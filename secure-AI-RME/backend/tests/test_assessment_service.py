"""
Unit test untuk normalisasi & perhitungan Top Diagnosa (hibrida).

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
)


class AssessmentNormalizationTests(unittest.TestCase):
    def test_normalize_strips_noise(self):
        self.assertEqual(
            normalize_assessment_text("  ISPA / Infeksi Saluran Napas  "),
            "ispa / infeksi saluran napas",
        )
        self.assertIsNone(normalize_assessment_text("-"))

    def test_split_multiple_entries(self):
        """Satu field dengan koma/dan harus jadi beberapa fragmen terpisah."""
        parts = split_assessment_fragments("ISPA, hipertensi dan anemia")
        self.assertEqual(len(parts), 3)

    def test_hybrid_merges_canonical_synonyms(self):
        """Tahap 1: sinonim ISPA & hipertensi harus satu bucket (source: canonical)."""
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
        ispa = next(item for item in top if item["diagnosis"] == "ISPA")
        self.assertEqual(ispa["count"], 2)
        self.assertEqual(ispa["source"], "canonical")
        self.assertEqual(total, 5)

    def test_hybrid_clusters_similar_unmapped_text(self):
        """Tahap 2: teks mirip tanpa aturan regex harus masuk cluster yang sama."""
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
        self.assertNotEqual(mapping["nyeri sendi"][0], mapping["batuk berdahak"][0])


if __name__ == "__main__":
    unittest.main()
