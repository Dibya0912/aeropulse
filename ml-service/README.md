# AeroPulse ML Service

This workspace contains the P2.5 prognostics service for the AeroPulse prototype.

## Current status

- FastAPI inference service: implemented.
- Trained benchmark model: implemented for NASA C-MAPSS FD001.
- Operational AeroPulse AF-017 / ENG-02 path: still uses `DETERMINISTIC_FALLBACK`.
- Supported modes: `TRAINED_MODEL` and `DETERMINISTIC_FALLBACK`.
- SHAP: not implemented.

The service does not claim that C-MAPSS contains AF-017, ENG-02, military aircraft, or operational fleet telemetry. C-MAPSS is used only as a public simulated turbofan degradation benchmark.

## Dataset provenance

NASA Open Data page:

```text
https://data.nasa.gov/dataset/cmapss-jet-engine-simulated-data
```

NASA resource identified during acquisition:

```text
5224bcd1-ad61-490b-93b9-2817288accb8
```

The NASA portal page was reachable, but direct ZIP/file download endpoints timed out or returned 404 in this environment. The FD001 raw files were obtained from this public mirror and validated against the NASA-documented FD001 structure:

```text
https://github.com/PunVas/nasa-c-mapss
```

Validated FD001 files:

- `data/raw/train_FD001.txt`: 20,631 rows, 100 train units, 26 columns.
- `data/raw/test_FD001.txt`: 13,096 rows, 100 test units, 26 columns.
- `data/raw/RUL_FD001.txt`: 100 final-cycle test RUL labels.

## Training methodology

The training script uses the documented C-MAPSS layout:

```text
unit_id, cycle, setting_1, setting_2, setting_3, sensor_1 ... sensor_21
```

Training targets are:

```text
RUL = max_cycle_for_unit - current_cycle
```

The target is capped at 125 cycles for training and validation rows. The cap is recorded in metadata and is used to reduce early-life target dominance in FD001. Test evaluation is reported on final-cycle test rows using the provided `RUL_FD001.txt` labels.

The split is unit-aware: 80 train units and 20 validation units with random seed 42. The test set has 100 units.

Near-constant features are removed by variance threshold and recorded in metadata.

## Artifacts

```text
models/rul_fd001_v1.joblib
models/rul_fd001_v1.metadata.json
```

The metadata records feature schema, target definition, removed features, train/validation/test unit counts, baseline metrics, candidate metrics, selected model, measured validation/test metrics, and one benchmark inference example.

## API behavior

`GET /health` reports trained model and fallback availability.

`GET /models` exposes active trained model metadata plus deterministic fallback metadata.

`POST /predict/rul` has two truthful paths:

- C-MAPSS FD001 benchmark payloads with `benchmark_source=NASA_CMAPSS_FD001` use `TRAINED_MODEL`.
- AeroPulse operational payloads such as AF-017 / ENG-02 use `DETERMINISTIC_FALLBACK`.

`POST /detect/anomaly`, `POST /predict/failure-risk`, and `POST /predict/full` preserve deterministic operational behavior.

## Train

```powershell
cd ml-service
python training\train_rul.py --data-dir data\raw --output-dir models
```

## Run service

```powershell
cd ml-service
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Run tests

```powershell
cd ml-service
python -m pytest
```
