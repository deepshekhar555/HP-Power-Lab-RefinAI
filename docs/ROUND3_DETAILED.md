# Round 3 | Detailed Presentation (Seven Content Slides)

Use seven content slides, plus a title slide and a references/source slide. Confirm the official business-track problem before finalizing. This outline distinguishes implemented prototype features from proposed pilot work.

## Slide 1 | Opportunity and User

- User: refinery process, energy, and maintenance engineers reviewing unit performance.
- Opportunity: bring operating context, energy behavior, and asset-health trends into a shared review workflow.
- Frame as a hypothesis to validate against the selected HPCL context video; do not claim HPCL has no monitoring or quantify unverified losses.
- Decision to improve: which deviation deserves investigation first, and what evidence supports that review?

## Slide 2 | RefinAI Workflow

- Ingest approved, time-aligned historian data for one pilot unit.
- Compare readings with baselines conditioned on operating regime.
- Detect deviations, explain contributing tags, and show confidence and limits.
- Ask an operator to accept, defer, or reject a review prompt and record why.
- Run in read-only shadow mode; no control-system writes.

## Slide 3 | Prototype and System Boundary

- Demonstrate `dashboard/index.html`: historical UCI replay, Three.js scene, per-sample conformal interval, model-input support check, and browser-local accept/defer/reject review log.
- The browser simulation is not a live HPCL digital twin; it uses no plant connection.
- The Python benchmark models are separate from the scene and do not drive dashboard telemetry or alerts.
- Proposed pilot architecture: approved historian export -> data quality/regime checks -> unit-specific models -> human-reviewed shadow alerts.

## Slide 4 | Evidence from Public Benchmarks

- NASA C-MAPSS FD001: Gradient Boosting RUL MAE 12.16 cycles on the official 100-engine test set; RUL capped at 125 cycles. Median-training-label baseline MAE: 38.01 cycles.
- UCI Combined Cycle Power Plant: power-output regression MAE 2.262 MW, R-squared 0.96667, on a fixed 20% held-out split (1,914 rows); split-conformal 90% interval test coverage 91.27% on this split only. PCA T-squared/Q screens are included as unlabeled statistical outlier context; no fault accuracy is claimed.
- Isolation Forest flagged 6/100 NASA test endpoints; no anomaly labels exist, so no detection accuracy is reported.
- These datasets are adjacent-method benchmarks, not refinery data or refinery validation. Show `ml/models/metrics.json` and cite the source datasets.

## Slide 5 | Pilot Measurement Plan

- Agree one unit, operating regimes, tag dictionary, sampling interval, historian access, and maintenance/energy labels with HPCL engineers.
- Establish a seasonal and operating-regime-aware baseline before model comparison.
- Measure data coverage, alert precision at an agreed review capacity, warning lead time, missed events, operator usefulness, and model stability across regimes.
- Estimate cost and emissions only from approved site factors and measured changes; report uncertainty.
- Gate: no scale-up until operators and engineering validate usefulness, safety, and data quality.

## Slide 6 | Safety, Governance, and Adoption

- Read-only, least-privilege data path; align cybersecurity and retention with HPCL OT/IT policy.
- Explanations, uncertainty, audit logs, and operator feedback accompany every prompt.
- No autonomous setpoint changes; existing control strategies, procedures, and safety interlocks remain authoritative.
- Monitor sensor drift, missing data, regime changes, false alerts, and model performance after any approved deployment.

## Slide 7 | Scale-up Decision and Value Case

- Stage 1: data feasibility and operator co-design.
- Stage 2: shadow-mode pilot on one agreed unit.
- Stage 3: compare measured outcomes with a documented baseline; proceed only if pre-agreed gates are met.
- Stage 4: assess transferability to another unit; retrain and revalidate rather than assuming one model generalizes.
- Business case formula: measured change in energy intensity x approved production basis x approved tariff/emissions factors, minus implementation and operating costs. No savings or payback is claimed before site validation.

## References / Source Slide

- HP Power Lab 3.0 official event page: https://unstop.com/competitions/crp-hp-power-lab-30-hindustan-petroleum-corporation-ltd-1761011
- NASA Prognostics Center of Excellence data repository, C-MAPSS: https://ti.arc.nasa.gov/tech/dash/groups/pcoe/prognostic-data-repository/
- UCI Machine Learning Repository, Combined Cycle Power Plant: https://archive.ics.uci.edu/dataset/294/combined+cycle+power+plant
- C-MAPSS reference: A. Saxena et al., "Damage Propagation Modeling for Aircraft Engine Run-to-Failure Simulation," PHM 2008.
- UCI CCPP references and data details: see the UCI dataset page and included `ml/data/raw/CCPP/Readme.txt`.
- S. J. Qin, "Survey on data-driven industrial process monitoring and diagnosis," *Annual Reviews in Control*, 36(2), 220–234 (2012), https://doi.org/10.1016/j.arcontrol.2012.09.004.
- A. K. S. Jardine, D. Lin, and D. Banjevic, "A review on machinery diagnostics and prognostics implementing condition-based maintenance," *Mechanical Systems and Signal Processing*, 20(7), 1483–1510 (2006), https://doi.org/10.1016/j.ymssp.2005.09.012.
- J. E. Jackson and G. S. Mudholkar, "Control procedures for residuals associated with principal component analysis," *Technometrics*, 21(3), 341–349 (1979), https://doi.org/10.1080/00401706.1979.10489779.
- A. N. Angelopoulos and S. Bates, "A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification," arXiv:2107.07511, https://arxiv.org/abs/2107.07511.

## Optional Three-Minute Video Outline

1. 0:00-0:25: State the opportunity as a question and name the refinery user.
2. 0:25-0:55: Explain the proposed review workflow and the need to validate it against the HPCL track context.
3. 0:55-1:35: Show the 3D prototype; explicitly label the telemetry as simulated.
4. 1:35-2:10: Present the two public benchmark results and their limits; do not call them refinery results.
5. 2:10-2:45: Explain the read-only, human-reviewed pilot and how impact would be measured.
6. 2:45-3:00: Close with the pilot decision gate and data needed from HPCL.
