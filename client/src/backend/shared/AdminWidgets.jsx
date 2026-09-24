import { useState } from "react";
import { Activity, Sparkles } from "lucide-react";
import {
  formatDayLabel,
  formatNumber,
  formatShortDate,
  toNumber,
} from "../dashboard/adminUtils.js";

export function IconBubble({ icon: Icon, tone = "blue" }) {
  return (
    <span className={`ap-icon-bubble ap-icon-bubble--${tone}`}>
      <Icon size={18} />
    </span>
  );
}

export function EmptyState({ icon: Icon = Sparkles, title, children }) {
  return (
    <div className="ap-empty-state">
      <Icon size={20} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function TrendPill({ value }) {
  const numberValue = toNumber(value);
  const tone = numberValue > 0 ? "up" : numberValue < 0 ? "down" : "flat";
  const label = numberValue > 0 ? `+${numberValue}%` : numberValue < 0 ? `${numberValue}%` : "Stable";
  return <span className={`ao-trend ao-trend--${tone}`}>{label}</span>;
}

function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point[0]} ${point[1]}`;
    const previous = points[index - 1];
    const controlX = (previous[0] + point[0]) / 2;
    return `${path} C ${controlX} ${previous[1]}, ${controlX} ${point[1]}, ${point[0]} ${point[1]}`;
  }, "");
}

export function MiniSparkline({ values, tone = "blue" }) {
  const safeValues = (Array.isArray(values) && values.length ? values : [0, 0]).map(toNumber);
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const points = safeValues.map((value, index) => {
    const x = safeValues.length <= 1 ? 48 : (index / (safeValues.length - 1)) * 96;
    const y = max === min ? 19 : 33 - ((value - min) / range) * 26;
    return [x, y];
  });
  const linePath = smoothPath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1][0]} 36 L ${points[0][0]} 36 Z`
    : "";

  return (
    <svg className={`ao-sparkline ao-sparkline--${tone}`} viewBox="0 0 96 38" preserveAspectRatio="none" aria-hidden="true">
      <path className="ao-sparkline__area" d={areaPath} />
      <line className="ao-sparkline__baseline" x1="0" x2="96" y1="35" y2="35" vectorEffect="non-scaling-stroke" />
      <path className="ao-sparkline__line" d={linePath} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function UsageChart({ activity, maxDays = 7 }) {
  const [hovered, setHovered] = useState(null);
  const days = Array.isArray(activity) ? activity.slice(-Math.max(1, Number(maxDays) || 7)) : [];
  const enriched = days.map((day) => ({
    ...day,
    visits: toNumber(day.unique_visits ?? day.visits ?? day.sessions),
    active: toNumber(day.active_users),
    runs: toNumber(day.exercise_attempts),
    quizzes: toNumber(day.quiz_completions),
    submissions: toNumber(day.passed_attempts),
    label: formatDayLabel(day.date),
  }));

  const hasActivity = enriched.some((day) => day.visits > 0 || day.runs > 0 || day.quizzes > 0);
  if (!hasActivity) {
    return (
      <div className="ao-usage-empty">
        <EmptyState icon={Activity} title="No usage yet">
          Daily visits, practice attempts, quiz completions, and XP will render here as learners use the platform.
        </EmptyState>
      </div>
    );
  }

  const series = [
    { key: "visits", label: "Visits", tone: "blue" },
    { key: "active", label: "Active Learners", tone: "green" },
    { key: "runs", label: "Code Runs", tone: "violet" },
    { key: "quizzes", label: "Quiz Completions", tone: "amber" },
    { key: "submissions", label: "Submissions", tone: "cyan" },
  ];
  const width = 820;
  const height = 290;
  const left = 54;
  const right = 28;
  const top = 32;
  const bottom = 228;
  const innerWidth = width - left - right;
  const innerHeight = bottom - top;
  const step = innerWidth / Math.max(enriched.length - 1, 1);
  const maxValue = Math.max(...enriched.flatMap((day) => series.map((item) => toNumber(day[item.key]))), 1);
  const yFor = (value) => bottom - (toNumber(value) / maxValue) * innerHeight;
  const linePath = (key) => smoothPath(enriched.map((day, index) => [left + index * step, yFor(day[key])]));

  const setHoverIndex = (index, guideX = null) => {
    const safeIndex = Math.min(enriched.length - 1, Math.max(0, index));
    const day = enriched[safeIndex];
    const resolvedGuideX = guideX ?? left + safeIndex * step;
    setHovered({
      index: safeIndex,
      date: day.date,
      guideX: resolvedGuideX,
      x: (resolvedGuideX / width) * 100,
      series: series.map((item) => ({
        label: item.label,
        tone: item.tone,
        value: day[item.key],
        y: yFor(day[item.key]),
      })),
    });
  };

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * width;
    const boundedX = Math.min(width - right, Math.max(left, relativeX));
    const rawIndex = Math.round((boundedX - left) / Math.max(step, 1));
    setHoverIndex(rawIndex, boundedX);
  };

  return (
    <div
      className="ao-usage-chart"
      role="img"
      aria-label={`${days.length} day usage chart`}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHovered(null)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + innerHeight * ratio;
          return <line key={ratio} className="ao-chart-gridline" x1={left} x2={width - right} y1={y} y2={y} vectorEffect="non-scaling-stroke" />;
        })}
        {[0, 0.5, 1].map((ratio) => (
          <text key={ratio} className="ao-chart-axis" x={14} y={yFor(maxValue * ratio) + 4}>
            {formatNumber(Math.round(maxValue * ratio))}
          </text>
        ))}

        {enriched.map((day, index) => {
          const x = left + index * step;
          const labelStep = Math.max(1, Math.ceil(enriched.length / 10));
          const showLabel = enriched.length <= 14 || index % labelStep === 0 || index === enriched.length - 1;

          return (
            <g key={day.date || index}>
              <title>{`${day.date}: ${day.visits} visits, ${day.runs} code runs, ${day.quizzes} quiz completions`}</title>
              {showLabel && (
                <text className="ao-chart-label" x={x} y={height - 24} textAnchor="middle">
                  {enriched.length <= 7 ? day.label : formatShortDate(day.date)}
                </text>
              )}
            </g>
          );
        })}

        {hovered && (
          <line
            className="ao-chart-hover-line"
            x1={hovered.guideX}
            x2={hovered.guideX}
            y1={top}
            y2={bottom}
          />
        )}

        {series.map((item) => (
          <g key={item.key}>
            <path className={`ao-chart-line ao-chart-line--${item.tone}`} d={linePath(item.key)} vectorEffect="non-scaling-stroke" />
            {enriched.map((day, index) => (
              <circle
                key={`${item.key}-${day.date || index}`}
                className={`ao-chart-dot ao-chart-dot--${item.tone}`}
                cx={left + index * step}
                cy={yFor(day[item.key])}
                r="4"
                tabIndex="0"
                onFocus={() => setHoverIndex(index)}
                onBlur={() => setHovered(null)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ))}

        {hovered && hovered.series.map((item) => (
          <circle
            key={`active-${item.label}`}
            className={`ao-chart-active-dot ao-chart-dot--${item.tone}`}
            cx={left + hovered.index * step}
            cy={item.y}
            r="6"
          />
        ))}
      </svg>
      {hovered && (
        <div
          className="ao-chart-tooltip ao-chart-tooltip--panel"
          style={{ left: `${hovered.x}%`, top: "26%" }}
        >
          <strong>{formatShortDate(hovered.date)}</strong>
          <div className="ao-chart-tooltip__rows">
            {hovered.series.map((item) => (
              <span key={item.label}>
                <i className={`is-${item.tone}`} />
                {item.label}
                <b>{formatNumber(item.value)}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
