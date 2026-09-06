"""Fixed commissioned apply/check program. This is not a general Python sandbox."""
import argparse
import ast
import hashlib
import json
import math
import os
from pathlib import Path
import signal
import tempfile


def deadline(_signum, _frame):
    raise TimeoutError("trusted apply/check exceeded its five-second deadline")


signal.signal(signal.SIGALRM, deadline)
signal.alarm(5)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_regular(path, maximum=16384):
    if path.is_symlink() or not path.is_file():
        raise ValueError("input must be a regular non-symlink file")
    with path.open("rb") as stream:
        data = stream.read(maximum + 1)
    if len(data) > maximum:
        raise ValueError("input exceeds the 16 KiB bound")
    return data


def checked_function(source):
    tree = ast.parse(source, filename="pricing.py", mode="exec")
    if len(list(ast.walk(tree))) > 96:
        raise ValueError("candidate AST exceeds bounded arithmetic grammar")
    if len(tree.body) != 1 or not isinstance(tree.body[0], ast.FunctionDef):
        raise ValueError("exactly one function is permitted")
    function = tree.body[0]
    arguments = function.args
    if (function.name != "inclusive_total" or function.decorator_list
            or function.returns is not None or function.type_comment is not None
            or getattr(function, "type_params", [])
            or arguments.posonlyargs or arguments.vararg or arguments.kwarg
            or arguments.kwonlyargs or arguments.defaults or arguments.kw_defaults
            or [arg.arg for arg in arguments.args] != ["prices", "tax_rate"]
            or any(arg.annotation is not None or arg.type_comment is not None for arg in arguments.args)
            or len(function.body) != 1 or not isinstance(function.body[0], ast.Return)):
        raise ValueError("require undecorated inclusive_total(prices, tax_rate) with one return")

    def expression(node, depth=0):
        if depth > 12:
            raise ValueError("expression exceeds depth limit")
        if isinstance(node, ast.Name) and node.id == "tax_rate":
            return
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            if math.isfinite(node.value) and abs(node.value) <= 1000000:
                return
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
            expression(node.left, depth + 1)
            expression(node.right, depth + 1)
            return
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            expression(node.operand, depth + 1)
            return
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and not node.keywords:
            if node.func.id == "sum" and len(node.args) == 1 and isinstance(node.args[0], ast.Name) and node.args[0].id == "prices":
                return
            if node.func.id == "round" and 1 <= len(node.args) <= 2:
                expression(node.args[0], depth + 1)
                if len(node.args) == 2 and not (isinstance(node.args[1], ast.Constant) and type(node.args[1].value) is int and 0 <= node.args[1].value <= 6):
                    raise ValueError("round precision must be a literal from zero to six")
                return
        raise ValueError("candidate contains syntax outside the commissioned arithmetic grammar")

    expression(function.body[0].value)
    namespace = {"__builtins__": {"sum": sum, "round": round}}
    exec(compile(tree, "pricing.py", "exec"), namespace)
    return namespace["inclusive_total"]


CASES = [([10, 20], 0.2, 36), ([], 0, 0), ([5], 0, 5),
         ([12.5, 7.5], 0.1, 22), ([100], -0.1, 90)]


def exercise(function):
    rows = []
    for prices, tax_rate, expected in CASES:
        actual = function(prices[:], tax_rate)
        passed = type(actual) in (int, float) and math.isfinite(actual) and math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-10)
        rows.append({"prices": prices, "tax_rate": tax_rate, "expected": expected,
                     "actual": actual, "passed": passed})
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture-root", required=True)
    parser.add_argument("--candidate-json", required=True)
    parser.add_argument("--fixture-sha256", required=True)
    parser.add_argument("--candidate-sha256", required=True)
    args = parser.parse_args()
    root = Path(args.fixture_root)
    if not root.is_absolute() or root.is_symlink() or root.resolve() != root:
        raise ValueError("fixture root must be canonical, absolute and non-symlink")
    target = root / "pricing.py"
    original = read_regular(target)
    candidate_bytes = read_regular(Path(args.candidate_json))
    if digest(original) != args.fixture_sha256 or digest(candidate_bytes) != args.candidate_sha256:
        raise ValueError("input changed after the exact material grant was composed")
    candidate = json.loads(candidate_bytes)
    if type(candidate) is not dict or set(candidate) != {"source"} or type(candidate["source"]) is not str:
        raise ValueError("candidate must be exactly a JSON object containing source text")
    source = candidate["source"].encode("utf-8")
    if len(source) > 8192:
        raise ValueError("replacement exceeds 8 KiB")
    # Both programs are inspected before compilation; the original must exhibit
    # a real defect and the actual model replacement must pass the same cases.
    before = exercise(checked_function(original.decode("utf-8")))
    if all(row["passed"] for row in before):
        raise ValueError("the commissioned fixture does not expose a failing behavior")
    after_candidate = exercise(checked_function(candidate["source"]))
    if not all(row["passed"] for row in after_candidate):
        print(json.dumps({"applied": False, "before": before, "candidate": after_candidate}))
        return 2
    if read_regular(target) != original or read_regular(Path(args.candidate_json)) != candidate_bytes:
        raise ValueError("source changed before the bounded replacement")
    pending = None
    try:
        with tempfile.NamedTemporaryFile(dir=root, prefix=".pricing-", delete=False) as stream:
            pending = Path(stream.name)
            stream.write(source)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(pending, target)
        pending = None
    finally:
        if pending is not None:
            pending.unlink(missing_ok=True)
    observed = read_regular(target)
    after = exercise(checked_function(observed.decode("utf-8")))
    if observed != source or not all(row["passed"] for row in after):
        raise ValueError("actual written artifact failed verification")
    print(json.dumps({"applied": True, "fixture_before_sha256": digest(original),
                      "candidate_json_sha256": digest(candidate_bytes),
                      "artifact_after_sha256": digest(observed),
                      "before": before, "after": after, "path": str(target)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
