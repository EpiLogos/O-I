"""Adversarial parser checks, not substitutes for the actual ACP candidate proof."""
import unittest
from trusted_apply import checked_function


class RestrictedArithmetic(unittest.TestCase):
    def test_rejects_effectful_or_unbounded_constructs_before_compilation(self):
        for source in [
            "import os\ndef inclusive_total(prices, tax_rate):\n    return 0\n",
            "def inclusive_total(prices, tax_rate):\n    return __import__('os').system('touch forbidden')\n",
            "def inclusive_total(prices, tax_rate):\n    return prices * 1000000\n",
            "def inclusive_total(prices, tax_rate):\n    return sum(x for x in prices)\n",
            "@print\ndef inclusive_total(prices, tax_rate):\n    return 0\n",
            "def inclusive_total(prices, tax_rate):\n    while True: pass\n",
            "def inclusive_total(prices, tax_rate):\n    return 10 ** 1000000\n",
        ]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                checked_function(source)

    def test_original_commissioned_defect_really_fails(self):
        original = checked_function("def inclusive_total(prices, tax_rate):\n    return sum(prices) + tax_rate\n")
        self.assertNotAlmostEqual(original([10, 20], 0.2), 36)


if __name__ == "__main__":
    unittest.main()
