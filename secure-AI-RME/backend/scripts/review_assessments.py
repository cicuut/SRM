"""
Debug script: bandingkan teks mentah vs hasil normalisasi hibrida.

Berguna saat menambah aturan di CANONICAL_ASSESSMENT_RULES
atau menyesuaikan ambang clustering (DBSCAN_EPS, dll.).

Usage dari folder backend/:
  python scripts/review_assessments.py
  python scripts/review_assessments.py --limit 50
  python scripts/review_assessments.py --all-clinics
  python scripts/review_assessments.py --email bidan@example.com
  python scripts/review_assessments.py --clinic-id <clinic_id>
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.assessment_service import (
    build_hybrid_bucket_map,
    collect_monthly_assessments,
    count_diagnoses,
    normalize_assessment_text,
    split_assessment_fragments,
    apply_canonical_rules,
)
from app.models import User


def normalize_clinic_id(value):
    normalized = str(value or "").strip().lower()

    if not normalized:
        return None

    if normalized in {"null", "none", "undefined"}:
        return None

    return str(value)


def get_target_clinic_id(email=None, clinic_id=None):
    if clinic_id:
        return normalize_clinic_id(clinic_id)

    if email:
        user = User.query.filter(User.email == email).first()

        if not user:
            print(f"User dengan email {email!r} tidak ditemukan.")
            return None

        if not user.clinic_id:
            print(f"User {email!r} belum memiliki clinic_id.")
            return None

        return normalize_clinic_id(user.clinic_id)

    user = (
        User.query
        .filter(User.clinic_id.isnot(None))
        .order_by(User.created_at.desc())
        .first()
    )

    if not user:
        print("Tidak ada user yang memiliki clinic_id.")
        return None

    return normalize_clinic_id(user.clinic_id)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--limit",
        type=int,
        default=30,
        help="Jumlah rows yang ditampilkan untuk preview.",
    )
    parser.add_argument(
        "--clinic-id",
        type=str,
        default="",
        help="Clinic ID spesifik yang ingin dicek.",
    )
    parser.add_argument(
        "--email",
        type=str,
        default="",
        help="Email user untuk mengambil clinic_id miliknya.",
    )
    parser.add_argument(
        "--all-clinics",
        action="store_true",
        help="Tampilkan assessment dari semua klinik. Cocok untuk mode admin/developer.",
    )

    args = parser.parse_args()

    app = create_app()

    with app.app_context():
        clinic_id = None

        if not args.all_clinics:
            clinic_id = get_target_clinic_id(
                email=args.email.strip() or None,
                clinic_id=args.clinic_id.strip() or None,
            )

            if not clinic_id:
                return

        raw_rows, visit_count = collect_monthly_assessments(
            clinic_id=clinic_id,
            include_all_clinics=args.all_clinics,
        )

        if args.all_clinics:
            print("Mode: semua klinik")
        else:
            print(f"Mode: clinic_id={clinic_id}")

        print(f"Visits with assessment/keluhan this month: {visit_count}\n")
        print(f"Text entries collected: {len(raw_rows)}\n")
        print("--- Raw → normalized → canonical ---")

        for raw in raw_rows[: args.limit]:
            for fragment in split_assessment_fragments(raw):
                normalized = normalize_assessment_text(fragment)
                canonical = apply_canonical_rules(normalized) if normalized else None

                print(f"RAW: {raw[:80]!r}")
                print(f"  fragment: {fragment!r}")
                print(f"  normalized: {normalized!r}")
                print(f"  canonical: {canonical!r}")
                print()

        top, total = count_diagnoses(raw_rows, top_n=10)

        print("--- Top diagnoses hybrid ---")

        if not top:
            print("Belum ada assessment atau keluhan pada kunjungan bulan ini.")
        else:
            for item in top:
                print(
                    f"#{item['rank']} {item['diagnosis']}: {item['count']} "
                    f"({item['percentage']}%) source={item.get('source')} "
                    f"variants={item.get('variants')}"
                )

        fragment_counts = Counter()

        for raw in raw_rows:
            for fragment in split_assessment_fragments(raw):
                fragment_counts[fragment] += 1

        print("\n--- Hybrid mapping sample ---")

        mapping = build_hybrid_bucket_map(fragment_counts)

        if not mapping:
            print("Tidak ada mapping karena belum ada data assessment.")
        else:
            for fragment, (_key, label, source) in list(mapping.items())[:15]:
                print(f"  {fragment!r} -> {label!r} ({source})")

        print(f"\nTotal fragments counted: {total}")


if __name__ == "__main__":
    main()