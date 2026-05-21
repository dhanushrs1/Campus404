import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  Compass,
  Flame,
  Globe2,
  MonitorSmartphone,
  MousePointerClick,
  Route,
  Trophy,
  Users,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
const worldMap = "/countries-110m.json";
import { apiUrl } from "../../../shared/api.js";
import { authenticatedFetch } from "../../../shared/authSession.js";
import { EmptyState } from "../../shared/AdminWidgets.jsx";
import { addDays, formatNumber, formatShortDate, isoDate, percentOf, toNumber } from "../adminUtils.js";
import "./AnalyticsPage.css";

const ENTRY_PATH_LIMIT = 10;
const DEVICE_COLORS = ["#1f62ff", "#18a96f", "#7c5cff", "#d97706", "#0ea5b7", "#ef4444"];

const COUNTRY_COORDS = {
  AE: [23.4241, 53.8478],
  AR: [-38.4161, -63.6167],
  AT: [47.5162, 14.5501],
  AU: [-25.2744, 133.7751],
  BD: [23.685, 90.3563],
  BE: [50.5039, 4.4699],
  BH: [25.9304, 50.6378],
  BR: [-14.235, -51.9253],
  CA: [56.1304, -106.3468],
  CH: [46.8182, 8.2275],
  CL: [-35.6751, -71.543],
  CN: [35.8617, 104.1954],
  CO: [4.5709, -74.2973],
  CZ: [49.8175, 15.473],
  DE: [51.1657, 10.4515],
  DK: [56.2639, 9.5018],
  DZ: [28.0339, 1.6596],
  EG: [26.8206, 30.8025],
  ES: [40.4637, -3.7492],
  ET: [9.145, 40.4897],
  FI: [61.9241, 25.7482],
  FR: [46.2276, 2.2137],
  GB: [55.3781, -3.436],
  GH: [7.9465, -1.0232],
  GR: [39.0742, 21.8243],
  HK: [22.3193, 114.1694],
  ID: [-0.7893, 113.9213],
  IE: [53.1424, -7.6921],
  IL: [31.0461, 34.8516],
  IN: [20.5937, 78.9629],
  IQ: [33.2232, 43.6793],
  IR: [32.4279, 53.688],
  IT: [41.8719, 12.5674],
  JP: [36.2048, 138.2529],
  KE: [-0.0236, 37.9062],
  KR: [35.9078, 127.7669],
  KW: [29.3117, 47.4818],
  LK: [7.8731, 80.7718],
  MA: [31.7917, -7.0926],
  MX: [23.6345, -102.5528],
  MY: [4.2105, 101.9758],
  NG: [9.082, 8.6753],
  NL: [52.1326, 5.2913],
  NO: [60.472, 8.4689],
  NP: [28.3949, 84.124],
  NZ: [-40.9006, 174.886],
  OM: [21.5126, 55.9233],
  PE: [-9.19, -75.0152],
  PH: [12.8797, 121.774],
  PK: [30.3753, 69.3451],
  PL: [51.9194, 19.1451],
  PT: [39.3999, -8.2245],
  QA: [25.3548, 51.1839],
  RO: [45.9432, 24.9668],
  RU: [61.524, 105.3188],
  SA: [23.8859, 45.0792],
  SE: [60.1282, 18.6435],
  SG: [1.3521, 103.8198],
  TH: [15.87, 100.9925],
  TN: [33.8869, 9.5375],
  TR: [38.9637, 35.2433],
  TZ: [-6.369, 34.8888],
  UA: [48.3794, 31.1656],
  UG: [1.3733, 32.2903],
  US: [37.0902, -95.7129],
  VN: [14.0583, 108.2772],
  ZA: [-30.5595, 22.9375],
};

const countryDisplayNames =
  typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function monthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
}

function asSafeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getRangePreset(preset) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (preset === "today") return { start: isoDate(today), end: isoDate(today) };
  if (preset === "yesterday") {
    const day = addDays(today, -1);
    return { start: isoDate(day), end: isoDate(day) };
  }
  if (preset === "7d") return { start: isoDate(addDays(today, -6)), end: isoDate(today) };
  if (preset === "30d") return { start: isoDate(addDays(today, -29)), end: isoDate(today) };
  if (preset === "month") return { start: isoDate(monthStart(today)), end: isoDate(monthEnd(today)) };
  return { start: isoDate(addDays(today, -29)), end: isoDate(today) };
}

function buildDateKeys(startDate, endDate) {
  const start = asSafeDate(startDate);
  const end = asSafeDate(endDate);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);

  const first = start <= end ? start : end;
  const last = start <= end ? end : start;
  const days = [];
  for (let day = new Date(first); day <= last && days.length < 370; day = addDays(day, 1)) {
    days.push(isoDate(day));
  }
  return days.length ? days : [isoDate(new Date())];
}

function createEmptyAnalytics(startDate, endDate) {
  const days = buildDateKeys(startDate, endDate);
  const emptyDays = days.map((date) => ({
    date,
    visits: 0,
    track_users: 0,
    events: 0,
    tracks: {},
  }));

  return {
    start_date: days[0],
    end_date: days[days.length - 1],
    range_days: days.length,
    totals: {
      visits: 0,
      track_users: 0,
      learning_events: 0,
      active_tracks: 0,
      average_daily_visits: 0,
      average_daily_track_users: 0,
    },
    visit_series: emptyDays.map(({ date, visits }) => ({ date, visits })),
    track_series: emptyDays,
    calendar_days: emptyDays,
    track_breakdown: [],
    top_entry_paths: [],
    device_breakdown: [],
    country_breakdown: [],
    bottleneck_exercises: [],
    active_learners: [],
  };
}

function normalizeAnalyticsPayload(payload, startDate, endDate) {
  const empty = createEmptyAnalytics(startDate, endDate);
  if (!payload || typeof payload !== "object") return empty;

  return {
    ...empty,
    ...payload,
    totals: {
      ...empty.totals,
      ...(payload.totals || {}),
    },
    visit_series: Array.isArray(payload.visit_series) ? payload.visit_series : empty.visit_series,
    track_series: Array.isArray(payload.track_series) ? payload.track_series : empty.track_series,
    calendar_days: Array.isArray(payload.calendar_days) ? payload.calendar_days : empty.calendar_days,
    track_breakdown: Array.isArray(payload.track_breakdown) ? payload.track_breakdown : [],
    top_entry_paths: Array.isArray(payload.top_entry_paths) ? payload.top_entry_paths : [],
    device_breakdown: Array.isArray(payload.device_breakdown) ? payload.device_breakdown : [],
    country_breakdown: Array.isArray(payload.country_breakdown) ? payload.country_breakdown : [],
    bottleneck_exercises: Array.isArray(payload.bottleneck_exercises) ? payload.bottleneck_exercises : [],
    active_learners: Array.isArray(payload.active_learners) ? payload.active_learners : [],
  };
}

function adaptDashboardStats(payload, startDate, endDate) {
  const empty = createEmptyAnalytics(startDate, endDate);
  if (!payload || typeof payload !== "object") return empty;

  const days = buildDateKeys(startDate, endDate);
  const activityByDay = new Map((payload.activity_by_day || []).map((day) => [day.date, day]));
  const visitsByDay = new Map((payload.visit_activity_by_day || []).map((day) => [day.date, day]));
  const trackSeries = days.map((date) => {
    const activity = activityByDay.get(date) || {};
    const visits = toNumber(visitsByDay.get(date)?.visits ?? visitsByDay.get(date)?.unique_visits);
    const uniqueVisitors = toNumber(visitsByDay.get(date)?.unique_visits ?? visits);
    return {
      date,
      visits,
      unique_visitors: uniqueVisitors,
      new_visitors: 0,
      returning_visitors: 0,
      track_users: toNumber(activity.active_users),
      events: toNumber(activity.exercise_attempts) + toNumber(activity.quiz_completions),
      tracks: {},
    };
  });
  const visitSeries = trackSeries.map(({ date, visits, unique_visitors, new_visitors, returning_visitors }) => ({
    date,
    visits,
    unique_visitors,
    new_visitors,
    returning_visitors,
  }));
  const trackBreakdown = (payload.track_performance || []).map((track) => ({
    track_id: track.track_id,
    title: track.title || `Track ${track.track_id}`,
    users: toNumber(track.enrolled),
    events: toNumber(track.completed_exercises),
    completions: toNumber(track.completed_tracks),
  }));
  const totalVisits = visitSeries.reduce((sum, day) => sum + toNumber(day.visits), 0);
  const totalTrackUsers = trackSeries.reduce((sum, day) => sum + toNumber(day.track_users), 0);
  const totalEvents = trackSeries.reduce((sum, day) => sum + toNumber(day.events), 0);

  return normalizeAnalyticsPayload(
    {
      start_date: days[0],
      end_date: days[days.length - 1],
      range_days: days.length,
      totals: {
        visits: totalVisits,
        unique_visitors: visitSeries.reduce((sum, day) => sum + toNumber(day.unique_visitors), 0),
        daily_unique_visitors: visitSeries.reduce((sum, day) => sum + toNumber(day.unique_visitors), 0),
        new_visitors: 0,
        returning_visitors: 0,
        track_users: totalTrackUsers,
        learning_events: totalEvents,
        active_tracks: trackBreakdown.filter((track) => toNumber(track.users) > 0 || toNumber(track.events) > 0).length,
        average_daily_visits: Math.round(totalVisits / Math.max(days.length, 1)),
        average_daily_track_users: Math.round(totalTrackUsers / Math.max(days.length, 1)),
      },
      visit_series: visitSeries,
      track_series: trackSeries,
      calendar_days: trackSeries,
      track_breakdown: trackBreakdown,
      top_entry_paths: payload.top_entry_paths || [],
      bottleneck_exercises: [],
      active_learners: [],
    },
    startDate,
    endDate,
  );
}

async function readJsonResponse(response) {
  return response.json().catch(() => null);
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ax-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey} style={{ "--dot": item.color }}>
          <i />
          {item.name}: <b>{formatNumber(item.value)}</b>
        </span>
      ))}
    </div>
  );
}

function RangeControls({ activePreset, startDate, endDate, onPreset, onCustom }) {
  const presets = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "month", label: "This month" },
  ];

  return (
    <section className="ax-toolbar" aria-label="Analytics filters">
      <div className="ax-toolbar__title">
        <span><BarChart3 size={17} /> Analytics</span>
        <h2>Visits and track usage</h2>
      </div>
      <div className="ax-toolbar__controls">
        <div className="ax-range-tabs" role="group" aria-label="Quick date ranges">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.key}
              className={activePreset === preset.key ? "is-active" : ""}
              onClick={() => onPreset(preset.key)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label className="ax-date-field">
          <CalendarDays size={15} />
          <input
            type="date"
            value={startDate}
            onChange={(event) => onCustom(event.target.value || startDate, endDate)}
            aria-label="Start date"
          />
        </label>
        <label className="ax-date-field">
          <CalendarDays size={15} />
          <input
            type="date"
            value={endDate}
            onChange={(event) => onCustom(startDate, event.target.value || endDate)}
            aria-label="End date"
          />
        </label>
      </div>
    </section>
  );
}

function MetricStrip({ analytics }) {
  const totals = analytics?.totals || {};
  const metrics = [
    { label: "Total visits", value: totals.visits, icon: Globe2, tone: "blue" },
    { label: "Unique visitors", value: totals.unique_visitors ?? totals.daily_unique_visitors, icon: Users, tone: "green" },
    { label: "New visitors", value: totals.new_visitors, icon: MousePointerClick, tone: "violet" },
    { label: "Returning visitors", value: totals.returning_visitors, icon: Route, tone: "amber" },
  ];

  return (
    <section className="ax-metrics" aria-label="Analytics summary">
      {metrics.map(({ label, value, icon: Icon, tone }) => (
        <article className={`ax-metric ax-metric--${tone}`} key={label}>
          <Icon size={22} />
          <span>{label}</span>
          <strong>{formatNumber(value || 0)}</strong>
        </article>
      ))}
    </section>
  );
}

function VisitsPanel({ data }) {
  const hasData = data.some((item) => toNumber(item.visits) > 0);
  const peak = data.reduce((best, item) => (toNumber(item.visits) > toNumber(best.visits) ? item : best), { visits: 0 });
  const total = data.reduce((sum, item) => sum + toNumber(item.visits), 0);
  const uniqueTotal = data.reduce((sum, item) => sum + toNumber(item.unique_visitors), 0);
  const average = Math.round(total / Math.max(data.length, 1));

  return (
    <article className="ax-panel ax-panel--wide ax-panel--visits">
      <header className="ax-panel__header">
        <div>
          <h3><Globe2 size={18} /> Visit analytics</h3>
          <p>Total public-site visits, including repeat visits from the same visitor.</p>
        </div>
        <div className="ax-panel__chips">
          <span>{formatNumber(total)} visits</span>
          <span>{formatNumber(uniqueTotal)} daily unique</span>
          <span>{formatNumber(average)} avg/day</span>
          <span>Peak {formatNumber(peak.visits || 0)}</span>
        </div>
      </header>

      <div className="ax-panel__body">
        {hasData ? (
          <div className="ax-chart ax-chart--large">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 18, right: 24, left: -4, bottom: 6 }}>
                <defs>
                  <linearGradient id="axVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f62ff" stopOpacity={0.34} />
                    <stop offset="58%" stopColor="#1f62ff" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#1f62ff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e4edf8" strokeDasharray="4 7" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#607294", fontSize: 12, fontWeight: 800 }} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "#607294", fontSize: 12, fontWeight: 800 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="visits" name="Visits" stroke="#1f62ff" strokeWidth={4} fill="url(#axVisits)" dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="unique_visitors" name="Unique visitors" stroke="#18a96f" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="new_visitors" name="New visitors" stroke="#7c5cff" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="returning_visitors" name="Returning visitors" stroke="#d97706" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="ax-empty-chart ax-empty-chart--large">
            <EmptyState icon={Globe2} title="No visits for this range">Visit data appears after public pages receive traffic.</EmptyState>
          </div>
        )}

      </div>
    </article>
  );
}

function formatDeviceLabel(value) {
  const normalized = String(value || "unknown").replace(/[_-]+/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function BreakdownTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload || {};

  return (
    <div className="ax-tooltip">
      <strong>{item.label || payload[0]?.name}</strong>
      <span style={{ "--dot": item.color || payload[0]?.color }}>
        <i />
        Visits: <b>{formatNumber(item.visits || payload[0]?.value || 0)}</b>
      </span>
      <span style={{ "--dot": "#18a96f" }}>
        <i />
        Unique: <b>{formatNumber(item.unique_visitors || 0)}</b>
      </span>
    </div>
  );
}

function getCountryCode(item) {
  const rawCode = String(item?.country_code || item?.code || item?.country || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(rawCode) ? rawCode : "UNKNOWN";
}

function formatCountryLabel(item) {
  const code = getCountryCode(item);
  if (code !== "UNKNOWN") {
    try {
      return countryDisplayNames?.of(code) || code;
    } catch {
      return code;
    }
  }
  return String(item?.country_name || item?.country || "Unknown").trim() || "Unknown";
}

function markerCoordinates(coords) {
  const [lat, lon] = coords;
  return [lon, lat];
}

function DevicePie({ devices }) {
  const chartData = devices
    .map((item, index) => ({
      key: `${item.device || "unknown"}-${index}`,
      label: formatDeviceLabel(item.device),
      visits: toNumber(item.visits),
      unique_visitors: toNumber(item.unique_visitors),
      color: DEVICE_COLORS[index % DEVICE_COLORS.length],
    }))
    .filter((item) => item.visits > 0 || item.unique_visitors > 0);
  const totalVisits = chartData.reduce((sum, item) => sum + item.visits, 0);
  const maxVisits = Math.max(...chartData.map((item) => item.visits), 1);

  return (
    <article className="ax-bottom-card ax-device-card">
      <h4><MonitorSmartphone size={16} /> Device mix</h4>
      {chartData.length ? (
        <>
          <div className="ax-pie-shell">
            <div className="ax-pie-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<BreakdownTooltip />} />
                  <Pie
                    data={chartData}
                    dataKey="visits"
                    nameKey="label"
                    innerRadius="58%"
                    outerRadius="82%"
                    paddingAngle={2}
                    cornerRadius={5}
                    stroke="#ffffff"
                    strokeWidth={3}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="ax-pie-total">
                <span>Visits</span>
                <strong>{formatNumber(totalVisits)}</strong>
              </div>
            </div>
          </div>
          <div className="ax-pie-legend">
            {chartData.map((item) => (
              <div key={item.key}>
                <i style={{ background: item.color }} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{formatNumber(item.unique_visitors)} unique</small>
                </span>
                <div><b style={{ width: `${percentOf(item.visits, maxVisits)}%`, background: item.color }} /></div>
                <em>{formatNumber(item.visits)}</em>
              </div>
            ))}
          </div>
        </>
      ) : (
        <small>No device data for this range.</small>
      )}
    </article>
  );
}

function CountryTrafficMap({ countries }) {
  const countryItems = countries
    .map((item, index) => {
      const code = getCountryCode(item);
      return {
        key: `${code}-${index}`,
        code,
        label: formatCountryLabel(item),
        visits: toNumber(item.visits),
        unique_visitors: toNumber(item.unique_visitors),
        coords: COUNTRY_COORDS[code],
        color: DEVICE_COLORS[index % DEVICE_COLORS.length],
      };
    })
    .filter((item) => item.visits > 0 || item.unique_visitors > 0);
  const totalVisits = countryItems.reduce((sum, item) => sum + item.visits, 0);
  const maxVisits = Math.max(...countryItems.map((item) => item.visits), 1);
  const mappedCountries = countryItems.filter((item) => item.coords);

  return (
    <article className="ax-bottom-card ax-country-card">
      <header className="ax-card-header">
        <h4><Globe2 size={16} /> Country traffic map</h4>
        <div className="ax-card-chips">
          <span>{formatNumber(countryItems.length)} countries</span>
          <span>{formatNumber(totalVisits)} visits</span>
        </div>
      </header>

      <div className="ax-country-map-layout">
        <div className="ax-map-frame">
          <ComposableMap
            className="ax-world-map"
            projection="geoEqualEarth"
            projectionConfig={{ scale: 165 }}
            role="img"
            aria-label="Country traffic map"
          >
            <Geographies geography={worldMap}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    className="ax-map-geography"
                    tabIndex={-1}
                  />
                ))
              }
            </Geographies>
            {mappedCountries.map((item, index) => {
              const radius = 4 + Math.sqrt(item.visits / maxVisits) * 13;
              return (
                <Marker
                  key={item.key}
                  coordinates={markerCoordinates(item.coords)}
                  className="ax-map-marker"
                  style={{ "--marker": item.color }}
                >
                  <circle className="ax-map-marker__halo" r={radius + 6} />
                  <circle className="ax-map-marker__dot" r={radius} />
                  {index < 5 && (
                    <text x={radius + 8} y={4}>{item.code}</text>
                  )}
                  <title>{`${item.label}: ${formatNumber(item.visits)} visits`}</title>
                </Marker>
              );
            })}
          </ComposableMap>
          {!mappedCountries.length && <span className="ax-map-empty">No country data for this range.</span>}
        </div>

        <div className="ax-country-rank">
          {countryItems.map((item) => (
            <div className="ax-country-rank__item" key={item.key}>
              <span className="ax-country-code">{item.code === "UNKNOWN" ? "--" : item.code}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{formatNumber(item.unique_visitors)} unique</small>
              </span>
              <div><i style={{ width: `${percentOf(item.visits, maxVisits)}%` }} /></div>
              <em>{formatNumber(item.visits)}</em>
            </div>
          ))}
          {!countryItems.length && <small>No country data for this range.</small>}
        </div>
      </div>
      </article>
  );
}

function EntryPointsList({ entryPaths }) {
  const visibleEntryPaths = entryPaths.slice(0, ENTRY_PATH_LIMIT);
  const maxEntryVisits = Math.max(...visibleEntryPaths.map((item) => toNumber(item.visits)), 1);

  return (
    <article className="ax-bottom-card ax-entry-card">
      <header className="ax-card-header">
        <h4><Compass size={16} /> Top {ENTRY_PATH_LIMIT} entry pages</h4>
        <div className="ax-card-chips">
          <span>{formatNumber(visibleEntryPaths.length)} paths</span>
        </div>
      </header>
      <div className="ax-breakdown-list ax-entry-list">
        {visibleEntryPaths.map((item, index) => (
          <div key={`${item.path || "/"}-${index}`}>
            <b>{index + 1}</b>
            <span title={item.path || "/"}>
              <strong>{item.path || "/"}</strong>
              <small>First page</small>
            </span>
            <div><i style={{ width: `${percentOf(item.visits, maxEntryVisits)}%` }} /></div>
            <em>{formatNumber(item.visits || 0)}</em>
          </div>
        ))}
        {visibleEntryPaths.length === 0 && <small>No entry page data for this range.</small>}
      </div>
    </article>
  );
}

function AudienceBreakdown({ devices, countries, entryPaths }) {
  return (
    <section className="ax-audience-grid" aria-label="Audience breakdown">
      <DevicePie devices={devices} />
      <CountryTrafficMap countries={countries} />
      <EntryPointsList entryPaths={entryPaths} />
    </section>
  );
}

function TrackUsagePanel({ data, tracks, selectedTrackId, onSelectTrack }) {
  const hasData = data.some((item) => toNumber(item.track_users) > 0 || toNumber(item.events) > 0);
  const selectedTrack = tracks.find((track) => String(track.track_id) === String(selectedTrackId));
  const totalEvents = data.reduce((sum, day) => sum + toNumber(day.events), 0);
  const totalTrackUsers = data.reduce((sum, day) => sum + toNumber(day.track_users), 0);
  const peakUsers = data.reduce((best, day) => Math.max(best, toNumber(day.track_users)), 0);
  const chartData = data.map((day) => ({
    ...day,
    selected_users: selectedTrack ? toNumber(day.tracks?.[String(selectedTrack.track_id)]) : 0,
  }));

  return (
    <article className="ax-panel ax-panel--wide ax-panel--tracks">
      <header className="ax-panel__header">
        <div>
          <h3><Route size={18} /> Track usage analytics</h3>
          <p>Daily learners and activity events across tracks.</p>
        </div>
        <div className="ax-panel__actions">
          <div className="ax-panel__chips">
            <span>{formatNumber(totalTrackUsers)} learners</span>
            <span>{formatNumber(totalEvents)} events</span>
            <span>Peak {formatNumber(peakUsers)}</span>
          </div>
          <label className="ax-select">
            <span>Track</span>
            <select value={selectedTrackId} onChange={(event) => onSelectTrack(event.target.value)}>
              <option value="all">All tracks</option>
              {tracks.map((track) => (
                <option key={track.track_id} value={track.track_id}>{track.title}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="ax-panel__body">
        {hasData ? (
          <div className="ax-chart ax-chart--large">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 18, right: 24, left: -4, bottom: 6 }}>
                <CartesianGrid stroke="#e4edf8" strokeDasharray="4 7" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#607294", fontSize: 12, fontWeight: 800 }} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "#607294", fontSize: 12, fontWeight: 800 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="events" name="Events" fill="#d9e7ff" radius={[8, 8, 0, 0]} />
                <Line type="monotone" dataKey="track_users" name="All track learners" stroke="#18a96f" strokeWidth={4} dot={false} activeDot={{ r: 6 }} />
                {selectedTrack && (
                  <Line type="monotone" dataKey="selected_users" name={selectedTrack.title} stroke="#7c5cff" strokeWidth={4} dot={false} activeDot={{ r: 6 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="ax-empty-chart ax-empty-chart--large">
            <EmptyState icon={Route} title="No track usage for this range">Track usage appears after learners open exercises or quizzes.</EmptyState>
          </div>
        )}

      </div>

      <section className="ax-bottom-card ax-bottom-card--rank">
        <h4>Top tracks</h4>
        <div className="ax-track-rank ax-track-rank--bottom">
          {tracks.slice(0, 7).map((track) => {
            const maxUsers = Math.max(...tracks.map((item) => toNumber(item.users)), 1);
            return (
              <button type="button" key={track.track_id} onClick={() => onSelectTrack(String(track.track_id))}>
                <span>
                  <strong>{track.title}</strong>
                  <small>{formatNumber(track.events)} events</small>
                </span>
                <div><i style={{ width: `${percentOf(track.users, maxUsers)}%` }} /></div>
                <em>{formatNumber(track.users)}</em>
              </button>
            );
          })}
          {tracks.length === 0 && <small>No track activity for this range.</small>}
        </div>
      </section>
    </article>
  );
}

export default function AnalyticsPage({ onSessionExpired }) {
  const initialRange = useMemo(() => getRangePreset("30d"), []);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [activePreset, setActivePreset] = useState("30d");
  const [selectedTrackId, setSelectedTrackId] = useState("all");
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    let disposed = false;

    async function loadAnalytics() {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      try {
        const response = await authenticatedFetch(apiUrl(`/api/admin/analytics?${params.toString()}`));

        if (response.status === 401) {
          onSessionExpired?.();
          throw new Error("Session expired.");
        }

        const payload = await readJsonResponse(response);
        if (response.status === 404) {
          const fallbackResponse = await authenticatedFetch(apiUrl("/api/admin/dashboard/stats"));
          if (fallbackResponse.status === 401) {
            onSessionExpired?.();
            throw new Error("Session expired.");
          }
          if (fallbackResponse.ok) {
            const fallbackPayload = await readJsonResponse(fallbackResponse);
            if (!disposed) setAnalytics(adaptDashboardStats(fallbackPayload, startDate, endDate));
            return;
          }
          if (!disposed) setAnalytics(createEmptyAnalytics(startDate, endDate));
          return;
        }
        if (!response.ok) {
          throw new Error(payload?.detail || `Unable to load analytics (${response.status}).`);
        }
        if (!disposed) setAnalytics(normalizeAnalyticsPayload(payload, startDate, endDate));
      } catch {
        if (!disposed) {
          setAnalytics((current) => current || createEmptyAnalytics(startDate, endDate));
        }
      }
    }

    void loadAnalytics();
    return () => {
      disposed = true;
    };
  }, [endDate, onSessionExpired, startDate]);

  const visitData = useMemo(
    () => (analytics?.visit_series || []).map((day) => ({
      ...day,
      label: formatShortDate(day.date),
      visits: toNumber(day.visits),
      unique_visitors: toNumber(day.unique_visitors ?? day.unique_visits),
      new_visitors: toNumber(day.new_visitors),
      returning_visitors: toNumber(day.returning_visitors),
    })),
    [analytics?.visit_series],
  );
  const trackData = useMemo(
    () => (analytics?.track_series || []).map((day) => ({
      ...day,
      label: formatShortDate(day.date),
      track_users: toNumber(day.track_users),
      events: toNumber(day.events),
    })),
    [analytics?.track_series],
  );
  const trackBreakdown = analytics?.track_breakdown || [];
  const deviceBreakdown = analytics?.device_breakdown || [];
  const countryBreakdown = analytics?.country_breakdown || [];
  const topEntryPaths = analytics?.top_entry_paths || [];
  const bottleneckExercises = analytics?.bottleneck_exercises || [];
  const activeLearners = analytics?.active_learners || [];

  useEffect(() => {
    if (selectedTrackId !== "all" && !trackBreakdown.some((track) => String(track.track_id) === String(selectedTrackId))) {
      setSelectedTrackId("all");
    }
  }, [selectedTrackId, trackBreakdown]);

  const applyPreset = (preset) => {
    const range = getRangePreset(preset);
    setActivePreset(preset);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const applyCustomRange = (nextStart, nextEnd) => {
    setActivePreset("custom");
    setStartDate(nextStart);
    setEndDate(nextEnd);
  };

  return (
    <div className="ax-page">
      <RangeControls
        activePreset={activePreset}
        startDate={startDate}
        endDate={endDate}
        onPreset={applyPreset}
        onCustom={applyCustomRange}
      />

      <MetricStrip analytics={analytics} />

      <section className="ax-section-stack">
        <VisitsPanel data={visitData} />
        
        <ActivityCalendarHeatmap analytics={analytics} />

        <TrackUsagePanel
          data={trackData}
          tracks={trackBreakdown}
          selectedTrackId={selectedTrackId}
          onSelectTrack={setSelectedTrackId}
        />

        <div className="ax-intelligence-grid">
          <BottleneckPanel exercises={bottleneckExercises} />
          <ActiveLearnersPanel learners={activeLearners} />
        </div>

        <AudienceBreakdown
          devices={deviceBreakdown}
          countries={countryBreakdown}
          entryPaths={topEntryPaths}
        />
      </section>
    </div>
  );
}

function ActivityCalendarHeatmap({ analytics }) {
  const calendarDays = analytics?.calendar_days || [];
  const hasData = calendarDays.some((item) => toNumber(item.events) > 0);

  const maxEvents = useMemo(() => {
    if (calendarDays.length === 0) return 1;
    return Math.max(...calendarDays.map((d) => toNumber(d.events)), 1);
  }, [calendarDays]);

  const stats = useMemo(() => {
    const totalEvents = calendarDays.reduce((sum, d) => sum + toNumber(d.events), 0);
    const activeDays = calendarDays.filter((d) => toNumber(d.events) > 0).length;
    const peak = calendarDays.reduce((best, d) => Math.max(best, toNumber(d.events)), 0);
    const avg = activeDays > 0 ? Math.round(totalEvents / activeDays) : 0;
    return { totalEvents, activeDays, peak, avg };
  }, [calendarDays]);

  const heatmapCells = useMemo(() => {
    if (calendarDays.length === 0) return [];
    
    const cells = calendarDays.map((d) => {
      const parts = d.date.split("-").map(Number);
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12);
      return {
        ...d,
        isPadding: false,
        dateObj,
        dayOfWeek: dateObj.getDay(),
      };
    });

    const firstCell = cells[0];
    const paddingStart = [];
    const firstDayOfWeek = firstCell.dayOfWeek;
    for (let i = 0; i < firstDayOfWeek; i++) {
      paddingStart.push({ isPadding: true, date: "", events: 0 });
    }

    const lastCell = cells[cells.length - 1];
    const paddingEnd = [];
    const lastDayOfWeek = lastCell.dayOfWeek;
    for (let i = lastDayOfWeek + 1; i <= 6; i++) {
      paddingEnd.push({ isPadding: true, date: "", events: 0 });
    }

    return [...paddingStart, ...cells, ...paddingEnd];
  }, [calendarDays]);

  const monthLabels = useMemo(() => {
    if (calendarDays.length === 0) return [];
    const months = new Set();
    calendarDays.forEach((d) => {
      const parts = d.date.split("-").map(Number);
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12);
      const label = dateObj.toLocaleDateString("en-US", { month: "short" });
      months.add(label);
    });
    return Array.from(months);
  }, [calendarDays]);

  const getIntensity = (events) => {
    if (events === 0) return 0;
    const ratio = events / maxEvents;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const getCellTooltip = (cell) => {
    if (cell.isPadding) return "";
    const parts = cell.date.split("-").map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return `${formattedDate}: ${formatNumber(cell.events)} events, ${formatNumber(cell.visits)} visits`;
  };

  return (
    <article className="ax-panel ax-panel--wide ax-heatmap-panel">
      <header className="ax-panel__header">
        <div>
          <h3>
            <CalendarDays size={18} /> Learning Activity Heatmap
          </h3>
          <p>Visual map of events, visits, and track submissions over time.</p>
        </div>
        <div className="ax-panel__chips">
          <span>{formatNumber(stats.totalEvents)} total events</span>
          <span>{formatNumber(stats.activeDays)} active days</span>
          <span>Peak {formatNumber(stats.peak)}/day</span>
        </div>
      </header>

      <div className="ax-heatmap-layout">
        <div className="ax-heatmap-main">
          {monthLabels.length > 0 && (
            <div className="ax-heatmap-months">
              {monthLabels.map((lbl, idx) => (
                <span key={lbl + idx}>{lbl}</span>
              ))}
            </div>
          )}
          <div className="ax-heatmap-container">
            <div className="ax-heatmap-days-of-week">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div className="ax-heatmap-grid">
              {heatmapCells.map((cell, idx) => {
                if (cell.isPadding) {
                  return <div key={`pad-${idx}`} className="ax-heatmap-cell ax-heatmap-cell--pad" />;
                }
                const level = getIntensity(toNumber(cell.events));
                return (
                  <div
                    key={cell.date}
                    className={`ax-heatmap-cell ax-heatmap-cell--lvl-${level}`}
                    title={getCellTooltip(cell)}
                  >
                    <div className="ax-cell-tooltip-pop">
                      <strong>{cell.date}</strong>
                      <span>Events: <b>{formatNumber(cell.events)}</b></span>
                      <span>Visits: <b>{formatNumber(cell.visits)}</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="ax-heatmap-legend">
            <span>Less</span>
            <div className="ax-heatmap-cell ax-heatmap-cell--lvl-0" />
            <div className="ax-heatmap-cell ax-heatmap-cell--lvl-1" />
            <div className="ax-heatmap-cell ax-heatmap-cell--lvl-2" />
            <div className="ax-heatmap-cell ax-heatmap-cell--lvl-3" />
            <div className="ax-heatmap-cell ax-heatmap-cell--lvl-4" />
            <span>More</span>
          </div>
        </div>

        <div className="ax-heatmap-sidebar">
          <h4>Activity Stats</h4>
          <div className="ax-heatmap-stat-row">
            <span>Active Days Rate</span>
            <strong>
              {percentOf(stats.activeDays, Math.max(calendarDays.length, 1))}%
            </strong>
          </div>
          <div className="ax-heatmap-stat-row">
            <span>Avg Events / Active Day</span>
            <strong>{formatNumber(stats.avg)}</strong>
          </div>
          <div className="ax-heatmap-stat-row">
            <span>Visits Peak</span>
            <strong>
              {formatNumber(
                calendarDays.reduce((best, d) => Math.max(best, toNumber(d.visits)), 0)
              )}
            </strong>
          </div>
        </div>
      </div>
    </article>
  );
}

function BottleneckPanel({ exercises }) {
  return (
    <article className="ax-panel ax-panel--intelligence">
      <header className="ax-panel__header">
        <div>
          <h3>
            <AlertTriangle size={18} className="ax-icon-warning" /> Curriculum Bottlenecks
          </h3>
          <p>Highest failure rates, hints utilized, and solutions viewed.</p>
        </div>
      </header>
      
      <div className="ax-intelligence-list">
        {exercises.length > 0 ? (
          exercises.map((ex, index) => {
            const passedPercent = percentOf(ex.passed_attempts, ex.total_attempts);
            const failedPercent = percentOf(ex.failed_attempts, ex.total_attempts);
            return (
              <div key={ex.exercise_id} className="ax-intel-item">
                <div className="ax-intel-item__rank">
                  <b>#{index + 1}</b>
                </div>
                <div className="ax-intel-item__main">
                  <div className="ax-intel-item__title-row">
                    <span className="ax-intel-item__title" title={ex.title}>
                      {ex.title}
                    </span>
                    <span className="ax-intel-item__badge">
                      {ex.failure_rate}% failure rate
                    </span>
                  </div>
                  
                  <div className="ax-intel-item__stats">
                    <span>
                      Attempts: <b>{formatNumber(ex.total_attempts)}</b>
                    </span>
                    <span>
                      Hints: <b>{formatNumber(ex.total_hints)}</b>
                    </span>
                    <span>
                      Solutions: <b>{formatNumber(ex.total_solutions_viewed)}</b>
                    </span>
                  </div>

                  <div className="ax-intel-item__bar-container">
                    <div className="ax-intel-item__bar">
                      <div 
                        className="ax-intel-item__bar-fill ax-intel-item__bar-fill--failed" 
                        style={{ width: `${failedPercent}%` }} 
                        title={`Failed: ${ex.failed_attempts} attempts`}
                      />
                      <div 
                        className="ax-intel-item__bar-fill ax-intel-item__bar-fill--passed" 
                        style={{ width: `${passedPercent}%` }}
                        title={`Passed: ${ex.passed_attempts} attempts`}
                      />
                    </div>
                    <div className="ax-intel-item__bar-labels">
                      <small>{formatNumber(ex.failed_attempts)} failed</small>
                      <small>{formatNumber(ex.passed_attempts)} passed</small>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="ax-empty-state-small">
            <BookOpen size={24} />
            <p>No exercise activity recorded in this range.</p>
          </div>
        )}
      </div>
    </article>
  );
}

function ActiveLearnersPanel({ learners }) {
  return (
    <article className="ax-panel ax-panel--intelligence">
      <header className="ax-panel__header">
        <div>
          <h3>
            <Trophy size={18} className="ax-icon-trophy" /> Active Learners Leaderboard
          </h3>
          <p>Students ranked by range XP earned, exercises solved, and executions.</p>
        </div>
      </header>

      <div className="ax-intelligence-list">
        {learners.length > 0 ? (
          learners.map((learner, index) => {
            const isTop3 = index < 3;
            const rankClass = isTop3 ? `ax-rank-badge--${index + 1}` : "";
            
            return (
              <div key={learner.user_id} className="ax-intel-item ax-intel-item--learner">
                <div className="ax-intel-item__rank">
                  <span className={`ax-rank-badge ${rankClass}`}>
                    {index + 1}
                  </span>
                </div>
                <div className="ax-intel-item__main">
                  <div className="ax-intel-item__title-row">
                    <span className="ax-intel-item__username">
                      {learner.username}
                    </span>
                    <span className="ax-intel-item__xp-badge">
                      <Flame size={13} /> {formatNumber(learner.xp_earned)} XP
                    </span>
                  </div>

                  <div className="ax-intel-item__learner-stats">
                    <div className="ax-learner-stat-card">
                      <small>Solved</small>
                      <strong>{formatNumber(learner.exercises_solved)}</strong>
                    </div>
                    <div className="ax-learner-stat-card">
                      <small>Total Runs</small>
                      <strong>{formatNumber(learner.total_attempts)}</strong>
                    </div>
                    <div className="ax-learner-stat-card">
                      <small>Success Rate</small>
                      <strong>
                        {learner.total_attempts > 0 
                          ? `${Math.round((learner.exercises_solved / learner.total_attempts) * 100)}%` 
                          : "0%"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="ax-empty-state-small">
            <Trophy size={24} />
            <p>No active learner leaderboard for this range.</p>
          </div>
        )}
      </div>
    </article>
  );
}
