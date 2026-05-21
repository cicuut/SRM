import unittest

from app.assessment_service import (
    count_assessments,
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
        self.assertIsNone(normalize_assessment_text("   "))

    def test_split_multiple_entries(self):
        parts = split_assessment_fragments("ISPA, hipertensi dan anemia")
        self.assertEqual(len(parts), 3)

    def test_count_merges_synonyms(self):
        raw = [
            "ISPA",
            "infeksi saluran pernapasan akut",
            "Hipertensi",
            "tekanan darah tinggi",
            "Hipertensi",
            "anemia",
        ]
        top, total = count_assessments(raw, top_n=5)
        labels = {item["assessment"] for item in top}
        self.assertIn("ISPA", labels)
        self.assertIn("Hipertensi", labels)
        ispa = next(item for item in top if item["assessment"] == "ISPA")
        self.assertEqual(ispa["count"], 2)
        self.assertEqual(total, 6)


if __name__ == "__main__":
    unittest.main()
