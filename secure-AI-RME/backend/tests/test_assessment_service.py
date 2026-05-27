"""
Unit test untuk normalisasi & perhitungan Top Diagnosa hibrida.

Jalankan dari folder backend/:
  python -m unittest tests.test_assessment_service -v
"""

import unittest
from collections import Counter

from app.assessment_service import (
    build_hybrid_bucket_map,
    count_diagnoses,
    normalize_assessment_text,
    split_assessment_fragments,
    apply_canonical_rules,
)


class AssessmentNormalizationTests(unittest.TestCase):
    def test_normalize_strips_noise(self):
        self.assertEqual(
            normalize_assessment_text("  ISPA / Infeksi Saluran Napas  "),
            "ispa / infeksi saluran napas",
        )

        self.assertIsNone(normalize_assessment_text("-"))
        self.assertIsNone(normalize_assessment_text("tidak ada"))
        self.assertIsNone(normalize_assessment_text("normal"))

    def test_split_multiple_entries(self):
        parts = split_assessment_fragments("ISPA, hipertensi dan anemia")

        self.assertEqual(parts, ["ispa", "hipertensi", "anemia"])

    def test_canonical_rules(self):
        self.assertEqual(apply_canonical_rules("ispa"), "ISPA")
        self.assertEqual(
            apply_canonical_rules("infeksi saluran pernapasan akut"),
            "ISPA",
        )
        self.assertEqual(
            apply_canonical_rules("tekanan darah tinggi"),
            "Hipertensi",
        )
        self.assertEqual(
            apply_canonical_rules("kencing manis"),
            "Diabetes Mellitus",
        )

    def test_hybrid_merges_canonical_synonyms(self):
        raw = [
            "ISPA",
            "infeksi saluran pernapasan akut",
            "Hipertensi",
            "tekanan darah tinggi",
            "anemia",
        ]

        top, total = count_diagnoses(raw, top_n=5)

        labels = {item["diagnosis"] for item in top}

        self.assertIn("ISPA", labels)
        self.assertIn("Hipertensi", labels)
        self.assertIn("Anemia", labels)

        ispa = next(item for item in top if item["diagnosis"] == "ISPA")
        hipertensi = next(
            item for item in top if item["diagnosis"] == "Hipertensi"
        )

        self.assertEqual(ispa["count"], 2)
        self.assertEqual(ispa["source"], "canonical")

        self.assertEqual(hipertensi["count"], 2)
        self.assertEqual(hipertensi["source"], "canonical")

        self.assertEqual(total, 5)

    def test_hybrid_clusters_similar_unmapped_text(self):
        fragments = Counter(
            {
                "batuk berdahak": 3,
                "batuk ber dahak": 2,
                "nyeri sendi": 1,
            }
        )

        mapping = build_hybrid_bucket_map(fragments)

        cough_keys = {
            mapping["batuk berdahak"][0],
            mapping["batuk ber dahak"][0],
        }

        self.assertEqual(len(cough_keys), 1)
        self.assertNotEqual(
            mapping["nyeri sendi"][0],
            mapping["batuk berdahak"][0],
        )

    def test_empty_raw_notes_returns_empty_result(self):
        top, total = count_diagnoses(["-", "normal", "", "tidak ada"], top_n=5)

        self.assertEqual(top, [])
        self.assertEqual(total, 0)


if __name__ == "__main__":
    unittest.main()