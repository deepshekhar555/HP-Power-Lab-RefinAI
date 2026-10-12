"""
RefinAI — Train models on REAL datasets.

Model A: Remaining Useful Life (RUL) Prediction — NASA C-MAPSS FD001
         RandomForest + GradientBoosting on sensor features -> RUL regression
         (Predictive Maintenance)

Model B: Power Plant Energy Output Prediction — UCI CCPP
         GradientBoosting on AT, V, AP, RH -> PE (MW)
         (Energy Efficiency / Optimization)

Saves models, metrics, and validation plots to ml/models/ and ml/analytics/.
"""
import os, json
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import (
    RandomForestRegressor,
    GradientBoostingRegressor,
    IsolationForest,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
MODEL = os.path.join(HERE, "models")
ANALYTICS = os.path.join(HERE, "analytics")
REPLAY_OUT = os.path.join(HERE, "..", "dashboard", "ccpp_replay.json")
os.makedirs(MODEL, exist_ok=True)
os.makedirs(ANALYTICS, exist_ok=True)

metrics = {}
CMAPSS_COLS = (
    ["engine_id", "cycle"]
    + [f"setting_{i}" for i in range(1, 4)]
    + [f"sensor_{i}" for i in range(1, 22)]
)

# ════════════════════════════════════════════════════════════
# MODEL A — RUL Prediction (Predictive Maintenance)
# ════════════════════════════════════════════════════════════
def train_rul():
    print("=" * 60)
    print("MODEL A: RUL Prediction (NASA C-MAPSS FD001)")
    print("=" * 60)
    df = pd.read_csv(os.path.join(DATA, "cmapss_fd001_train.csv"))
    rul_cap = 125
    df["RUL"] = df["RUL"].clip(upper=rul_cap)

    sensors = [c for c in df.columns if c.startswith("sensor_")]
    settings = [c for c in df.columns if c.startswith("setting_")]
    feats = sensors + settings

    # Keep entire engines on one side of the validation split.
    engine_ids = np.sort(df["engine_id"].unique())
    train_ids, val_ids = train_test_split(engine_ids, test_size=0.2, random_state=42)
    train_df = df[df["engine_id"].isin(train_ids)]
    val_df = df[df["engine_id"].isin(val_ids)]

    std = train_df[feats].std()
    drop = std[std < 0.01].index.tolist()
    feats = [f for f in feats if f not in drop]
    print(f"  Using {len(feats)} features (dropped {len(drop)} near-constant)")

    scaler_val = StandardScaler().fit(train_df[feats])
    x_train = scaler_val.transform(train_df[feats])
    x_val = scaler_val.transform(val_df[feats])
    y_train = train_df["RUL"].values
    y_val = val_df["RUL"].values

    candidates = {
        "RandomForest": RandomForestRegressor(
            n_estimators=200, max_depth=18, random_state=42, n_jobs=-1
        ),
        "GradientBoosting": GradientBoostingRegressor(
            n_estimators=300, max_depth=5, learning_rate=0.08, random_state=42
        ),
    }
    validation = {}
    for name, model in candidates.items():
        model.fit(x_train, y_train)
        prediction = model.predict(x_val)
        validation[name] = {
            "MAE": mean_absolute_error(y_val, prediction),
            "RMSE": np.sqrt(mean_squared_error(y_val, prediction)),
            "R2": r2_score(y_val, prediction),
        }

    best_name = min(validation, key=lambda name: validation[name]["MAE"])
    best_model = candidates[best_name]
    print("\n  Engine-held-out validation:")
    for name, result in validation.items():
        print(f"  {name:16s} MAE={result['MAE']:.2f}  RMSE={result['RMSE']:.2f}  R2={result['R2']:.4f}")
    print(f"  Selected: {best_name}")

    # Refit on all training engines, then score the official FD001 test engines.
    x_all = df[feats].values
    y_all = df["RUL"].values
    scaler = StandardScaler().fit(x_all)
    x_all_scaled = scaler.transform(x_all)
    best_model.fit(x_all_scaled, y_all)

    test_path = os.path.join(HERE, "data", "raw", "test_FD001.txt")
    rul_path = os.path.join(HERE, "data", "raw", "RUL_FD001.txt")
    test_df = pd.read_csv(test_path, sep=r"\s+", header=None, names=CMAPSS_COLS)
    last_rows = test_df.sort_values(["engine_id", "cycle"]).groupby("engine_id").tail(1)
    y_test = np.loadtxt(rul_path).reshape(-1).clip(max=rul_cap)
    if len(last_rows) != len(y_test):
        raise ValueError("Official FD001 test rows and RUL labels do not align")
    x_test = scaler.transform(last_rows[feats].values)
    test_pred = best_model.predict(x_test)
    test_mae = mean_absolute_error(y_test, test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, test_pred))
    test_r2 = r2_score(y_test, test_pred)
    baseline_pred = np.full_like(y_test, np.median(y_all), dtype=float)
    baseline_mae = mean_absolute_error(y_test, baseline_pred)
    print(f"\n  Official FD001 test ({len(y_test)} engines, RUL capped at {rul_cap}):")
    print(f"  {best_name}: MAE={test_mae:.2f}  RMSE={test_rmse:.2f}  R2={test_r2:.4f}")
    print(f"  Median baseline MAE={baseline_mae:.2f}")

    joblib.dump(best_model, os.path.join(MODEL, "rul_predictor.pkl"))
    joblib.dump(scaler, os.path.join(MODEL, "rul_scaler.pkl"))
    joblib.dump(feats, os.path.join(MODEL, "rul_features.pkl"))

    metrics["RUL"] = {
        "model": best_name,
        "MAE": round(test_mae, 2),
        "RMSE": round(test_rmse, 2),
        "R2": round(test_r2, 4),
        "validation_MAE": round(validation[best_name]["MAE"], 2),
        "baseline_MAE": round(baseline_mae, 2),
        "dataset": "NASA C-MAPSS FD001 official test set",
        "train_rows": len(df),
        "train_engines": int(df["engine_id"].nunique()),
        "test_engines": int(len(y_test)),
        "rul_cap_cycles": rul_cap,
        "evaluation": "Engine-held-out model selection; official FD001 test labels",
    }

    iso = IsolationForest(n_estimators=200, contamination=0.07, random_state=42)
    iso.fit(x_all_scaled)
    anomaly_test = iso.predict(x_test)
    n_anom = int((anomaly_test == -1).sum())
    print(f"  Unsupervised anomaly model flagged {n_anom} / {len(x_test)} official test engines")
    joblib.dump(iso, os.path.join(MODEL, "anomaly_cmapss.pkl"))
    metrics["Anomaly"] = {
        "flagged": n_anom,
        "total": int(len(x_test)),
        "dataset": "NASA C-MAPSS FD001 official test endpoints",
        "evaluation": "Unsupervised flags only; no anomaly ground-truth labels",
    }

    # Plot official held-out engine predictions and fitted-model importances.
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    axes[0].scatter(y_test, test_pred, s=16, alpha=0.65, color="#2f7cf6")
    axes[0].plot([0, rul_cap], [0, rul_cap], "r--", lw=1)
    axes[0].set_xlabel("Actual RUL (cycles)"); axes[0].set_ylabel("Predicted RUL (cycles)")
    axes[0].set_title(f"Official FD001 Test: {best_name}\nMAE={test_mae:.1f}, R2={test_r2:.3f}")

    # Feature importance
    imp = best_model.feature_importances_
    idx = np.argsort(imp)[-12:]
    axes[1].barh([feats[i] for i in idx], imp[idx], color="#22c55e")
    axes[1].set_title("Top 12 Feature Importances for RUL")
    fig.tight_layout()
    fig.savefig(os.path.join(ANALYTICS, "rul_results.png"))
    plt.close(fig)
    print("  -> saved rul_results.png\n")


# ════════════════════════════════════════════════════════════
# MODEL B — Energy Output Prediction (Energy Efficiency)
# ════════════════════════════════════════════════════════════
def train_energy():
    print("=" * 60)
    print("MODEL B: Energy Output (UCI Combined-Cycle Power Plant)")
    print("=" * 60)
    df = pd.read_csv(os.path.join(DATA, "ccpp_clean.csv"))

    X = df[["AT", "V", "AP", "RH"]].values
    y = df["PE"].values

    train_indices, test_indices = train_test_split(
        np.arange(len(df)), test_size=0.2, random_state=42
    )
    Xtr, Xte = X[train_indices], X[test_indices]
    ytr, yte = y[train_indices], y[test_indices]
    scaler = StandardScaler().fit(Xtr)
    Xtr = scaler.transform(Xtr)
    Xte = scaler.transform(Xte)

    gb = GradientBoostingRegressor(n_estimators=400, max_depth=5, learning_rate=0.08, random_state=42)
    gb.fit(Xtr, ytr)
    pred = gb.predict(Xte)
    mae = mean_absolute_error(yte, pred)
    rmse = np.sqrt(mean_squared_error(yte, pred))
    r2 = r2_score(yte, pred)

    print(f"  GradBoosting -> MAE={mae:.3f} MW  RMSE={rmse:.3f} MW  R2={r2:.5f}")

    joblib.dump(gb, os.path.join(MODEL, "energy_ccpp.pkl"))
    joblib.dump(scaler, os.path.join(MODEL, "energy_ccpp_scaler.pkl"))

    metrics["Energy"] = {
        "model": "GradientBoosting",
        "MAE_MW": round(mae, 3),
        "RMSE_MW": round(rmse, 3),
        "R2": round(r2, 5),
        "dataset": "UCI Combined Cycle Power Plant",
        "rows": len(df),
        "test_rows": int(len(yte)),
        "evaluation": "Held-out 20% test split; random_state=42",
    }

    # A negative test residual is a model discrepancy, not verified energy waste.
    residual = yte - pred
    underprediction_mask = residual < -1
    metrics["Energy"]["test_underpredicted_points"] = int(underprediction_mask.sum())
    metrics["Energy"]["residual_note"] = "Model residual proxy only; not measured plant waste"
    print(f"  Test rows with actual output > prediction by 1 MW: {underprediction_mask.sum()} / {len(yte)}")

    replay = df.iloc[test_indices][["AT", "V", "AP", "RH", "PE"]].copy().reset_index(drop=True)
    replay.insert(0, "sample_id", [int(index + 1) for index in test_indices])
    replay["PE_pred"] = pred
    replay["residual_MW"] = residual
    replay_payload = {
        "source": "UCI Combined Cycle Power Plant dataset",
        "source_url": "https://archive.ics.uci.edu/dataset/294/combined+cycle+power+plant",
        "source_period": "2006-2011",
        "sample_count": len(replay),
        "sample_order": "Fixed held-out split order; the source records have no timestamps and are shuffled, not chronological.",
        "fields": {
            "AT": "Ambient temperature (C)",
            "V": "Exhaust vacuum (cm Hg)",
            "AP": "Ambient pressure (mbar)",
            "RH": "Relative humidity (%)",
            "PE": "Measured net electrical output (MW)",
            "PE_pred": "Gradient Boosting model estimate (MW)",
            "residual_MW": "Measured output minus model estimate (MW)",
        },
        "samples": replay.round(4).to_dict(orient="records"),
    }
    with open(REPLAY_OUT, "w", encoding="utf-8") as f:
        json.dump(replay_payload, f, separators=(",", ":"))
    metrics["Energy"]["replay_file"] = "dashboard/ccpp_replay.json"
    print(f"  -> exported {len(replay)} measured test samples to {REPLAY_OUT}")

    # Plot
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    axes[0].scatter(yte, pred, s=4, alpha=0.3, color="#ef4444")
    axes[0].plot([410, 500], [410, 500], "k--", lw=1)
    axes[0].set_xlabel("Actual PE (MW)"); axes[0].set_ylabel("Predicted PE (MW)")
    axes[0].set_title(f"Energy: Actual vs Predicted\nMAE={mae:.2f} MW, R2={r2:.4f}")

    axes[1].hist(residual, bins=40, color="#f59e0b", edgecolor="white")
    axes[1].axvline(0, color="red", ls="--")
    axes[1].set_xlabel("Residual (MW)"); axes[1].set_ylabel("Count")
    axes[1].set_title("Held-out Test Residuals (actual - predicted)")
    fig.tight_layout()
    fig.savefig(os.path.join(ANALYTICS, "energy_results.png"))
    plt.close(fig)
    print("  -> saved energy_results.png\n")


# ════════════════════════════════════════════════════════════
if __name__ == "__main__":
    train_rul()
    train_energy()

    with open(os.path.join(MODEL, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    print("All metrics:", json.dumps(metrics, indent=2))
    print(f"\nModels saved to: {MODEL}")
