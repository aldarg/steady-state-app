// The journal as one flat list, in the order the page draws it (v1-04
// decisions 2 and 3): newest first, a heading for each local day that has
// intakes, then that day's intakes, and a marker between two intakes more
// than 36 h apart. Pure: no clock and no DOM. The instant it is drawn at, the
// locale and the zone come in as arguments; every text comes from i18n.js.

import { formatDayHeading, formatMg, formatTime, localDay, t } from "./i18n.js";

const HOUR_MS = 3_600_000;
const GAP_MS = 36 * HOUR_MS;
const HOURS_PER_DAY = 24;
const DAYS_FROM_HOURS = 48;

// Decision 3: under two days, the hours; from two days on, the days and the
// hours left over, which are left out when they are 0.
const gapLabel = (hours, locale) => {
  if (hours < DAYS_FROM_HOURS) {
    return t(locale, "journal.gapHours", { h: hours });
  }
  const d = Math.floor(hours / HOURS_PER_DAY);
  const h = hours % HOURS_PER_DAY;
  return h === 0
    ? t(locale, "journal.gapDays", { d })
    : t(locale, "journal.gapDaysHours", { d, h });
};

// The store keeps the doses by instant, ties by id, so its order reversed is
// newest first, with intakes at one instant in the reverse of its order.
// More than 36 h never fits in one local day, so a marker, placed after the
// newer intake, always comes before the older intake's day heading.
export const journalView = (doc, { nowMs, locale, timeZone }) => {
  const entries = [];
  let newerMs = null;
  let day = null;
  for (const { id, takenAt, mg, note } of doc.doses.toReversed()) {
    const ms = Date.parse(takenAt);
    if (newerMs !== null && newerMs - ms > GAP_MS) {
      const hours = Math.floor((newerMs - ms) / HOUR_MS);
      entries.push({ kind: "gap", hours, label: gapLabel(hours, locale) });
    }
    const key = localDay(ms, timeZone);
    if (key !== day) {
      const label = formatDayHeading(ms, nowMs, locale, timeZone);
      entries.push({ kind: "day", key, label });
      day = key;
    }
    entries.push({
      kind: "intake",
      id,
      takenAt,
      time: formatTime(ms, locale, timeZone),
      dose: formatMg(mg, locale),
      note,
    });
    newerMs = ms;
  }
  return entries;
};
