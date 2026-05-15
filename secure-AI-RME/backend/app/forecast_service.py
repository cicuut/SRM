from __future__ import annotations

import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import func

from app.models import MedicalRecord, Patient, PregnancyRecord, VisitMaster, db

try:
    import holidays
except ImportError:  # pragma: no cover
    holidays = None

MODEL_DIR = Path(__file__).resolve().parent.parent / "forecast"

SERVICE_MODELS: Dict[str, dict] = {
    "Kehamilan": {
        "file": "model_kehamilan_1.joblib",
        "features": [
            "lag_30",
            "rolling_mean_30",
            "is_first_half",
            "is_weekend",
            "is_holiday",
        ],
    },
    "Keluarga Berencana": {
        "file": "model_famplan_1.joblib",
        "features": [
            "lag_30",
            "lag_60",
            "lag_90",
            "day_of_month",
            "is_weekend",
            "is_first_half",
            "is_saturday",
        ],
    },
    "Umum": {
        "file": "model_polum_1.joblib",
        "features": [
            "lag_1",
            "lag_7",
            "rolling_mean_7",
            "rolling_std_7",
            "day_of_week",
            "is_weekend",
            "is_saturday",
            "is_holiday",
        ],
    },
    "Imunisasi": {
        "file": "model_vaksin_1.joblib",
        "features": [
            "lag_1",
            "lag_7",
            "lag_30",
            "day_of_month",
            "is_weekend",
            "is_first_half",
        ],
    },
    "Persalinan": {
        "file": "model_melahirkan_1.joblib",
        "features": [
            "hpl_count",
            "day_of_week",
            "is_first_half",
            "is_weekend",
        ],
    },
}

_loaded_models: Dict[str, object] = {}
_holiday_cache: Dict[int, set] = {}


def _load_model(service_type: str):
    if service_type not in _loaded_models:
        config = SERVICE_MODELS[service_type]
        path = MODEL_DIR / config["file"]
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {path}")
        _loaded_models[service_type] = joblib.load(path)
    return _loaded_models[service_type]


def _holiday_dates(year: int) -> set:
    if year not in _holiday_cache:
        if holidays is not None:
            _holiday_cache[year] = set(holidays.Indonesia(years=year).keys())
        else:
            _holiday_cache[year] = set()
    return _holiday_cache[year]


def _is_holiday(target: date) -> int:
    return int(target in _holiday_dates(target.year))


def _series_value(series: Dict[date, float], target: date) -> float:
    return float(series.get(target, 0.0))


def _rolling_mean(series: Dict[date, float], target: date, window: int) -> float:
    values = [
        _series_value(series, target - timedelta(days=offset))
        for offset in range(1, window + 1)
    ]
    return float(np.mean(values)) if values else 0.0


def _rolling_std(series: Dict[date, float], target: date, window: int) -> float:
    values = [
        _series_value(series, target - timedelta(days=offset))
        for offset in range(1, window + 1)
    ]
    return float(np.std(values)) if values else 0.0


def _build_feature_row(
    service_type: str,
    series: Dict[date, float],
    target: date,
    hpl_counts: Optional[Dict[date, int]] = None,
) -> Dict[str, float]:
    weekday = target.weekday()
    row = {
        "lag_1": _series_value(series, target - timedelta(days=1)),
        "lag_7": _series_value(series, target - timedelta(days=7)),
        "lag_30": _series_value(series, target - timedelta(days=30)),
        "lag_60": _series_value(series, target - timedelta(days=60)),
        "lag_90": _series_value(series, target - timedelta(days=90)),
        "rolling_mean_7": _rolling_mean(series, target, 7),
        "rolling_mean_30": _rolling_mean(series, target, 30),
        "rolling_std_7": _rolling_std(series, target, 7),
        "day_of_week": weekday,
        "day_of_month": target.day,
        "is_weekend": int(weekday >= 5),
        "is_saturday": int(weekday == 5),
        "is_first_half": int(target.day <= 15),
        "is_holiday": _is_holiday(target),
        "hpl_count": float((hpl_counts or {}).get(target, 0)),
    }
    feature_names = SERVICE_MODELS[service_type]["features"]
    return {name: row[name] for name in feature_names}


def _parse_clinic_id(clinic_id: Union[str, uuid.UUID]) -> uuid.UUID:
    if isinstance(clinic_id, uuid.UUID):
        return clinic_id
    return uuid.UUID(str(clinic_id))


def get_monthly_visit_total(
    clinic_id: str, month_start: date, end_date: date
) -> int:
    clinic_uuid = _parse_clinic_id(clinic_id)
    total = (
        db.session.query(func.count(VisitMaster.visit_id))
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .filter(
            Patient.clinic_id == clinic_uuid,
            VisitMaster.visit_date >= month_start,
            VisitMaster.visit_date <= end_date,
        )
        .scalar()
    )
    return int(total or 0)


def get_monthly_counts_by_service(
    clinic_id: str, month_start: date, end_date: date
) -> Dict[str, int]:
    clinic_uuid = _parse_clinic_id(clinic_id)
    rows = (
        db.session.query(
            MedicalRecord.record_type,
            func.count(VisitMaster.visit_id),
        )
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .filter(
            Patient.clinic_id == clinic_uuid,
            VisitMaster.visit_date >= month_start,
            VisitMaster.visit_date <= end_date,
        )
        .group_by(MedicalRecord.record_type)
        .all()
    )
    return {str(record_type): int(total) for record_type, total in rows}


def get_daily_visit_counts(
    clinic_id: str, record_type: str, start_date: date, end_date: date
) -> Dict[date, int]:
    clinic_uuid = _parse_clinic_id(clinic_id)
    rows = (
        db.session.query(VisitMaster.visit_date, func.count(VisitMaster.visit_id))
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .filter(
            Patient.clinic_id == clinic_uuid,
            MedicalRecord.record_type == record_type,
            VisitMaster.visit_date >= start_date,
            VisitMaster.visit_date <= end_date,
        )
        .group_by(VisitMaster.visit_date)
        .all()
    )

    counts: Dict[date, int] = {}
    for visit_date, total in rows:
        if visit_date is None:
            continue
        day = visit_date.date() if hasattr(visit_date, "date") else visit_date
        counts[day] = int(total)
    return counts


def get_hpl_counts_by_date(
    clinic_id: str, start_date: date, end_date: date
) -> Dict[date, int]:
    """Jumlah pasien kehamilan dengan HPL (expected_due_date) pada tanggal tertentu."""
    clinic_uuid = _parse_clinic_id(clinic_id)
    rows = (
        db.session.query(
            PregnancyRecord.expected_due_date,
            func.count(PregnancyRecord.pr_id),
        )
        .join(MedicalRecord, PregnancyRecord.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .filter(
            Patient.clinic_id == clinic_uuid,
            PregnancyRecord.expected_due_date.isnot(None),
            PregnancyRecord.expected_due_date >= start_date,
            PregnancyRecord.expected_due_date <= end_date,
        )
        .group_by(PregnancyRecord.expected_due_date)
        .all()
    )

    counts: Dict[date, int] = {}
    for due_date, total in rows:
        if due_date is None:
            continue
        day = due_date.date() if hasattr(due_date, "date") else due_date
        counts[day] = int(total)
    return counts


def _fill_series(
    counts: Dict[date, int], start_date: date, end_date: date
) -> Dict[date, float]:
    series: Dict[date, float] = {}
    current = start_date
    while current <= end_date:
        series[current] = float(counts.get(current, 0))
        current += timedelta(days=1)
    return series


def predict_single_day(
    service_type: str,
    series: Dict[date, float],
    target: date,
    hpl_counts: Optional[Dict[date, int]] = None,
) -> float:
    model = _load_model(service_type)
    features = _build_feature_row(service_type, series, target, hpl_counts)
    feature_names = SERVICE_MODELS[service_type]["features"]
    frame = pd.DataFrame([[features[name] for name in feature_names]], columns=feature_names)
    prediction = float(model.predict(frame)[0])
    return max(0.0, round(prediction))


def forecast_date_range(
    service_type: str,
    historical_counts: Dict[date, int],
    forecast_start: date,
    forecast_end: date,
    history_start: Optional[date] = None,
    hpl_counts: Optional[Dict[date, int]] = None,
) -> Tuple[List[dict], Dict[date, float]]:
    if history_start is None:
        history_start = forecast_start - timedelta(days=120)

    series = _fill_series(historical_counts, history_start, forecast_end)
    predictions: List[dict] = []
    current = forecast_start

    while current <= forecast_end:
        predicted = predict_single_day(
            service_type, series, current, hpl_counts=hpl_counts
        )
        series[current] = predicted
        predictions.append({"date": current.isoformat(), "count": int(round(predicted))})
        current += timedelta(days=1)

    return predictions, series


def get_month_bounds(reference: Optional[date] = None) -> Tuple[date, date]:
    today = reference or date.today()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = date(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(today.year, today.month + 1, 1) - timedelta(days=1)
    return month_start, month_end


def build_forecast_payload(clinic_id: str, reference: Optional[date] = None) -> dict:
    today = reference or date.today()
    month_start, month_end = get_month_bounds(today)
    history_start = month_start - timedelta(days=120)

    history: List[dict] = []
    forecast: List[dict] = []
    by_service: Dict[str, dict] = {}

    month_end_actual = min(today, month_end)
    monthly_actual = get_monthly_visit_total(clinic_id, month_start, month_end_actual)
    monthly_counts_by_service = get_monthly_counts_by_service(
        clinic_id, month_start, month_end_actual
    )
    forecast_remaining_total = 0
    hpl_counts = get_hpl_counts_by_date(clinic_id, history_start, month_end)

    for service_type in SERVICE_MODELS:
        counts = get_daily_visit_counts(
            clinic_id, service_type, history_start, today
        )
        actual_this_month = sum(
            total
            for day, total in counts.items()
            if month_start <= day <= min(today, month_end)
        )

        forecast_start = today + timedelta(days=1)
        service_forecast: List[dict] = []
        forecast_total = 0

        if forecast_start <= month_end:
            service_forecast, _ = forecast_date_range(
                service_type,
                counts,
                forecast_start,
                month_end,
                history_start=history_start,
                hpl_counts=hpl_counts if service_type == "Persalinan" else None,
            )
            forecast_total = sum(item["count"] for item in service_forecast)

        service_history = [
            {"date": day.isoformat(), "count": int(total)}
            for day, total in sorted(counts.items())
            if day >= month_start and day <= today
        ]

        by_service[service_type] = {
            "actual_month_to_date": actual_this_month,
            "forecast_remaining_month": forecast_total,
            "forecast_month_total": actual_this_month + forecast_total,
            "history": service_history,
            "forecast": service_forecast,
            "has_model": True,
        }

        forecast_remaining_total += forecast_total

        history.extend(service_history)
        forecast.extend(service_forecast)

    for record_type, actual_count in monthly_counts_by_service.items():
        if record_type in by_service:
            continue

        by_service[record_type] = {
            "actual_month_to_date": actual_count,
            "forecast_remaining_month": 0,
            "forecast_month_total": actual_count,
            "history": [],
            "forecast": [],
            "has_model": False,
        }

    monthly_forecast = monthly_actual + forecast_remaining_total

    aggregated_history = _aggregate_daily_points(history)
    aggregated_forecast = _aggregate_daily_points(forecast)

    return {
        "month": month_start.strftime("%Y-%m"),
        "monthly_actual": monthly_actual,
        "monthly_forecast": monthly_forecast,
        "history": aggregated_history,
        "forecast": aggregated_forecast,
        "by_service": by_service,
    }


def _aggregate_daily_points(points: List[dict]) -> List[dict]:
    totals: Dict[str, int] = {}
    for point in points:
        totals[point["date"]] = totals.get(point["date"], 0) + point["count"]
    return [
        {"date": day, "count": totals[day]}
        for day in sorted(totals.keys())
    ]
