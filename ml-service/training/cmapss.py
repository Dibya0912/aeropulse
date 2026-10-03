from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from random import Random

import numpy as np

SETTING_COLUMNS = ["setting_1", "setting_2", "setting_3"]
SENSOR_COLUMNS = [f"sensor_{index}" for index in range(1, 22)]
FEATURE_COLUMNS = [*SETTING_COLUMNS, *SENSOR_COLUMNS]
COLUMNS = ["unit_id", "cycle", *FEATURE_COLUMNS]
RUL_CAP = 125
RANDOM_SEED = 42


@dataclass(frozen=True)
class CmapssFrame:
    rows: list[dict[str, float]]

    @property
    def unit_ids(self) -> list[int]:
        return sorted({int(row["unit_id"]) for row in self.rows})


def read_cmapss_table(path: Path) -> CmapssFrame:
    rows: list[dict[str, float]] = []
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw_line.strip():
            continue
        values = raw_line.split()
        if len(values) != len(COLUMNS):
            raise ValueError(f"{path.name} row {line_number} has {len(values)} columns; expected {len(COLUMNS)}")
        rows.append(dict(zip(COLUMNS, (float(value) for value in values), strict=True)))
    if not rows:
        raise ValueError(f"{path.name} is empty")
    return CmapssFrame(rows)


def read_rul_labels(path: Path) -> dict[int, float]:
    labels: dict[int, float] = {}
    for index, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw_line.strip():
            continue
        labels[index] = float(raw_line.strip().split()[0])
    if not labels:
        raise ValueError(f"{path.name} is empty")
    return labels


def validate_fd001(train: CmapssFrame, test: CmapssFrame, rul_labels: dict[int, float]) -> dict[str, int]:
    train_units = train.unit_ids
    test_units = test.unit_ids
    if train_units != list(range(1, 101)):
        raise ValueError("FD001 train unit IDs must be 1..100")
    if test_units != list(range(1, 101)):
        raise ValueError("FD001 test unit IDs must be 1..100")
    if sorted(rul_labels) != test_units:
        raise ValueError("FD001 RUL labels must align 1:1 with test unit IDs")
    if any(row["cycle"] < 1 for row in [*train.rows, *test.rows]):
        raise ValueError("FD001 cycle values must be positive")
    return {
        "train_rows": len(train.rows),
        "test_rows": len(test.rows),
        "train_units": len(train_units),
        "test_units": len(test_units),
        "rul_labels": len(rul_labels),
    }


def add_train_rul(rows: list[dict[str, float]], rul_cap: int | None = RUL_CAP) -> list[float]:
    max_cycle_by_unit: dict[int, float] = {}
    for row in rows:
        unit = int(row["unit_id"])
        max_cycle_by_unit[unit] = max(max_cycle_by_unit.get(unit, 0.0), row["cycle"])
    labels = [max_cycle_by_unit[int(row["unit_id"])] - row["cycle"] for row in rows]
    if rul_cap is not None:
        labels = [min(label, float(rul_cap)) for label in labels]
    return labels


def split_units(unit_ids: list[int], validation_fraction: float = 0.2, seed: int = RANDOM_SEED) -> tuple[list[int], list[int]]:
    shuffled = list(unit_ids)
    Random(seed).shuffle(shuffled)
    validation_count = max(1, round(len(shuffled) * validation_fraction))
    validation_units = sorted(shuffled[:validation_count])
    training_units = sorted(shuffled[validation_count:])
    return training_units, validation_units


def rows_for_units(rows: list[dict[str, float]], units: list[int]) -> list[dict[str, float]]:
    unit_set = set(units)
    return [row for row in rows if int(row["unit_id"]) in unit_set]


def feature_matrix(rows: list[dict[str, float]], features: list[str]) -> np.ndarray:
    return np.asarray([[row[feature] for feature in features] for row in rows], dtype=float)


def target_vector(rows: list[dict[str, float]], rul_cap: int | None = RUL_CAP) -> np.ndarray:
    return np.asarray(add_train_rul(rows, rul_cap), dtype=float)


def select_non_constant_features(rows: list[dict[str, float]], threshold: float = 1e-10) -> tuple[list[str], dict[str, str]]:
    matrix = feature_matrix(rows, FEATURE_COLUMNS)
    variances = matrix.var(axis=0)
    selected: list[str] = []
    removed: dict[str, str] = {}
    for feature, variance in zip(FEATURE_COLUMNS, variances, strict=True):
        if variance <= threshold:
            removed[feature] = f"near-constant variance={variance:.6g}"
        else:
            selected.append(feature)
    return selected, removed


def final_test_rows(test: CmapssFrame, rul_labels: dict[int, float]) -> tuple[list[dict[str, float]], np.ndarray]:
    latest_by_unit: dict[int, dict[str, float]] = {}
    for row in test.rows:
        unit = int(row["unit_id"])
        if unit not in latest_by_unit or row["cycle"] > latest_by_unit[unit]["cycle"]:
            latest_by_unit[unit] = row
    rows = [latest_by_unit[unit] for unit in sorted(latest_by_unit)]
    labels = np.asarray([rul_labels[int(row["unit_id"])] for row in rows], dtype=float)
    return rows, labels
