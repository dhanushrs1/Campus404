import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Compass,
  MonitorSmartphone,
  Globe2,
  MousePointerClick,
  Route,
  Users,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiUrl } from "../../../shared/api.js";
import { authenticatedFetch } from "../../../shared/authSession.js";
import { EmptyState } from "../../shared/AdminWidgets.jsx";
import { addDays, formatNumber, formatShortDate, isoDate, percentOf, toNumber } from "../adminUtils.js";
import "./AnalyticsPage.css";

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

function AudienceBreakdown({ devices, countries, entryPaths }) {
  const maxDeviceVisits = Math.max(...devices.map((item) => toNumber(item.visits)), 1);
  const maxCountryVisits = Math.max(...countries.map((item) => toNumber(item.visits)), 1);
  const maxEntryVisits = Math.max(...entryPaths.map((item) => toNumber(item.visits)), 1);

  return (
    <section className="ax-audience-grid" aria-label="Audience breakdown">
      <article className="ax-bottom-card">
        <h4><MonitorSmartphone size={16} /> Devices</h4>
        <div className="ax-breakdown-list">
          {devices.map((item) => (
            <div key={item.device || "unknown"}>
              <span>
                <strong>{formatDeviceLabel(item.device)}</strong>
                <small>{formatNumber(item.unique_visitors || 0)} unique</small>
              </span>
              <div><i style={{ width: `${percentOf(item.visits, maxDeviceVisits)}%` }} /></div>
              <em>{formatNumber(item.visits || 0)}</em>
            </div>
          ))}
          {devices.length === 0 && <small>No device data for this range.</small>}
        </div>
      </article>

      <article className="ax-bottom-card">
        <h4><Globe2 size={16} /> Countries</h4>
        <div className="ax-breakdown-list">
          {countries.map((item) => (
            <div key={item.country || "Unknown"}>
              <span>
                <strong>{item.country || "Unknown"}</strong>
                <small>{formatNumber(item.unique_visitors || 0)} unique</small>
              </span>
              <div><i style={{ width: `${percentOf(item.visits, maxCountryVisits)}%` }} /></div>
              <em>{formatNumber(item.visits || 0)}</em>
            </div>
          ))}
          {countries.length === 0 && <small>No country data for this range.</small>}
        </div>
      </article>

      <article className="ax-bottom-card">
        <h4><Compass size={16} /> Entry pages</h4>
        <div className="ax-breakdown-list">
          {entryPaths.map((item) => (
            <div key={item.path || "/"}>
              <span>
                <strong>{item.path || "/"}</strong>
                <small>First page</small>
              </span>
              <div><i style={{ width: `${percentOf(item.visits, maxEntryVisits)}%` }} /></div>
              <em>{formatNumber(item.visits || 0)}</em>
            </div>
          ))}
          {entryPaths.length === 0 && <small>No entry page data for this range.</small>}
        </div>
      </article>
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
        <TrackUsagePanel
          data={trackData}
          tracks={trackBreakdown}
          selectedTrackId={selectedTrackId}
          onSelectTrack={setSelectedTrackId}
        />
        <AudienceBreakdown
          devices={deviceBreakdown}
          countries={countryBreakdown}
          entryPaths={topEntryPaths}
        />
      </section>
    </div>
  );
}
