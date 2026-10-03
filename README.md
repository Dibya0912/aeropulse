# AeroPulse SIH26249 Prototype

AeroPulse is a Smart India Hackathon 2026 prototype for Air Power predictive maintenance and fleet availability. It demonstrates a connected maintenance decision chain for a small four-aircraft demo fleet while keeping real ML benchmark validation separate from the operational demo.

## What Is Implemented

- Deterministic AF-017 / ENG-02 golden operational workflow.
- Shared frontend state for aircraft, components, alerts, work orders, inventory, technicians, bays, schedule, notifications and audit.
- Role-gated workflow actions for maintenance officer, technician, inventory manager and administrator.
- FastAPI prognostics service.
- Deterministic fallback prognostics for AF-017 / ENG-02.
- Real trained RUL benchmark model for NASA C-MAPSS FD001.
- Model Validation page at `/admin/model-validation`.
- Demo reset that restores the operational demo state without touching ML artifacts or benchmark data.

## Critical Data Boundary

NASA C-MAPSS FD001 is a public simulated turbofan degradation benchmark used to validate the RUL modeling pipeline.

AF-017 / ENG-02 is simulated AeroPulse demonstration data and currently uses the deterministic fallback because its telemetry schema is not directly compatible with FD001.

Do not map AF-017 telemetry into the FD001 trained model unless a future phase implements and validates a compatible feature pipeline.

## Technology Actually Used

- Next.js 16 frontend.
- React 19.
- TypeScript.
- FastAPI.
- scikit-learn `HistGradientBoostingRegressor` for the frozen FD001 benchmark model.
- Local browser `localStorage` for prototype demo persistence.

Not implemented: production authentication, real military telemetry, SHAP, Spring Boot, PostgreSQL, MQTT, Kafka, Digital Twin or fake real-time infrastructure monitoring.

## Prerequisites

- Node.js and pnpm compatible with `pnpm@12.3.4`.
- Python with the dependencies in `ml-service/requirements.txt`.

Install frontend dependencies:

```powershell
pnpm install
```

Install ML service dependencies:

```powershell
cd ml-service
python -m pip install -r requirements.txt
```

## Environment

Copy `.env.example` if you need local overrides:

```powershell
Copy-Item .env.example .env.local
```

Variables:

- `NEXT_PUBLIC_PROGNOSTICS_API_URL`: frontend-visible FastAPI URL. Default: `http://127.0.0.1:8000`.
- `AEROPULSE_ALLOWED_ORIGINS`: comma-separated FastAPI CORS origins. Default: `http://localhost:3000,http://127.0.0.1:3000`.

No secrets are required for the current demo.

## Startup

Frontend only:

```powershell
pnpm dev
```

or:

```powershell
.\scripts\start-frontend.ps1
```

ML service:

```powershell
cd ml-service
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

or:

```powershell
.\scripts\start-ml.ps1
```

Frontend + ML service: run the frontend and ML service commands in separate terminals.

The application does not retrain the model at startup. It uses the frozen serialized artifacts:

- `ml-service/models/rul_fd001_v1.joblib`
- `ml-service/models/rul_fd001_v1.metadata.json`

## Pre-Flight Check

```powershell
.\scripts\check-demo.ps1
```

Status meanings:

- `READY`: FastAPI is reachable, trained benchmark provider is available, fallback is available.
- `DEGRADED - FALLBACK AVAILABLE`: FastAPI or trained provider is unavailable, but the operational AF-017 deterministic demo can still run.
- `BLOCKED`: required model artifact or metadata is missing.

## Golden Operational Demo Path

From a fresh reset:

1. Command Center
2. Fleet / AF-017
3. ENG-02 component health
4. AF-017 Prognostics
5. Prediction detail `PRED-017-ENG02-001`
6. Predictive alert `ALT-017-ENG02-001`
7. Work order `WO-1048`
8. Spare `BRG-X21`
9. Technician `AK-01`
10. Bay `B04`
11. Technician starts work
12. Record inspection finding
13. Consume BRG-X21
14. Record maintenance action
15. Complete work
16. Maintenance officer verifies
17. AF-017 becomes READY
18. Fleet readiness recalculates
19. Audit trail records the chain

## Benchmark ML Demo Path

1. Administration
2. Model Validation
3. Review public NASA C-MAPSS FD001 benchmark provenance
4. Review estimator, feature schema, RUL target, RUL cap and measured metrics
5. Review benchmark inference example
6. Confirm prediction mode `TRAINED_MODEL`

This path is separate from AF-017 / ENG-02, which remains `DETERMINISTIC_FALLBACK`.

## Tests

Frontend typecheck:

```powershell
pnpm exec tsc --noEmit
```

Production build:

```powershell
pnpm build
```

ML tests:

```powershell
cd ml-service
python -m pytest
python -m compileall app training tests
```

## Optional Retraining

Retraining is not required for demo startup and should not be done unless explicitly intended.

```powershell
cd ml-service
python training\train_rul.py --data-dir data\raw --output-dir models
```

This uses the real FD001 files under `ml-service/data/raw` and overwrites the model artifact and metadata with measured metrics from the executed run.

## Deployment Readiness

The Next.js frontend can be deployed independently if `NEXT_PUBLIC_PROGNOSTICS_API_URL` points to the deployed FastAPI service.

The FastAPI service can be deployed independently if it can read the frozen `models` directory. Configure `AEROPULSE_ALLOWED_ORIGINS` with exact frontend origins. Do not use unrestricted production CORS without a deliberate security review.

## Known Limitations

- The operational fleet data is simulated demo data.
- AF-017 / ENG-02 uses deterministic fallback rules, not the FD001 trained model.
- The trained model is a benchmark validation model, not a certified operational aviation model.
- Prototype authorization is role-gated UI/application logic, not production authentication.
- Browser console capture depends on available tooling.
