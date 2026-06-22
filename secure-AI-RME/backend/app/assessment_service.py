from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_, func

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


EMPTY_ASSESSMENT_VALUES = frozenset(
    {
        "",
        "-",
        "--",
        "n/a",
        "na",
        "none",
        "null",
        "tidak ada",
        "tdk ada",
        "kosong",
        "normal",
        "sehat",
        "dalam batas normal",
        "dbn",
        "within normal limits",
        "wnl",
    }
)

CANONICAL_ASSESSMENT_RULES: Tuple[Tuple[str, str], ...] = (
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

FRAGMENT_SPLIT_PATTERN = re.compile(
    r"[,;\n\r]+|\s+dan\s+|\s+serta\s+|\s+&\s+",
    flags=re.IGNORECASE,
)

FUZZY_MERGE_THRESHOLD = 0.88
GREEDY_CLUSTER_THRESHOLD = 0.82
DBSCAN_EPS = 0.42
DBSCAN_MIN_SAMPLES = 2


def normalize_role(role) -> str:
    normalized = str(role or "").strip().lower()

    role_aliases = {
        "admin": "admin",
        "developer": "admin",
        "midwife": "midwife",
        "bidan": "midwife",
        "owner": "midwife",
        "asisten": "asisten",
        "assistant": "asisten",
        "staff": "asisten",
    }

    return role_aliases.get(normalized, normalized)


def normalize_clinic_id(clinic_id) -> Optional[str]:
    normalized = str(clinic_id or "").strip().lower()

    if not normalized:
        return None

    if normalized in {"null", "none", "undefined"}:
        return None

    return str(clinic_id)


def _safe_decrypt(value) -> Optional[str]:
    if not value:
        return None

    try:
        decrypted = decrypt_data(value)
        return str(decrypted).strip() if decrypted else None
    except Exception:
        return str(value).strip() or None


def normalize_assessment_text(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None

    text = unicodedata.normalize("NFKC", str(raw))
    text = text.replace("\u00a0", " ")
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^[\-\*\•\d]+[\.\)\:]\s*", "", text)
    text = re.sub(r"[^\w\s\-/]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if not text or text in EMPTY_ASSESSMENT_VALUES:
        return None

    return text


def split_assessment_fragments(raw: Optional[str]) -> List[str]:
    normalized = normalize_assessment_text(raw)

    if not normalized:
        return []

    parts = [
        part.strip()
        for part in FRAGMENT_SPLIT_PATTERN.split(normalized)
        if part.strip()
    ]

    return parts or [normalized]


def apply_canonical_rules(normalized_text: str) -> Optional[str]:
    for pattern, label in CANONICAL_ASSESSMENT_RULES:
        if re.search(pattern, normalized_text, flags=re.IGNORECASE):
            return label

    return None


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


def _similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, left, right).ratio()


def _find_fuzzy_bucket(
    candidate_key: str,
    bucket_labels: Dict[str, str],
) -> Optional[Tuple[str, str]]:
    for key, label in bucket_labels.items():
        if _similarity(candidate_key, key) >= FUZZY_MERGE_THRESHOLD:
            return key, label

    return None


def _cluster_fragments_greedy(fragments: List[str]) -> Dict[str, int]:
    cluster_ids: Dict[str, int] = {}
    clusters: List[List[str]] = []

    ordered = sorted(fragments, key=len)

    for fragment in ordered:
        assigned = False

        for index, members in enumerate(clusters):
            if any(
                _similarity(fragment, member) >= GREEDY_CLUSTER_THRESHOLD
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


def _cluster_fragments_tfidf(fragments: List[str]) -> Dict[str, int]:
    if len(fragments) < 2:
        return {fragment: 0 for fragment in fragments}

    try:
        from sklearn.cluster import DBSCAN
        from sklearn.feature_extraction.text import TfidfVectorizer
    except ImportError:
        return _cluster_fragments_greedy(fragments)

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
        next_singleton_id = int(labels.max()) + 1

        for fragment, label in zip(fragments, labels):
            if label == -1:
                cluster_ids[fragment] = next_singleton_id
                next_singleton_id += 1
            else:
                cluster_ids[fragment] = int(label)

        return cluster_ids

    except Exception:
        return _cluster_fragments_greedy(fragments)


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

    cluster_assignments = _cluster_fragments_tfidf(unmapped)

    clusters: Dict[int, List[str]] = defaultdict(list)

    for fragment in unmapped:
        clusters[cluster_assignments[fragment]].append(fragment)

    for members in clusters.values():
        representative = max(members, key=lambda item: fragment_counts[item])
        rule_label = apply_canonical_rules(representative)

        if rule_label:
            key, label, source = rule_label.lower(), rule_label, "canonical"
        else:
            label = to_display_label(representative)
            key = label.lower()
            source = "cluster" if len(members) > 1 else "singleton"

            fuzzy_match = _find_fuzzy_bucket(key, bucket_labels)

            if fuzzy_match:
                key, label = fuzzy_match
                source = "fuzzy"
            else:
                bucket_labels[key] = label

        for member in members:
            member_rule = apply_canonical_rules(member)

            if member_rule:
                mapping[member] = (member_rule.lower(), member_rule, "canonical")
                bucket_labels[member_rule.lower()] = member_rule
            else:
                mapping[member] = (key, label, source)

    return mapping


def count_diagnoses(
    raw_notes: List[str],
    *,
    top_n: int = 5,
) -> Tuple[List[dict], int]:
    fragment_counts: Counter[str] = Counter()

    for raw in raw_notes:
        for fragment in split_assessment_fragments(raw):
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
                "assessment": label,
                "count": count,
                "percentage": round((count / grand_total) * 100, 1),
                "variants": sorted(bucket_variants[key])[:5],
                "source": sorted(bucket_sources[key])[0],
            }
        )

    return top_items, total_fragments


def _base_assessment_query(visit_model, field_column):
    return (
        db.session.query(VisitMaster.visit_id, field_column)
        .join(VisitMaster, visit_model.visit_id == VisitMaster.visit_id)
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
    )


def _apply_month_filter(query, month_start: date, month_end: date):
    return query.filter(
        func.date(VisitMaster.visit_date) >= month_start,
        func.date(VisitMaster.visit_date) <= month_end,
    )


def _apply_clinic_filter(query, clinic_id: Optional[str], include_all_clinics: bool):
    if include_all_clinics:
        return query

    if clinic_id:
        return query.filter(Patient.clinic_id == clinic_id)

    return query.filter(False)


def collect_monthly_assessments(
    clinic_id: Optional[UUID] = None,
    month_start: Optional[date] = None,
    month_end: Optional[date] = None,
    *,
    include_all_clinics: bool = False,
) -> Tuple[List[str], int]:
    if month_start is None or month_end is None:
        month_start, month_end = get_month_bounds()

    normalized_clinic_id = normalize_clinic_id(clinic_id)

    notes: List[str] = []
    visit_ids: set = set()

    for visit_model in (VisitPregnancy, VisitGeneral):
        field_column = visit_model.assessment

        query = _base_assessment_query(visit_model, field_column)
        query = _apply_month_filter(query, month_start, month_end)
        query = _apply_clinic_filter(
            query,
            normalized_clinic_id,
            include_all_clinics,
        )

        rows = query.all()

        for visit_id, encrypted_value in rows:
            decrypted = _safe_decrypt(encrypted_value)

            if decrypted:
                visit_ids.add(visit_id)
                notes.append(decrypted)

    kb_query = (
        db.session.query(VisitMaster.visit_id, VisitFamilyPlanning.complaint)
        .join(
            VisitFamilyPlanning,
            VisitMaster.visit_id == VisitFamilyPlanning.visit_id,
        )
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
    )

    kb_query = _apply_month_filter(kb_query, month_start, month_end)
    kb_query = _apply_clinic_filter(
        kb_query,
        normalized_clinic_id,
        include_all_clinics,
    )

    kb_rows = kb_query.all()

    for visit_id, encrypted_complaint in kb_rows:
        decrypted = _safe_decrypt(encrypted_complaint)

        if decrypted:
            visit_ids.add(visit_id)
            notes.append(decrypted)

    return notes, len(visit_ids)


def get_top_diagnoses_payload(
    clinic_id: Optional[UUID] = None,
    reference: Optional[date] = None,
    *,
    top_n: int = 5,
    include_all_clinics: bool = False,
    current_user=None,
    current_role: Optional[str] = None,
) -> dict:
    role = normalize_role(current_role)

    if current_user is not None:
        user_role = normalize_role(getattr(current_user, "user_role", None))
        role = role or user_role

        if not clinic_id:
            clinic_id = getattr(current_user, "clinic_id", None)

    should_include_all_clinics = include_all_clinics or role == "admin"

    month_start, month_end = get_month_bounds(reference)
    month_label = month_start.strftime("%Y-%m")

    raw_notes, visit_count = collect_monthly_assessments(
        clinic_id=clinic_id,
        month_start=month_start,
        month_end=month_end,
        include_all_clinics=should_include_all_clinics,
    )

    top_items, total_fragments = count_diagnoses(raw_notes, top_n=top_n)

    return {
        "month": month_label,
        "grouping_method": "hybrid",
        "total_visits_with_assessment": visit_count,
        "total_assessment_fragments": total_fragments,
        "top_diagnoses": top_items,
        "top_assessments": top_items,
        "summary": (
            f"{visit_count} kunjungan · {total_fragments} entri"
            if visit_count
            else "Belum ada assessment atau keluhan pada kunjungan bulan ini."
        ),
    }