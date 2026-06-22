from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import false, func

from app.models import (
    DeliveryRecord,
    MedicalRecord,
    Patient,
    PregnancyRecord,
    User,
    VisitMaster,
    db,
)
from app.utils import get_jakarta_now

try:
    import holidays
except ImportError:
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
        "file": "model_famplan_2.joblib",
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
        "file": "model_vaksin_2.joblib",
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
        "file": "model_melahirkan_2.joblib",
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


def _role_to_text(value) -> str:
    if value is None:
        return ""

    if hasattr(value, "value"):
        return str(value.value)

    return str(value)


def _normalize_role(role: Optional[str]) -> str:
    normalized = str(role or "").strip().lower()

    role_aliases = {
        "admin": "admin",
        "developer": "admin",
        "midwife": "midwife",
        "bidan": "midwife",
        "owner": "midwife",
        "asisten": "asisten",
        "assistant": "asisten",
        "staff": "asisten",
    }

    return role_aliases.get(normalized, normalized)


def _normalize_clinic_id(clinic_id) -> str:
    normalized = str(clinic_id or "").strip()

    if not normalized:
        return ""

    if normalized.lower() in {"none", "null", "undefined"}:
        return ""

    return normalized


def _get_current_user_from_jwt() -> Optional[User]:
    try:
        user_id = get_jwt_identity()
    except Exception:
        return None

    if not user_id:
        return None

    return db.session.get(User, user_id)


def _resolve_clinic_scope(
    *,
    current_user=None,
    current_role: Optional[str] = None,
    role: Optional[str] = None,
    clinic_id=None,
    user_id: Optional[str] = None,
    include_all_clinics: bool = False,
) -> Optional[str]:
    """
    Return:
    - None            → global scope / semua klinik.
    - clinic_id       → filter ke clinic_id tersebut.
    - "__NO_CLINIC__" → user butuh scope klinik tapi belum punya clinic_id.
    """

    if include_all_clinics:
        return None

    normalized_role = _normalize_role(current_role or role)
    normalized_clinic_id = _normalize_clinic_id(clinic_id)

    if current_user is not None:
        if not normalized_role:
            normalized_role = _normalize_role(
                _role_to_text(getattr(current_user, "user_role", ""))
            )

        if not normalized_clinic_id:
            normalized_clinic_id = _normalize_clinic_id(
                getattr(current_user, "clinic_id", None)
            )

    if user_id and not normalized_role:
        user = db.session.get(User, user_id)

        if user:
            normalized_role = _normalize_role(_role_to_text(user.user_role))
            normalized_clinic_id = _normalize_clinic_id(user.clinic_id)

    if not normalized_role and not normalized_clinic_id:
        jwt_user = _get_current_user_from_jwt()

        if jwt_user:
            normalized_role = _normalize_role(_role_to_text(jwt_user.user_role))
            normalized_clinic_id = _normalize_clinic_id(jwt_user.clinic_id)

    if not normalized_role and not normalized_clinic_id:
        return None

    if normalized_role == "admin":
        return None

    if normalized_role in {"midwife", "asisten"}:
        return normalized_clinic_id or "__NO_CLINIC__"

    return normalized_clinic_id or "__NO_CLINIC__"


def _apply_clinic_filter(query, clinic_scope: Optional[str]):
    if clinic_scope is None:
        return query

    if clinic_scope == "__NO_CLINIC__":
        return query.filter(false())

    return query.filter(Patient.clinic_id == clinic_scope)


def _to_date_key(value) -> Optional[date]:
    if value is None:
        return None

    if isinstance(value, date) and not isinstance(value, datetime):
        return value

    if isinstance(value, datetime):
        return value.date()

    raw_value = str(value).strip()

    if not raw_value:
        return None

    try:
        return datetime.fromisoformat(raw_value[:10]).date()
    except Exception:
        return None


def _sum_counts(counts: Optional[Dict[date, int]]) -> int:
    if not counts:
        return 0

    return sum(int(value or 0) for value in counts.values())


def _service_has_history(
    service_type: str,
    counts: Dict[date, int],
    forecast_history_counts: Optional[Dict[date, int]] = None,
    hpl_counts: Optional[Dict[date, int]] = None,
) -> bool:
    if _sum_counts(counts) > 0:
        return True

    if service_type == "Persalinan":
        if _sum_counts(forecast_history_counts) > 0:
            return True

        if _sum_counts(hpl_counts) > 0:
            return True

    return False


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


def get_monthly_visit_total(
    month_start: date,
    end_date: date,
    clinic_scope: Optional[str] = None,
) -> int:
    query = (
        db.session.query(func.count(VisitMaster.visit_id))
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .filter(
            func.date(VisitMaster.visit_date) >= month_start,
            func.date(VisitMaster.visit_date) <= end_date,
        )
    )

    query = _apply_clinic_filter(query, clinic_scope)

    total = query.scalar()

    return int(total or 0)


def get_monthly_counts_by_service(
    month_start: date,
    end_date: date,
    clinic_scope: Optional[str] = None,
) -> Dict[str, int]:
    query = (
        db.session.query(
            MedicalRecord.record_type,
            func.count(VisitMaster.visit_id),
        )
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .filter(
            func.date(VisitMaster.visit_date) >= month_start,
            func.date(VisitMaster.visit_date) <= end_date,
        )
    )

    query = _apply_clinic_filter(query, clinic_scope)

    rows = query.group_by(MedicalRecord.record_type).all()

    return {str(record_type): int(total) for record_type, total in rows}


def get_daily_visit_counts(
    record_type: str,
    start_date: date,
    end_date: date,
    clinic_scope: Optional[str] = None,
) -> Dict[date, int]:
    query = (
        db.session.query(func.date(VisitMaster.visit_date), func.count(VisitMaster.visit_id))
        .join(MedicalRecord, VisitMaster.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .filter(
            MedicalRecord.record_type == record_type,
            func.date(VisitMaster.visit_date) >= start_date,
            func.date(VisitMaster.visit_date) <= end_date,
        )
    )

    query = _apply_clinic_filter(query, clinic_scope)

    rows = query.group_by(func.date(VisitMaster.visit_date)).all()

    counts: Dict[date, int] = {}

    for visit_date, total in rows:
        day = _to_date_key(visit_date)

        if day is None:
            continue

        counts[day] = int(total)

    return counts


def get_daily_delivery_counts(
    start_date: date,
    end_date: date,
    clinic_scope: Optional[str] = None,
) -> Dict[date, int]:
    query = (
        db.session.query(
            func.date(DeliveryRecord.delivery_date),
            func.count(DeliveryRecord.dr_id),
        )
        .join(MedicalRecord, DeliveryRecord.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .filter(
            MedicalRecord.record_type == "Persalinan",
            DeliveryRecord.delivery_date.isnot(None),
            func.date(DeliveryRecord.delivery_date) >= start_date,
            func.date(DeliveryRecord.delivery_date) <= end_date,
        )
    )

    query = _apply_clinic_filter(query, clinic_scope)

    rows = query.group_by(func.date(DeliveryRecord.delivery_date)).all()

    counts: Dict[date, int] = {}

    for delivery_date, total in rows:
        day = _to_date_key(delivery_date)

        if day is None:
            continue

        counts[day] = int(total)

    return counts


def get_hpl_counts_by_date(
    start_date: date,
    end_date: date,
    clinic_scope: Optional[str] = None,
) -> Dict[date, int]:
    query = (
        db.session.query(
            func.date(PregnancyRecord.expected_due_date),
            func.count(PregnancyRecord.pr_id),
        )
        .join(MedicalRecord, PregnancyRecord.record_id == MedicalRecord.record_id)
        .join(Patient, MedicalRecord.patient_id == Patient.patient_id)
        .filter(
            PregnancyRecord.expected_due_date.isnot(None),
            func.date(PregnancyRecord.expected_due_date) >= start_date,
            func.date(PregnancyRecord.expected_due_date) <= end_date,
        )
    )

    query = _apply_clinic_filter(query, clinic_scope)

    rows = query.group_by(func.date(PregnancyRecord.expected_due_date)).all()

    counts: Dict[date, int] = {}

    for due_date, total in rows:
        day = _to_date_key(due_date)

        if day is None:
            continue

        counts[day] = int(total)

    return counts


def _fill_series(
    counts: Dict[date, int],
    start_date: date,
    end_date: date,
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
    model_features = getattr(model, "feature_names_in_", None)

    feature_names = (
        list(model_features)
        if model_features is not None
        else SERVICE_MODELS[service_type]["features"]
    )

    frame = pd.DataFrame(
        [[features[name] for name in feature_names]],
        columns=feature_names,
    )

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
            service_type,
            series,
            current,
            hpl_counts=hpl_counts,
        )

        series[current] = predicted

        predictions.append(
            {
                "date": current.isoformat(),
                "count": int(round(predicted)),
            }
        )

        current += timedelta(days=1)

    return predictions, series


def get_month_bounds(reference: Optional[date] = None) -> Tuple[date, date]:
    today = reference or get_jakarta_now().date()
    month_start = today.replace(day=1)

    if today.month == 12:
        month_end = date(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(today.year, today.month + 1, 1) - timedelta(days=1)

    return month_start, month_end


def build_forecast_payload(
    reference: Optional[date] = None,
    *,
    current_user=None,
    current_role: Optional[str] = None,
    clinic_id=None,
    role: Optional[str] = None,
    user_id: Optional[str] = None,
    include_all_clinics: bool = False,
) -> dict:
    today = reference or get_jakarta_now().date()
    month_start, month_end = get_month_bounds(today)
    history_start = month_start - timedelta(days=120)

    clinic_scope = _resolve_clinic_scope(
        current_user=current_user,
        current_role=current_role,
        role=role,
        clinic_id=clinic_id,
        user_id=user_id,
        include_all_clinics=include_all_clinics,
    )

    history: List[dict] = []
    forecast: List[dict] = []
    by_service: Dict[str, dict] = {}

    month_end_actual = min(today, month_end)

    monthly_actual = get_monthly_visit_total(
        month_start,
        month_end_actual,
        clinic_scope=clinic_scope,
    )

    monthly_counts_by_service = get_monthly_counts_by_service(
        month_start,
        month_end_actual,
        clinic_scope=clinic_scope,
    )

    forecast_remaining_total = 0

    hpl_counts = get_hpl_counts_by_date(
        history_start,
        month_end,
        clinic_scope=clinic_scope,
    )

    for service_type in SERVICE_MODELS:
        if service_type == "Persalinan":
            counts = get_daily_delivery_counts(
                history_start,
                today,
                clinic_scope=clinic_scope,
            )

            forecast_history_counts = get_daily_visit_counts(
                "Kehamilan",
                history_start,
                today,
                clinic_scope=clinic_scope,
            )
        else:
            forecast_history_counts = None

            counts = get_daily_visit_counts(
                service_type,
                history_start,
                today,
                clinic_scope=clinic_scope,
            )

        actual_this_month = sum(
            total
            for day, total in counts.items()
            if month_start <= day <= min(today, month_end)
        )

        forecast_start = today + timedelta(days=1)
        service_forecast: List[dict] = []
        forecast_total = 0

        has_service_history = _service_has_history(
            service_type=service_type,
            counts=counts,
            forecast_history_counts=forecast_history_counts,
            hpl_counts=hpl_counts,
        )

        if forecast_start <= month_end and has_service_history:
            service_forecast, _ = forecast_date_range(
                service_type,
                forecast_history_counts
                if service_type == "Persalinan"
                else counts,
                forecast_start,
                month_end,
                history_start=history_start,
                hpl_counts=hpl_counts if service_type == "Persalinan" else None,
            )

            forecast_total = sum(item["count"] for item in service_forecast)

        service_history = _daily_points_for_range(
            counts,
            month_start,
            min(today, month_end),
        )

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

    aggregated_history = _aggregate_daily_points_for_range(
        history,
        month_start,
        month_end_actual,
    )

    forecast_range_start = today + timedelta(days=1)

    aggregated_forecast = (
        _aggregate_daily_points_for_range(
            forecast,
            forecast_range_start,
            month_end,
        )
        if forecast_range_start <= month_end
        else []
    )

    return {
        "month": month_start.strftime("%Y-%m"),
        "monthly_actual": monthly_actual,
        "monthly_forecast": monthly_forecast,
        "history": aggregated_history,
        "forecast": aggregated_forecast,
        "by_service": by_service,
    }


def _daily_points_for_range(
    counts: Dict[date, int],
    start_date: date,
    end_date: date,
) -> List[dict]:
    if start_date > end_date:
        return []

    points: List[dict] = []
    current = start_date

    while current <= end_date:
        points.append(
            {
                "date": current.isoformat(),
                "count": int(counts.get(current, 0)),
            }
        )

        current += timedelta(days=1)

    return points


def _aggregate_daily_points_for_range(
    points: List[dict],
    start_date: date,
    end_date: date,
) -> List[dict]:
    if start_date > end_date:
        return []

    totals: Dict[str, int] = {}

    for point in points:
        totals[point["date"]] = totals.get(point["date"], 0) + point["count"]

    result: List[dict] = []
    current = start_date

    while current <= end_date:
        day = current.isoformat()

        result.append(
            {
                "date": day,
                "count": totals.get(day, 0),
            }
        )

        current += timedelta(days=1)

    return result