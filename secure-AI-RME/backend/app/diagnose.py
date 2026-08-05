from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func

from app.forecast_service import get_month_bounds
from app.models import (
    MedicalRecord,
    Patient,
    VisitFamilyPlanning,
    VisitGeneral,
    VisitMaster,
    VisitPregnancy,
    db,
)
from app.utils import decrypt_data

# empty values ignored during the normalization process
EMPTY_VALUES = frozenset(
    {
        "",
        "-",
        "--",
        "n/a",
        "na",
        "none",
        "null",
        "tidak ada keluhan",
        "tdk ada keluhan",
        "kosong",
        "normal",
        "sehat",
        "dalam batas normal",
        "dbn",
    }
)

# diagnosis synonim
CANONICAL_RULES: Tuple[Tuple[str, str], ...] = (
    (
        r"infeksi\s+saluran\s+(?:pernapasan|napas)\s+(?:atas|akut)|\bispa\b|\bismk\b",
        "ISPA",
    ),
    (
        r"hipertensi|tekanan\s+darah\s+tinggi|\btd\s+tinggi\b|\bhtn\b",
        "Hipertensi",
    ),
    (
        r"diabetes\s+mellitus|\bdiabetes\b|\bkencing\s+manis\b|\btdm\b|\bdm\b",
        "Diabetes Mellitus",
    ),
    (
        r"kehamilan\s+normal|hamil\s+sehat|kehamilan\s+fisiologis",
        "Kehamilan Normal",
    ),
    (r"anemia|kurang\s+darah|hb\s+rendah", "Anemia"),
    (r"gastritis|maag|dispepsia", "Gastritis"),
    (
        r"faringitis|radang\s+tenggorokan|tonsilitis|radang\s+amandel",
        "Faringitis",
    ),
    (r"demam\s+berdarah|\bdbd\b", "Demam Berdarah"),
    (r"diare|muntah|gastroenteritis", "Diare"),
    (r"asma|bronkitis|sesak\s+napas", "Asma / Bronkitis"),
    (r"infeksi\s+saluran\s+kemih|\bisk\b", "Infeksi Saluran Kemih"),
    (r"keputihan|servisitis|vaginitis|fluor\s+albus", "Keputihan / Infeksi Vagina"),
    (r"nyeri\s+haid|dismenore|mens\s+nyeri", "Nyeri Haid"),
    (r"spotting|perdarahan\s+tidak\s+normal|menorrhagia", "Perdarahan Tidak Normal"),
    (r"sakit\s+perut|nyeri\s+abdomen|nyeri\s+ulu\s*hati", "Nyeri Abdomen"),
    (r"migren|sakit\s+kepala|cephalgia", "Sakit Kepala"),
    (r"myalgia|nyeri\s+otot|pegal", "Nyeri Otot"),
    (r"dermatitis|eksim|gatal", "Dermatitis"),
    (r"pre\s*eklampsia|eklampsia", "Pre-Eklampsia"),
    (r"abortus|keguguran|ancaman\s+abortus", "Abortus / Ancaman Abortus"),
    (r"riwayat\s+operasi|post\s*op", "Pasca Operasi"),
)

# split the diagnosis fragments
FRAGMENT_SPLIT_PATTERN = re.compile(
    r"[,;\n\r]+|\s+dan\s+|\s+serta\s+|\s+&\s+",
    flags=re.IGNORECASE,
)

# parameter
FUZZY_MERGE_THRESHOLD = 0.85
GREEDY_CLUSTER_THRESHOLD = 0.80
DBSCAN_EPS = 0.40
DBSCAN_MIN_SAMPLES = 2


def decrypt(value) -> Optional[str]:
    if not value:
        return None

    try:
        decrypted = decrypt_data(value)
        return str(decrypted).strip() if decrypted else None
    except Exception:
        return str(value).strip() or None

# clean the text
def normalize_text(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None

    text = unicodedata.normalize("NFKC", str(raw))
    text = text.replace("\u00a0", " ")
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^[\-\*\•\d]+[\.\)\:]\s*", "", text)
    text = re.sub(r"[^\w\s\-/]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if not text or text in EMPTY_VALUES:
        return None

    return text

# split the text into fragments
def split_fragments(raw: Optional[str]) -> List[str]:
    normalized = normalize_text(raw)

    if not normalized:
        return []

    parts = [
        part.strip()
        for part in FRAGMENT_SPLIT_PATTERN.split(normalized)
        if part.strip()
    ]

    return parts or [normalized]

# apply the canonical rules
def apply_canonical_rules(normalized_text: str) -> Optional[str]:
    for pattern, label in CANONICAL_RULES:
        if re.search(pattern, normalized_text, flags=re.IGNORECASE):
            return label

    return None

# convert the normalized text to a display label
def to_display_label(normalized_text: str) -> str:
    words = normalized_text.split()
    result = []

    for word in words:
        if word.isupper() and len(word) <= 5:
            result.append(word)
        elif "/" in word:
            result.append("/".join(part.capitalize() for part in word.split("/")))
        else:
            result.append(word.capitalize())

    return " ".join(result)

# calculate the similarity using SequenceMatcher
def similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left, right).ratio()

# find bucket diagnosis that already exists
def find_fuzzy_bucket(
    candidate_key: str,
    bucket_labels: Dict[str, str],
) -> Optional[Tuple[str, str]]:
    for key, label in bucket_labels.items():
        if similarity(candidate_key, key) >= FUZZY_MERGE_THRESHOLD:
            return key, label

    return None

# similarity-based clustering using greedy
def cluster_fragments_greedy(fragments: List[str]) -> Dict[str, int]:
    cluster_ids: Dict[str, int] = {}
    clusters: List[List[str]] = []

    ordered = sorted(fragments, key=len)

    for fragment in ordered:
        assigned = False

        for index, members in enumerate(clusters):
            if any(
                similarity(fragment, member) >= GREEDY_CLUSTER_THRESHOLD
                for member in members
            ):
                members.append(fragment)
                cluster_ids[fragment] = index
                assigned = True
                break

        if not assigned:
            cluster_ids[fragment] = len(clusters)
            clusters.append([fragment])

    return cluster_ids

# groups similar diagnosis fragments using TF-IDF and DBSCAN
def cluster_fragments_tfidf(fragments: List[str]) -> Dict[str, int]:
    if len(fragments) < 2:
        return {fragment: 0 for fragment in fragments}

    try:
        from sklearn.cluster import DBSCAN
        from sklearn.feature_extraction.text import TfidfVectorizer
    except ImportError:
        return cluster_fragments_greedy(fragments)

    try:
        matrix = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 4),
            min_df=1,
        ).fit_transform(fragments)

        labels = DBSCAN(
            eps=DBSCAN_EPS,
            min_samples=DBSCAN_MIN_SAMPLES,
            metric="cosine",
        ).fit_predict(matrix)

        cluster_ids: Dict[str, int] = {}
        next_singleton_id = int(labels.max()) + 1 # to create unique id cluster

        for fragment, label in zip(fragments, labels):
            if label == -1:
                cluster_ids[fragment] = next_singleton_id
                next_singleton_id += 1
            else:
                cluster_ids[fragment] = int(label)

        return cluster_ids

    except Exception:
        return cluster_fragments_greedy(fragments)

# builds the hybrid diagnosis mapping pipeline
def build_hybrid_bucket_map(
    fragment_counts: Counter[str],
) -> Dict[str, Tuple[str, str, str]]:
    mapping: Dict[str, Tuple[str, str, str]] = {}
    bucket_labels: Dict[str, str] = {}
    unmapped: List[str] = []

    for fragment, _count in fragment_counts.most_common():
        rule_label = apply_canonical_rules(fragment)

        if rule_label:
            key = rule_label.lower()
            mapping[fragment] = (key, rule_label, "canonical")
            bucket_labels[key] = rule_label
        else:
            unmapped.append(fragment)

    if not unmapped:
        return mapping

    cluster_assignments = cluster_fragments_tfidf(unmapped)

    clusters: Dict[int, List[str]] = defaultdict(list)

    for fragment in unmapped:
        clusters[cluster_assignments[fragment]].append(fragment) # groups diagnoes based on dbscan result

    for members in clusters.values():
        representative = max(members, key=lambda item: fragment_counts[item])
        rule_label = apply_canonical_rules(representative)

        if rule_label:
            key, label, source = rule_label.lower(), rule_label, "canonical"
        else:
            label = to_display_label(representative)
            key = label.lower()
            source = "cluster" if len(members) > 1 else "singleton"

            fuzzy_match = find_fuzzy_bucket(key, bucket_labels)

            if fuzzy_match:
                key, label = fuzzy_match
                source = "fuzzy"
            else:
                bucket_labels[key] = label # create new label

        for member in members:
            member_rule = apply_canonical_rules(member)

            if member_rule:
                mapping[member] = (member_rule.lower(), member_rule, "canonical")
                bucket_labels[member_rule.lower()] = member_rule
            else:
                mapping[member] = (key, label, source)

    return mapping

# counts diagnosis frequencies
def count_diagnoses(
    raw_notes: List[str],
    *,
    top_n: int = 5,
) -> Tuple[List[dict], int]:
    fragment_counts: Counter[str] = Counter()

    for raw in raw_notes:
        for fragment in split_fragments(raw):
            fragment_counts[fragment] += 1

    total_fragments = sum(fragment_counts.values())

    if total_fragments == 0:
        return [], 0

    hybrid_map = build_hybrid_bucket_map(fragment_counts)

    bucket_counts: Counter[str] = Counter()
    bucket_labels: Dict[str, str] = {}
    bucket_variants: Dict[str, set[str]] = defaultdict(set)
    bucket_sources: Dict[str, set[str]] = defaultdict(set)

    for fragment, count in fragment_counts.items():
        key, label, source = hybrid_map.get(
            fragment,
            (fragment, to_display_label(fragment), "singleton"),
        )
        bucket_counts[key] += count
        bucket_labels[key] = label
        bucket_variants[key].add(fragment)
        bucket_sources[key].add(source)

    ranked = bucket_counts.most_common(top_n)
    top_items = []
    grand_total = sum(bucket_counts.values()) or 1

    for rank, (key, count) in enumerate(ranked, start=1):
        label = bucket_labels[key]

        top_items.append(
            {
                "rank": rank,
                "diagnosis": label,
                "count": count,
                "percentage": round((count / grand_total) * 100, 1),
                "variants": sorted(bucket_variants[key])[:5],
                "source": sorted(bucket_sources[key])[0],
            }
        )

    return top_items, total_fragments

# retrieve diagnosis data
def base_query(visit_model, field_column):
    return (
        db.session.query(VisitMaster.visit_id, field_column)
        .join(VisitMaster, visit_model.visit_id == VisitMaster.visit_id)
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
    )

# Filter the query to records belonging to the specified clinic
def apply_clinic_scope(query, clinic_id):
    if clinic_id is None:
        raise ValueError("clinic_id is required for diagnosis queries")

    return query.filter(
        Patient.clinic_id == clinic_id,
        MedicalRecord.clinic_id == clinic_id,
    )

# filters records based on the monthly date range.
def apply_month_filter(query, month_start: date, month_end: date):
    return query.filter(
        func.date(VisitMaster.visit_date) >= month_start,
        func.date(VisitMaster.visit_date) <= month_end,
    )

# collects monthly diagnoses
def collect_monthly_diagnoses(
    clinic_id,
    month_start: Optional[date] = None,
    month_end: Optional[date] = None,
) -> Tuple[List[str], int]:
    if clinic_id is None:
        raise ValueError("clinic_id is required for diagnosis collection")

    if month_start is None or month_end is None:
        month_start, month_end = get_month_bounds()

    notes: List[str] = []
    visit_ids: set = set()
    
    # get subjective for pregnancy and general
    for visit_model in (VisitPregnancy, VisitGeneral):
        field_column = visit_model.subjective
        
        query = base_query(visit_model, field_column)
        query = apply_clinic_scope(query, clinic_id)
        query = apply_month_filter(query, month_start, month_end)

        rows = query.all()

        for visit_id, encrypted_value in rows:
            decrypted = decrypt(encrypted_value)

            if decrypted:
                visit_ids.add(visit_id)
                notes.append(decrypted)

    # get complaint for family planning
    kb_query = (
        db.session.query(VisitMaster.visit_id, VisitFamilyPlanning.complaint)
        .join(
            VisitFamilyPlanning,
            VisitMaster.visit_id == VisitFamilyPlanning.visit_id,
        )
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
    )

    kb_query = apply_clinic_scope(kb_query, clinic_id)
    kb_query = apply_month_filter(kb_query, month_start, month_end)

    kb_rows = kb_query.all()

    for visit_id, encrypted_complaint in kb_rows:
        decrypted = decrypt(encrypted_complaint)

        if decrypted:
            visit_ids.add(visit_id)
            notes.append(decrypted)

    return notes, len(visit_ids)

# function used to generate the monthly Top-5 diagnosis report
def get_top_diagnoses_payload(
    clinic_id,
    reference: Optional[date] = None,
    *,
    top_n: int = 5,
) -> dict:
    if clinic_id is None:
        raise ValueError("clinic_id is required for top diagnoses payload")

    month_start, month_end = get_month_bounds(reference)
    month_label = month_start.strftime("%Y-%m")

    raw_notes, visit_count = collect_monthly_diagnoses(
        clinic_id,
        month_start=month_start,
        month_end=month_end,
    )

    top_items, total_fragments = count_diagnoses(raw_notes, top_n=top_n)

    return {
        "month": month_label,
        "clinic_id": str(clinic_id),
        "grouping_method": "hybrid",
        "total_visits_with_diagnoses": visit_count,
        "total_diagnoses_fragments": total_fragments,
        "top_diagnoses": top_items,
        "summary": (
            f"{visit_count} kunjungan · {total_fragments} entri"
            if visit_count
            else "Belum ada diagnosa pada kunjungan bulan ini."
        ),
    }