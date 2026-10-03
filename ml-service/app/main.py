import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .providers import DeterministicFallbackProvider, TrainedModelProvider, load_provider
from .schemas import BenchmarkRulRequest, FailureRiskRequest, PrognosticsRequest, PredictionMode

provider = load_provider(Path(__file__).resolve().parents[1] / "models")
fallback_provider = DeterministicFallbackProvider()

app = FastAPI(title="AeroPulse Prognostics Service", version="0.2.0")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("AEROPULSE_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "active_prediction_mode": provider.info.prediction_mode,
        "trained_model_available": provider.info.prediction_mode == PredictionMode.TRAINED_MODEL,
        "fallback_available": True,
    }


@app.get("/models")
def models() -> dict[str, object]:
    active = provider.info.__dict__.copy()
    fallback = fallback_provider.info.__dict__.copy()
    return {"active": active, "fallback": fallback}


@app.post("/predict/rul")
def predict_rul(payload: dict[str, object]):
    if payload.get("benchmark_source") == "NASA_CMAPSS_FD001":
        if not isinstance(provider, TrainedModelProvider):
            raise HTTPException(status_code=503, detail="Trained FD001 model artifact is unavailable")
        try:
            benchmark_payload = BenchmarkRulRequest.model_validate(payload)
            return provider.predict_benchmark_rul(benchmark_payload)
        except (ValueError, ValidationError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        operational_payload = PrognosticsRequest.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return fallback_provider.predict_rul(operational_payload)


@app.post("/detect/anomaly")
def detect_anomaly(payload: PrognosticsRequest):
    return fallback_provider.detect_anomaly(payload)


@app.post("/predict/failure-risk")
def predict_failure_risk(payload: FailureRiskRequest):
    return fallback_provider.predict_failure_risk(payload)


@app.post("/predict/full")
def predict_full(payload: PrognosticsRequest):
    return fallback_provider.predict_full(payload)
