/** Semua tanggal dalam bulan (YYYY-MM-DD), dari tanggal 1 sampai akhir bulan. */
export function getDaysInMonth(referenceDate = new Date()): string[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    );
  }

  return dates;
}

/** Semua tanggal dari startKey sampai endKey (inklusif), format YYYY-MM-DD. */
export function getDaysInRange(startKey: string, endKey: string): string[] {
  if (!startKey || !endKey || startKey > endKey) {
    return [];
  }

  const dates: string[] = [];
  const current = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);

  if (Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export function toDateKey(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fillCountPoints(
  points: { date: string; count: number }[],
  dates: string[],
): { date: string; count: number }[] {
  const map = new Map(points.map((point) => [point.date, point.count]));
  return dates.map((date) => ({ date, count: map.get(date) ?? 0 }));
}

export function fillAmountPoints(
  points: { date: string; amount: number }[],
  dates: string[],
): { date: string; amount: number }[] {
  const map = new Map(points.map((point) => [point.date, point.amount]));
  return dates.map((date) => ({ date, amount: map.get(date) ?? 0 }));
}
