"use client";

import { useMemo, useState } from "react";

type Period = "day" | "week" | "month";

const PERFORMANCE = [
  { queue: "B2B", sla: "94%", aht: "6 мин", satisfaction: "4.8" },
  { queue: "Retail", sla: "88%", aht: "4 мин", satisfaction: "4.5" },
  { queue: "Support", sla: "91%", aht: "7 мин", satisfaction: "4.6" },
];

const GRAPH_DATA: Record<Period, number[]> = {
  day: [82, 90, 95, 93, 97, 92, 94],
  week: [71, 82, 79, 85, 88, 90, 92],
  month: [60, 65, 70, 72, 80, 84, 90],
};

export default function StatsView() {
  const [period, setPeriod] = useState<Period>("day");

  const dataset = useMemo(() => GRAPH_DATA[period], [period]);

  return (
    <div className="stats-view">
      <section className="stats-cards">
        <article>
          <span>Диалогов сегодня</span>
          <strong>186</strong>
          <small>+14% к прошлой неделе</small>
        </article>
        <article>
          <span>Среднее время ответа</span>
          <strong>3 мин 42 сек</strong>
          <small>SLA 90%</small>
        </article>
        <article>
          <span>Эскалации</span>
          <strong>12</strong>
          <small>4 в работе</small>
        </article>
        <article>
          <span>Операторы онлайн</span>
          <strong>27</strong>
          <small>+5 в резерве</small>
        </article>
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
            {PERFORMANCE.map((row) => (
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
