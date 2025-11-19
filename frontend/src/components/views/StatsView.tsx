"use client";

import { useEffect, useMemo, useState } from "react";

type Period = "day" | "week" | "month";

type MetricCard = {
  label: string;
  value: string;
  caption: string;
};

// TODO: replace mock stats with real API once /api/stats endpoints are available.
const PERFORMANCE = [
  { queue: "B2B", sla: "94%", aht: "6 мин", satisfaction: "4.8" },
  { queue: "Retail", sla: "88%", aht: "4 мин", satisfaction: "4.5" },
  { queue: "Support", sla: "91%", aht: "7 мин", satisfaction: "4.6" },
];

// TODO: replace mock stats with real API once /api/stats endpoints are available.
const GRAPH_DATA: Record<Period, number[]> = {
  day: [82, 90, 95, 93, 97, 92, 94],
  week: [71, 82, 79, 85, 88, 90, 92],
  month: [60, 65, 70, 72, 80, 84, 90],
};

export default function StatsView() {
  const [metrics, setMetrics] = useState<MetricCard[] | null>(null);
  const [performanceData, setPerformanceData] = useState<typeof PERFORMANCE>([]);
  const [chartData, setChartData] = useState<Record<Period, number[]>>({
    day: [],
    week: [],
    month: [],
  });
  const [period, setPeriod] = useState<Period>("day");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    async function loadStats() {
      try {
        // TODO: Replace with analytics overview request to /api/stats/overview
        const overviewMetrics: MetricCard[] = [
          { label: "Диалогов сегодня", value: "186", caption: "+14% к прошлой неделе" },
          { label: "Среднее время ответа", value: "3 мин 42 сек", caption: "SLA 90%" },
          { label: "Эскалации", value: "12", caption: "4 в работе" },
          { label: "Операторы онлайн", value: "27", caption: "+5 в резерве" },
        ];

        // TODO: Replace with SLA dataset from /api/stats/sla
        setMetrics(overviewMetrics);
        setPerformanceData(PERFORMANCE);
        setChartData(GRAPH_DATA);
      } catch (statsError) {
        setError(statsError instanceof Error ? statsError.message : "Не удалось загрузить статистику");
      } finally {
        setIsLoading(false);
      }
    }

    void loadStats();
  }, []);

  const dataset = useMemo(() => chartData[period] ?? [], [chartData, period]);
  const hasData = Boolean(metrics?.length && performanceData.length && dataset.length);

  if (isLoading) {
    return (
      <div className="stats-view">
        <p className="placeholder">Загрузка статистики...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-view">
        <p className="placeholder" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="stats-view">
        <p className="placeholder">Нет данных для отображения</p>
      </div>
    );
  }

  return (
    <div className="stats-view">
      <section className="stats-cards">
        {metrics?.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.caption}</small>
          </article>
        ))}
      </section>

      <section className="stats-chart">
        <div className="chart-heading">
          <div>
            <h3>Динамика SLA</h3>
            <p>Показатель за выбранный период</p>
          </div>
          <div className="period-switcher" role="tablist">
            {(["day", "week", "month"] as Period[]).map((value) => (
              <button
                key={value}
                type="button"
                className={`ghost-button ${period === value ? "ghost-button-active" : ""}`}
                onClick={() => setPeriod(value)}
              >
                {value === "day" && "День"}
                {value === "week" && "Неделя"}
                {value === "month" && "Месяц"}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-placeholder">
          {dataset.map((value, index) => (
            <div key={`${value}-${index}`} className="chart-bar" style={{ height: `${value}%` }}>
              <span>{value}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="stats-table">
        <h3>Очереди</h3>
        <table>
          <thead>
            <tr>
              <th>Очередь</th>
              <th>SLA</th>
              <th>AHT</th>
              <th>Оценка клиентов</th>
            </tr>
          </thead>
          <tbody>
            {performanceData.map((row) => (
              <tr key={row.queue}>
                <td>{row.queue}</td>
                <td>{row.sla}</td>
                <td>{row.aht}</td>
                <td>{row.satisfaction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
