// The summary strip above the chart (v1-07): the level now, the last intake
// and the time to a steady level, as the texts the page places. Pure: no
// DOM, no clock, no globals. The instant it is drawn at, the locale and the
// zone come in as arguments; every text comes from i18n.js.

import {
  formatDayHeading,
  formatNumber,
  formatTime,
  levelNumber,
  t,
  tPlural,
} from "./i18n.js";
import { concTotal, params } from "./pk.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
// Decision 4: the journal's missed-dose threshold (v1-04 decision 3); an
// intake strictly more than 36 h after the one before it starts a regimen.
const GAP_MS = 36 * HOUR_MS;
// Decision 5: the level counts as steady five half-lives after the start,
// about 97 %.
const STEADY_HALF_LIVES = 5;

// Decision 2: exactly 0, every intake past the cutoff or none yet come,
// reads as 0; above 0 and below 0.05, as the tooltip's bound, with no ≈.
const levelText = (value, locale) => {
  if (value === 0) {
    return t(locale, "summary.level", { value: formatNumber(0, locale) });
  }
  const { below, text } = levelNumber(value, locale);
  return t(locale, below ? "summary.levelBelow" : "summary.level", {
    value: text,
  });
};

// Decision 4: walking back from the last intake, the first that is the log's
// first, or has another dose than the intake before it in the store's order,
// or comes more than 36 h after it.
const regimenStartMs = (doses) => {
  for (let i = doses.length - 1; i > 0; i -= 1) {
    const ms = Date.parse(doses[i].takenAt);
    const before = doses[i - 1];
    if (doses[i].mg !== before.mg || ms - Date.parse(before.takenAt) > GAP_MS) {
      return ms;
    }
  }
  return Date.parse(doses[0].takenAt);
};

// Decision 5: the time left, in whole hours below a day and whole days of
// 24 h from a day on, each rounded up, so the text never puts the steady
// level earlier than the rule does.
const steadyText = (remainingMs, locale) => {
  if (remainingMs <= 0) {
    return t(locale, "summary.steadyReached");
  }
  if (remainingMs < DAY_MS) {
    const h = Math.ceil(remainingMs / HOUR_MS);
    return t(locale, "summary.steadyHours", { h });
  }
  const d = Math.ceil(remainingMs / DAY_MS);
  return tPlural(locale, "summary.steadyDays", d, { d });
};

// Decision 1. The store keeps the doses by instant, ties by id, so the last
// is the latest by time, one logged ahead included (decision 3); the level
// counts it only once its time has come (decision 2: pk counts only intakes
// at or before its instant).
export const summaryView = (doc, { nowMs, locale, timeZone }) => {
  const { doses, settings } = doc;
  if (doses.length === 0) {
    return { empty: true };
  }
  const p = params(settings);
  const last = doses.at(-1);
  const lastMs = Date.parse(last.takenAt);
  const steadyMs =
    regimenStartMs(doses) + STEADY_HALF_LIVES * p.halfLifeH * HOUR_MS;
  return {
    empty: false,
    level: levelText(concTotal(doses, nowMs, p), locale),
    lastDay: formatDayHeading(lastMs, nowMs, locale, timeZone),
    lastLine: t(locale, "summary.lastLine", {
      time: formatTime(lastMs, locale, timeZone),
      mg: formatNumber(last.mg, locale),
    }),
    steady: steadyText(steadyMs - nowMs, locale),
    steadyMs,
  };
};
