// Draws the controller's state into the page and forwards the page's events
// to it (decision 8). It decides nothing: the rules are in controller.js and
// intake.js, every string is in i18n.js, the journal's list is journal.js's,
// the chart's view is chart.js's, the summary strip's texts are summary.js's,
// the menu's are settings.js's and the backup's are backup.js's. v1-13
// decision 1: the menu's panel is ui-menu.js's, the backup's I/O edge
// ui-backup.js's, the install hint and the intro ui-notices.js's, and the
// helpers they share ui-dom.js's; this module mounts the page, draws the rest
// and listens. Nothing runs at import: the document, the window, the clock,
// Chart.js and Hammer come in from app.js.

import { resultText } from "./backup.js";
import { PRESETS, chartModel, mountChart, onShown } from "./chart.js";
import { formatMg, formatTime, localDay, t } from "./i18n.js";
import { DOSE_CHIPS, NOTE_MAX } from "./intake.js";
import { journalView } from "./journal.js";
import { summaryView } from "./summary.js";
import {
  drawBackupDialog,
  drawBackupLine,
  drawRecovery,
  focusAfterRecovery,
  listenBackup,
} from "./ui-backup.js";
import { drawMessage, onCancel, setText, setValue } from "./ui-dom.js";
import { drawMenu, listenMenu, makePhenotypes } from "./ui-menu.js";
import {
  drawInstall,
  drawIntro,
  drawReminder,
  listenInstall,
  listenReminder,
} from "./ui-notices.js";

const FIELDS = ["dose", "time", "note"];

// A timer and the wall clock can disagree by a millisecond or so; a toast
// that is still there when its timer fires is looked at again this soon.
const RETRY_MS = 50;

// v1-09 decision 7: the toasts with no undo, whose texts are backup.js's.
const RESULT_TOASTS = new Set(["imported", "replaced"]);

// The elements the state is drawn into, by their data-ui name.
const findParts = (document) =>
  Object.fromEntries(
    [...document.querySelectorAll("[data-ui]")].map((element) => [
      element.dataset.ui,
      element,
    ]),
  );

const makeChips = (document, container) =>
  DOSE_CHIPS.map((mg) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.chip = String(mg);
    container.append(chip);
    return chip;
  });

// v1-05 decision 9: the chart's five presets, under it.
const makePresets = (document, container) =>
  PRESETS.map((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset";
    button.dataset.preset = preset;
    container.append(button);
    return button;
  });

// Every static text, from its data-text key, and every accessible name from
// its data-label key.
const drawStrings = ({ document, chips, presets }, locale) => {
  document.documentElement.lang = locale;
  document.title = t(locale, "app.name");
  for (const element of document.querySelectorAll("[data-text]")) {
    setText(element, t(locale, element.dataset.text));
  }
  for (const element of document.querySelectorAll("[data-label]")) {
    element.setAttribute("aria-label", t(locale, element.dataset.label));
  }
  for (const chip of chips) {
    setText(chip, formatMg(Number(chip.dataset.chip), locale));
  }
  for (const button of presets) {
    setText(button, t(locale, `chart.preset.${button.dataset.preset}`));
  }
};

const drawPrimary = ({ parts }, { primary, locale }) => {
  const { mg } = primary;
  drawMessage(parts.primaryDose, mg === null ? null : formatMg(mg, locale));
  parts.other.hidden = mg === null;
};

const messageOf = (locale, kind, field, code) =>
  code === null
    ? null
    : t(locale, `${kind}.${field}.${code}`, { max: NOTE_MAX });

const drawFields = ({ parts, chips }, { form, locale }) => {
  for (const field of FIELDS) {
    const code = form.errors[field];
    setValue(parts[field], form.fields[field]);
    parts[field].setAttribute("aria-invalid", String(code !== null));
    drawMessage(
      parts[`${field}Error`],
      messageOf(locale, "error", field, code),
    );
  }
  drawMessage(
    parts.doseWarning,
    messageOf(locale, "warning", "dose", form.warnings.dose),
  );
  const { shown, count } = form.counter;
  drawMessage(
    parts.noteCounter,
    shown ? t(locale, "form.noteCounter", { count, max: NOTE_MAX }) : null,
  );
  for (const chip of chips) {
    const pressed = Number(chip.dataset.chip) === form.chip;
    chip.setAttribute("aria-pressed", String(pressed));
  }
};

// v1-04 decision 8: the journal, one element per entry of journalView, top
// to bottom. A row is a button whose text is its accessible name; CSS cuts
// it to one line.
const makeRow = (document, entry, locale) => {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "row";
  row.dataset.id = entry.id;
  const line = document.createElement("span");
  line.className = "row-line";
  const key = entry.note === "" ? "journal.row" : "journal.rowNote";
  line.textContent = t(locale, key, entry);
  row.append(line);
  const item = document.createElement("li");
  item.append(row);
  return { item, row };
};

const makeGap = (document, { label }) => {
  const gap = document.createElement("div");
  gap.className = "gap";
  gap.setAttribute("role", "separator");
  gap.setAttribute("aria-label", label);
  gap.textContent = label;
  return gap;
};

// A day's heading opens the list its intakes go into.
const makeJournal = (document, entries, locale) => {
  const fragment = document.createDocumentFragment();
  const rows = new Map();
  let list = null;
  for (const entry of entries) {
    if (entry.kind === "day") {
      const heading = document.createElement("h3");
      heading.className = "day";
      heading.textContent = entry.label;
      list = document.createElement("ul");
      list.className = "rows";
      fragment.append(heading, list);
    } else if (entry.kind === "gap") {
      fragment.append(makeGap(document, entry));
    } else {
      const { item, row } = makeRow(document, entry, locale);
      rows.set(entry.id, row);
      list.append(item);
    }
  }
  return { fragment, rows };
};

// Decision 8: the journal is drawn again when the stored document or the
// local day has changed since it was last drawn, and only then: typing in
// the form or a toast's timer leaves its elements as they are. v1-07
// decision 8: `nowMs` is the event's one reading of the clock.
const drawJournal = (view, state, nowMs) => {
  if (state.blocked) {
    return;
  }
  const { parts, controller, document } = view;
  const { locale, timeZone } = state;
  const day = localDay(nowMs, timeZone);
  const { doc } = controller;
  if (doc === view.journal.doc && day === view.journal.day) {
    return;
  }
  const entries = journalView(doc, { nowMs, locale, timeZone });
  const { fragment, rows } = makeJournal(document, entries, locale);
  parts.journal.replaceChildren(fragment);
  parts.journalSection.hidden = entries.length === 0;
  view.journal = { doc, day, rows };
};

// v1-07 decision 8: the summary strip is written with the chart's view, at
// that view's now, from the same document, locale and zone, so that it and
// the "now" line agree. An empty log hides it.
const drawSummary = (view, doc, { nowMs, locale, timeZone }) => {
  const { parts } = view;
  const summary = summaryView(doc, { nowMs, locale, timeZone });
  parts.summary.hidden = summary.empty;
  if (!summary.empty) {
    setText(parts.summaryLevel, summary.level);
    setText(parts.summaryLastDay, summary.lastDay);
    setText(parts.summaryLastLine, summary.lastLine);
    setText(parts.summarySteady, summary.steady);
  }
  view.summary = { doc, locale, timeZone, day: localDay(nowMs, timeZone) };
};

// v1-07 decision 8: the day line follows the journal's headings. On a new
// local day, it alone is written again, at the new now; the level, the time
// and dose, and the countdown stay at the chart view's now. `nowMs` is the
// draw's one reading, the journal's too, so the two name the same day.
const drawSummaryDay = (view, state, nowMs) => {
  if (state.blocked || view.summary === null) {
    return;
  }
  const { doc, locale, timeZone, day } = view.summary;
  const today = localDay(nowMs, timeZone);
  if (today === day) {
    return;
  }
  const summary = summaryView(doc, { nowMs, locale, timeZone });
  if (!summary.empty) {
    setText(view.parts.summaryLastDay, summary.lastDay);
  }
  view.summary = { ...view.summary, day: today };
};

const setPressed = (element, pressed) => {
  if (element.getAttribute("aria-pressed") !== String(pressed)) {
    element.setAttribute("aria-pressed", String(pressed));
  }
};

// v1-05 decision 11: the chart is drawn again only when chartModel gives a
// view other than the one drawn last: after a change of the document, the
// preset, the range (v1-06) or the locale, or, `fresh`, when the page is
// shown again or a preset is tapped. Typing in the form or a toast's timer
// computes nothing and draws nothing. v1-07 decision 8: `nowMs` is the
// event's one reading of the clock.
const drawChart = (view, state, nowMs, { fresh = false } = {}) => {
  if (state.blocked) {
    return;
  }
  const { parts, controller, presets } = view;
  const { doc } = controller;
  // v1-06 decision 7: a document change stores a gesture's pending result
  // first; showRange draws the new document at that range, from here again.
  if (doc !== view.chart.doc) {
    const range = view.chart.canvas.settle();
    if (range !== null) {
      controller.showRange(range);
      return;
    }
  }
  const { preset, range, locale, timeZone } = state;
  for (const button of presets) {
    setPressed(button, button.dataset.preset === preset);
  }
  const options = { preset, range, nowMs, locale, timeZone };
  const shown = view.chart.model.viewFor(doc, options, { fresh });
  view.chart.doc = doc;
  if (shown === view.chart.drawn) {
    return;
  }
  view.chart.drawn = shown;
  parts.chartEmpty.hidden = !shown.empty;
  parts.chartBox.hidden = shown.empty;
  parts.presets.hidden = shown.empty;
  if (!shown.empty) {
    view.chart.canvas.draw(shown, { doc, locale, timeZone });
  }
  drawSummary(view, doc, options);
};

// Which form is open: null, the add form, or the id of the intake it edits.
const ADDING = Symbol("adding");

const shownForm = (form) => {
  if (form === null) {
    return null;
  }
  return form.editing === null ? ADDING : form.editing.id;
};

// The form takes the place of the primary action while it is open. Focus
// goes to its title whenever it opens or switches to another intake; when it
// closes, back to the row of the intake it edited, or to the primary when
// there is none: after the add form, or when the row is gone.
const drawForm = (view, state) => {
  const { parts } = view;
  const { form, locale } = state;
  const open = form !== null;
  parts.form.hidden = !open;
  parts.log.hidden = open;
  if (open) {
    const editing = form.editing !== null;
    const title = editing ? "form.editTitle" : "form.title";
    setText(parts.formTitle, t(locale, title));
    parts.delete.hidden = !editing;
    drawFields(view, state);
  }
  const shown = shownForm(form);
  if (shown !== null && shown !== view.formShown) {
    parts.formTitle.focus();
  }
  if (shown === null && view.formShown !== null) {
    (view.journal.rows.get(view.formShown) ?? parts.primary).focus();
  }
  view.formShown = shown;
};

const drawDialog = ({ parts }, { dialog, locale, timeZone }) => {
  if (dialog === null) {
    if (parts.dialog.open) {
      parts.dialog.close();
    }
    return;
  }
  const time = formatTime(dialog.nearbyAt, locale, timeZone);
  setText(parts.dialogText, t(locale, "dialog.duplicate", { time }));
  if (!parts.dialog.open) {
    parts.dialog.showModal();
  }
};

// Decision 10: every toast shown gets a tick() at its `until`.
const armToast = (view, toast) => {
  if (toast === view.armed) {
    return;
  }
  const { window, controller, now } = view;
  window.clearTimeout(view.timer);
  view.armed = toast;
  if (toast === null) {
    return;
  }
  const fire = () => {
    controller.tick();
    if (controller.state.toast === toast) {
      const wait = Math.max(RETRY_MS, toast.until - now());
      view.timer = window.setTimeout(fire, wait);
    }
  };
  view.timer = window.setTimeout(fire, Math.max(0, toast.until - now()));
};

// The logged toast names the intake it added; the deleted toast, the one it
// took away (v1-04 decision 6); an import's, its result (v1-09 decision 7).
const toastText = ({ toast, locale, timeZone }) => {
  if (RESULT_TOASTS.has(toast.kind)) {
    return resultText(toast, locale);
  }
  if (toast.kind === "deleted") {
    const { mg, takenAt } = toast.removed;
    const time = formatTime(Date.parse(takenAt), locale, timeZone);
    return t(locale, "toast.deleted", { mg: formatMg(mg, locale), time });
  }
  const time = formatTime(toast.takenAt, locale, timeZone);
  return t(locale, "toast.logged", { mg: formatMg(toast.mg, locale), time });
};

const drawToast = (view, state) => {
  const { toast } = state;
  const { parts, document } = view;
  armToast(view, toast);
  if (toast === null) {
    const hadFocus = parts.toast.contains(document.activeElement);
    parts.toast.hidden = true;
    setText(parts.toastText, "");
    if (hadFocus) {
      parts.primary.focus();
    }
    return;
  }
  setText(parts.toastText, toastText(state));
  parts.undo.hidden = RESULT_TOASTS.has(toast.kind);
  parts.toast.hidden = false;
};

// v1-07 decision 8: the one step every path that draws the chart goes
// through — a draw, a tap on the pressed preset, a page shown again. One
// reading of the clock, for the chart, the journal and the strip's day line,
// so that no path refreshes the strip without the journal, and none of them
// straddles midnight. v1-09 decisions 4 and 6, implementation round 2: the
// last-backup line and the recovery note name a day too. v1-13 decision 4:
// and the reminder is judged at it, so a page shown again re-judges it.
const drawDated = (view, state, { fresh = false } = {}) => {
  const nowMs = view.now();
  drawChart(view, state, nowMs, { fresh });
  drawJournal(view, state, nowMs);
  drawSummaryDay(view, state, nowMs);
  drawBackupLine(view, state, nowMs);
  drawRecovery(view, state, nowMs);
  drawReminder(view, state, nowMs);
};

const draw = (view, state) => {
  const { parts } = view;
  if (state.locale !== view.locale) {
    drawStrings(view, state.locale);
    view.locale = state.locale;
  }
  parts.blocked.hidden = !state.blocked;
  parts.main.hidden = state.blocked;
  // v1-08 decision 4: the panel shows SPEC §6's warning too, since the
  // page's own sits behind it.
  const banner =
    state.banner === null ? null : t(state.locale, "banner.notSaved");
  drawMessage(parts.banner, banner);
  drawMessage(parts.menuBanner, banner);
  drawInstall(view, state);
  drawDated(view, state);
  drawPrimary(view, state);
  drawDialog(view, state);
  drawForm(view, state);
  drawToast(view, state);
  // v1-09 decision 5: the backup dialog sits over the panel, so it closes
  // before the panel does.
  drawBackupDialog(view, state);
  focusAfterRecovery(view, state);
  drawMenu(view, state);
  drawIntro(view, state);
};

// After a refused submit, focus goes to the first field in error.
const focusFirstError = ({ parts, controller }) => {
  const { form, dialog } = controller.state;
  if (form === null || dialog !== null) {
    return;
  }
  const field = FIELDS.find((name) => form.errors[name] !== null);
  if (field !== undefined) {
    parts[field].focus();
  }
};

const listen = (view) => {
  const { parts, controller, document } = view;
  const on = (element, type, handler) =>
    element.addEventListener(type, handler);
  on(parts.primary, "click", () => controller.tapPrimary());
  on(parts.other, "click", () => controller.openForm());
  on(parts.cancel, "click", () => controller.closeForm());
  on(parts.delete, "click", () => controller.deleteEditing());
  on(parts.form, "submit", (event) => {
    event.preventDefault();
    controller.submitForm();
    focusFirstError(view);
  });
  for (const field of FIELDS) {
    on(parts[field], "input", () =>
      controller.editForm({ [field]: parts[field].value }),
    );
  }
  // A date picker may report its value on change alone.
  on(parts.time, "change", () =>
    controller.editForm({ time: parts.time.value }),
  );
  on(parts.chips, "click", (event) => {
    const chip = event.target.closest("[data-chip]");
    if (chip !== null) {
      controller.chooseDose(Number(chip.dataset.chip));
    }
  });
  on(parts.confirm, "click", () => controller.confirmDuplicate());
  on(parts.dialogCancel, "click", () => controller.cancelDuplicate());
  onCancel(on, parts.dialog, () => controller.cancelDuplicate());
  on(parts.undo, "click", () => controller.undo());
  listenMenu(view, on);
  listenBackup(view, on);
  listenInstall(view, on);
  listenReminder(view, on);
  on(parts.introOk, "click", () => controller.closeIntro());
  onCancel(on, parts.intro, () => controller.closeIntro());
  on(parts.introOpen, "click", () => {
    view.introOpener = parts.introOpen;
    controller.openIntro();
  });
  on(parts.journal, "click", (event) => {
    const row = event.target.closest("[data-id]");
    if (row !== null) {
      controller.openEdit(row.dataset.id);
    }
  });
  // v1-06 decisions 2 and 7: a preset tap beats any gesture begun before it,
  // and always redraws: the pressed preset's too, whose state is unchanged
  // but whose scale a gesture may have moved.
  on(parts.presets, "click", (event) => {
    const button = event.target.closest("[data-preset]");
    if (button !== null) {
      view.chart.canvas.supersede();
      const before = controller.state;
      controller.choosePreset(button.dataset.preset);
      if (controller.state === before) {
        drawDated(view, before, { fresh: true });
      }
    }
  });
  // Decision 8: a page shown again on another day re-labels its days; v1-05
  // decision 11: and its chart is drawn again at the new now; v1-06 decision
  // 8: at 7 d if it was zoomed, and beating any gesture begun before. v1-07
  // decision 8: shown again, the fresh chart comes with the journal and the
  // strip's day line, through drawDated; hidden, the journal alone.
  on(document, "visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      drawJournal(view, controller.state, view.now());
      return;
    }
    view.chart.canvas.supersede();
    const shown = onShown(controller.state);
    if (shown.fresh) {
      drawDated(view, controller.state, { fresh: true });
    } else {
      controller.choosePreset(shown.preset);
    }
  });
};

export const mountUi = ({
  controller,
  document,
  window,
  now,
  Chart,
  Hammer,
}) => {
  const parts = findParts(document);
  const view = {
    controller,
    document,
    window,
    now,
    parts,
    chips: makeChips(document, parts.chips),
    presets: makePresets(document, parts.presets),
    phenotypes: makePhenotypes(document, parts.menuPhenotypes),
    chart: {
      model: chartModel(),
      canvas: mountChart({
        Chart,
        Hammer,
        canvas: parts.chartCanvas,
        tip: parts.chartTip,
        window,
        document,
        now,
        onRange: (range) => controller.showRange(range),
      }),
      drawn: null,
      // The document the drawn view was computed from.
      doc: null,
    },
    locale: null,
    formShown: null,
    journal: { doc: null, day: null, rows: new Map() },
    // The document, locale, zone and local day the strip was written for.
    summary: null,
    armed: null,
    timer: null,
    // v1-09 decision 5: the backup dialog focused last, or null.
    backupShown: null,
    // Whether the last draw was of the blocked page, or null before the
    // first.
    drawnBlocked: null,
    // v1-09 decision 3, implementation round 3: each file input's latest
    // selection, by its number.
    selections: new Map(),
    // v1-12 decision 3: the intro's opener, or null.
    introOpener: null,
  };
  listen(view);
  controller.subscribe((state) => draw(view, state));
  draw(view, controller.state);
};
