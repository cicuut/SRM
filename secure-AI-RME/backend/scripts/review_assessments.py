"""
Review raw vs normalized assessment data.

Usage (from backend/):
  python scripts/review_assessments.py
  python scripts/review_assessments.py --limit 50
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.assessment_service import (
    collect_monthly_assessments,
    count_assessments,
    normalize_assessment_text,
    split_assessment_fragments,
    apply_canonical_rules,
)
from app.models import User


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=30, help="Rows to preview")
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        clinic_id = User.query.filter(User.clinic_id.isnot(None)).first()
        if not clinic_id:
            print("No clinic user found.")
            return

        raw_rows, visit_count = collect_monthly_assessments(clinic_id.clinic_id)
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

        top, total = count_assessments(raw_rows, top_n=10)
        print("--- Top assessments ---")
        for item in top:
            print(
                f"#{item['rank']} {item['assessment']}: {item['count']} "
                f"({item['percentage']}%) variants={item.get('variants')}"
            )
        print(f"\nTotal fragments counted: {total}")


if __name__ == "__main__":
    main()
