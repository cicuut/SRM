from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import and_

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

# Values treated as empty after cleaning.
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

# (regex pattern, canonical display label) — longest / most specific rules first.
CANONICAL_ASSESSMENT_RULES: Tuple[Tuple[str, str], ...] = (
    (
        r"infeksi\s+saluran\s+(?:pernapasan|napas)\s+(?:atas|akut)|\bispa\b|\bismk\b",
        "ISPA",
    ),
    (r"hipertensi|tekanan\s+darah\s+tinggi|\btd\s+tinggi\b|\bhtn\b", "Hipertensi"),
    (
        r"diabetes\s+mellitus|\bdiabetes\b|\bkencing\s+manis\b|\btdm\b|\bdm\b",
        "Diabetes Mellitus",
    ),
    (r"kehamilan\s+normal|hamil\s+sehat|kehamilan\s+fisiologis", "Kehamilan Normal"),
    (r"anemia|kurang\s+darah|hb\s+rendah", "Anemia"),
    (r"gastritis|maag|dispepsia", "Gastritis"),
    (r"faringitis|radang\s+tenggorokan|tonsilitis|radang\s+amandel", "Faringitis"),
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

SIMILARITY_MERGE_THRESHOLD = 0.88


def _safe_decrypt(value) -> Optional[str]:
    if not value:
        return None
    try:
        return decrypt_data(value)
    except Exception:
        return str(value).strip() or None


def normalize_assessment_text(raw: Optional[str]) -> Optional[str]:
    """
    Normalize free-text assessment for consistent grouping.

    Steps: unicode normalize, lowercase, collapse whitespace, strip punctuation
    noise, remove empty placeholders.
    """
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
    """Split one assessment field into separate diagnosa fragments."""
    normalized = normalize_assessment_text(raw)
    if not normalized:
        return []

    parts = [part.strip() for part in FRAGMENT_SPLIT_PATTERN.split(normalized) if part.strip()]
    return parts or [normalized]


def apply_canonical_rules(normalized_text: str) -> Optional[str]:
    """Map normalized text to a canonical label using medical synonym rules."""
    for pattern, label in CANONICAL_ASSESSMENT_RULES:
        if re.search(pattern, normalized_text, flags=re.IGNORECASE):
            return label
    return None


def to_display_label(normalized_text: str) -> str:
    """Fallback label when no canonical rule matches."""
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


def resolve_canonical_label(
    normalized_fragment: str,
    known_keys: Dict[str, str],
) -> Tuple[str, str]:
    """
    Return (bucket_key, display_label) for a normalized fragment.
    Merges near-duplicates via fuzzy match against keys already seen.
    """
    rule_label = apply_canonical_rules(normalized_fragment)
    if rule_label:
        key = rule_label.lower()
        return key, rule_label

    for key, label in known_keys.items():
        if _similarity(normalized_fragment, key) >= SIMILARITY_MERGE_THRESHOLD:
            return key, label

    display = to_display_label(normalized_fragment)
    return normalized_fragment, display


def count_assessments(
    raw_assessments: List[str],
    *,
    top_n: int = 5,
) -> Tuple[List[dict], int]:
    """
    Normalize and count assessment fragments.

    Returns (top_items, total_fragments_counted).
    """
    bucket_counts: Counter[str] = Counter()
    bucket_labels: Dict[str, str] = {}
    bucket_variants: Dict[str, set[str]] = defaultdict(set)

    total_fragments = 0

    for raw in raw_assessments:
        for fragment in split_assessment_fragments(raw):
            total_fragments += 1
            key, label = resolve_canonical_label(fragment, bucket_labels)
            bucket_counts[key] += 1
            bucket_labels[key] = label
            bucket_variants[key].add(fragment)

    ranked = bucket_counts.most_common(top_n)
    top_items = []
    grand_total = sum(bucket_counts.values()) or 1

    for rank, (key, count) in enumerate(ranked, start=1):
        top_items.append(
            {
                "rank": rank,
                "assessment": bucket_labels[key],
                "count": count,
                "percentage": round((count / grand_total) * 100, 1),
                "variants": sorted(bucket_variants[key])[:5],
            }
        )

    return top_items, total_fragments


def collect_monthly_assessments(
    clinic_id: UUID,
    month_start: Optional[date] = None,
    month_end: Optional[date] = None,
) -> Tuple[List[str], int]:
    """
    Load decrypted clinical text for the current clinic and month.

    Sources:
    - pregnancy_visit.assessment
    - general_visit.assessment
    - kb_visit.complaint (keluhan)
    """
    if month_start is None or month_end is None:
        month_start, month_end = get_month_bounds()

    date_filter = and_(
        VisitMaster.visit_date >= month_start,
        VisitMaster.visit_date <= month_end,
    )

    clinic_filter = Patient.clinic_id == clinic_id
    notes: List[str] = []
    visit_ids: set = set()

    for visit_model in (VisitPregnancy, VisitGeneral):
        rows = (
            db.session.query(VisitMaster.visit_id, visit_model.assessment)
            .join(VisitMaster, visit_model.visit_id == VisitMaster.visit_id)
            .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
            .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
            .filter(clinic_filter, date_filter)
            .all()
        )
        for visit_id, encrypted_value in rows:
            decrypted = _safe_decrypt(encrypted_value)
            if decrypted:
                visit_ids.add(visit_id)
                notes.append(decrypted)

    kb_rows = (
        db.session.query(VisitMaster.visit_id, VisitFamilyPlanning.complaint)
        .join(
            VisitFamilyPlanning,
            VisitMaster.visit_id == VisitFamilyPlanning.visit_id,
        )
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .filter(clinic_filter, date_filter)
        .all()
    )
    for visit_id, encrypted_complaint in kb_rows:
        decrypted = _safe_decrypt(encrypted_complaint)
        if decrypted:
            visit_ids.add(visit_id)
            notes.append(decrypted)

    return notes, len(visit_ids)


def get_top_assessments_payload(
    clinic_id: UUID,
    reference: Optional[date] = None,
    *,
    top_n: int = 5,
) -> dict:
    month_start, month_end = get_month_bounds(reference)
    month_label = month_start.strftime("%Y-%m")
    raw_notes, visit_count = collect_monthly_assessments(
        clinic_id, month_start, month_end
    )
    top_items, total_fragments = count_assessments(raw_notes, top_n=top_n)

    return {
        "month": month_label,
        "total_visits_with_assessment": visit_count,
        "total_assessment_fragments": total_fragments,
        "top_assessments": top_items,
        "summary": (
            f"{visit_count} kunjungan memiliki assessment/keluhan; "
            f"{total_fragments} entri dinormalisasi."
            if visit_count
            else "Belum ada assessment atau keluhan pada kunjungan bulan ini."
        ),
    }
