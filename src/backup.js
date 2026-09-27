// The backup's rules and texts (v1-09 decision 1), as pure functions: what an
// import's file holds and what each choice would do with it, the panel's
// last-backup line, the recovery screen's note, and the texts of the preview,
// of the restore question and of an import's toast; v1-13 decision 2: and
// whether the backup reminder is due, with its text. No DOM, no clock, no
// globals: the document, the file's text, the instant it is drawn at, the
// locale and the zone come in as arguments; every text comes from i18n.js.
// The store validates and merges (v1-02); nothing here counts on its own.

import {
  formatDate,
  formatDayHeading,
  formatTime,
  localDay,
  t,
  tPlural,
} from "./i18n.js";
import { mergeInto, parseDocument, unreadableExport } from "./store.js";

// B5: a file that is not a backup is one answer, whatever its problems.
const REJECTED = Object.freeze({ ok: false });

// v1-13 decision 2: SPEC §5.6's reminder shows above 14 intakes, and after
// 30 × 24 hours without a backup, in elapsed time.
const REMINDER_DOSES = 14;
const REMINDER_MS = 30 * 24 * 3600 * 1000;

// The first and last intakes by instant, whatever the file's order.
const spanOf = (doses) => {
  if (doses.length === 0) {
    return null;
  }
  const instants = doses.map(({ takenAt }) => Date.parse(takenAt));
  return { firstMs: Math.min(...instants), lastMs: Math.max(...instants) };
};

// `localDoc` is null on the blocked page, where nothing can be merged into.
export const importPreview = (localDoc, text, name) => {
  const parsed = parseDocument(text);
  if (!parsed.ok) {
    return REJECTED;
  }
  const incoming = parsed.doc;
  const blocked = localDoc === null;
  return {
    ok: true,
    name,
    incoming,
    count: incoming.doses.length,
    span: spanOf(incoming.doses),
    merge: blocked ? null : mergeInto(localDoc, incoming).counts,
    localCount: blocked ? null : localDoc.doses.length,
  };
};

// B1: the journal's day words, with the time for a copy made today.
export const lastBackupText = (lastBackupAt, nowMs, locale, timeZone) => {
  if (lastBackupAt === null) {
    return { label: null, value: t(locale, "backup.none") };
  }
  const ms = Date.parse(lastBackupAt);
  const day = formatDayHeading(ms, nowMs, locale, timeZone);
  const today = localDay(ms, timeZone) === localDay(nowMs, timeZone);
  return {
    label: t(locale, "backup.last"),
    value: today
      ? t(locale, "backup.lastToday", {
          day,
          time: formatTime(ms, locale, timeZone),
        })
      : day,
  };
};

// v1-13 decision 2: every intake counts, however old. Exactly 30 × 24 hours
// is not yet due; a clock behind lastBackupAt gives a negative age, so not
// due either.
export const backupDue = (doc, nowMs) =>
  doc.doses.length > REMINDER_DOSES &&
  (doc.lastBackupAt === null ||
    nowMs - Date.parse(doc.lastBackupAt) > REMINDER_MS);

// v1-13 decisions 2 and 5: no backup yet, or the local date of the last one.
export const reminderText = (doc, nowMs, locale, timeZone) =>
  doc.lastBackupAt === null
    ? t(locale, "reminder.none")
    : t(locale, "reminder.old", {
        date: formatDate(Date.parse(doc.lastBackupAt), locale, timeZone),
      });

// Decision 6, implementation round 2: the first recovery button's second
// line, at the instant of the draw's one reading, names the file exportRaw
// gives on that day. The name does not depend on the text saved.
export const recoveryNote = (nowMs, locale, timeZone) => {
  const { filename } = unreadableExport("", nowMs, timeZone);
  return t(locale, "recovery.saveTextNote", { filename });
};

const summaryText = ({ count, span }, locale, timeZone) => {
  if (count === 0) {
    return t(locale, "import.empty");
  }
  const text = t(locale, "import.span", {
    from: formatDate(span.firstMs, locale, timeZone),
    to: formatDate(span.lastMs, locale, timeZone),
  });
  return tPlural(locale, "import.summary", count, { n: count, span: text });
};

// B3's dialog and B6's question. The merge and the replace are null on the
// blocked page, which offers neither.
export const previewTexts = (preview, locale, timeZone) => {
  const { name, count, merge, localCount } = preview;
  const summary = summaryText(preview, locale, timeZone);
  return {
    name,
    summary,
    merge:
      merge === null
        ? null
        : t(locale, "import.mergeLine", {
            added: merge.added,
            already: merge.alreadyHere,
            skipped: merge.duplicatesSkipped,
          }),
    replace:
      localCount === null
        ? null
        : tPlural(locale, "import.replaceLine", count, {
            n: count,
            local: localCount,
          }),
    restore: t(locale, "recovery.restoreQuestion", { summary }),
  };
};

// B4: an import's toast, for the kinds `imported` and `replaced`.
export const resultText = (toast, locale) => {
  if (toast.kind === "replaced") {
    return tPlural(locale, "toast.replaced", toast.count, { n: toast.count });
  }
  if (toast.added === 0) {
    return t(locale, "toast.importedNone");
  }
  return tPlural(locale, "toast.imported", toast.added, { n: toast.added });
};
