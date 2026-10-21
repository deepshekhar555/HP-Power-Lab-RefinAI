# RefinAI — Competition Pitch Draft

This draft is a benchmark-backed proposal, not a claim of HPCL deployment or guaranteed competition outcome. Confirm the exact challenge track and problem statement against the official event materials before submission.

## One-line pitch

RefinAI demonstrates how process conditions and an output baseline can help an operator spot an unusual generation deviation and decide what evidence to review next.

## Demonstration

1. Replay a measured record from the UCI Combined Cycle Power Plant dataset.
2. Show the model's net-output estimate, split-conformal interval, and measured output.
3. Review input completeness/support plus PCA Hotelling T-squared and Q-residual benchmark screens and their largest statistical contributions.
4. Capture a browser-local accept/defer/reject response; explain that no single residual or statistical screen identifies a fault.

## Evidence

- UCI CCPP contains 9,568 measured observations. The evaluation uses a fixed held-out 20% split of 1,914 rows.
- Gradient Boosting performance on that split: MAE 2.262 MW, RMSE 3.109 MW, and R-squared 0.96667. A separate 90% split-conformal interval had 91.27% held-out test coverage on this split only; this is not refinery calibration.
- PCA retained three components (97.45% fit variance); T-squared and Q screens flagged 1.20% and 1.04% of test records against calibration references. No fault labels are present, so these are not detection performance metrics.
- NASA C-MAPSS FD001 reports 12.16-cycle RUL MAE on its official test set, but it is simulated aircraft-engine data and is an adjacent-method benchmark only.
- Neither benchmark measures HPCL refinery performance, energy waste, failures, or savings.

## Proposed pilot and value test

Request an approved, read-only historian export for one agreed unit. Align tags, timestamps, operating regimes, and quality flags; then run a shadow-mode review with engineers. Measure coverage, false alerts at an agreed review capacity, lead time, operator usefulness, and stability before estimating impact.

The value explorer uses editable placeholders for recovery, operating hours, tariff, O&M, and pilot cost. It is a scenario calculator, not a savings forecast. Replace every assumption with HPCL-approved values and measured pilot outcomes before presenting payback as a business result.

## Closing

RefinAI is a testable decision-support hypothesis: compare measured process context with an expected-output baseline, make deviations easier to review, and proceed only if an approved shadow pilot proves useful. It does not write to controls or replace engineering judgment.
