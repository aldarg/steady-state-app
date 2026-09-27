// v1-13 decision 1: v1-11's install hint, whose save button is the panel's,
// and v1-12's intro, moved from ui.js: their draws, and the hint's listeners.
// v1-13 decision 4: and the backup reminder, its draw and its listeners.
// Nothing runs at import.

import { backupDue, reminderText } from "./backup.js";
import { saveBackup } from "./ui-backup.js";
import { setText } from "./ui-dom.js";

// v1-11 decision 3: the install hint, while the controller shows it and the
// page is not blocked. The blocked page's document is null, so it is not read
// then. With the hint shown, the move sentence and the save button show while
// the log holds an intake: the first one saved reveals them, and deleting the
// last hides them.
export const drawInstall = ({ parts, controller }, state) => {
  const shown = state.installHint && !state.blocked;
  parts.install.hidden = !shown;
  if (shown) {
    const holdsIntakes = controller.doc.doses.length > 0;
    parts.installMove.hidden = !holdsIntakes;
    parts.installSave.hidden = !holdsIntakes;
  }
};

// v1-12 decision 3: the intro's modal. It opens with focus on introOk, not by
// autofocus, and closes with it on its opener, introOpen, or on the primary.
export const drawIntro = (view, { intro }) => {
  const { parts } = view;
  if (intro && !parts.intro.open) {
    parts.intro.showModal();
    parts.introOk.focus();
  } else if (!intro && parts.intro.open) {
    parts.intro.close();
    (view.introOpener ?? parts.primary).focus();
    view.introOpener = null;
  }
};

// v1-11 decision 3: the hint's save button runs the panel's save. Its close
// button dismisses it, and focus moves to the next visible control, since
// the one that had it is gone: the form's first dose chip while the form
// hides the primary button, the primary button otherwise. The modal dialog
// and the panel make the hint inert, so no other state reaches it.
export const listenInstall = (view, on) => {
  const { parts, controller, chips } = view;
  on(parts.installSave, "click", () => saveBackup(view));
  on(parts.installClose, "click", () => {
    controller.dismissInstallHint();
    if (!controller.state.installHint) {
      (controller.state.form === null ? parts.primary : chips[0]).focus();
    }
  });
};

// v1-13 decision 4: the reminder, judged at the dated step's one reading of
// the clock, while the page is not blocked, it is not dismissed, the backup
// is due, and the install hint, which asks for a backup too, is hidden (R4).
// The blocked page's document is null, so it is not read then. Whenever it
// hides with focus inside it, after its close or its save, focus moves to
// the next visible control, noted before the hide, since a browser may drop
// focus to the body once the element is hidden: the form's first dose chip
// while the form hides the primary button, the primary button otherwise.
export const drawReminder = (view, state, nowMs) => {
  const { parts, controller, document, chips } = view;
  const shown =
    !state.blocked &&
    !state.reminderDismissed &&
    !state.installHint &&
    backupDue(controller.doc, nowMs);
  if (shown) {
    setText(
      parts.reminderText,
      reminderText(controller.doc, nowMs, state.locale, state.timeZone),
    );
  }
  const hadFocus = !shown && parts.reminder.contains(document.activeElement);
  parts.reminder.hidden = !shown;
  if (hadFocus) {
    (state.form === null ? parts.primary : chips[0]).focus();
  }
};

// v1-13 decision 4: the reminder's save runs the panel's save, and its close
// dismisses it until the next page load; the draw then hides it.
export const listenReminder = (view, on) => {
  const { parts, controller } = view;
  on(parts.reminderSave, "click", () => saveBackup(view));
  on(parts.reminderClose, "click", () => controller.dismissReminder());
};
