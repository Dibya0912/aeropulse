from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import joblib
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import GradientBoostingRegressor, HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline

from cmapss import (
    RANDOM_SEED,
    RUL_CAP,
    feature_matrix,
    final_test_rows,
    read_cmapss_table,
    read_rul_labels,
    rows_for_units,
    select_non_constant_features,
    split_units,
    target_vector,
    validate_fd001,
)


def regression_metrics(y_true, predictions) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, predictions)),
        "rmse": float(mean_squared_error(y_true, predictions) ** 0.5),
        "r2": float(r2_score(y_true, predictions)),
    }


def build_candidates() -> dict[str, object]:
    return {
        "dummy_mean": DummyRegressor(strategy="mean"),
        "random_forest": RandomForestRegressor(n_estimators=180, random_state=RANDOM_SEED, n_jobs=-1, min_samples_leaf=2),
        "hist_gradient_boosting": HistGradientBoostingRegressor(random_state=RANDOM_SEED, max_iter=160, learning_rate=0.07),
        "gradient_boosting": GradientBoostingRegressor(random_state=RANDOM_SEED, n_estimators=180, learning_rate=0.06, max_depth=3),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a tabular RUL model from real NASA C-MAPSS FD001 data.")
    parser.add_argument("--data-dir", default="ml-service/data/raw")
    parser.add_argument("--output-dir", default="ml-service/models")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    train_path = data_dir / "train_FD001.txt"
    test_path = data_dir / "test_FD001.txt"
    rul_path = data_dir / "RUL_FD001.txt"
    for path in [train_path, test_path, rul_path]:
        if not path.exists():
            raise FileNotFoundError(f"{path} does not exist; do not train without genuine C-MAPSS FD001 files")

    train_frame = read_cmapss_table(train_path)
    test_frame = read_cmapss_table(test_path)
    rul_labels = read_rul_labels(rul_path)
    validation_summary = validate_fd001(train_frame, test_frame, rul_labels)

    training_units, validation_units = split_units(train_frame.unit_ids)
    training_rows = rows_for_units(train_frame.rows, training_units)
    validation_rows = rows_for_units(train_frame.rows, validation_units)
    selected_features, removed_features = select_non_constant_features(training_rows)

    x_train = feature_matrix(training_rows, selected_features)
    y_train = target_vector(training_rows, RUL_CAP)
    x_valid = feature_matrix(validation_rows, selected_features)
    y_valid = target_vector(validation_rows, RUL_CAP)
    test_rows, y_test = final_test_rows(test_frame, rul_labels)
    x_test = feature_matrix(test_rows, selected_features)

    results: dict[str, dict[str, float]] = {}
    trained_models: dict[str, object] = {}
    for name, model in build_candidates().items():
        pipeline = Pipeline([("regressor", model)])
        pipeline.fit(x_train, y_train)
        results[name] = regression_metrics(y_valid, pipeline.predict(x_valid))
        trained_models[name] = pipeline

    selected_name = min((name for name in results if name != "dummy_mean"), key=lambda name: results[name]["rmse"])
    selected_model = trained_models[selected_name]
    test_predictions = selected_model.predict(x_test)
    test_metrics = regression_metrics(y_test, test_predictions)

    regressor = selected_model.named_steps["regressor"]
    feature_importance: list[dict[str, float]] = []
    if hasattr(regressor, "feature_importances_"):
        feature_importance = [
            {"feature": feature, "importance": float(importance)}
            for feature, importance in sorted(
                zip(selected_features, regressor.feature_importances_, strict=True),
                key=lambda item: item[1],
                reverse=True,
            )
        ]

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = output_dir / "rul_fd001_v1.joblib"
    metadata_path = output_dir / "rul_fd001_v1.metadata.json"
    joblib.dump(selected_model, artifact_path)
    metadata = {
        "model_id": "CMAPSS-FD001-RUL",
        "model_version": "v1",
        "model_type": regressor.__class__.__name__,
        "dataset": "NASA C-MAPSS turbofan degradation benchmark",
        "dataset_subset": "FD001",
        "dataset_provenance": {
            "nasa_open_data_page": "https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data",
            "nasa_resource_id": "5224bcd1-ad61-490b-93b9-2817288accb8",
            "download_mirror": "https://github.com/PunVas/nasa-c-mapss",
            "download_note": "NASA Open Data direct ZIP endpoints timed out or returned 404 in this environment; raw FD001 files were obtained from the public GitHub mirror and validated against the NASA-documented 26-column FD001 structure.",
        },
        "features": selected_features,
        "removed_features": removed_features,
        "target_definition": "RUL = max_cycle_for_unit - current_cycle for training rows; evaluation uses final-cycle RUL labels for FD001 test units.",
        "rul_cap": RUL_CAP,
        "rul_cap_reason": "The cap limits early-life targets where exact far-future RUL is less operationally useful and is a common C-MAPSS FD001 regression practice; it is applied only to training/validation run-to-failure rows, not to provided test labels.",
        "random_seed": RANDOM_SEED,
        "training_timestamp": datetime.now(UTC).isoformat(),
        "training_units": training_units,
        "validation_units": validation_units,
        "training_unit_count": len(training_units),
        "validation_unit_count": len(validation_units),
        "test_unit_count": len(test_frame.unit_ids),
        "validation_summary": validation_summary,
        "candidate_metrics": results,
        "baseline_metrics": results["dummy_mean"],
        "selected_model": selected_name,
        "selection_reason": "Lowest validation RMSE among non-dummy tabular candidates.",
        "evaluation_metrics": {
            "validation": results[selected_name],
            "test_last_cycle": test_metrics,
        },
        "benchmark_inference_example": {
            "source": "FD001 test final-cycle row",
            "unit_id": int(test_rows[0]["unit_id"]),
            "cycle": int(test_rows[0]["cycle"]),
            "predicted_rul": int(max(0, round(float(test_predictions[0])))),
            "provided_rul_label": float(y_test[0]),
            "prediction_mode": "TRAINED_MODEL",
        },
        "feature_importance": feature_importance,
        "artifact_path": str(artifact_path),
        "metadata_path": str(metadata_path),
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"artifact": str(artifact_path), "metadata": str(metadata_path), "selected_model": selected_name, "metrics": metadata["evaluation_metrics"]}, indent=2))


if __name__ == "__main__":
    main()
