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
