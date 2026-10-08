import { memo, useEffect, useRef, useState } from 'react';
import { useGame } from '../hooks/useGame';
import {
  statisticSeries,
  statisticDistributions,
} from '../game/content/statistics';
import { evaluateCondition } from '../game/engine/conditions';
import { idlePopulation, representedPopulation } from '../game/engine/units';
import { D, formatNumber, formatDuration } from '../game/utils/numbers';
import type { StatisticSample, StatisticSeriesDefinition } from '../game/types';
const HistoryChart = memo(function HistoryChart({
  series,
  samples,
}: {
  series: StatisticSeriesDefinition;
  samples: StatisticSample[];
}) {
  const chart = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(760);
  const hasSamples = samples.length > 0;
  useEffect(() => {
    const element = chart.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(
        Math.max(280, Math.min(760, Math.round(entry.contentRect.width))),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasSamples]);
  const height = 280,
    left = 68,
    top = 24,
    plotWidth = width - left - 24,
    plotHeight = 206;
  const maximum = samples.reduce((n, p) => n.max(p.value), D(1));
  const start = samples[0]?.timestamp ?? 0,
    end = samples.at(-1)?.timestamp ?? start + 1;
  const x = (time: number) =>
    left + ((time - start) / Math.max(1, end - start)) * plotWidth;
  const y = (value: string) =>
    top + plotHeight - D(value).div(maximum).toNumber() * plotHeight;
  const path = samples
    .map(
      (point, i) => `${i ? 'L' : 'M'}${x(point.timestamp)},${y(point.value)}`,
    )
    .join(' ');
  return (
    <section className="panel statistic-chart" aria-label={series.name}>
      <div className="panel-heading">
        <h2>{series.name}</h2>
        <span className="subtle">{samples.length} samples</span>
      </div>
      {samples.length ? (
        <>
          <svg
            ref={chart}
            className="history-chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${series.name}: ${formatNumber(samples[0].value)} to ${formatNumber(samples.at(-1)!.value)}`}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
              <g key={fraction}>
                <line
                  x1={left}
                  x2={left + plotWidth}
                  y1={top + plotHeight * (1 - fraction)}
                  y2={top + plotHeight * (1 - fraction)}
                  stroke="#e4ece6"
                />
                <text
                  x={left - 10}
                  y={top + plotHeight * (1 - fraction) + 4}
                  textAnchor="end"
                >
                  {formatNumber(maximum.mul(fraction), 0)}
                </text>
              </g>
            ))}
            <path
              d={path}
              stroke={series.color}
              strokeWidth="2.5"
              fill="none"
            />
            {samples.length === 1 && (
              <circle
                cx={x(start)}
                cy={y(samples[0].value)}
                r="4"
                fill={series.color}
              />
            )}
            <text x={left} y={height - 24}>
              {formatDuration(start)}
            </text>
            <text x={left + plotWidth} y={height - 24} textAnchor="end">
              {formatDuration(end)}
            </text>
            <text x={left + plotWidth / 2} y={height - 4} textAnchor="middle">
              Simulated time
            </text>
          </svg>
          <details className="chart-data">
            <summary>Recent sample values</summary>
            <table>
              <thead>
                <tr>
                  <th>Simulated time</th>
                  <th className="numeric">Value</th>
                </tr>
              </thead>
              <tbody>
                {samples.slice(-24).map((p) => (
                  <tr key={p.timestamp}>
                    <td>{formatDuration(p.timestamp)}</td>
                    <td className="numeric">{formatNumber(p.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <p className="empty-chart">
          Your history will appear as your civilization grows.
        </p>
      )}
      <p className="sheet-note">
        History begins when this statistic is discovered. It records simulated
        play, including offline progress.
      </p>
    </section>
  );
});
export function StatisticsSheet() {
  const { state } = useGame();
  const kpis = [
    { name: 'Current population', value: state.population },
    { name: 'Maximum population', value: state.statistics.maxPopulation },
    {
      name: 'Total population created',
      value: state.statistics.totalPopulationCreated,
    },
    { name: 'Idle population', value: idlePopulation(state) },
    { name: 'Assigned population', value: representedPopulation(state) },
  ];
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">A RECORD OF YOUR CIVILIZATION</div>
          <h1>The story in the numbers.</h1>
          <p>Your records grow alongside your people.</p>
        </div>
      </div>
      <div className="statistics-kpis">
        {kpis.map((kpi) => (
          <div className="panel" key={kpi.name}>
            <span className="field-label">{kpi.name}</span>
            <strong>{formatNumber(kpi.value, 0)}</strong>
          </div>
        ))}
      </div>
      {statisticSeries
        .filter((series) => evaluateCondition(series.unlockCondition, state))
        .map((series) => (
          <HistoryChart
            key={series.id}
            series={series}
            samples={state.statisticsHistory[series.id] ?? []}
          />
        ))}
      {statisticDistributions
        .filter((chart) => evaluateCondition(chart.unlockCondition, state))
        .map((chart) => (
          <section
            className="panel statistic-chart"
            key={chart.id}
            aria-label={chart.name}
          >
            <h2>{chart.name}</h2>
            <div className="distribution-chart">
              {chart.values(state).map((group) => (
                <div className="distribution-row" key={group.id}>
                  <span>{group.name}</span>
                  <div className="distribution-track">
                    <div
                      style={{
                        width: `${group.value.div(state.population).mul(100).toNumber()}%`,
                        background: group.color,
                      }}
                    />
                  </div>
                  <strong>{formatNumber(group.value, 0)}</strong>
                </div>
              ))}
            </div>
            <p className="sheet-note">
              People represented by units, rather than the number of units.
            </p>
          </section>
        ))}
    </>
  );
}
