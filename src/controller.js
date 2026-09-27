// The first screen's state, and every change to it: the primary action, the
// form, in add or edit mode, the duplicate dialog, the undo toast, the
// storage banner, the chart's preset or range, the menu (v1-08), and the
// backup's dialog and its exports, imports and recovery (v1-09), the
// install hint (v1-11), the intro (v1-12), and the backup reminder's
// dismissal (v1-13), over v1-02's store. The clock and the ids are injected;
// the controller reads no clock and makes no id. It draws nothing and moves
// no file: src/ui.js draws the state, and the journal, the chart and the
// menu's settings from the document, and delivers the files the exports
// give.

import { importPreview } from "./backup.js";
import { PRESETS } from "./chart.js";
import { formatNumber } from "./i18n.js";
import {
  DOSE_CHIPS,
  doseWarning,
  findNearby,
  lastDoseMg,
  localInputToMs,
  msToLocalInput,
  noteCounter,
  noteError,
  parseDoseInput,
  timeError,
} from "./intake.js";
import { halfLifePrefill, parseHalfLifeInput } from "./settings.js";
import {
  DEFAULT_SETTINGS,
  addDose,
  deleteDose,
  exportCsv,
  exportJson,
  markBackedUp,
  mergeInto,
  replaceWith,
  restoreDose,
  unreadableExport,
  updateDose,
  updateSettings,
} from "./store.js";

export const UNDO_MS = 6000;

const NOT_SAVED = Object.freeze({ kind: "notSaved" });
// v1-09 decision 2: the backup dialog's two kinds that hold no preview.
const REJECTED = Object.freeze({ kind: "rejected" });
const START_FRESH = Object.freeze({ kind: "startFresh" });
// v1-04 decision 6: the toasts whose undo takes something back; an import's
// has none (v1-09 B4).
const UNDOABLE = new Set(["logged", "deleted"]);
const NO_ERRORS = Object.freeze({ dose: null, time: null, note: null });
const FIELDS = ["dose", "time", "note"];

// Decision 6: the form shows the wall time that will be saved; a value that
// is not a time is kept as typed, for submitForm to report.
const resolvedTime = (value) => {
  const ms = localInputToMs(value);
  return ms === null ? value : msToLocalInput(ms);
};

const withField = (fields, key, value) => ({
  ...fields,
  [key]: key === "time" ? resolvedTime(value) : value,
});

// Everything the form shows follows from its fields and its errors. `editing`
// is null for the add form, and { id, prefill } for an edit (v1-04 decision
// 4): the dose, the time and the note as the form first showed them.
const formOf = (fields, errors, editing) => {
  const dose = parseDoseInput(fields.dose);
  const mg = dose.ok ? dose.mg : null;
  return {
    fields,
    errors,
    warnings: { dose: mg === null ? null : doseWarning(mg) },
    chip: DOSE_CHIPS.includes(mg) ? mg : null,
    counter: noteCounter(fields.note),
    editing,
  };
};

const timeCode = (value, takenAt, nowMs) => {
  if (takenAt !== null) {
    return timeError(takenAt, nowMs);
  }
  return value === "" ? "empty" : "invalid";
};

// v1-08 decision 2: the open menu's half-life field, its text and the code
// of its error.
const menuWith = (text, error = null) => ({ halfLife: { text, error } });

const sameMenu = (a, b) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.halfLife.text === b.halfLife.text &&
    a.halfLife.error === b.halfLife.error);

// A store operation the controller built must succeed: one that does not is a
// bug worth seeing, not a state to show. v1-08 decision 2: so a setting the
// store refuses, an unknown phenotype or locale or a flag that is not a
// boolean, throws a TypeError before anything changes. v1-09: a recovery
// the store refuses names its mode.
const settled = (result, what) => {
  if (!result.ok) {
    const where = result.problems?.map(
      ({ path, code }) => `${path}: ${code}`,
    ) ?? [`the store is ${result.refused}`];
    throw new TypeError(`${what} was refused (${where.join(", ")})`);
  }
  return result;
};

const isoAt = (ms) => new Date(ms).toISOString();

// v1-08 decision 2: the menu's actions, over the controller's state: `read`
// gives it, `change` sets it and tells the listeners, and `bannerAfter` is
// the banner after a commit.
const menuActions = ({ store, read, change, bannerAfter }) => {
  // The menu as given, when it differs from the one shown.
  const showMenu = (menu) => {
    if (!sameMenu(menu, read().menu)) {
      change({ menu });
    }
  };

  // Settings are committed only when they change what is stored, and
  // `menuAfter` gives the menu after them; the banner follows the commit, as
  // for doses, and the locale the stored one. Nothing else changes: the
  // form, the dialog, the toast, the preset and the range stay.
  const commitSettings = (changes, menuAfter = () => read().menu) => {
    const { settings } = store.doc;
    const stored = Object.entries(changes).every(
      ([key, value]) => settings[key] === value,
    );
    if (stored) {
      showMenu(menuAfter());
      return;
    }
    const updated = settled(updateSettings(store.doc, changes), "the settings");
    const commit = store.commit(updated.doc);
    change({
      menu: menuAfter(),
      locale: store.doc.settings.locale,
      banner: bannerAfter(commit),
    });
  };

  // The menu with its field's text replaced, which clears the error: the
  // error was about the text that is gone.
  const menuWithText = (text) => (read().menu === null ? null : menuWith(text));

  const openMenu = () => {
    const { halfLifeOverrideH } = store.doc.settings;
    const text =
      halfLifeOverrideH === null
        ? ""
        : formatNumber(halfLifeOverrideH, read().locale);
    change({ menu: menuWith(text) });
  };

  // Escape and the back gesture (M7): what is typed and not committed is
  // dropped with its error.
  const closeMenu = () => {
    if (read().menu !== null) {
      change({ menu: null });
    }
  };

  // M4: a phenotype chosen clears the custom half-life, which replaces it
  // (SPEC §4).
  const choosePhenotype = (phenotype) =>
    commitSettings({ phenotype, halfLifeOverrideH: null }, () =>
      menuWithText(""),
    );

  const chooseCustomHalfLife = () => {
    const { settings } = store.doc;
    if (settings.halfLifeOverrideH !== null) {
      return;
    }
    const h = halfLifePrefill(settings);
    commitSettings({ halfLifeOverrideH: h }, () =>
      menuWithText(formatNumber(h, read().locale)),
    );
  };

  // A keystroke commits nothing (M4); only an open menu has a field.
  const editHalfLife = (text) => {
    if (read().menu !== null) {
      showMenu(menuWith(text));
    }
  };

  // M4: the field's text commits when the field is left or Enter is
  // pressed, and only while the menu is open, so that the change a closing
  // dialog fires after a cancel commits nothing (M7).
  const commitHalfLife = () => {
    const { menu, locale } = read();
    if (menu === null || store.doc.settings.halfLifeOverrideH === null) {
      return;
    }
    const { text } = menu.halfLife;
    const parsed = parseHalfLifeInput(text);
    if (!parsed.ok) {
      showMenu(menuWith(text, parsed.error));
      return;
    }
    commitSettings({ halfLifeOverrideH: parsed.h }, () =>
      menuWith(formatNumber(parsed.h, locale)),
    );
  };

  // M7: the Done button commits what is typed first, and does not close
  // over an entry that is refused.
  const finishMenu = () => {
    if (read().menu === null) {
      return;
    }
    if (store.doc.settings.halfLifeOverrideH !== null) {
      commitHalfLife();
      if (read().menu.halfLife.error !== null) {
        return;
      }
    }
    change({ menu: null });
  };

  const setShowRefRange = (on) => commitSettings({ showRefRange: on });

  const setShowPerDoseCurves = (on) =>
    commitSettings({ showPerDoseCurves: on });

  // The stored half-life's text is written again in the new locale; any
  // other text is an entry not yet accepted, and stays as typed, with its
  // error, for Done to judge (M4, M7).
  const chooseLocale = (locale) => {
    const before = read().locale;
    commitSettings({ locale }, () => {
      const { menu } = read();
      const { halfLifeOverrideH } = store.doc.settings;
      const storedText =
        halfLifeOverrideH === null
          ? null
          : formatNumber(halfLifeOverrideH, before);
      return menu === null || menu.halfLife.text !== storedText
        ? menu
        : menuWith(formatNumber(halfLifeOverrideH, locale));
    });
  };

  return {
    openMenu,
    closeMenu,
    finishMenu,
    choosePhenotype,
    chooseCustomHalfLife,
    editHalfLife,
    commitHalfLife,
    setShowRefRange,
    setShowPerDoseCurves,
    chooseLocale,
  };
};

// v1-09 decision 2: the backup's actions, over the controller's state:
// `read` gives it, `change` sets it and tells the listeners, `bannerAfter`
// is the banner after a commit, and `leave` rebuilds the state once a
// restore or a fresh start has left the blocked page. createController
// guards each by the page it works on. The exports give `{ filename, text }`
// and change nothing; ui.js delivers them.
const backupActions = ({
  store,
  now,
  timeZone,
  read,
  change,
  bannerAfter,
  leave,
}) => {
  // The file's document, while the dialog of `kind` asks about it.
  const incomingFor = (kind) => {
    const { backupDialog } = read();
    return backupDialog?.kind === kind ? backupDialog.preview.incoming : null;
  };

  // For the page to call once a JSON export completed (B2, Q6).
  const backupSaved = () => {
    const commit = store.commit(markBackedUp(store.doc, isoAt(now())));
    change({ banner: bannerAfter(commit) });
  };

  // B3, B5, B6: a file that is not a backup is rejected on either page; a
  // backup is offered for import, or, while blocked, for a restore.
  const proposeImport = (name, text) => {
    const { blocked } = read();
    const preview = importPreview(blocked ? null : store.doc, text, name);
    if (!preview.ok) {
      change({ backupDialog: REJECTED });
      return;
    }
    change({ backupDialog: { kind: blocked ? "restore" : "import", preview } });
  };

  // After either choice, the dialog and the panel close and the toast
  // states the result (B3, B4).
  const imported = (commit, nowMs, toast, changes = {}) =>
    change({
      ...changes,
      primary: { mg: lastDoseMg(store.doc) },
      backupDialog: null,
      menu: null,
      toast: { ...toast, until: nowMs + UNDO_MS },
      banner: bannerAfter(commit),
    });

  // Q1: the local settings and lastBackupAt stay.
  const mergeImport = () => {
    const incoming = incomingFor("import");
    if (incoming === null) {
      return;
    }
    const merged = mergeInto(store.doc, incoming);
    const toast = { kind: "imported", added: merged.counts.added };
    imported(store.commit(merged.doc), now(), toast);
  };

  // Q6: a replace counts as a backup. An edit form may name an intake that
  // is gone, so it closes.
  const replaceImport = () => {
    const incoming = incomingFor("import");
    if (incoming === null) {
      return;
    }
    const nowMs = now();
    const commit = store.commit(replaceWith(incoming, isoAt(nowMs)));
    const toast = { kind: "replaced", count: store.doc.doses.length };
    imported(commit, nowMs, toast, {
      locale: store.doc.settings.locale,
      form: null,
    });
  };

  const dismissBackupDialog = () => {
    if (read().backupDialog !== null) {
      change({ backupDialog: null });
    }
  };

  // B6: nothing on the device can be read, so a backup is restored whole,
  // which counts as a backup (Q6).
  const restoreBackup = () => {
    const incoming = incomingFor("restore");
    if (incoming === null) {
      return;
    }
    settled(store.restoreFromBackup(incoming, isoAt(now())), "the restore");
    leave();
  };

  const startFresh = () => {
    if (read().backupDialog?.kind === "startFresh") {
      settled(store.startFresh(), "the fresh start");
      leave();
    }
  };

  return {
    exportBackup: () => exportJson(store.doc, now(), timeZone),
    exportCsv: () => exportCsv(store.doc, now(), timeZone),
    backupSaved,
    exportRaw: () => unreadableExport(store.raw, now(), timeZone),
    proposeImport,
    mergeImport,
    replaceImport,
    dismissBackupDialog,
    restoreBackup,
    askStartFresh: () => change({ backupDialog: START_FRESH }),
    startFresh,
  };
};

// v1-13 decision 3: the reminder's dismissal, over the controller's state:
// `read` gives it, and `change` sets it and tells the listeners. Only a new
// page load, a new controller, shows the reminder again; no commit and no
// other action changes `reminderDismissed`.
const reminderDismissal =
  ({ read, change }) =>
  () => {
    if (!read().reminderDismissed) {
      change({ reminderDismissed: true });
    }
  };

// The state a controller opens with over the store as it is, with
// createController's zone, `installable` and `offerIntro`. v1-09 decision 2:
// leaving the blocked page rebuilds it.
const openingStateOf = ({ store, timeZone, installable, offerIntro }) => {
  const blocked = store.mode === "unreadable";
  return {
    blocked,
    locale: blocked ? DEFAULT_SETTINGS.locale : store.doc.settings.locale,
    timeZone,
    primary: { mg: blocked ? null : lastDoseMg(store.doc) },
    form: null,
    dialog: null,
    toast: null,
    banner: store.mode === "memory" ? NOT_SAVED : null,
    // v1-05 decision 9: the chart always opens on 7 d; never stored.
    preset: "7d",
    // v1-06 decision 2: the range a gesture left, or null on a preset;
    // never stored.
    range: null,
    // v1-08 decision 2: null, or the open menu's half-life field. The
    // settings themselves are the document's.
    menu: null,
    // v1-09 decision 2: null, or the backup dialog's kind, with the
    // file's preview for an import or a restore.
    backupDialog: null,
    // v1-11 decision 2: whether the install hint shows, until it is
    // dismissed; never stored. A controller is blocked only at opening, so
    // the rebuild on leaving the blocked page meets no dismissal.
    installHint: installable,
    // v1-12 decision 1: whether the intro is open; never stored. At
    // opening, while the log is empty, when offered; the blocked page's
    // document is null, so it is not read then.
    intro: offerIntro && !blocked && store.doc.doses.length === 0,
    // v1-13 decision 3: whether the backup reminder was dismissed; never
    // stored. Nothing can be dismissed while blocked, so the rebuild on
    // leaving the blocked page meets no dismissal.
    reminderDismissed: false,
  };
};

// v1-11 decision 2: `installable` is whether the page may suggest Add to Home
// Screen, from src/device.js. v1-12 decision 1: `offerIntro` is whether the
// intro opens by itself on an empty log; app.js offers it.
export const createController = ({
  store,
  now,
  timeZone,
  newId,
  installable = false,
  offerIntro = false,
}) => {
  const listeners = new Set();
  // The candidate the open dialog is asking about.
  let pending = null;
  // The state it opens with, which leaving the blocked page rebuilds.
  const openingState = () =>
    openingStateOf({ store, timeZone, installable, offerIntro });
  let state = openingState();

  const change = (changes) => {
    state = { ...state, ...changes };
    for (const listener of listeners) {
      listener(state);
    }
  };

  const bannerAfter = (commit) => (commit.saved ? state.banner : NOT_SAVED);

  // An add closes the form: saving is the form's last step.
  const add = (candidate, nowMs) => {
    const id = newId();
    const takenAt = new Date(candidate.takenAt).toISOString();
    const dose = { takenAt, mg: candidate.mg, note: candidate.note };
    const added = settled(addDose(store.doc, dose, id), "the new dose");
    const commit = store.commit(added.doc);
    pending = null;
    change({
      primary: { mg: lastDoseMg(store.doc) },
      form: null,
      dialog: null,
      toast: {
        kind: "logged",
        doseId: id,
        mg: candidate.mg,
        takenAt: candidate.takenAt,
        until: nowMs + UNDO_MS,
      },
      banner: bannerAfter(commit),
    });
  };

  // Decision 9: both entry points go through the same duplicate step.
  const propose = (candidate, nowMs) => {
    const nearby = findNearby(store.doc, candidate.takenAt);
    if (nearby === null) {
      add(candidate, nowMs);
      return;
    }
    pending = candidate;
    change({
      dialog: { kind: "duplicate", nearbyAt: Date.parse(nearby.takenAt) },
    });
  };

  const openForm = () => {
    const mg = lastDoseMg(store.doc);
    const fields = {
      dose: mg === null ? "" : formatNumber(mg, state.locale),
      time: msToLocalInput(now()),
      note: "",
    };
    change({ form: formOf(fields, NO_ERRORS, null) });
  };

  // v1-04 decision 4: the add form's rules, prefilled from the stored dose.
  const openEdit = (id) => {
    if (state.dialog !== null) {
      return;
    }
    const dose = store.doc.doses.find((stored) => stored.id === id);
    if (dose === undefined) {
      return;
    }
    const prefill = {
      dose: formatNumber(dose.mg, state.locale),
      time: msToLocalInput(Date.parse(dose.takenAt)),
      note: dose.note,
    };
    const editing = { id: dose.id, prefill };
    change({ form: formOf({ ...prefill }, NO_ERRORS, editing) });
  };

  const tapPrimary = () => {
    if (state.dialog !== null) {
      return;
    }
    const mg = lastDoseMg(store.doc);
    if (mg === null) {
      openForm();
      return;
    }
    const nowMs = now();
    const candidate = { takenAt: nowMs, mg, note: "" };
    propose(candidate, nowMs);
  };

  const closeForm = () => {
    if (state.form !== null) {
      change({ form: null });
    }
  };

  // An edit clears the error of each field it changes: the error was about
  // the value that is gone.
  const editForm = (changes) => {
    if (state.form === null) {
      return;
    }
    let { fields } = state.form;
    const errors = { ...state.form.errors };
    for (const key of FIELDS.filter((name) => Object.hasOwn(changes, name))) {
      fields = withField(fields, key, changes[key]);
      errors[key] = null;
    }
    change({ form: formOf(fields, errors, state.form.editing) });
  };

  const chooseDose = (mg) => editForm({ dose: formatNumber(mg, state.locale) });

  const noErrors = (errors) =>
    Object.values(errors).every((code) => code === null);

  // v1-04 decision 5: a field whose text is still its prefill keeps the
  // stored value, and is neither parsed nor validated; a changed one is
  // parsed and validated as in the add form. No dialog and no toast.
  const submitEdit = ({ fields, editing }, nowMs) => {
    const { id, prefill } = editing;
    const stored = store.doc.doses.find((dose) => dose.id === id);
    const changed = (key) => fields[key] !== prefill[key];
    const dose = changed("dose")
      ? parseDoseInput(fields.dose)
      : { ok: true, mg: stored.mg };
    const takenAtMs = changed("time") ? localInputToMs(fields.time) : null;
    const errors = {
      dose: dose.ok ? null : dose.error,
      time: changed("time") ? timeCode(fields.time, takenAtMs, nowMs) : null,
      note: changed("note") ? noteError(fields.note) : null,
    };
    if (!noErrors(errors)) {
      change({ form: formOf(fields, errors, editing) });
      return;
    }
    const changes = {
      takenAt: changed("time")
        ? new Date(takenAtMs).toISOString()
        : stored.takenAt,
      mg: dose.mg,
      note: changed("note") ? fields.note : stored.note,
    };
    const updated = settled(updateDose(store.doc, id, changes), "the edit");
    const commit = store.commit(updated.doc);
    change({
      primary: { mg: lastDoseMg(store.doc) },
      form: null,
      banner: bannerAfter(commit),
    });
  };

  const submitForm = () => {
    if (state.form === null || state.dialog !== null) {
      return;
    }
    const nowMs = now();
    if (state.form.editing !== null) {
      submitEdit(state.form, nowMs);
      return;
    }
    const { fields } = state.form;
    const dose = parseDoseInput(fields.dose);
    const takenAt = localInputToMs(fields.time);
    const errors = {
      dose: dose.ok ? null : dose.error,
      time: timeCode(fields.time, takenAt, nowMs),
      note: noteError(fields.note),
    };
    change({ form: formOf(fields, errors, null) });
    if (noErrors(errors)) {
      const candidate = { takenAt, mg: dose.mg, note: fields.note };
      propose(candidate, nowMs);
    }
  };

  // v1-04 decision 6: the delete's toast holds the dose as it was stored,
  // for its undo to put back.
  const deleteEditing = () => {
    const editing = state.form?.editing ?? null;
    if (editing === null) {
      return;
    }
    const deleted = settled(deleteDose(store.doc, editing.id), "the delete");
    const commit = store.commit(deleted.doc);
    change({
      primary: { mg: lastDoseMg(store.doc) },
      form: null,
      toast: {
        kind: "deleted",
        removed: deleted.removed,
        until: now() + UNDO_MS,
      },
      banner: bannerAfter(commit),
    });
  };

  const confirmDuplicate = () => {
    if (pending !== null) {
      add(pending, now());
    }
  };

  const cancelDuplicate = () => {
    if (pending !== null) {
      pending = null;
      change({ dialog: null });
    }
  };

  // Decision 10: undo works strictly before `until`. It takes back the add
  // or the delete its toast shows (v1-04 decision 6); an undone add closes
  // the edit form open on that dose, whose id would name nothing.
  const undone = (commit, form) =>
    change({
      primary: { mg: lastDoseMg(store.doc) },
      form,
      toast: null,
      banner: bannerAfter(commit),
    });

  const undo = () => {
    const { toast, form } = state;
    if (toast === null || !UNDOABLE.has(toast.kind) || now() >= toast.until) {
      return;
    }
    if (toast.kind === "deleted") {
      const restored = settled(
        restoreDose(store.doc, toast.removed),
        "the undo",
      );
      undone(store.commit(restored.doc), form);
      return;
    }
    const deleted = settled(deleteDose(store.doc, toast.doseId), "the undo");
    const orphaned = form?.editing?.id === toast.doseId;
    undone(store.commit(deleted.doc), orphaned ? null : form);
  };

  const tick = () => {
    if (state.toast !== null && now() >= state.toast.until) {
      change({ toast: null });
    }
  };

  // v1-05 decision 9: one of the chart's five presets; v1-06 decision 2: it
  // clears the range, which leaves no preset pressed, so a preset chosen
  // while zoomed always changes the state.
  const choosePreset = (preset) => {
    if (!PRESETS.includes(preset)) {
      throw new TypeError(
        `preset must be one of ${PRESETS.join(", ")}, got ${JSON.stringify(preset)}`,
      );
    }
    if (preset !== state.preset) {
      change({ preset, range: null });
    }
  };

  // v1-06 decision 2: the range a gesture left, after which no preset is
  // pressed.
  const showRange = ({ fromMs, toMs }) => {
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
      throw new TypeError(
        `range must be finite with fromMs < toMs, got ${fromMs} to ${toMs}`,
      );
    }
    change({ preset: null, range: { fromMs, toMs } });
  };

  // v1-11 decision 2: only a new page load, a new controller, shows it again.
  const dismissInstallHint = () => {
    if (state.installHint) {
      change({ installHint: false });
    }
  };

  // v1-12 decision 1: only these change `intro`; no commit does.
  const openIntro = () => {
    if (!state.intro) {
      change({ intro: true });
    }
  };

  const closeIntro = () => {
    if (state.intro) {
      change({ intro: false });
    }
  };

  const menu = menuActions({
    store,
    read: () => state,
    change,
    bannerAfter,
  });

  const backup = backupActions({
    store,
    now,
    timeZone,
    read: () => state,
    change,
    bannerAfter,
    // v1-12 decision 1: the rebuild keeps the intro closed, so that the
    // empty log a fresh start leaves does not open it.
    leave: () => {
      pending = null;
      change({ ...openingState(), intro: false });
    },
  });

  const dismissReminder = reminderDismissal({ read: () => state, change });

  // Decision 11: while the stored data cannot be read, every action is
  // refused, and the state stays as it is. v1-09 decision 2: but for the
  // recovery screen's own, which only the blocked page allows. A refused
  // action gives null.
  const unlessBlocked =
    (action) =>
    (...args) =>
      state.blocked ? null : action(...args);
  const whileBlocked =
    (action) =>
    (...args) =>
      state.blocked ? action(...args) : null;
  // v1-12 decision 1: a file read that settles under the intro is dropped,
  // so that the intro stays the only modal.
  const unlessIntro =
    (action) =>
    (...args) =>
      state.intro ? null : action(...args);

  return {
    get state() {
      return state;
    },
    // The stored document, for the journal; null while it cannot be read.
    get doc() {
      return store.doc;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    tapPrimary: unlessBlocked(tapPrimary),
    openForm: unlessBlocked(openForm),
    openEdit: unlessBlocked(openEdit),
    closeForm: unlessBlocked(closeForm),
    editForm: unlessBlocked(editForm),
    chooseDose: unlessBlocked(chooseDose),
    submitForm: unlessBlocked(submitForm),
    deleteEditing: unlessBlocked(deleteEditing),
    confirmDuplicate: unlessBlocked(confirmDuplicate),
    cancelDuplicate: unlessBlocked(cancelDuplicate),
    undo: unlessBlocked(undo),
    tick: unlessBlocked(tick),
    choosePreset: unlessBlocked(choosePreset),
    showRange: unlessBlocked(showRange),
    dismissInstallHint: unlessBlocked(dismissInstallHint),
    dismissReminder: unlessBlocked(dismissReminder),
    openIntro: unlessBlocked(openIntro),
    closeIntro: unlessBlocked(closeIntro),
    openMenu: unlessBlocked(menu.openMenu),
    closeMenu: unlessBlocked(menu.closeMenu),
    finishMenu: unlessBlocked(menu.finishMenu),
    choosePhenotype: unlessBlocked(menu.choosePhenotype),
    chooseCustomHalfLife: unlessBlocked(menu.chooseCustomHalfLife),
    editHalfLife: unlessBlocked(menu.editHalfLife),
    commitHalfLife: unlessBlocked(menu.commitHalfLife),
    setShowRefRange: unlessBlocked(menu.setShowRefRange),
    setShowPerDoseCurves: unlessBlocked(menu.setShowPerDoseCurves),
    chooseLocale: unlessBlocked(menu.chooseLocale),
    exportBackup: unlessBlocked(backup.exportBackup),
    exportCsv: unlessBlocked(backup.exportCsv),
    backupSaved: unlessBlocked(backup.backupSaved),
    mergeImport: unlessBlocked(backup.mergeImport),
    replaceImport: unlessBlocked(backup.replaceImport),
    proposeImport: unlessIntro(backup.proposeImport),
    dismissBackupDialog: backup.dismissBackupDialog,
    exportRaw: whileBlocked(backup.exportRaw),
    restoreBackup: whileBlocked(backup.restoreBackup),
    askStartFresh: whileBlocked(backup.askStartFresh),
    startFresh: whileBlocked(backup.startFresh),
  };
};
