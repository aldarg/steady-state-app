// The rules of logging an intake, as pure functions: the dose the one tap logs,
// what the form accepts, and the duplicate search. No DOM, no clock, no
// randomness: every instant comes in as an argument. Problems are codes, never
// sentences; the screen turns them into text through src/i18n.js.

export const DOSE_CHIPS = Object.freeze([5, 10, 15, 20]);
export const NOTE_MAX = 500;

// The form's doses, in whole tenths of a milligram: 0.1 mg to 40 mg.
const MIN_TENTHS = 1;
const MAX_TENTHS = 400;
const LABEL_MAX_MG = 20;
const AHEAD_MS = 3_600_000;
const NEARBY_MS = 6 * 3_600_000;
// The counter shows once a note is longer than this.
const COUNTER_AFTER = 400;

// Decision 3: the store keeps the doses by instant, ties by id, so the latest
// is the last one.
export const lastDoseMg = (doc) => doc.doses.at(-1)?.mg ?? null;

// Decision 4: digits, then at most one separator, "." or ",", and digits.
const PLAIN_DECIMAL = /^(?<whole>\d+)(?:[.,](?<fraction>\d+))?$/u;

const refused = (error) => ({ ok: false, error });

export const parseDoseInput = (text) => {
  const trimmed = text.trim();
  if (trimmed === "") {
    return refused("empty");
  }
  const match = PLAIN_DECIMAL.exec(trimmed);
  if (match === null) {
    return refused("invalid");
  }
  // Decided on the text, before binary rounding could carry a value across a
  // boundary ("40.000000000000001" is not 40): "2.50" is 2.5, "2.25" is not a
  // multiple of 0.1.
  const { whole, fraction = "" } = match.groups;
  const tenth = fraction.replace(/0+$/u, "");
  if (tenth.length > 1) {
    return refused("step");
  }
  const tenths = Number(whole) * 10 + Number(tenth);
  if (tenths < MIN_TENTHS || tenths > MAX_TENTHS) {
    return refused("range");
  }
  return { ok: true, mg: tenths / 10 };
};

// Decision 5.
export const timeError = (takenAtMs, nowMs) =>
  takenAtMs > nowMs + AHEAD_MS ? "future" : null;

export const doseWarning = (mg) => (mg > LABEL_MAX_MG ? "aboveLabelMax" : null);

// Code points, so that an emoji counts once, as a person counts it.
const codePoints = (text) => [...text].length;

export const noteError = (text) =>
  codePoints(text) > NOTE_MAX ? "tooLong" : null;

export const noteCounter = (text) => {
  const count = codePoints(text);
  return { shown: count > COUNTER_AFTER, count };
};

const LOCAL_INPUT =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})$/u;

// Decision 6: the fields must survive a round trip through a UTC date, where
// no daylight-saving change can move them, so that 30 February or 24:00 is
// null rather than rolled over: the instant must spell the value back, as
// v1-02's store checks a stored time. Returns the fields, or null.
const calendarFields = (value) => {
  const match = typeof value === "string" ? LOCAL_INPUT.exec(value) : null;
  if (match === null) {
    return null;
  }
  const [year, month, day, hour, minute] = Object.values(match.groups).map(
    Number,
  );
  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day);
  check.setUTCHours(hour, minute, 0, 0);
  return check.toISOString().slice(0, 16) === value
    ? { year, month, day, hour, minute }
    : null;
};

// A datetime-local value to UTC ms in the runtime's zone, or null. The local
// time is ECMAScript's: a repeated hour is its earlier instant, and a time in
// a spring-forward gap moves forward by the gap. setFullYear, not the Date
// constructor, keeps years 0–99 out of the 1900s.
export const localInputToMs = (value) => {
  const fields = calendarFields(value);
  if (fields === null) {
    return null;
  }
  const local = new Date(0);
  local.setFullYear(fields.year, fields.month - 1, fields.day);
  local.setHours(fields.hour, fields.minute, 0, 0);
  return local.getTime();
};

const pad = (number, width = 2) => String(number).padStart(width, "0");

// The local minute of `ms` as a datetime-local value; seconds are dropped.
export const msToLocalInput = (ms) => {
  const local = new Date(ms);
  const date = `${pad(local.getFullYear(), 4)}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
  return `${date}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
};

// Decision 7: the dose closest in time within 6 h, or null. The doses come in
// the store's order, so a strict comparison keeps the earlier of two at the
// same distance.
export const findNearby = (doc, takenAtMs) => {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const dose of doc.doses) {
    const distance = Math.abs(Date.parse(dose.takenAt) - takenAtMs);
    if (distance <= NEARBY_MS && distance < nearestDistance) {
      nearest = dose;
      nearestDistance = distance;
    }
  }
  return nearest;
};
