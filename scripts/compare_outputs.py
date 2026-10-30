#!/usr/bin/env python3
"""Compare Rust parser output with the fmsave oracle export."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

# Fields the oracle does not export, either because fmsave omits them or because
# FM27 Scout derives them (names, roles, injuries, suspensions). They are covered by
# the real-save regression test instead of the oracle diff.
SKIP = {
    "unique_id",
    "second_nation_ids",
    "home_grown_nation_ids",
    "home_grown_club_uids",
    "loan_parent_club_name",
    "traits",
    "best_role",
    "club_nation_name",
    "gender",
    "injuries",
    "nation_name",
    "suspensions",
}


def load(path: str) -> list[dict]:
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def compare_value(path: str, expected, actual, differences: list[str]) -> None:
    if path.split(".")[0] in SKIP:
        return
    if isinstance(expected, dict) and isinstance(actual, dict):
        for key in sorted(set(expected) | set(actual)):
            compare_value(
                f"{path}.{key}" if path else key,
                expected.get(key),
                actual.get(key),
                differences,
            )
    elif isinstance(expected, list) and isinstance(actual, list):
        if path == "home_grown_club_names":
            expected = [value for value in expected if value is not None]
            actual = [value for value in actual if value is not None]
        if expected != actual:
            differences.append(f"{path}: {expected!r} != {actual!r}")
    elif expected != actual:
        differences.append(f"{path}: {expected!r} != {actual!r}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("oracle")
    parser.add_argument("rust")
    parser.add_argument("--max-report", type=int, default=30)
    args = parser.parse_args()
    oracle = {row["uid"]: row for row in load(args.oracle)}
    rust = {row["uid"]: row for row in load(args.rust)}
    missing = sorted(set(oracle) - set(rust))
    extra = sorted(set(rust) - set(oracle))
    print(f"oracle={len(oracle)} rust={len(rust)} missing={len(missing)} extra={len(extra)}")
    if missing:
        print("missing uids:", missing[:20])
    if extra:
        print("extra uids:", extra[:20])
    mismatch_count = 0
    for uid in sorted(set(oracle) & set(rust)):
        differences: list[str] = []
        compare_value("", oracle[uid], rust[uid], differences)
        if differences:
            mismatch_count += 1
            if mismatch_count <= args.max_report:
                print(f"\nuid {uid} ({oracle[uid].get('name')}) {len(differences)} differences")
                for difference in differences[:20]:
                    print("  ", difference)
    print(f"\nplayers with differences: {mismatch_count}")
    if mismatch_count > args.max_report:
        print(f"(only first {args.max_report} shown)")


if __name__ == "__main__":
    main()
