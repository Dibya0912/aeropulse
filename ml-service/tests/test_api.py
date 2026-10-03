from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers import DeterministicFallbackProvider, TrainedModelProvider, load_provider
from app.schemas import BenchmarkRulRequest
from training.cmapss import (
    add_train_rul,
    read_cmapss_table,
    read_rul_labels,
    split_units,
    validate_fd001,
)


client = TestClient(app)
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
MODELS = ROOT / "models"


def eng02_payload():
    return {
        "aircraft_id": "AF-017",
        "component_id": "ENG-02",
        "health": 64,
        "telemetry": [
            {"cycle": 5181, "temperature": 640, "vibration": 0.42, "pressure": 35.8, "rpm": 9120},
            {"cycle": 5184, "temperature": 649, "vibration": 0.48, "pressure": 35.4, "rpm": 9145},
            {"cycle": 5187, "temperature": 662, "vibration": 0.55, "pressure": 34.9, "rpm": 9165},
            {"cycle": 5190, "temperature": 681, "vibration": 0.64, "pressure": 34.3, "rpm": 9188},
            {"cycle": 5193, "temperature": 704, "vibration": 0.78, "pressure": 33.7, "rpm": 9211},
            {"cycle": 5196, "temperature": 728, "vibration": 0.91, "pressure": 33.1, "rpm": 9230},
        ],
    }


def benchmark_payload():
    provider = TrainedModelProvider(MODELS)
    train = read_cmapss_table(RAW / "train_FD001.txt")
    row = train.rows[0]
    return {
        "benchmark_source": "NASA_CMAPSS_FD001",
        "unit_id": int(row["unit_id"]),
        "cycle": int(row["cycle"]),
        "features": {feature: row[feature] for feature in provider.expected_features},
    }


def test_dataset_loader_and_validation():
    train = read_cmapss_table(RAW / "train_FD001.txt")
    test = read_cmapss_table(RAW / "test_FD001.txt")
    rul = read_rul_labels(RAW / "RUL_FD001.txt")
    summary = validate_fd001(train, test, rul)
    assert summary == {"train_rows": 20631, "test_rows": 13096, "train_units": 100, "test_units": 100, "rul_labels": 100}
    assert len(train.rows[0]) == 26


def test_rul_target_calculation():
    rows = [
        {"unit_id": 1.0, "cycle": 1.0},
        {"unit_id": 1.0, "cycle": 3.0},
        {"unit_id": 2.0, "cycle": 4.0},
        {"unit_id": 2.0, "cycle": 7.0},
    ]
    assert add_train_rul(rows, rul_cap=None) == [2.0, 0.0, 3.0, 0.0]


def test_unit_aware_split_has_no_overlap():
    train_units, validation_units = split_units(list(range(1, 101)))
    assert len(train_units) == 80
    assert len(validation_units) == 20
    assert set(train_units).isdisjoint(validation_units)


def test_health_reports_trained_and_fallback_availability():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["trained_model_available"] is True
    assert body["fallback_available"] is True


def test_models_reports_real_artifact_metadata():
    response = client.get("/models")
    assert response.status_code == 200
    body = response.json()
    assert body["active"]["prediction_mode"] == "TRAINED_MODEL"
    assert body["active"]["dataset_subset"] == "FD001"
    assert body["active"]["evaluation_metrics"]["validation"]["rmse"] > 0
    assert body["fallback"]["prediction_mode"] == "DETERMINISTIC_FALLBACK"


def test_cors_allows_local_frontend_origin():
    response = client.options(
        "/predict/rul",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_operational_rul_endpoint_preserves_af017_fallback():
    response = client.post("/predict/rul", json=eng02_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["aircraft_id"] == "AF-017"
    assert body["component_id"] == "ENG-02"
    assert body["rul_unit"] == "cycles"
    assert body["prediction_mode"] == "DETERMINISTIC_FALLBACK"
    assert body["model_id"] == "RULE-RUL-DEMO"
    assert body["rul"] == 33


def test_trained_benchmark_prediction():
    response = client.post("/predict/rul", json=benchmark_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["benchmark_source"] == "NASA_CMAPSS_FD001"
    assert body["prediction_mode"] == "TRAINED_MODEL"
    assert body["model_id"] == "CMAPSS-FD001-RUL"
    assert body["rul_unit"] == "cycles"
    assert body["rul"] >= 0


def test_wrong_feature_schema_rejected():
    payload = benchmark_payload()
    payload["features"].pop(next(iter(payload["features"])))
    response = client.post("/predict/rul", json=payload)
    assert response.status_code == 422


def test_nan_feature_rejected():
    payload = benchmark_payload()
    key = next(iter(payload["features"]))
    payload["features"][key] = "not-a-number"
    response = client.post("/predict/rul", json=payload)
    assert response.status_code == 422

    provider = TrainedModelProvider(MODELS)
    payload = benchmark_payload()
    key = next(iter(payload["features"]))
    payload["features"][key] = float("nan")
    request = BenchmarkRulRequest.model_construct(**payload)
    with pytest.raises(ValueError):
        provider.predict_benchmark_rul(request)


def test_anomaly_endpoint_stays_fallback():
    response = client.post("/detect/anomaly", json=eng02_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["anomaly_score"] == 0.99
    assert body["anomaly_state"] == "CRITICAL"
    assert body["prediction_mode"] == "DETERMINISTIC_FALLBACK"


def test_failure_risk_derivation_stays_fallback():
    response = client.post(
        "/predict/failure-risk",
        json={"aircraft_id": "AF-017", "component_id": "ENG-02", "rul": 31, "anomaly_score": 0.94, "health": 64},
    )
    assert response.status_code == 200
    assert response.json()["failure_risk"] == "HIGH"
    assert response.json()["prediction_mode"] == "DETERMINISTIC_FALLBACK"


def test_full_prediction_response_stays_fallback():
    response = client.post("/predict/full", json=eng02_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["prediction_mode"] == "DETERMINISTIC_FALLBACK"
    assert body["failure_risk"] == "HIGH"
    assert body["input_signals"]["latest_vibration"] == 0.91


def test_invalid_payload_rejected():
    response = client.post("/predict/rul", json={"aircraft_id": "AF-017"})
    assert response.status_code == 422


def test_artifact_missing_falls_back(tmp_path):
    provider = load_provider(tmp_path)
    assert isinstance(provider, DeterministicFallbackProvider)


def test_corrupt_metadata_rejected(tmp_path):
    (tmp_path / "rul_fd001_v1.metadata.json").write_text("{bad json", encoding="utf-8")
    (tmp_path / "rul_fd001_v1.joblib").write_text("not a real artifact", encoding="utf-8")
    with pytest.raises(Exception):
        TrainedModelProvider(tmp_path)
    provider = load_provider(tmp_path)
    assert isinstance(provider, DeterministicFallbackProvider)
