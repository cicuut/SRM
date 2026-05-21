interface TopAssessmentItem {
  rank: number;
  assessment: string;
  count: number;
  percentage: number;
}

interface TopAssessmentListProps {
  month?: string | null;
  totalVisits?: number;
  items: TopAssessmentItem[];
  emptyMessage?: string;
  isLoading?: boolean;
}

const RANK_COLORS = ["#4F6F52", "#739072", "#5C7A5E", "#86A789", "#A8C5A0"];

function formatMonthLabel(month?: string | null) {
  if (!month) return "";
  const [year, monthNum] = month.split("-");
  if (!year || !monthNum) return month;
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function TopAssessmentList({
  month,
  totalVisits = 0,
  items,
  emptyMessage = "Belum ada assessment atau keluhan KB bulan ini.",
  isLoading = false,
}: TopAssessmentListProps) {
  if (isLoading) {
    return <p className="mt-4 text-sm text-gray-500">Menghitung assessment...</p>;
  }

  if (items.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">{emptyMessage}</p>;
  }

  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="mt-4 space-y-4">
      {month && (
        <p className="text-xs text-gray-500">
          Periode: {formatMonthLabel(month)}
          {totalVisits > 0 &&
            ` · ${totalVisits} kunjungan dengan assessment/keluhan`}
        </p>
      )}
      <ol className="space-y-6">
        {items.map((item, index) => {
          const accent = RANK_COLORS[index % RANK_COLORS.length];
          const barWidth = Math.max((item.count / maxCount) * 100, 8);

          return (
            <li
              key={`${item.rank}-${item.assessment}`}
              className="rounded-lg border border-[#E6EDE5] bg-[#FDFEF9] px-4 py-3"
              style={{ borderLeftWidth: 4, borderLeftColor: accent }}
            >
              <div className="flex items-start justify-between gap-10">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500">#{item.rank}</p>
                  <p className="text-sm font-semibold text-[#4F6F52]">
                    {item.assessment}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-gray-600">
                  <p className="font-semibold" style={{ color: accent }}>
                    {item.count}×
                  </p>
                  <p>{item.percentage}%</p>
                </div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E6EDE5]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${barWidth}%`, backgroundColor: accent }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
