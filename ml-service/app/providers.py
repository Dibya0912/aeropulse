from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

import joblib
import numpy as np
from pydantic import ValidationError

from .schemas import (
    AnomalyResponse,
    BenchmarkRulRequest,
    BenchmarkRulResponse,
    FailureRiskRequest,
    FailureRiskResponse,
    FullPredictionResponse,
    PredictionMode,
    PrognosticsRequest,
    RiskLevel,
    RulResponse,
)


@dataclass(frozen=True)
class ModelInfo:
    model_id: str
    model_version: str
    model_type: str
    prediction_mode: PredictionMode
    dataset: str | None
    dataset_subset: str | None
    features: list[str]
    training_timestamp: str | None
    evaluation_metrics: dict[str, float] | None
    metadata: dict[str, object] | None
    artifact_available: bool


class PrognosticsProvider(Protocol):
    info: ModelInfo

    def predict_rul(self, payload: PrognosticsRequest) -> RulResponse:
        ...

    def detect_anomaly(self, payload: PrognosticsRequest) -> AnomalyResponse:
        ...

    def predict_failure_risk(self, payload: FailureRiskRequest) -> FailureRiskResponse:
        ...

    def predict_full(self, payload: PrognosticsRequest) -> FullPredictionResponse:
        ...


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def _signals(payload: PrognosticsRequest) -> dict[str, float]:
    first = payload.telemetry[0]
    latest = payload.telemetry[-1]
    return {
        "cycle_span": float(latest.cycle - first.cycle),
        "latest_temperature": latest.temperature,
        "latest_vibration": latest.vibration,
        "latest_pressure": latest.pressure,
        "latest_rpm": latest.rpm,
        "temperature_rise": latest.temperature - first.temperature,
        "vibration_rise": latest.vibration - first.vibration,
        "pressure_drop": first.pressure - latest.pressure,
    }


class DeterministicFallbackProvider:
    def __init__(self) -> None:
        self.info = ModelInfo(
            model_id="RULE-RUL-DEMO",
            model_version="v1",
            model_type="transparent deterministic rules",
            prediction_mode=PredictionMode.DETERMINISTIC_FALLBACK,
            dataset=None,
            dataset_subset=None,
            features=["temperature", "vibration", "pressure", "rpm", "cycle"],
            training_timestamp=None,
            evaluation_metrics=None,
            metadata=None,
            artifact_available=True,
        )

    def _anomaly_score(self, payload: PrognosticsRequest) -> tuple[float, list[str]]:
        s = _signals(payload)
        score = min(
            0.99,
            max(
                0.0,
                round(
                    s["vibration_rise"] * 1.9
                    + s["temperature_rise"] / 180
                    + s["pressure_drop"] / 18,
                    2,
                ),
            ),
        )
        evidence = [
            f"Vibration changed by {s['vibration_rise']:.2f}g across the telemetry window.",
            f"Temperature changed by {s['temperature_rise']:.1f}C across the telemetry window.",
            f"Pressure changed by {-s['pressure_drop']:.1f} psi across the telemetry window.",
            f"Health input is {payload.health:.0f}%.",
        ]
        return score, evidence

    def predict_rul(self, payload: PrognosticsRequest) -> RulResponse:
        anomaly_score, _ = self._anomaly_score(payload)
        rul = max(12, round(92 - anomaly_score * 60))
        return RulResponse(
            aircraft_id=payload.aircraft_id,
            component_id=payload.component_id,
            prediction_timestamp=_timestamp(),
            rul=rul,
            model_id=self.info.model_id,
            model_version=self.info.model_version,
            prediction_mode=self.info.prediction_mode,
            input_cycles=len(payload.telemetry),
        )

    def detect_anomaly(self, payload: PrognosticsRequest) -> AnomalyResponse:
        score, evidence = self._anomaly_score(payload)
        if score >= 0.9:
            state = "CRITICAL"
        elif score >= 0.75:
            state = "ANOMALOUS"
        elif score >= 0.5:
            state = "WATCH"
        else:
            state = "NORMAL"
        return AnomalyResponse(
            aircraft_id=payload.aircraft_id,
            component_id=payload.component_id,
            prediction_timestamp=_timestamp(),
            anomaly_score=score,
            anomaly_state=state,
            model_id=self.info.model_id,
            model_version=self.info.model_version,
            prediction_mode=self.info.prediction_mode,
            evidence=evidence,
        )

    def predict_failure_risk(self, payload: FailureRiskRequest) -> FailureRiskResponse:
        derivation: list[str] = []
        if payload.rul <= 25:
            risk = RiskLevel.CRITICAL
            derivation.append("RUL is at or below 25 cycles.")
        elif payload.rul <= 45 or payload.anomaly_score >= 0.82:
            risk = RiskLevel.HIGH
            derivation.append("RUL is at or below 45 cycles or anomaly score is at least 0.82.")
        elif payload.rul <= 70 or payload.anomaly_score >= 0.55 or payload.health < 75:
            risk = RiskLevel.MEDIUM
            derivation.append("RUL, anomaly score, or health is in watch range.")
        else:
            risk = RiskLevel.LOW
            derivation.append("RUL, anomaly score, and health are outside maintenance thresholds.")
        derivation.append(f"Inputs: RUL={payload.rul}, anomaly={payload.anomaly_score:.2f}, health={payload.health:.0f}%.")
        return FailureRiskResponse(
            aircraft_id=payload.aircraft_id,
            component_id=payload.component_id,
            prediction_timestamp=_timestamp(),
            failure_risk=risk,
            derivation=derivation,
            model_id=self.info.model_id,
            model_version=self.info.model_version,
            prediction_mode=self.info.prediction_mode,
        )

    def predict_full(self, payload: PrognosticsRequest) -> FullPredictionResponse:
        rul = self.predict_rul(payload)
        anomaly = self.detect_anomaly(payload)
        risk = self.predict_failure_risk(
            FailureRiskRequest(
                aircraft_id=payload.aircraft_id,
                component_id=payload.component_id,
                rul=rul.rul,
                anomaly_score=anomaly.anomaly_score,
                health=payload.health,
            )
        )
        return FullPredictionResponse(
            aircraft_id=payload.aircraft_id,
            component_id=payload.component_id,
            prediction_timestamp=rul.prediction_timestamp,
            rul=rul.rul,
            model_id=rul.model_id,
            model_version=rul.model_version,
            prediction_mode=rul.prediction_mode,
            input_cycles=rul.input_cycles,
            anomaly_score=anomaly.anomaly_score,
            anomaly_state=anomaly.anomaly_state,
            failure_risk=risk.failure_risk,
            health=payload.health,
            evidence=[*anomaly.evidence, *risk.derivation],
            input_signals=_signals(payload),
        )


class TrainedModelProvider:
    def __init__(self, model_dir: Path) -> None:
        metadata_path = model_dir / "rul_fd001_v1.metadata.json"
        artifact_path = model_dir / "rul_fd001_v1.joblib"
        if not metadata_path.exists():
            raise FileNotFoundError("trained model metadata is unavailable")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        required = ["model_id", "model_version", "model_type", "dataset", "dataset_subset", "features", "evaluation_metrics"]
        missing = [key for key in required if key not in metadata]
        if missing:
            raise ValueError(f"trained model metadata missing required keys: {', '.join(missing)}")
        if metadata["dataset_subset"] != "FD001":
            raise ValueError("trained model provider only accepts FD001 metadata")
        if not artifact_path.exists():
            raise FileNotFoundError("trained model artifact is unavailable")
        features = metadata.get("features", [])
        if not isinstance(features, list) or not all(isinstance(feature, str) for feature in features):
            raise ValueError("trained model metadata has invalid feature schema")
        self.model = joblib.load(artifact_path)
        self.expected_features = list(features)
        self.metadata = metadata
        self.info = ModelInfo(
            model_id=metadata["model_id"],
            model_version=metadata["model_version"],
            model_type=metadata["model_type"],
            prediction_mode=PredictionMode.TRAINED_MODEL,
            dataset=metadata.get("dataset"),
            dataset_subset=metadata.get("dataset_subset"),
            features=self.expected_features,
            training_timestamp=metadata.get("training_timestamp"),
            evaluation_metrics=metadata.get("evaluation_metrics"),
            metadata=metadata,
            artifact_available=True,
        )

    def predict_benchmark_rul(self, payload: BenchmarkRulRequest) -> BenchmarkRulResponse:
        provided = set(payload.features)
        expected = set(self.expected_features)
        if provided != expected:
            missing = sorted(expected - provided)
            extra = sorted(provided - expected)
            detail = []
            if missing:
                detail.append(f"missing features: {', '.join(missing)}")
            if extra:
                detail.append(f"unexpected features: {', '.join(extra)}")
            raise ValueError("; ".join(detail))
        values = [payload.features[feature] for feature in self.expected_features]
        if not np.isfinite(values).all():
            raise ValueError("all FD001 benchmark features must be finite numeric values")
        prediction = float(self.model.predict(np.asarray([values], dtype=float))[0])
        return BenchmarkRulResponse(
            unit_id=payload.unit_id,
            cycle=payload.cycle,
            prediction_timestamp=_timestamp(),
            rul=max(0, round(prediction)),
            model_id=self.info.model_id,
            model_version=self.info.model_version,
            prediction_mode=PredictionMode.TRAINED_MODEL,
            input_feature_count=len(self.expected_features),
        )


def load_provider(model_dir: Path | None = None) -> PrognosticsProvider:
    root = model_dir or Path(__file__).resolve().parents[1] / "models"
    try:
        return TrainedModelProvider(root)
    except (FileNotFoundError, ValueError, ValidationError, json.JSONDecodeError):
        return DeterministicFallbackProvider()
