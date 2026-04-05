import { useEffect, useRef, useState } from 'react';
import { Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { parseDateKeyToLocalDate } from '../lib/dateKey';
import { useAuthStore } from '../store/authStore';
import { useDateStore } from '../store/dateStore';

type AnalyticsResponse = Awaited<ReturnType<typeof api.getAnalytics>>;

export function AnalyticsPage() {
  const token = useAuthStore((state) => state.token);
  const selectedDate = useDateStore((state) => state.selectedDate);
  const setSelectedDate = useDateStore((state) => state.setSelectedDate);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.floor(element.clientWidth);
      const nextHeight = Math.floor(element.clientHeight);

      setChartSize((previous) => {
        if (previous.width === nextWidth && previous.height === nextHeight) {
          return previous;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    const load = async () => {
      try {
        const response = await api.getAnalytics(token, days, selectedDate);
        setData(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load analytics.');
      }
    };

    load();
  }, [days, selectedDate, token]);

  const dateLabel = parseDateKeyToLocalDate(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h2>
      <p className="mt-1 text-sm text-slate-600">
        Trend and performance metrics derived from the same dynamic goals for the selected date context.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          id="analytics-date"
          name="analyticsDate"
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          id="analytics-days"
          name="analyticsDays"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Ending on {dateLabel}
        </span>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Selected Date</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{data?.summary.todayPercent ?? 0}%</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current Streak</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {data?.summary.currentStreakDays ?? 0} days
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Average Completion</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{data?.summary.averageCompletion ?? 0}%</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-800">
          Goals completed on selected date: {data?.summary.completedGoalsToday ?? 0}/
          {data?.summary.totalGoalsToday ?? 0}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Remaining: {(data?.summary.remainingGoalTitles ?? []).join(', ') || 'No pending goals'}
        </p>
      </div>

      <div ref={chartContainerRef} className="mt-6 h-[280px] rounded-xl border border-slate-200 p-3">
        {chartSize.width > 0 && chartSize.height > 0 ? (
          <LineChart width={chartSize.width} height={chartSize.height} data={data?.trend ?? []}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="selfPercent" stroke="#0284c7" strokeWidth={3} />
            <Line type="monotone" dataKey="partnerPercent" stroke="#059669" strokeWidth={3} />
          </LineChart>
        ) : null}
      </div>

      {/* Calendar Heatmap */}
      {(data?.trend ?? []).length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Completion Heatmap</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block h-3 w-3 rounded-sm bg-slate-100"></span> None
              <span className="inline-block h-3 w-3 rounded-sm bg-rose-200"></span> 0%
              <span className="inline-block h-3 w-3 rounded-sm bg-amber-200"></span> 1-49%
              <span className="inline-block h-3 w-3 rounded-sm bg-yellow-200"></span> 50-74%
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-200"></span> 75-99%
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500"></span> 100%
            </div>
          </div>
          <HeatmapGrid trend={data?.trend ?? []} />
        </div>
      )}
    </section>
  );
}

type TrendDay = { date: string; selfPercent: number; partnerPercent: number };

function heatColor(percent: number | null): string {
  if (percent === null) return 'bg-slate-100';
  if (percent === 0) return 'bg-rose-200';
  if (percent < 50) return 'bg-amber-200';
  if (percent < 75) return 'bg-yellow-200';
  if (percent < 100) return 'bg-emerald-200';
  return 'bg-emerald-500';
}

function HeatmapGrid({ trend }: { trend: TrendDay[] }) {
  // Group days into weeks (columns of 7)
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // Build a weeks array - each week is up to 7 days
  const weeks: TrendDay[][] = [];
  for (let i = 0; i < trend.length; i += 7) {
    weeks.push(trend.slice(i, i + 7));
  }

  return (
    <div className="relative overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                className={`h-4 w-4 cursor-default rounded-sm ${heatColor(day.selfPercent)}`}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({
                    text: `${day.date}: ${day.selfPercent.toFixed(0)}%`,
                    x: rect.left,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </div>
        ))}
      </div>
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded bg-slate-900 px-2 py-1 text-xs text-white shadow-lg"
          style={{ left: tooltip.x + 20, top: tooltip.y - 8 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
