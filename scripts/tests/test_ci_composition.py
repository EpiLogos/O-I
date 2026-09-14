import ast
import json
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = {
    "central",
    "actuation",
    "ai-kit",
    "software-factory",
    "workcell",
    "quaternal-logic",
}


class CiCompositionTests(unittest.TestCase):
    def test_current_source_verifier_uses_owner_lifecycle_contract(self):
        path = ROOT / "scripts" / "verify-current-main-source.py"
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source)
        names = {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}
        self.assertIn("LIFECYCLE_PATH", names)
        self.assertNotIn("RELEASE_MANIFEST", names)
        self.assertIn('.oi/product.json', source)
        self.assertNotIn('suite/manifest.json")\n    products =', source)

    def test_weekly_current_source_matrix_contains_all_six_native_owners(self):
        workflow = yaml.safe_load(
            (ROOT / ".github" / "workflows" / "cross-product.yml").read_text(encoding="utf-8")
        )
        matrix = workflow["jobs"]["current-main-source"]["strategy"]["matrix"]
        self.assertEqual(set(matrix["product"]), EXPECTED)

    def test_mainline_snapshot_has_no_parallel_native_owner_exception(self):
        snapshot = json.loads((ROOT / "suite" / "mainline.json").read_text(encoding="utf-8"))
        products = snapshot["products"]
        self.assertEqual({product["id"] for product in products}, EXPECTED)
        self.assertNotIn(
            "parallel-native-owner-exception",
            {product["state"] for product in products},
        )


if __name__ == "__main__":
    unittest.main()
