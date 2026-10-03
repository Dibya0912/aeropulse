from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class PredictionMode(str, Enum):
    TRAINED_MODEL = "TRAINED_MODEL"
    DETERMINISTIC_FALLBACK = "DETERMINISTIC_FALLBACK"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TelemetryPoint(BaseModel):
    cycle: int = Field(..., ge=0)
    temperature: float = Field(..., gt=0)
    vibration: float = Field(..., ge=0)
    pressure: float = Field(..., gt=0)
    rpm: float = Field(..., gt=0)


class PrognosticsRequest(BaseModel):
    aircraft_id: str = Field(..., min_length=1)
    component_id: str = Field(..., min_length=1)
    health: float = Field(..., ge=0, le=100)
    telemetry: list[TelemetryPoint] = Field(..., min_length=2)

    @model_validator(mode="after")
    def cycles_must_be_ordered(self) -> "PrognosticsRequest":
        cycles = [point.cycle for point in self.telemetry]
        if cycles != sorted(cycles):
            raise ValueError("telemetry cycles must be sorted in ascending order")
        if len(set(cycles)) != len(cycles):
            raise ValueError("telemetry cycles must be unique")
        return self


class RulResponse(BaseModel):
    aircraft_id: str
    component_id: str
    prediction_timestamp: str
    rul: int
    rul_unit: Literal["cycles"] = "cycles"
    model_id: str
    model_version: str
    prediction_mode: PredictionMode
    input_cycles: int


class AnomalyResponse(BaseModel):
    aircraft_id: str
    component_id: str
    prediction_timestamp: str
    anomaly_score: float = Field(..., ge=0, le=1)
    anomaly_state: Literal["NORMAL", "WATCH", "ANOMALOUS", "CRITICAL"]
    model_id: str
    model_version: str
    prediction_mode: PredictionMode
    evidence: list[str]


class FailureRiskRequest(BaseModel):
    aircraft_id: str
    component_id: str
    rul: int = Field(..., ge=0)
    anomaly_score: float = Field(..., ge=0, le=1)
    health: float = Field(..., ge=0, le=100)


class FailureRiskResponse(BaseModel):
    aircraft_id: str
    component_id: str
    prediction_timestamp: str
    failure_risk: RiskLevel
    derivation: list[str]
    model_id: str
    model_version: str
    prediction_mode: PredictionMode


class FullPredictionResponse(RulResponse):
    anomaly_score: float = Field(..., ge=0, le=1)
    anomaly_state: Literal["NORMAL", "WATCH", "ANOMALOUS", "CRITICAL"]
    failure_risk: RiskLevel
    health: float = Field(..., ge=0, le=100)
    evidence: list[str]
    input_signals: dict[str, float]


class BenchmarkRulRequest(BaseModel):
    benchmark_source: Literal["NASA_CMAPSS_FD001"]
    unit_id: int = Field(..., ge=1)
    cycle: int = Field(..., ge=1)
    features: dict[str, float]

    @model_validator(mode="after")
    def finite_features_only(self) -> "BenchmarkRulRequest":
        for name, value in self.features.items():
            if value != value or value in {float("inf"), float("-inf")}:
                raise ValueError(f"{name} must be a finite numeric value")
        return self


class BenchmarkRulResponse(BaseModel):
    benchmark_source: Literal["NASA_CMAPSS_FD001"] = "NASA_CMAPSS_FD001"
    unit_id: int
    cycle: int
    prediction_timestamp: str
    rul: int
    rul_unit: Literal["cycles"] = "cycles"
    model_id: str
    model_version: str
    prediction_mode: Literal[PredictionMode.TRAINED_MODEL]
    input_feature_count: int
