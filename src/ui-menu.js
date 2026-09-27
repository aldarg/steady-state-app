// v1-13 decision 1: the menu's panel (v1-08), moved from ui.js: its phenotype
// rows, its draw and its listeners. Its texts are settings.js's. Nothing runs
// at import.

import { PHENOTYPE_ORDER, menuView } from "./settings.js";
import {
  drawMessage,
  onCancel,
  setChecked,
  setText,
  setValue,
} from "./ui-dom.js";

// v1-08 decision 5: each language's radio, by its data-ui name.
const LOCALE_PARTS = Object.freeze({ ru: "menuRu", en: "menuEn" });

// v1-08 decision 5: the four phenotypes' radios, in PHENOTYPE_ORDER, each in
// a label with its name over its second line; the custom one follows them
// in index.html.
export const makePhenotypes = (document, container) =>
  PHENOTYPE_ORDER.map((phenotype) => {
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "menu-model";
    input.className = "option-input";
    input.dataset.phenotype = phenotype;
    const name = document.createElement("span");
    name.className = "option-name";
    const note = document.createElement("span");
    note.className = "option-note";
    const text = document.createElement("span");
    text.className = "option-text";
    text.append(name, note);
    const row = document.createElement("label");
    row.className = "option";
    row.append(input, text);
    container.append(row);
    return { input, name, note };
  });

// v1-08 decision 5: the custom half-life's field, shown while custom is
// checked. Its text is the menu's, written only when it differs, so that
// what is typed and not yet committed stays, and so does the caret.
const drawHalfLife = ({ parts }, field) => {
  parts.halfLifeField.hidden = !field.shown;
  setText(parts.halfLifeLabel, field.label);
  setText(parts.halfLifeHint, field.hint);
  setValue(parts.halfLife, field.text);
  parts.halfLife.setAttribute("aria-invalid", String(field.error !== null));
  drawMessage(parts.halfLifeError, field.error);
};

// v1-08 decision 5: every control on each draw, the radios and the switches
// checked as the document says.
const drawPanel = (view, { title, done, model, chart, language }) => {
  const { parts, phenotypes } = view;
  setText(parts.menuTitle, title);
  setText(parts.menuDone, done);
  setText(parts.menuModel, model.legend);
  setText(parts.menuModelNote, model.note);
  for (const [index, row] of model.phenotypes.entries()) {
    const { input, name, note } = phenotypes[index];
    setChecked(input, row.checked);
    setText(name, row.label);
    setText(note, row.halfLife);
  }
  setChecked(parts.menuCustom, model.custom.checked);
  setText(parts.menuCustomLabel, model.custom.label);
  drawHalfLife(view, model.field);
  setText(parts.menuChart, chart.legend);
  for (const [switchPart, shown] of [
    ["menuBand", chart.band],
    ["menuDoses", chart.doses],
  ]) {
    setChecked(parts[switchPart], shown.checked);
    setText(parts[`${switchPart}Label`], shown.label);
    setText(parts[`${switchPart}Note`], shown.note);
  }
  setText(parts.menuLanguage, language.legend);
  for (const { locale, label, checked } of language.locales) {
    const part = LOCALE_PARTS[locale];
    setChecked(parts[part], checked);
    setText(parts[`${part}Label`], label);
  }
};

// v1-08 decision 4: the panel is a modal while the menu is open. It opens
// with focus on its title, and closes with focus back on the menu button,
// set here rather than left to the browser. The button is hidden while the
// page is blocked, since the header sits outside main.
export const drawMenu = (view, state) => {
  const { parts, controller } = view;
  parts.menuButton.hidden = state.blocked;
  if (state.menu === null) {
    if (parts.menu.open) {
      parts.menu.close();
      parts.menuButton.focus();
    }
    return;
  }
  drawPanel(view, menuView(controller.doc.settings, state.menu, state.locale));
  if (!parts.menu.open) {
    parts.menu.showModal();
    parts.menuTitle.focus();
  }
};

// M7: Done over a refused half-life leaves the panel open, with focus in
// the field.
const focusHalfLifeError = ({ parts, controller }) => {
  const { menu } = controller.state;
  if (menu !== null && menu.halfLife.error !== null) {
    parts.halfLife.focus();
  }
};

// v1-08 decisions 4 and 5: the menu's controls. A typed half-life is
// committed on change, as the field is left, or on Enter, never on a
// keystroke. Escape and the back gesture close the panel through its cancel
// event, whose handler closes the menu before the dialog closes, so that the
// change the browser then fires reaches a closed menu (M7).
export const listenMenu = (view, on) => {
  const { parts, controller } = view;
  on(parts.menuButton, "click", () => controller.openMenu());
  on(parts.menuDone, "click", () => {
    controller.finishMenu();
    focusHalfLifeError(view);
  });
  onCancel(on, parts.menu, () => controller.closeMenu());
  on(parts.menuPhenotypes, "change", (event) => {
    const input = event.target.closest("[data-phenotype]");
    if (input !== null) {
      controller.choosePhenotype(input.dataset.phenotype);
    }
  });
  on(parts.menuCustom, "change", () => controller.chooseCustomHalfLife());
  on(parts.halfLife, "input", () =>
    controller.editHalfLife(parts.halfLife.value),
  );
  on(parts.halfLife, "change", () => controller.commitHalfLife());
  on(parts.halfLife, "keydown", (event) => {
    if (event.key === "Enter") {
      controller.commitHalfLife();
    }
  });
  on(parts.menuBand, "change", () =>
    controller.setShowRefRange(parts.menuBand.checked),
  );
  on(parts.menuDoses, "change", () =>
    controller.setShowPerDoseCurves(parts.menuDoses.checked),
  );
  for (const [locale, part] of Object.entries(LOCALE_PARTS)) {
    on(parts[part], "change", () => controller.chooseLocale(locale));
  }
};
