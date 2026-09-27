// The menu's rules and texts (v1-08 decision 1), as pure functions: the
// phenotypes in their order, each one's half-life, where a custom half-life
// starts, what its field accepts, and everything the panel shows. No DOM, no
// clock, no globals: the settings, the menu's state and the locale come in
// as arguments. A refused entry is a code, never a sentence; menuView turns
// every code into error.halfLife's one text (M4).

import { formatNumber, t } from "./i18n.js";
import { params } from "./pk.js";

// Fastest to slowest (M3).
export const PHENOTYPE_ORDER = Object.freeze(["UM", "NM", "IM", "PM"]);

// The language options, in the panel's order.
const LOCALES = Object.freeze(["ru", "en"]);

// The store's limits (v1-02): 10 to 150 h, in whole tenths of an hour.
const MIN_TENTHS = 100;
const MAX_TENTHS = 1500;

// The phenotype's own half-life, SPEC §4's, with any custom one set aside:
// the four rows keep theirs while custom is active.
export const phenotypeHalfLifeH = (settings, phenotype) =>
  params({ ...settings, phenotype, halfLifeOverrideH: null }).halfLifeH;

// M4: choosing custom starts from the stored phenotype's half-life, to one
// decimal, so that nothing visibly jumps.
export const halfLifePrefill = (settings) =>
  Math.round(phenotypeHalfLifeH(settings, settings.phenotype) * 10) / 10;

// As intake.js reads a dose: digits, then at most one separator, "." or ",",
// and digits.
const PLAIN_DECIMAL = /^(?<whole>\d+)(?:[.,](?<fraction>\d+))?$/u;

const refused = (error) => ({ ok: false, error });

export const parseHalfLifeInput = (text) => {
  const trimmed = text.trim();
  if (trimmed === "") {
    return refused("empty");
  }
  const match = PLAIN_DECIMAL.exec(trimmed);
  if (match === null) {
    return refused("invalid");
  }
  // Decided on the text, before binary rounding could hide a digit:
  // "40,50" is 40.5, "40,5000000000000001" is not one decimal.
  const { whole, fraction = "" } = match.groups;
  const tenth = fraction.replace(/0+$/u, "");
  if (tenth.length > 1) {
    return refused("step");
  }
  const tenths = Number(whole) * 10 + Number(tenth);
  if (tenths < MIN_TENTHS || tenths > MAX_TENTHS) {
    return refused("range");
  }
  return { ok: true, h: tenths / 10 };
};

// Decision 5: the custom radio is checked while a custom half-life is set,
// and then no phenotype's is; each row's second line is its half-life in
// whole hours.
const modelView = (settings, { text, error }, locale) => {
  const custom = settings.halfLifeOverrideH !== null;
  return {
    legend: t(locale, "menu.model"),
    note: t(locale, "menu.modelNote"),
    phenotypes: PHENOTYPE_ORDER.map((phenotype) => ({
      phenotype,
      label: t(locale, `menu.phenotype.${phenotype}`),
      halfLife: t(locale, "menu.halfLife", {
        h: formatNumber(
          Math.round(phenotypeHalfLifeH(settings, phenotype)),
          locale,
        ),
      }),
      checked: !custom && settings.phenotype === phenotype,
    })),
    custom: { label: t(locale, "menu.custom"), checked: custom },
    field: {
      shown: custom,
      label: t(locale, "menu.customField"),
      hint: t(locale, "menu.customHint"),
      text,
      error: error === null ? null : t(locale, "error.halfLife"),
    },
  };
};

// Every text and state the open panel shows (decision 5), from the stored
// settings and the menu's state: the field's text is the menu's, not the
// document's, so that what is typed stays until it is committed.
export const menuView = (settings, menu, locale) => ({
  title: t(locale, "menu.title"),
  done: t(locale, "menu.done"),
  model: modelView(settings, menu.halfLife, locale),
  chart: {
    legend: t(locale, "menu.chart"),
    band: {
      label: t(locale, "menu.band"),
      note: t(locale, "menu.bandNote"),
      checked: settings.showRefRange,
    },
    doses: {
      label: t(locale, "menu.doses"),
      note: t(locale, "menu.dosesNote"),
      checked: settings.showPerDoseCurves,
    },
  },
  language: {
    legend: t(locale, "menu.language"),
    locales: LOCALES.map((code) => ({
      locale: code,
      label: t(locale, `menu.locale.${code}`),
      checked: settings.locale === code,
    })),
  },
});
