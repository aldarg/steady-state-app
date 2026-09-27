// The chart (v1-05): the modelled level over a window of the log, as a pure
// view, and that view's wiring to the vendored Chart.js 4.5.1, and (v1-06)
// to chartjs-plugin-zoom 2.2.0 over Hammer 2.0.8 for pinch and pan. The view
// reads no clock and touches no DOM; mountChart is handed Chart.js, Hammer,
// the canvas, the window and the clock by ui.js, so nothing here runs at
// import and Node imports it.

import {
  formatLevel,
  formatMg,
  formatMoment,
  formatNumber,
  formatTick,
  formatTime,
  localDay,
  t,
} from "./i18n.js";
import { params, series } from "./pk.js";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export const PRESETS = Object.freeze(["7d", "30d", "90d", "1y", "all"]);

const PRESET_DAYS = Object.freeze({ "7d": 7, "30d": 30, "90d": 90, "1y": 365 });

// Decision 1, C2: a window is seven parts, six back and one ahead; all is at
// least 7 days wide, and its back part reaches the first intake.
const WINDOW_PARTS = 7;
const BACK_PARTS = 6;
const ALL_FLOOR_MS = 7 * DAY_MS;

// SPEC §5.4's steps and per-dose curves, by the window's width.
const FINE_UP_TO_MS = 14 * DAY_MS;
const DOSES_UP_TO_MS = 90 * DAY_MS;

export const stepFor = (width) => {
  if (width <= FINE_UP_TO_MS) {
    return 30 * MINUTE_MS;
  }
  return width <= DOSES_UP_TO_MS ? 2 * HOUR_MS : 6 * HOUR_MS;
};

export const perDoseShown = (width) => width <= DOSES_UP_TO_MS;

// Ten half-lives of the slower phase, past which pk.js skips a dose: the
// projection is zero from there on.
const CUTOFF_HALF_LIVES = 10;

const cutoffMs = (p) =>
  CUTOFF_HALF_LIVES * Math.max(p.halfLifeH, Math.LN2 / p.ka) * HOUR_MS;

const widthOf = (preset, nowMs, firstMs) =>
  preset === "all"
    ? Math.max(ALL_FLOOR_MS, ((nowMs - firstMs) * WINDOW_PARTS) / BACK_PARTS)
    : PRESET_DAYS[preset] * DAY_MS;

// v1-06 decision 4: a range is at least 12 h wide.
export const MIN_RANGE_MS = 12 * HOUR_MS;

// v1-06 decision 4: the limits of a gesture are the all window, exactly as
// the all preset draws it.
export const rangeBounds = ({ nowMs, firstMs, p }) => {
  const { fromMs, toMs } = chartWindow({ preset: "all", nowMs, firstMs, p });
  return { fromMs, toMs };
};

// v1-06 decision 4: a range narrower than 12 h widened about its centre, one
// wider than the bounds made the bounds, and one that sticks out moved in,
// keeping its width.
export const clampRange = (range, bounds) => {
  const centre = (range.fromMs + range.toMs) / 2;
  const { fromMs, toMs } =
    range.toMs - range.fromMs < MIN_RANGE_MS
      ? { fromMs: centre - MIN_RANGE_MS / 2, toMs: centre + MIN_RANGE_MS / 2 }
      : range;
  const width = toMs - fromMs;
  if (width > bounds.toMs - bounds.fromMs) {
    return { fromMs: bounds.fromMs, toMs: bounds.toMs };
  }
  if (fromMs < bounds.fromMs) {
    return { fromMs: bounds.fromMs, toMs: bounds.fromMs + width };
  }
  if (toMs > bounds.toMs) {
    return { fromMs: bounds.toMs - width, toMs: bounds.toMs };
  }
  return { fromMs, toMs };
};

// v1-06 decision 3: the stored range clamped into the bounds of the log
// drawn, over a grid at the drawn range's step, anchored at now and reaching
// past both ends.
const rangeWindow = ({ range, nowMs, firstMs, p }) => {
  const { fromMs, toMs } = clampRange(
    range,
    rangeBounds({ nowMs, firstMs, p }),
  );
  const width = toMs - fromMs;
  const stepMs = stepFor(width);
  return {
    fromMs,
    toMs,
    gridFromMs: nowMs - Math.ceil((nowMs - fromMs) / stepMs) * stepMs,
    gridToMs: nowMs + Math.ceil((toMs - nowMs) / stepMs) * stepMs,
    stepMs,
    width,
  };
};

// Decision 1: one part ahead, never past the cutoff, and both ends on the
// grid through now, so the solid-to-dashed change falls on a point. A range
// (v1-06) has its own window; a preset's grid is its window.
export const chartWindow = ({ preset, range = null, nowMs, firstMs, p }) => {
  if (range !== null) {
    return rangeWindow({ range, nowMs, firstMs, p });
  }
  const width = widthOf(preset, nowMs, firstMs);
  const stepMs = stepFor(width);
  const ahead =
    Math.floor(Math.min(width / WINDOW_PARTS, cutoffMs(p)) / stepMs) * stepMs;
  const back = Math.ceil((width - ahead) / stepMs) * stepMs;
  return { fromMs: nowMs - back, toMs: nowMs + ahead, stepMs, width };
};

// Decision 3, C3: 20 % headroom, and 18 with the band so that its lower edge
// shows; a step of 1, 2 or 5 times a power of ten, at most five of them.
const HEADROOM = 1.2;
const BAND_FLOOR = 18;
const MAX_STEPS = 5;
const MANTISSAS = Object.freeze([1, 2, 5]);

const tickStep = (target) => {
  let power = 1;
  while (target / (MANTISSAS.at(-1) * power) > MAX_STEPS) {
    power *= 10;
  }
  return MANTISSAS.map((mantissa) => mantissa * power).find(
    (step) => target / step <= MAX_STEPS,
  );
};

export const yAxis = (maxTotal, band) => {
  const target = Math.max(HEADROOM * maxTotal, band ? BAND_FLOOR : 0);
  const step = tickStep(target);
  const yMax = Math.max(step, Math.ceil(target / step) * step);
  const yTicks = Array.from({ length: yMax / step + 1 }, (_, k) => k * step);
  return { yMax, yTicks };
};

// Decision 6: which local dates carry a tick, by the window's width, and at
// which hours: v1-06 decision 10's every 3 or 6 hours up to 2 days, and
// midnight alone beyond. A date is kept by its calendar fields, read in UTC
// from calendarDay's count; the midnight's label is the density's name.
const MIDNIGHT = Object.freeze([0]);
const DENSITIES = Object.freeze([
  {
    upTo: DAY_MS,
    name: "day",
    hours: Object.freeze([0, 3, 6, 9, 12, 15, 18, 21]),
    keeps: () => true,
  },
  {
    upTo: 2 * DAY_MS,
    name: "day",
    hours: Object.freeze([0, 6, 12, 18]),
    keeps: () => true,
  },
  { upTo: 8 * DAY_MS, name: "day", hours: MIDNIGHT, keeps: () => true },
  {
    upTo: 60 * DAY_MS,
    name: "week",
    hours: MIDNIGHT,
    keeps: (date) => date.getUTCDay() === 1,
  },
  {
    upTo: 180 * DAY_MS,
    name: "month",
    hours: MIDNIGHT,
    keeps: (date) => date.getUTCDate() === 1,
  },
  {
    upTo: 730 * DAY_MS,
    name: "quarter",
    hours: MIDNIGHT,
    keeps: (date) => date.getUTCDate() === 1 && date.getUTCMonth() % 3 === 0,
  },
  {
    upTo: Infinity,
    name: "year",
    hours: MIDNIGHT,
    keeps: (date) => date.getUTCDate() === 1 && date.getUTCMonth() === 0,
  },
]);

// The runtime's local date of `ms`, as the UTC midnight of that date: a count
// of calendar days that no daylight-saving change can shift.
const calendarDay = (ms) => {
  const local = new Date(ms);
  return new Date(0).setUTCFullYear(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
  );
};

// Each tick from its own calendar date and hour, never from the tick before:
// a midnight the zone skips moves only its own tick, to the instant
// setHours(0, 0, 0, 0) gives, and no later one. As intake.js's
// localInputToMs, setFullYear keeps years 0–99 out of the 1900s.
const localHour = (date, hour) => {
  const local = new Date(0);
  local.setFullYear(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  local.setHours(hour, 0, 0, 0);
  return local.getTime();
};

// v1-06 decision 10: the tick built for hour 0 is labelled as its day, even
// where it resolved to 01:00; every other one by its time.
const tickLabel = (ms, hour, name, locale, timeZone) =>
  hour === 0
    ? formatTick(ms, name, locale, timeZone)
    : formatTime(ms, locale, timeZone);

export const timeTicks = ({ fromMs, toMs, width, locale, timeZone }) => {
  const { name, hours, keeps } = DENSITIES.find(({ upTo }) => width <= upTo);
  const ticks = [];
  const lastDay = calendarDay(toMs);
  for (let day = calendarDay(fromMs); day <= lastDay; day += DAY_MS) {
    const date = new Date(day);
    for (const hour of keeps(date) ? hours : []) {
      const ms = localHour(date, hour);
      if (ms >= fromMs && ms <= toMs) {
        ticks.push({ ms, label: tickLabel(ms, hour, name, locale, timeZone) });
      }
    }
  }
  return ticks;
};

// Decision 4, C5: the AGNP consensus range.
const BAND = Object.freeze({ from: 15, to: 80 });
// Decision 2: a dose is drawn when it peaks above a hundredth of the total.
const DOSE_SHARE = 100;

const largest = (points) => points.reduce((max, { y }) => Math.max(max, y), 0);

// One curve per dose the series holds at some grid point, its points those
// grid points, in order; it is drawn when it peaks above a hundredth of the
// total at the points shown (v1-06 decision 3).
const doseCurves = (rows, maxTotal, shown) => {
  const curves = new Map();
  for (const { t: x, perDose } of rows) {
    for (const [id, y] of perDose) {
      if (!curves.has(id)) {
        curves.set(id, []);
      }
      curves.get(id).push({ x, y });
    }
  }
  return [...curves]
    .filter(
      ([, points]) => largest(points.filter(shown)) > maxTotal / DOSE_SHARE,
    )
    .map(([id, points]) => ({ id, points }));
};

// Decision 2: everything the chart draws, from the stored document as the
// store keeps it (doses by instant, ties by id). Every logged intake counts,
// one logged ahead of now included. `rows` is pk.series's own output, which
// the tooltip reads. v1-06 decision 3: at a range, the grid reaches past the
// range shown, and the y-axis and the 1 % rule read only the points inside
// it; `bounds` are the gesture's limits.
export const chartView = (
  doc,
  { preset, range = null, nowMs, locale, timeZone },
) => {
  if (doc.doses.length === 0) {
    return { empty: true };
  }
  const { settings } = doc;
  const p = params(settings);
  const firstMs = Date.parse(doc.doses[0].takenAt);
  const {
    fromMs,
    toMs,
    gridFromMs = fromMs,
    gridToMs = toMs,
    stepMs,
    width,
  } = chartWindow({ preset, range, nowMs, firstMs, p });
  const rows = series(doc.doses, gridFromMs, gridToMs, stepMs, p);
  const total = rows.map(({ t: x, total: y }) => ({ x, y }));
  const shown = ({ x }) => x >= fromMs && x <= toMs;
  const maxTotal = largest(total.filter(shown));
  const { yMax, yTicks } = yAxis(maxTotal, settings.showRefRange);
  const drawsDoses = settings.showPerDoseCurves && perDoseShown(width);
  return {
    empty: false,
    fromMs,
    toMs,
    gridFromMs,
    stepMs,
    bounds: rangeBounds({ nowMs, firstMs, p }),
    now: nowMs,
    total,
    doses: drawsDoses ? doseCurves(rows, maxTotal, shown) : [],
    yMax,
    yTicks,
    yLabels: yTicks.map((tick) => formatNumber(tick, locale)),
    band: settings.showRefRange
      ? { ...BAND, label: t(locale, "chart.band") }
      : null,
    ticks: timeTicks({ fromMs, toMs, width, locale, timeZone }),
    labels: { now: t(locale, "chart.now"), axis: t(locale, "chart.axis") },
    rows,
  };
};

// Decision 8: the grid point nearest `ms`, the earlier on a tie. The grid is
// uniform from gridFromMs (v1-06 decision 3: at a range, before the range's
// start), and the distances are whole milliseconds.
export const nearestIndex = ({ total, gridFromMs, stepMs }, ms) => {
  const last = total.length - 1;
  const below = Math.min(
    last,
    Math.max(0, Math.floor((ms - gridFromMs) / stepMs)),
  );
  const later = below < last && total[below + 1].x - ms < ms - total[below].x;
  return later ? below + 1 : below;
};

// An intake on the point's own local day is named by its time; another, by
// its moment.
const intakeTime = (intakeMs, pointMs, nowMs, locale, timeZone) =>
  localDay(intakeMs, timeZone) === localDay(pointMs, timeZone)
    ? formatTime(intakeMs, locale, timeZone)
    : formatMoment(intakeMs, nowMs, locale, timeZone);

// Decision 8, C6: the moment, the total, and the latest intake strictly
// before the point while the series still holds it there.
export const tooltipAt = (view, ms, { doc, locale, timeZone }) => {
  const index = nearestIndex(view, ms);
  const { x, y } = view.total[index];
  const latest = doc.doses.findLast(({ takenAt }) => Date.parse(takenAt) < x);
  const held =
    latest === undefined ? undefined : view.rows[index].perDose.get(latest.id);
  const intake =
    held === undefined
      ? null
      : t(locale, "chart.intake", {
          time: intakeTime(
            Date.parse(latest.takenAt),
            x,
            view.now,
            locale,
            timeZone,
          ),
          mg: formatMg(latest.mg, locale),
          level: formatLevel(held, locale),
        });
  return {
    title: formatMoment(x, view.now, locale, timeZone),
    total: t(locale, "chart.total", { level: formatLevel(y, locale) }),
    intake,
  };
};

// v1-06 decision 7: two ranges are the same by their two ends.
const sameRange = (a, b) =>
  a === null || b === null
    ? a === b
    : a.fromMs === b.fromMs && a.toMs === b.toMs;

// Decision 11: the last view, kept while the document object, the preset,
// the range (v1-06) and the locale stay the same, unless a fresh one is asked
// for.
export const chartModel = (compute = chartView) => {
  let kept = null;
  const viewFor = (doc, options, { fresh }) => {
    const { preset, range = null, locale } = options;
    const same =
      kept !== null &&
      kept.doc === doc &&
      kept.preset === preset &&
      sameRange(kept.range, range) &&
      kept.locale === locale;
    if (fresh || !same) {
      kept = { doc, preset, range, locale, view: compute(doc, options) };
    }
    return kept.view;
  };
  return { viewFor };
};

// v1-06 decision 8: a page shown again with a range returns to 7 d; one on a
// preset draws it afresh, at the new now.
export const onShown = ({ range }) =>
  range === null ? { fresh: true } : { preset: "7d" };

// Decision 10: the CSS tokens the chart is drawn in, read again when the
// colour scheme changes.
const TOKENS = Object.freeze({
  accent: "--color-accent",
  dose: "--color-dose",
  band: "--color-band",
  muted: "--color-muted",
  line: "--color-line",
  edge: "--color-edge",
  text: "--color-text",
});

const readLook = (window, canvas) => {
  const style = window.getComputedStyle(canvas);
  const colors = Object.fromEntries(
    Object.entries(TOKENS).map(([name, token]) => [
      name,
      style.getPropertyValue(token).trim(),
    ]),
  );
  return { colors, family: style.fontFamily };
};

const TOTAL_WIDTH = 2.5;
const DOSE_WIDTH = 1;
const DASH = Object.freeze([5, 4]);
const FONT_SIZE = 12;
const LABEL_SIZE = 11;
const TOP_ROOM = 20;
const INSET = 6;
// v1-14 decision 2: 2 px above the top tick label, which rises 6 px above
// the plot; at LABEL_SIZE, the labels then stay inside TOP_ROOM.
const LABEL_RISE = 8;
const ACTIVE_RADIUS = 3;

// Decision 5: every segment that starts at or after now is dashed. The
// colours are fixed strings: nothing changes with the level.
const lineOf = (points, color, width, nowMs) => ({
  data: points,
  borderColor: color,
  borderWidth: width,
  borderJoinStyle: "round",
  fill: false,
  pointRadius: 0,
  pointHitRadius: 0,
  tension: 0,
  segment: {
    borderDash: ({ p0DataIndex }) =>
      points[p0DataIndex].x >= nowMs ? [...DASH] : undefined,
  },
});

// The total first: Chart.js draws the first dataset on top.
const datasetsOf = (view, { colors }) => [
  lineOf(view.total, colors.accent, TOTAL_WIDTH, view.now),
  ...view.doses.map(({ points }) =>
    lineOf(points, colors.dose, DOSE_WIDTH, view.now),
  ),
];

// Decision 6: both scales linear, each with exactly the view's ticks; the y
// scale from 0, which Chart.js does not assume. v1-14 decision 3: x keeps
// those in its current range, ends included, each labelled by its value.
const scalesOf = (view, { colors, family }) => {
  const ticks = { color: colors.muted, font: { family, size: FONT_SIZE } };
  const labels = new Map(view.ticks.map(({ ms, label }) => [ms, label]));
  return {
    x: {
      type: "linear",
      bounds: "data",
      min: view.fromMs,
      max: view.toMs,
      afterBuildTicks: (scale) => {
        scale.ticks = view.ticks
          .filter(({ ms }) => ms >= scale.min && ms <= scale.max)
          .map(({ ms }) => ({ value: ms }));
      },
      ticks: {
        ...ticks,
        autoSkip: false,
        maxRotation: 0,
        callback: (value) => labels.get(value),
      },
      grid: { color: colors.line },
      border: { color: colors.line },
    },
    y: {
      type: "linear",
      bounds: "data",
      min: 0,
      max: view.yMax,
      afterBuildTicks: (scale) => {
        scale.ticks = view.yTicks.map((value) => ({ value }));
      },
      ticks: {
        ...ticks,
        autoSkip: false,
        callback: (value, index) => view.yLabels[index],
      },
      grid: { color: colors.line },
      border: { display: false },
    },
  };
};

const optionsOf = (view, look, zoom) => ({
  animation: false,
  responsive: true,
  maintainAspectRatio: false,
  parsing: false,
  normalized: true,
  events: [],
  layout: { padding: { top: TOP_ROOM } },
  plugins: { legend: { display: false }, tooltip: { enabled: false }, zoom },
  scales: scalesOf(view, look),
});

const textStyle = (ctx, color, family) => {
  ctx.fillStyle = color;
  ctx.font = `${LABEL_SIZE}px ${family}`;
};

// Decision 4: the band's fill, under the grid, from 15 to 80 or the axis top.
const drawBand = (chart, { view, look }) => {
  if (view.band === null) {
    return;
  }
  const { ctx, chartArea, scales } = chart;
  const top = scales.y.getPixelForValue(Math.min(view.band.to, view.yMax));
  const bottom = scales.y.getPixelForValue(view.band.from);
  ctx.save();
  ctx.fillStyle = look.colors.band;
  ctx.fillRect(chartArea.left, top, chartArea.width, bottom - top);
  ctx.restore();
};

// C5: the band's label, small and muted, just inside its lower-left corner.
const drawBandLabel = (chart, { view, look }) => {
  if (view.band === null) {
    return;
  }
  const { ctx, chartArea, scales } = chart;
  ctx.save();
  textStyle(ctx, look.colors.muted, look.family);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(
    view.band.label,
    chartArea.left + INSET,
    scales.y.getPixelForValue(view.band.from) - INSET / 2,
  );
  ctx.restore();
};

const verticalLine = (chart, x, color) => {
  const { ctx, chartArea } = chart;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, chartArea.top);
  ctx.lineTo(x, chartArea.bottom);
  ctx.stroke();
  ctx.restore();
};

// Decision 5 and 7: the "now" line labelled at its top, the axis unit once
// at the top of the y-axis, and the tapped point's line and dot. v1-14: the
// labels raised (decision 2); the unit always, the rest only in the plot (3).
const drawMarks = (chart, { view, look, active }) => {
  const { ctx, chartArea, scales } = chart;
  const inPlot = (x) => x >= chartArea.left && x <= chartArea.right;
  const nowX = scales.x.getPixelForValue(view.now);
  const nowShown = inPlot(nowX);
  if (nowShown) {
    verticalLine(chart, nowX, look.colors.edge);
  }
  ctx.save();
  textStyle(ctx, look.colors.muted, look.family);
  ctx.textBaseline = "bottom";
  if (nowShown) {
    ctx.textAlign = "center";
    ctx.fillText(view.labels.now, nowX, chartArea.top - LABEL_RISE);
  }
  ctx.textAlign = "left";
  ctx.fillText(view.labels.axis, scales.y.left, chartArea.top - LABEL_RISE);
  ctx.restore();
  const x = active === null ? null : scales.x.getPixelForValue(active.x);
  if (x === null || !inPlot(x)) {
    return;
  }
  verticalLine(chart, x, look.colors.text);
  ctx.save();
  ctx.fillStyle = look.colors.accent;
  ctx.beginPath();
  ctx.arc(
    x,
    scales.y.getPixelForValue(active.y),
    ACTIVE_RADIUS,
    0,
    2 * Math.PI,
  );
  ctx.fill();
  ctx.restore();
};

// The band, the labels and the marks, drawn from the chart's current state:
// the band under the grid, its label over the grid and under the curves.
const overlay = (state) => ({
  id: "steadyStateOverlay",
  beforeDraw: (chart) => drawBand(chart, state),
  beforeDatasetsDraw: (chart) => drawBandLabel(chart, state),
  afterDatasetsDraw: (chart) => drawMarks(chart, state),
});

const TIP_GAP = 8;
// Decision 8, round 3: a pointer that comes up within this many CSS px of
// where it went down, with no pointercancel between, is a tap. v1-06
// decision 5: a pan starts beyond it.
const TAP_SLOP = 10;

// v1-06 decision 5: chartjs-plugin-zoom's options. Time only; a pan from 10
// px; a pinch, and any wheel, which onZoomStart sorts; no drag-to-zoom; the
// bounds as the limits, and 12 h the narrowest.
export const zoomOptions = (bounds, handlers) => {
  const {
    onPanStart,
    onPan,
    onPanComplete,
    onZoomStart,
    onZoom,
    onZoomComplete,
  } = handlers;
  return {
    pan: {
      enabled: true,
      mode: "x",
      threshold: TAP_SLOP,
      onPanStart,
      onPan,
      onPanComplete,
    },
    zoom: {
      mode: "x",
      pinch: { enabled: true },
      wheel: { enabled: true, modifierKey: null },
      drag: { enabled: false },
      onZoomStart,
      onZoom,
      onZoomComplete,
    },
    limits: {
      x: { min: bounds.fromMs, max: bounds.toMs, minRange: MIN_RANGE_MS },
    },
  };
};

// v1-06 decision 5: a wheel zooms with Ctrl or ⌘ held (a trackpad's pinch
// arrives as a wheel with Ctrl), and a plain one scrolls the page; any other
// start, a pinch's, is let through.
export const wheelAllowed = (event) =>
  event.type !== "wheel" || event.ctrlKey === true || event.metaKey === true;

// v1-06 decision 7: a gesture's result is stored this long after its last
// completion; wheel events closer together than the plugin's completion
// delay are one stream.
const SETTLE_MS = 100;
const WHEEL_STREAM_MS = 250;

// v1-06 decision 7: when a gesture's result is stored, and whether it still
// may be. Every accepted start cancels the pending timer and every
// completion of a gesture whose result is not yet taken re-arms it; a timer
// due while a pointer is down on the canvas waits for the last one's end,
// which also arms it for a pan or a pinch the browser cancelled. The epoch
// moves when a preset is tapped or the page is shown again: a gesture begun
// before then stores nothing, and its later steps are undone. v1-14
// decision 4: every accepted start closes the tip, through mountChart's close.
const settling = ({ window, now, state, held, onRange, close: closeTip }) => {
  const gesture = {
    epoch: 0,
    // The epoch the latest accepted start recorded.
    recorded: null,
    // The wheel stream: its first event's epoch, its last event's instant.
    stream: null,
    // An accepted start since the last recompute or settle: a result is
    // pending, not yet taken.
    started: false,
    // An accepted pan or pinch start since the last recompute or settle.
    open: false,
    // The timer came due while a pointer was down.
    due: false,
    timer: null,
  };
  const current = () => gesture.recorded === gesture.epoch;
  const pending = () => gesture.started && current();
  const liveRange = () => {
    const { min, max } = state.chart.scales.x;
    return clampRange({ fromMs: min, toMs: max }, state.view.bounds);
  };
  const cancel = () => {
    window.clearTimeout(gesture.timer);
    gesture.timer = null;
    gesture.due = false;
  };
  const close = () => {
    cancel();
    gesture.started = false;
    gesture.open = false;
  };
  const recompute = () => {
    gesture.timer = null;
    if (held()) {
      gesture.due = true;
      return;
    }
    const range = current() ? liveRange() : null;
    close();
    if (range !== null) {
      onRange(range);
    }
  };
  const arm = () => {
    cancel();
    gesture.timer = window.setTimeout(recompute, SETTLE_MS);
  };
  // Implementation round 2: a result is taken once. The plugin's 250 ms
  // wheel completion trails every event, so it can come after the recompute
  // or a document change took the result; it then arms nothing.
  const complete = () => {
    if (gesture.started) {
      arm();
    }
  };
  const start = (epoch, opens) => {
    cancel();
    gesture.recorded = epoch;
    gesture.started = true;
    if (opens) {
      gesture.open = true;
    }
    closeTip();
  };
  // A wheel event under 250 ms after the last accepted one keeps its
  // stream's epoch, so a preset tapped mid-stream makes the rest stale.
  const wheelEpoch = () => {
    const ms = now();
    const { stream } = gesture;
    const continues = stream !== null && ms - stream.lastMs < WHEEL_STREAM_MS;
    const epoch = continues ? stream.epoch : gesture.epoch;
    gesture.stream = { epoch, lastMs: ms };
    return epoch;
  };
  // The plugin writes a step to the scale's configured limits, then updates:
  // a stale step is put back there, to the drawn view's range.
  const undoStale = () => {
    if (current()) {
      return;
    }
    const { chart, view } = state;
    const { options } = chart.scales.x;
    if (options.min !== view.fromMs || options.max !== view.toMs) {
      options.min = view.fromMs;
      options.max = view.toMs;
      chart.update("none");
    }
  };
  const handlers = {
    onPanStart: () => {
      start(gesture.epoch, true);
    },
    onPan: undoStale,
    onPanComplete: complete,
    onZoomStart: ({ event }) => {
      const allowed = wheelAllowed(event);
      if (allowed && event.type === "wheel") {
        start(wheelEpoch(), false);
      } else if (allowed) {
        start(gesture.epoch, true);
      }
      return allowed;
    },
    onZoom: undoStale,
    onZoomComplete: complete,
  };
  return {
    handlers,
    pending,
    supersede: () => {
      gesture.epoch += 1;
    },
    // A pending result, taken now so that a document change draws it, and
    // no longer pending; none while a pointer is down.
    settle: () => {
      if (!pending() || held()) {
        return null;
      }
      const range = liveRange();
      close();
      return range;
    },
    // The last pointer down on the canvas lifted or was cancelled.
    released: () => {
      if (gesture.due || gesture.open) {
        arm();
      }
    },
  };
};

const tipLine = (document, text, className) => {
  const line = document.createElement("span");
  line.className = className;
  line.textContent = text;
  return line;
};

// Decision 8: the tooltip beside the point's line, on the side with room.
const showTip = ({ tip, canvas, document }, point, lines, chart) => {
  const { title, total, intake } = lines;
  tip.replaceChildren(
    tipLine(document, title, "chart-tip-title"),
    tipLine(document, total, "chart-tip-line"),
    ...(intake === null ? [] : [tipLine(document, intake, "chart-tip-line")]),
  );
  tip.hidden = false;
  const x = chart.scales.x.getPixelForValue(point.x);
  const right = x + TIP_GAP;
  const left = Math.max(0, x - TIP_GAP - tip.offsetWidth);
  const fits = right + tip.offsetWidth <= canvas.clientWidth;
  tip.style.left = `${fits ? right : left}px`;
};

// Decisions 8 and 10: draws each view it is given, and opens the tooltip on
// a tap or a hover at the nearest grid point until a tap outside the canvas.
// A tap is told from pointer events, each pointer by its id, not from click,
// which iOS Safari does not send for a tap on a plain page area. A touch the
// browser turned into a scroll is cancelled, and neither opens nor closes it.
// v1-06: the zoom plugin pans and zooms the drawn view; the range a gesture
// leaves goes to onRange, and ui.js tells mountChart when a preset or the
// page shown again beats a gesture (supersede) and when a document change
// is about to redraw it (settle).
export const mountChart = ({
  Chart,
  Hammer,
  canvas,
  tip,
  window,
  document,
  now,
  onRange,
}) => {
  // v1-06 decision 6: the canvas's touch-action is pan-y, so a vertical drag
  // scrolls the page and a horizontal one or a pinch reaches Hammer.
  Hammer.defaults.touchAction = "pan-y";
  const state = {
    view: null,
    context: null,
    look: readLook(window, canvas),
    active: null,
    chart: null,
  };
  const parts = { tip, canvas, document };

  // Where each pointer now down went down, by pointerId, and whether another
  // pointer was down with it (v1-06 decision 11).
  const downs = new Map();
  const held = () =>
    [...downs.values()].some(({ target }) => target === canvas);

  const close = () => {
    state.active = null;
    tip.hidden = true;
  };
  const gestures = settling({ window, now, state, held, onRange, close });

  const render = () => {
    const { view, look } = state;
    const zoom = zoomOptions(view.bounds, gestures.handlers);
    const options = optionsOf(view, look, zoom);
    if (state.chart === null) {
      state.chart = new Chart(canvas, {
        type: "line",
        data: { datasets: datasetsOf(view, look) },
        options,
        plugins: [overlay(state)],
      });
      return;
    }
    // v1-06 decision 7: while a gesture's result is pending, a new view
    // keeps the scale the gesture left.
    if (gestures.pending()) {
      const { min, max } = state.chart.scales.x.options;
      Object.assign(options.scales.x, { min, max });
    }
    state.chart.data.datasets = datasetsOf(view, look);
    state.chart.options = options;
    state.chart.update();
  };

  // v1-14 decision 4: no hover or tap opens it while a gesture is pending.
  const open = (event) => {
    if (state.chart === null || gestures.pending()) {
      return;
    }
    const { left } = canvas.getBoundingClientRect();
    const ms = state.chart.scales.x.getValueForPixel(event.clientX - left);
    const point = state.view.total[nearestIndex(state.view, ms)];
    if (point === state.active) {
      return;
    }
    state.active = point;
    showTip(
      parts,
      point,
      tooltipAt(state.view, point.x, state.context),
      state.chart,
    );
    state.chart.draw();
  };

  const closeAndDraw = () => {
    if (state.active !== null) {
      close();
      state.chart.draw();
    }
  };

  // A pointer's end, its up or its cancel; the last one on the canvas may
  // release a gesture's result (v1-06 decision 7).
  const lifted = (event) => {
    const down = downs.get(event.pointerId);
    downs.delete(event.pointerId);
    if (down?.target === canvas && !held()) {
      gestures.released();
    }
    return down;
  };
  document.addEventListener("pointerdown", (event) => {
    const { pointerId, clientX, clientY, target } = event;
    downs.delete(pointerId);
    const shared = downs.size > 0;
    for (const down of downs.values()) {
      down.shared = true;
    }
    downs.set(pointerId, { clientX, clientY, target, shared });
  });
  document.addEventListener("pointercancel", lifted);
  document.addEventListener("pointerup", (event) => {
    const down = lifted(event);
    const tapped =
      down !== undefined &&
      !down.shared &&
      Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) <=
        TAP_SLOP;
    if (!tapped) {
      return;
    }
    if (down.target === canvas) {
      open(event);
    } else {
      closeAndDraw();
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") {
      open(event);
    }
  });
  canvas.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") {
      closeAndDraw();
    }
  });
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      state.look = readLook(window, canvas);
      if (state.chart !== null) {
        render();
      }
    });

  // A new view closes the tooltip: its point belongs to the old grid.
  const draw = (view, context) => {
    Object.assign(state, { view, context });
    close();
    render();
  };

  return { draw, supersede: gestures.supersede, settle: gestures.settle };
};
