// v1-13 decision 1: the backup's I/O edge (v1-09 decision 3), moved from
// ui.js: where files are shared, downloaded and read, the panel's last-backup
// line, the recovery screen and the backup dialog. Its texts are backup.js's.
// Nothing runs at import.

import { lastBackupText, previewTexts, recoveryNote } from "./backup.js";
import { t } from "./i18n.js";
import { drawMessage, onCancel, setText } from "./ui-dom.js";

// v1-09 decision 3: each export's media type.
const MEDIA = Object.freeze({
  json: "application/json",
  csv: "text/csv",
  text: "text/plain",
});

// A download's Blob URL is revoked this long after its click, since a
// browser may still be reading the Blob when click() returns.
const REVOKE_MS = 60_000;

// v1-09 decision 5: the buttons each kind of the backup dialog shows, the
// safe one last, where focus goes when it opens.
const BACKUP_BUTTONS = Object.freeze({
  import: ["backupMerge", "backupReplace", "backupCancel"],
  rejected: ["backupOk"],
  restore: ["backupRestore", "backupCancel"],
  startFresh: ["backupSaveText", "backupDelete", "backupCancel"],
});
const ALL_BACKUP_BUTTONS = [...new Set(Object.values(BACKUP_BUTTONS).flat())];

// v1-09 decision 4: the last-backup line, at the draw's reading of the
// clock, its label muted and hidden before the first copy.
export const drawBackupLine = ({ parts, controller }, state, nowMs) => {
  if (state.blocked) {
    return;
  }
  const { lastBackupAt } = controller.doc;
  const line = lastBackupText(
    lastBackupAt,
    nowMs,
    state.locale,
    state.timeZone,
  );
  drawMessage(parts.backupLastLabel, line.label);
  setText(parts.backupLastValue, line.value);
};

// v1-09 decision 6: the first button's second line names the file the raw
// text is saved to, at the draw's reading of the clock (implementation round
// 2).
export const drawRecovery = ({ parts }, state, nowMs) => {
  if (state.blocked) {
    setText(
      parts.recoverySaveTextNote,
      recoveryNote(nowMs, state.locale, state.timeZone),
    );
  }
};

// v1-09 decision 5: the dialog's lines for its kind. Only an import has the
// file's name and the two choices' lines.
const backupLines = ({ backupDialog, locale, timeZone }) => {
  const { kind } = backupDialog;
  if (kind === "rejected") {
    return { text: t(locale, "import.rejected") };
  }
  if (kind === "startFresh") {
    return { text: t(locale, "recovery.freshQuestion") };
  }
  const texts = previewTexts(backupDialog.preview, locale, timeZone);
  if (kind === "restore") {
    return { text: texts.restore };
  }
  const { name, summary, merge, replace } = texts;
  return { name, text: summary, merge, replace };
};

// v1-09 decision 5: one modal dialog, over whatever is open, while
// backupDialog is set. Focus goes to its safe button whenever it opens or
// its kind changes.
export const drawBackupDialog = (view, state) => {
  const { parts } = view;
  const { backupDialog } = state;
  if (backupDialog === null) {
    if (parts.backupDialog.open) {
      parts.backupDialog.close();
    }
    view.backupShown = null;
    return;
  }
  const {
    name = null,
    text,
    merge = null,
    replace = null,
  } = backupLines(state);
  drawMessage(parts.backupName, name);
  setText(parts.backupText, text);
  drawMessage(parts.backupMergeLine, merge);
  drawMessage(parts.backupReplaceLine, replace);
  const buttons = BACKUP_BUTTONS[backupDialog.kind];
  for (const part of ALL_BACKUP_BUTTONS) {
    parts[part].hidden = !buttons.includes(part);
  }
  if (!parts.backupDialog.open) {
    parts.backupDialog.showModal();
  }
  if (backupDialog !== view.backupShown) {
    parts[buttons.at(-1)].focus();
    view.backupShown = backupDialog;
  }
};

// v1-09 decision 6, implementation round 2: leaving the blocked page hides
// the control that had focus, so focus goes to the primary button, once the
// dialog it was left from has closed.
export const focusAfterRecovery = (view, state) => {
  if (view.drawnBlocked === true && !state.blocked) {
    view.parts.primary.focus();
  }
  view.drawnBlocked = state.blocked;
};

// v1-09 decision 3: the file, to the share sheet where the browser can share
// files, else as a download: a Blob URL on an anchor named for the file. A
// cancelled share is the one outcome that delivers nothing; any other
// failure falls back to the download. The share is asked for before any
// await, within the tap that asked for it.
const deliver = async ({ window, document }, { filename, text, type }) => {
  const file = new window.File([text], filename, { type });
  const { navigator } = window;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  const url = window.URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), REVOKE_MS);
  return "downloaded";
};

// B2, Q6: only a JSON export that was not cancelled counts as a backup.
export const saveBackup = (view) => {
  const { controller } = view;
  const exported = controller.exportBackup();
  deliver(view, { ...exported, type: MEDIA.json }).then((outcome) => {
    if (outcome !== "cancelled") {
      controller.backupSaved();
    }
  });
};

// The file chosen is read and proposed. The input is cleared at once, so
// that the same file chosen again fires change again. Implementation round
// 2: a file that cannot be read holds no backup, so it is proposed with no
// text, and rejected as any unsuitable file is (B5). Implementation round 3:
// each input numbers its selections, and a read that settles after a newer
// selection of the same input does nothing. Implementation round 4: nor
// does one that settles after its page is gone: the recovery screen's input
// counts only while the page is blocked, and the panel's only while it is
// not.
const proposeChosen = ({ controller, selections }, input, onBlockedPage) => {
  const [file] = input.files;
  input.value = "";
  if (file === undefined) {
    return;
  }
  const selection = (selections.get(input) ?? 0) + 1;
  selections.set(input, selection);
  const propose = (text) => {
    const latest = selections.get(input) === selection;
    if (latest && controller.state.blocked === onBlockedPage) {
      controller.proposeImport(file.name, text);
    }
  };
  file.text().then(propose, () => propose(""));
};

// v1-09 decisions 3 to 6: the panel's group, the recovery screen and the
// dialog, which Escape and Android's back dismiss through the controller.
export const listenBackup = (view, on) => {
  const { parts, controller } = view;
  const saveRaw = () =>
    deliver(view, { ...controller.exportRaw(), type: MEDIA.text });
  on(parts.backupSave, "click", () => saveBackup(view));
  on(parts.backupCsv, "click", () =>
    deliver(view, { ...controller.exportCsv(), type: MEDIA.csv }),
  );
  on(parts.backupImport, "click", () => parts.importFile.click());
  on(parts.recoverySaveText, "click", saveRaw);
  on(parts.recoveryRestore, "click", () => parts.restoreFile.click());
  on(parts.recoveryStartFresh, "click", () => controller.askStartFresh());
  for (const [input, onBlockedPage] of [
    [parts.importFile, false],
    [parts.restoreFile, true],
  ]) {
    on(input, "change", () => proposeChosen(view, input, onBlockedPage));
  }
  on(parts.backupMerge, "click", () => controller.mergeImport());
  on(parts.backupReplace, "click", () => controller.replaceImport());
  on(parts.backupRestore, "click", () => controller.restoreBackup());
  on(parts.backupSaveText, "click", saveRaw);
  on(parts.backupDelete, "click", () => controller.startFresh());
  for (const button of [parts.backupCancel, parts.backupOk]) {
    on(button, "click", () => controller.dismissBackupDialog());
  }
  onCancel(on, parts.backupDialog, () => controller.dismissBackupDialog());
};
