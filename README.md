# HP-Power-Lab-RefinAI

RefinAI is a proposed operator decision-support concept for refinery energy and asset-health reviews. This repository contains an illustrative 3D refinery dashboard and reproducible experiments on two public industrial benchmark datasets. It is a student prototype, not an HPCL deployment.

**Important boundary:** dashboard telemetry is generated for demonstration. NASA C-MAPSS contains simulated aircraft-engine degradation data; UCI CCPP contains combined-cycle power-plant measurements. Neither dataset is HPCL refinery data. Savings figures and operator prompts are illustrative assumptions, not verified outcomes or control recommendations.

## Run on Windows

From the project folder, install dependencies and reproduce the processed data, metrics, and charts:

```powershell
python -m pip install -r ml/requirements.txt
python ml/eda_real_data.py
python ml/train_real_models.py
```

Serve the dashboard from the project folder so the Three.js module and benchmark images load correctly:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/dashboard/` in Chrome or Edge. Three.js and Chart.js load from public CDNs, so the browser needs internet access. The telemetry remains simulated; the dashboard has no plant connection or backend.

To jump directly to a specific historical physical sample, append a sample index to the query string, for example:

```text
http://localhost:8000/dashboard/?physical-replay=3
```

This opens the digital twin at a specific UCI measured record so the plant scene and instrument values reflect a chosen physical sample instead of starting at the first row.

## Included

- `dashboard/`: responsive dashboard, stylized 3D twin, simulated unit telemetry, and benchmark result views.
- `ml/eda_real_data.py`: analyzes NASA C-MAPSS FD001 and UCI CCPP files, then saves plots and processed CSVs.
- `ml/train_real_models.py`: selects a C-MAPSS RUL model using engine-held-out validation, evaluates it on NASA's official FD001 test labels, and evaluates CCPP power-output regression on a held-out split.
- `ml/models/metrics.json`: latest benchmark metrics.
- `docs/ROUND2_PROBLEM_ID.md`: two-slide problem-identification draft.
- `docs/ROUND3_DETAILED.md`: seven content-slide outline, sources, and optional pitch script.
- `docs/ARCHITECTURE.md`: implemented prototype boundary and proposed HPCL pilot architecture.
- `docs/INNOVATION_CATALOG.md`: exploratory idea catalogue; it does not replace choosing the official challenge track.

`ml/generate_data.py` and `ml/train_models.py` are the original synthetic-data experiment. They are separate from the reproducible public-benchmark pipeline above; their synthetic scores are not used in `metrics.json` or the dashboard's benchmark table.

## Current Benchmark Results

- NASA C-MAPSS FD001: Gradient Boosting MAE 12.16 cycles on 100 official test engines; RUL labels capped at 125 cycles. Median-training-label baseline MAE: 38.01 cycles.
- UCI CCPP: Gradient Boosting MAE 2.220 MW and R-squared 0.968 on a fixed 20% held-out split (1,914 rows).
- Isolation Forest: flagged 6 of 100 NASA test-engine endpoints. The dataset has no anomaly labels, so this is not an accuracy or recall score.

These results demonstrate methods on adjacent public benchmarks only. They do not establish refinery RUL accuracy, energy savings, emissions reductions, or HPCL operational impact. A refinery pilot requires approved historical, unit-specific data and review by plant engineers.

## Competition Drafts

The Unstop page specifies two Round 2 slides and seven Round 3 content slides, excluding title and references/source slides. Confirm the exact business-track name and track video before submission; the public event page does not provide that detailed brief.
