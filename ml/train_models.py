"""
RefinAI ML pipeline. Trains three models on the synthetic refinery dataset:

  1. Energy Anomaly Detection  -> IsolationForest on process signals
  2. Predictive Maintenance     -> RandomForestClassifier (failure_label)
  3. Energy Regression          -> GradientBoostingRegressor (expected energy)

Prints metrics and saves models to ml/models/.

Usage:
  python generate_data.py   # first time only
  python train_models.py
"""
import os
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import (
    IsolationForest,
    RandomForestClassifier,
    GradientBoostingRegressor,
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    mean_absolute_error,
    r2_score,
)

here = os.path.dirname(os.path.abspath(__file__))
data_path = os.path.join(here, "data", "refinery_sensors.csv")
model_dir = os.path.join(here, "models")
os.makedirs(model_dir, exist_ok=True)

FEATURES = [
    "temperature_c", "pressure_bar", "flow_m3h",
    "vibration_mms", "fuel_rate_kgh", "energy_kwh",
]


def load():
    if not os.path.exists(data_path):
        raise SystemExit(
            "Dataset not found. Run `python generate_data.py` first."
        )
    return pd.read_csv(data_path)


def train_anomaly(df):
    model = IsolationForest(n_estimators=200, contamination=0.08, random_state=42)
    model.fit(df[FEATURES])
    pred = model.predict(df[FEATURES])
    anomalies = int((pred == -1).sum())
    joblib.dump(model, os.path.join(model_dir, "anomaly_isolation_forest.pkl"))
    print(f"[1] Anomaly model trained. Flagged {anomalies} / {len(df)} readings.")
    return model


def train_failure(df):
    X = df[FEATURES]
    y = df["failure_label"]
    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )
    model = RandomForestClassifier(
        n_estimators=200, class_weight="balanced", random_state=42
    )
    model.fit(Xtr, ytr)
    print("[2] Predictive-maintenance model:")
    print(classification_report(yte, model.predict(Xte), zero_division=0))
    joblib.dump(model, os.path.join(model_dir, "failure_random_forest.pkl"))
    return model


def train_energy(df):
    # Predict energy from process signals; residual = wasted energy
    X = df[["temperature_c", "pressure_bar", "flow_m3h", "fuel_rate_kgh"]]
    y = df["energy_kwh"]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42)
    model = GradientBoostingRegressor(random_state=42)
    model.fit(Xtr, ytr)
    pred = model.predict(Xte)
    print("[3] Energy regression model:")
    print(f"    MAE = {mean_absolute_error(yte, pred):.2f} kWh")
    print(f"    R2  = {r2_score(yte, pred):.4f}")
    df = df.copy()
    df["energy_expected"] = model.predict(X)
    df["energy_waste"] = (df["energy_kwh"] - df["energy_expected"]).clip(lower=0)
    wasted = df["energy_waste"].sum()
    print(f"    Total wasted energy detected = {wasted:,.0f} kWh")
    joblib.dump(model, os.path.join(model_dir, "energy_gbr.pkl"))
    return model


if __name__ == "__main__":
    df = load()
    print(f"Loaded {len(df)} rows, {df.shape[1]} columns.\n")
    train_anomaly(df)
    print()
    train_failure(df)
    print()
    train_energy(df)
    print("\nAll models saved to:", model_dir)
