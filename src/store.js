// The intake log as one document (SPEC §3): validation, normalization, the
// dose and settings operations, JSON and CSV export, import by replace or
// merge, the backup reminder, and the one storage key with its failure modes
// (SPEC §6). No clock and no randomness except newDoseId(): every time comes
// in as an argument. Problems are { path, code } pairs, never sentences; the
// screens turn codes into text through src/i18n.js.

export const STORAGE_KEY = "esc-tracker:v1";
export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = Object.freeze({
  phenotype: "NM",
  halfLifeOverrideH: null,
  showRefRange: true,
  showPerDoseCurves: true,
  locale: "ru",
});

export const emptyDocument = () => ({
  version: SCHEMA_VERSION,
  settings: { ...DEFAULT_SETTINGS },
  doses: [],
  lastBackupAt: null,
});

// v1-11 decision 7: randomUUID needs a secure context, and plain LAN http is
// not one; getRandomValues works in every context. So where randomUUID is
// missing, a version 4 UUID is built from 16 random bytes: the version nibble
// set to 4, the variant bits to 10, in lowercase hex, 8-4-4-4-12. Lint
// refuses bitwise operators, so the bits are set by arithmetic: the low four
// bits of byte 6 under 0100, and the low six of byte 8 under 10.
const hexOf = (bytes) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const uuidFromBytes = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = 0x40 + (bytes[6] % 0x10);
  bytes[8] = 0x80 + (bytes[8] % 0x40);
  const hex = hexOf(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

export const newDoseId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : uuidFromBytes();

const MAX_MG = 40;
const MIN_HALF_LIFE_H = 10;
const MAX_HALF_LIFE_H = 150;
const REMINDER_DOSES = 14;
const REMINDER_MS = 30 * 86_400_000;
const PHENOTYPES = ["UM", "NM", "IM", "PM"];
const LOCALES = ["ru", "en"];
const CSV_HEADER = "takenAt_local,takenAt_utc,mg,note";
// The byte order mark: CSV exports open with it, an import may.
const BOM = "\uFEFF";

// Any version, either case: SPEC §3 says only "uuid".
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu;

// UTC only, as Z or +00:00, with a fraction of any length.
const UTC_DATE_TIME =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.(?<fraction>\d+))?(?:Z|\+00:00)$/u;

// Decision 2: field by field, not Date.parse, which ECMAScript defines for one
// spelling only and V8 stretches to read 2026-02-30 as 2 March. setUTCFullYear,
// not Date.UTC, keeps years 0–99 out of the 1900s; the fraction is truncated to
// the millisecond; and the instant must spell the input's own first 19
// characters, so that no field has rolled over. Returns a Date, or null.
const parseInstant = (text) => {
  const match = UTC_DATE_TIME.exec(text);
  if (match === null) {
    return null;
  }
  const { year, month, day, hour, minute, second } = match.groups;
  const ms = (match.groups.fraction ?? "").padEnd(3, "0").slice(0, 3);
  const instant = new Date(0);
  instant.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  instant.setUTCHours(Number(hour), Number(minute), Number(second), Number(ms));
  return instant.toISOString().slice(0, 19) === text.slice(0, 19)
    ? instant
    : null;
};

// A leaf rule answers a value with a problem code, or null when it is valid.
const nullable = (codeOf) => (value) => (value === null ? null : codeOf(value));

const oneOf = (options) => (value) => {
  if (typeof value !== "string") {
    return "type";
  }
  return options.includes(value) ? null : "range";
};

const formatted = (accepts) => (value) => {
  if (typeof value !== "string") {
    return "type";
  }
  return accepts(value) ? null : "format";
};

const flag = (value) => (typeof value === "boolean" ? null : "type");

const text = (value) => (typeof value === "string" ? null : "type");

const timestamp = formatted((value) => parseInstant(value) !== null);

const schemaVersion = (value) => {
  if (typeof value !== "number") {
    return "type";
  }
  if (!Number.isInteger(value) || value < 1) {
    return "range";
  }
  return value > SCHEMA_VERSION ? "newer-version" : null;
};

// 10–150 h, to one decimal place (Q3).
const halfLife = (value) => {
  if (typeof value !== "number") {
    return "type";
  }
  const inRange = value >= MIN_HALF_LIFE_H && value <= MAX_HALF_LIFE_H;
  return inRange && Math.round(value * 10) / 10 === value ? null : "range";
};

const milligrams = (value) => {
  if (typeof value !== "number") {
    return "type";
  }
  return value > 0 && value <= MAX_MG ? null : "range";
};

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const keyPath = (path, key) => (path === "" ? key : `${path}.${key}`);

// A rule pushes every problem it finds in a value at `path`.
const leaf = (codeOf) => (value, path, problems) => {
  const code = codeOf(value);
  if (code !== null) {
    problems.push({ path, code });
  }
};

// Exactly the keys of SPEC §3 (decision 2): each missing key and each extra one
// is a problem of its own, and each expected key is checked by its rule.
const record = (rules) => (value, path, problems) => {
  if (!isRecord(value)) {
    problems.push({ path, code: "type" });
    return;
  }
  for (const key of Object.keys(rules)) {
    if (!Object.hasOwn(value, key)) {
      problems.push({ path: keyPath(path, key), code: "missing-key" });
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (Object.hasOwn(rules, key)) {
      rules[key](child, keyPath(path, key), problems);
    } else {
      problems.push({ path: keyPath(path, key), code: "unknown-key" });
    }
  }
};

const SETTINGS_RULES = {
  phenotype: leaf(oneOf(PHENOTYPES)),
  halfLifeOverrideH: leaf(nullable(halfLife)),
  showRefRange: leaf(flag),
  showPerDoseCurves: leaf(flag),
  locale: leaf(oneOf(LOCALES)),
};

const DOSE_RULES = {
  id: leaf(formatted((value) => UUID.test(value))),
  takenAt: leaf(timestamp),
  mg: leaf(milligrams),
  note: leaf(text),
};

const checkDose = record(DOSE_RULES);

// The id a duplicate check can compare: a well-formed one, in lowercase.
const comparableId = (dose) =>
  isRecord(dose) && typeof dose.id === "string" && UUID.test(dose.id)
    ? dose.id.toLowerCase()
    : null;

// Two ids equal ignoring case are one intake twice; the second is the problem.
const doseList = (value, path, problems) => {
  if (!Array.isArray(value)) {
    problems.push({ path, code: "type" });
    return;
  }
  const seen = new Set();
  for (const [index, dose] of value.entries()) {
    checkDose(dose, `${path}[${index}]`, problems);
    const id = comparableId(dose);
    if (seen.has(id)) {
      problems.push({ path: `${path}[${index}].id`, code: "duplicate-id" });
    }
    if (id !== null) {
      seen.add(id);
    }
  }
};

const checkDocument = record({
  version: leaf(schemaVersion),
  settings: record(SETTINGS_RULES),
  doses: doseList,
  lastBackupAt: leaf(nullable(timestamp)),
});

// Decision 4: a newer document is not held to version 1's shape; its version
// is the one thing to say about it.
const isNewer = (value) =>
  isRecord(value) && schemaVersion(value.version) === "newer-version";

export const validateDocument = (value) => {
  if (isNewer(value)) {
    return {
      ok: false,
      problems: [{ path: "version", code: "newer-version" }],
    };
  }
  const problems = [];
  checkDocument(value, "", problems);
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
};

const byId = (a, b) => (a < b ? -1 : Number(a > b));

// Decision 3, for a valid document: every time in toISOString() form and every
// id in lowercase first, then the doses by instant, ties by id. Keys come out
// in SPEC §3's order, so an export reads the same whatever order it was given.
const normalizeDoses = (doses) =>
  doses
    .map(({ id, takenAt, mg, note }) => {
      const instant = parseInstant(takenAt);
      const canonical = instant.toISOString();
      const dose = { id: id.toLowerCase(), takenAt: canonical, mg, note };
      return { ms: instant.getTime(), dose };
    })
    .sort((a, b) => a.ms - b.ms || byId(a.dose.id, b.dose.id))
    .map(({ dose }) => dose);

const normalize = (doc) => ({
  version: doc.version,
  settings: Object.fromEntries(
    Object.keys(SETTINGS_RULES).map((key) => [key, doc.settings[key]]),
  ),
  doses: normalizeDoses(doc.doses),
  lastBackupAt:
    doc.lastBackupAt === null
      ? null
      : parseInstant(doc.lastBackupAt).toISOString(),
});

// A document argument must be valid: one that is not is a bug worth seeing.
const normalizeValid = (doc, name) => {
  const result = validateDocument(doc);
  if (!result.ok) {
    const where = result.problems.map(
      ({ path, code }) => `${path || "the document"}: ${code}`,
    );
    throw new TypeError(
      `${name} is not a valid document (${where.join(", ")})`,
    );
  }
  return normalize(doc);
};

// Decision 4: version 1 needs no schema change. A version 2 hooks in here.
export const migrate = (doc) => normalizeValid(doc, "doc");

const parseJson = (json) => {
  try {
    return { value: JSON.parse(json) };
  } catch {
    return null;
  }
};

// Decision 5: one leading BOM, as Windows Notepad writes, is not part of the
// JSON (RFC 8259 lets a parser ignore it). A second one is.
const withoutBom = (json) =>
  typeof json === "string" && json.startsWith(BOM)
    ? json.slice(BOM.length)
    : json;

export const parseDocument = (json) => {
  const parsed = parseJson(withoutBom(json));
  if (parsed === null) {
    return { ok: false, problems: [{ path: "", code: "json" }] };
  }
  const result = validateDocument(parsed.value);
  return result.ok ? { ok: true, doc: migrate(parsed.value) } : result;
};

// Decision 6: an operation validates the document it would return, so one
// rule set covers every change; the input is never modified.
const settle = (next) => {
  const result = validateDocument(next);
  return result.ok ? { ok: true, doc: normalize(next) } : result;
};

const unknownId = () => ({
  ok: false,
  problems: [{ path: "id", code: "range" }],
});

// Ids are equal ignoring case, as validation compares them.
const indexOfId = (doses, id) =>
  typeof id === "string"
    ? doses.findIndex((dose) => dose.id === id.toLowerCase())
    : -1;

export const addDose = (doc, { takenAt, mg, note }, id) => {
  const current = normalizeValid(doc, "doc");
  const dose = { id, takenAt, mg, note };
  return settle({ ...current, doses: [...current.doses, dose] });
};

// Decision 6: an edit changes the time, the dose or the note, and nothing else.
const DOSE_CHANGES = ["takenAt", "mg", "note"];

export const updateDose = (doc, id, changes) => {
  const current = normalizeValid(doc, "doc");
  const unknown = Object.keys(changes).filter(
    (key) => !DOSE_CHANGES.includes(key),
  );
  if (unknown.length > 0) {
    const problems = unknown.map((key) => ({ path: key, code: "unknown-key" }));
    return { ok: false, problems };
  }
  const index = indexOfId(current.doses, id);
  if (index === -1) {
    return unknownId();
  }
  const dose = { ...current.doses[index], ...changes };
  return settle({ ...current, doses: current.doses.with(index, dose) });
};

export const deleteDose = (doc, id) => {
  const current = normalizeValid(doc, "doc");
  const index = indexOfId(current.doses, id);
  if (index === -1) {
    return unknownId();
  }
  const doses = current.doses.toSpliced(index, 1);
  return { ...settle({ ...current, doses }), removed: current.doses[index] };
};

export const restoreDose = (doc, removed) => {
  const current = normalizeValid(doc, "doc");
  return settle({ ...current, doses: [...current.doses, removed] });
};

export const updateSettings = (doc, changes) => {
  const current = normalizeValid(doc, "doc");
  const settings = { ...current.settings, ...changes };
  return settle({ ...current, settings });
};

// The same pill logged on two devices: one instant, one dose.
const intakeKey = ({ takenAt, mg }) => `${takenAt} ${mg}`;

// Q1 and decision 7. Both sides are normalized before anything is compared;
// an incoming dose is matched against the local log only, so duplicates within
// the file stay as the file had them.
export const mergeInto = (local, incoming) => {
  const here = normalizeValid(local, "local");
  const file = normalizeValid(incoming, "incoming");
  const ids = new Set(here.doses.map(({ id }) => id));
  const intakes = new Set(here.doses.map(intakeKey));
  const added = [];
  let alreadyHere = 0;
  let duplicatesSkipped = 0;
  for (const dose of file.doses) {
    if (ids.has(dose.id)) {
      alreadyHere += 1;
    } else if (intakes.has(intakeKey(dose))) {
      duplicatesSkipped += 1;
    } else {
      added.push(dose);
    }
  }
  const counts = {
    inFile: file.doses.length,
    added: added.length,
    alreadyHere,
    duplicatesSkipped,
  };
  return {
    doc: normalize({ ...here, doses: [...here.doses, ...added] }),
    counts,
  };
};

// The document must be valid as given: the new date is set on it, never used
// to repair it. The result is checked too, for the date itself.
const withBackup = (doc, nowIso, name) =>
  normalizeValid({ ...normalizeValid(doc, name), lastBackupAt: nowIso }, name);

// Decision 8: the device now holds exactly what the file holds (Q6).
export const replaceWith = (incoming, nowIso) =>
  withBackup(incoming, nowIso, "incoming");

// Decision 9: for the UI to call once a JSON export has completed.
export const markBackedUp = (doc, nowIso) => withBackup(doc, nowIso, "doc");

// Without this, Intl would format a missing time as now: a clock read.
const requireMs = (ms, name) => {
  if (!Number.isFinite(ms)) {
    throw new TypeError(`${name} must be a finite number of ms, got ${ms}`);
  }
};

export const needsBackupReminder = (doc, nowMs) => {
  requireMs(nowMs, "nowMs");
  const { doses, lastBackupAt } = normalizeValid(doc, "doc");
  if (doses.length <= REMINDER_DOSES) {
    return false;
  }
  return (
    lastBackupAt === null ||
    nowMs - parseInstant(lastBackupAt).getTime() > REMINDER_MS
  );
};

// Local wall time in `timeZone`, from the runtime's zone data. The era is asked
// for because Intl writes year 0 as 1 BC, where ISO 8601 counts it as 0000.
const localClock = (timeZone) => {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    era: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (ms) => {
    const parts = Object.fromEntries(
      format.formatToParts(ms).map(({ type, value }) => [type, value]),
    );
    const year =
      parts.era === "BC" ? 1 - Number(parts.year) : Number(parts.year);
    const sign = year < 0 ? "-" : "";
    const yyyy = `${sign}${String(Math.abs(year)).padStart(4, "0")}`;
    return {
      date: `${yyyy}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  };
};

const filename = (stem, nowMs, timeZone, extension) => {
  requireMs(nowMs, "nowMs");
  return `${stem}-${localClock(timeZone)(nowMs).date}.${extension}`;
};

export const exportJson = (doc, nowMs, timeZone) => ({
  filename: filename("steady-state", nowMs, timeZone, "json"),
  text: `${JSON.stringify(normalizeValid(doc, "doc"), null, 2)}\n`,
});

// RFC 4180 (Q4): a note holding a comma, a quote or a line break is quoted,
// its quotes doubled. Formulas are not escaped: the note is the user's own.
const csvField = (value) =>
  /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export const exportCsv = (doc, nowMs, timeZone) => {
  const name = filename("steady-state", nowMs, timeZone, "csv");
  const clock = localClock(timeZone);
  const rows = normalizeValid(doc, "doc").doses.map(({ takenAt, mg, note }) => {
    const { date, time } = clock(parseInstant(takenAt).getTime());
    return `${date} ${time},${takenAt},${String(mg)},${csvField(note)}`;
  });
  const lines = [CSV_HEADER, ...rows].map((line) => `${line}\r\n`);
  return { filename: name, text: `${BOM}${lines.join("")}` };
};

// Q5's first way out: the stored text byte for byte, to be repaired by hand.
export const unreadableExport = (raw, nowMs, timeZone) => ({
  filename: filename("steady-state-unreadable", nowMs, timeZone, "txt"),
  text: raw,
});

const readStored = (storage) => {
  try {
    return { raw: storage.getItem(STORAGE_KEY) };
  } catch {
    return null;
  }
};

// The mode the store opens in, from one read of the one key.
const opening = (storage) => {
  const stored = readStored(storage);
  if (stored === null) {
    return { mode: "memory", doc: emptyDocument(), raw: null, problems: null };
  }
  if (stored.raw === null) {
    return { mode: "saved", doc: emptyDocument(), raw: null, problems: null };
  }
  const parsed = parseDocument(stored.raw);
  return parsed.ok
    ? { mode: "saved", doc: parsed.doc, raw: null, problems: null }
    : {
        mode: "unreadable",
        doc: null,
        raw: stored.raw,
        problems: parsed.problems,
      };
};

const refused = (mode) => ({ ok: false, refused: mode });

// Decision 14. `saved`: what is stored is the document. `unreadable`: what is
// stored cannot be read, and nothing is written until startFresh() or
// restoreFromBackup(). `memory`: a read or a write threw, so whatever is stored
// is unknown, and the store never writes again.
export const openStore = (storage) => {
  const state = opening(storage);

  const keep = (doc) => {
    Object.assign(state, { doc, raw: null, problems: null });
    if (state.mode === "memory") {
      return { ok: true, saved: false };
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(doc));
      state.mode = "saved";
      return { ok: true, saved: true };
    } catch {
      state.mode = "memory";
      return { ok: true, saved: false };
    }
  };

  const commit = (doc) => {
    if (state.mode === "unreadable") {
      return refused(state.mode);
    }
    const result = validateDocument(doc);
    return result.ok ? keep(normalize(doc)) : result;
  };

  const startFresh = () =>
    state.mode === "unreadable" ? keep(emptyDocument()) : refused(state.mode);

  // A restore is a replace-import, so it sets lastBackupAt (Q6).
  const restoreFromBackup = (doc, nowIso) => {
    if (state.mode !== "unreadable") {
      return refused(state.mode);
    }
    const result = validateDocument(doc);
    return result.ok ? keep(replaceWith(doc, nowIso)) : result;
  };

  return {
    get mode() {
      return state.mode;
    },
    get doc() {
      return state.doc;
    },
    get raw() {
      return state.raw;
    },
    get problems() {
      return state.problems;
    },
    commit,
    startFresh,
    restoreFromBackup,
  };
};
