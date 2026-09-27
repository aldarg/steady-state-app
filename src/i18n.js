// Every user-facing string (CLAUDE.md), in Russian, the default, and English,
// with the same keys; and the formatters that turn a number or an instant into
// text. A key or a parameter that is missing throws: a missing text is a
// failing test, not a blank on screen. A no-break space (v1-07 decision 6) is
// written as its escape, \u00A0, and so is the word joiner after the strip's
// unit's slash, \u2060, where a browser may otherwise break: lint refuses an
// invisible character. v1-14 decisions 5 and 7: a no-break space precedes
// every spaced em dash, so that no line starts with one, and joins «на» to
// «экран» in the install hint.

export const STRINGS = Object.freeze({
  ru: Object.freeze({
    "app.name": "Steady State",
    "primary.label": "Отметить приём",
    "primary.other": "Другая доза или время…",
    "toast.logged": "Записано: {mg} в {time}",
    "toast.deleted": "Удалено: {mg} в {time}",
    "toast.undo": "Отменить",
    "dialog.duplicate": "Уже есть приём в {time}. Добавить ещё один?",
    "dialog.confirm": "Добавить",
    "dialog.cancel": "Отмена",
    "form.title": "Приём",
    "form.editTitle": "Изменить приём",
    "form.dose": "Доза, мг",
    "form.chips": "Частые дозы",
    "form.time": "Дата и время",
    "form.note": "Заметка (необязательно)",
    "form.noteCounter": "{count} из {max}",
    "form.save": "Сохранить",
    "form.cancel": "Отмена",
    "form.delete": "Удалить",
    "error.dose.empty": "Укажите дозу.",
    "error.dose.invalid": "Нужно число, например 10 или 2,5.",
    "error.dose.range": "Доза\u00A0— от 0,1 до 40 мг.",
    "error.dose.step": "Доза задаётся с шагом 0,1 мг.",
    "error.time.empty": "Укажите дату и время.",
    "error.time.invalid": "Такой даты или времени нет.",
    "error.time.future": "Это больше чем на час вперёд.",
    "error.note.tooLong": "Не больше {max} символов.",
    "warning.dose.aboveLabelMax":
      "Больше 20 мг\u00A0— выше максимальной дозы по инструкции. Проверьте значение.",
    "banner.notSaved": "Данные не сохраняются: хранилище недоступно.",
    "blocked.text":
      "Сохранённые данные не читаются. Они не изменены и не будут перезаписаны.",
    "unit.mg": "{mg} мг",
    "journal.title": "Журнал",
    "journal.today": "Сегодня",
    "journal.yesterday": "Вчера",
    "journal.row": "{time} · {dose}",
    "journal.rowNote": "{time} · {dose} · {note}",
    "journal.gapHours": "перерыв {h} ч",
    "journal.gapDays": "перерыв {d} д",
    "journal.gapDaysHours": "перерыв {d} д {h} ч",
    "chart.label": "Модельная оценка концентрации в плазме, нг/мл",
    "chart.axis": "нг/мл",
    "chart.band": "Референсный диапазон AGNP: 15–80 нг/мл",
    "chart.now": "сейчас",
    "chart.total": "Всего: {level}",
    "chart.intake": "Приём {time} ({mg}): {level}",
    "chart.empty": "График появится после первого приёма",
    "chart.presets": "Период",
    "chart.preset.7d": "7 д",
    "chart.preset.30d": "30 д",
    "chart.preset.90d": "90 д",
    "chart.preset.1y": "1 г",
    "chart.preset.all": "Всё",
    "unit.level": "{value} нг/мл",
    "unit.levelBelow": "< {value} нг/мл",
    "summary.now": "Сейчас",
    "summary.last": "Последний приём",
    "summary.steady": "Стабильный уровень",
    "summary.level": "≈\u00A0{value} нг/\u2060мл",
    "summary.levelBelow": "<\u00A0{value} нг/\u2060мл",
    "summary.lastLine": "{time}\u00A0· {mg}\u00A0мг",
    "summary.steadyReached": "достигнут",
    "summary.steadyHours": "через ≈\u00A0{h}\u00A0ч",
    "summary.steadyDays.one": "через ≈\u00A0{d}\u00A0день",
    "summary.steadyDays.few": "через ≈\u00A0{d}\u00A0дня",
    "summary.steadyDays.many": "через ≈\u00A0{d}\u00A0дней",
    "summary.steadyDays.other": "через ≈\u00A0{d}\u00A0дня",
    "menu.title": "Настройки",
    "menu.done": "Готово",
    "menu.model": "Модель",
    "menu.modelNote":
      "Эсциталопрам выводится в основном ферментом CYP2C19. Его активность наследуется и определяется генетическим анализом. Если вы не знаете свой тип, оставьте «Нормальный».",
    "menu.phenotype.UM": "Ультрабыстрый (UM)",
    "menu.phenotype.NM": "Нормальный (NM)",
    "menu.phenotype.IM": "Промежуточный (IM)",
    "menu.phenotype.PM": "Медленный (PM)",
    "menu.halfLife": "t½ ≈\u00A0{h}\u00A0ч",
    "menu.custom": "Свой период полувыведения",
    "menu.customField": "t½, ч",
    "menu.customHint": "от 10 до 150",
    "error.halfLife": "От 10 до 150 ч, не больше одного знака после запятой.",
    "menu.chart": "График",
    "menu.band": "Референсный диапазон",
    "menu.bandNote": "15–80 нг/мл, консенсус AGNP по ТЛМ",
    "menu.doses": "Кривые отдельных приёмов",
    "menu.dosesNote": "Видны на периодах до 90 дней",
    "menu.language": "Язык",
    "menu.locale.ru": "Русский",
    "menu.locale.en": "English",
    "backup.title": "Резервная копия",
    "backup.last": "Последняя копия",
    "backup.none": "Копий ещё не было",
    "backup.lastToday": "{day}, {time}",
    "backup.save": "Сохранить копию",
    "backup.saveNote": "JSON, все данные",
    "backup.csv": "Экспорт в CSV",
    "backup.csvNote": "для таблиц",
    "backup.import": "Восстановить из файла…",
    "backup.importNote": "заменить или объединить",
    "import.span": "с {from} по {to}",
    "import.summary.one": "В файле {n} приём, {span}.",
    "import.summary.few": "В файле {n} приёма, {span}.",
    "import.summary.many": "В файле {n} приёмов, {span}.",
    "import.summary.other": "В файле {n} приёма, {span}.",
    "import.empty": "В файле нет приёмов.",
    "import.mergeLine":
      "Объединить: добавится {added}, уже есть {already}, повторов пропущено {skipped}. Настройки на устройстве не изменятся.",
    "import.replaceLine.one":
      "Заменить: на устройстве будет ровно то, что в файле, {n} приём вместо {local} и настройки из файла.",
    "import.replaceLine.few":
      "Заменить: на устройстве будет ровно то, что в файле, {n} приёма вместо {local} и настройки из файла.",
    "import.replaceLine.many":
      "Заменить: на устройстве будет ровно то, что в файле, {n} приёмов вместо {local} и настройки из файла.",
    "import.replaceLine.other":
      "Заменить: на устройстве будет ровно то, что в файле, {n} приёма вместо {local} и настройки из файла.",
    "import.merge": "Объединить",
    "import.replace": "Заменить",
    "import.rejected":
      "Файл не подходит: это не резервная копия Steady State или она повреждена.",
    "import.ok": "Понятно",
    "recovery.saveText": "Сохранить текст в файл",
    "recovery.saveTextNote": "{filename}\u00A0— чтобы разобраться вручную",
    "recovery.restore": "Восстановить из копии…",
    "recovery.restoreNote": "из файла резервной копии (JSON)",
    "recovery.startFresh": "Начать заново",
    "recovery.startFreshNote": "сохранённые данные будут удалены",
    "recovery.restoreQuestion": "{summary} Восстановить?",
    "recovery.restoreConfirm": "Восстановить",
    "recovery.freshQuestion":
      "Сохранённые данные будут удалены насовсем. Сначала сохранить их в файл?",
    "recovery.freshSave": "Сохранить в файл",
    "recovery.freshDelete": "Удалить и начать заново",
    "toast.imported.one": "Добавлен {n} приём",
    "toast.imported.few": "Добавлено {n} приёма",
    "toast.imported.many": "Добавлено {n} приёмов",
    "toast.imported.other": "Добавлено {n} приёма",
    "toast.importedNone": "Новых приёмов нет",
    "toast.replaced.one": "Данные заменены: {n} приём",
    "toast.replaced.few": "Данные заменены: {n} приёма",
    "toast.replaced.many": "Данные заменены: {n} приёмов",
    "toast.replaced.other": "Данные заменены: {n} приёма",
    "install.text":
      "Добавьте приложение на\u00A0экран «Домой»: iOS может удалить данные сайта, если не открывать его 7\u00A0дней.",
    "install.how": "Нажмите «Поделиться», затем «На\u00A0экран „Домой“».",
    "install.move":
      "Там приложение откроется с пустым журналом. Сохраните копию здесь и восстановите её там: Настройки → Восстановить из файла…",
    "install.close": "Скрыть подсказку",
    "intro.title": "Прежде чем начать",
    "intro.lead":
      "Здесь ведётся журнал приёмов эсциталопрама, а график показывает модельную концентрацию в крови.",
    "intro.text":
      "Это модельная оценка по средним популяционным параметрам, а не измеренная концентрация. Индивидуальные значения могут отличаться в 1,5–2\u00A0раза и больше. Не используйте для решений о дозировке\u00A0— обсуждайте их с врачом.",
    "intro.ok": "Понятно",
    "footer.text":
      "Модельная оценка, а не измеренная концентрация. Не используйте для решений о дозировке.",
    "footer.more": "Подробнее",
    "reminder.none":
      "Резервной копии ещё не было. Сохраните её, чтобы журнал не потерялся.",
    "reminder.old":
      "Последняя резервная копия\u00A0— {date}. Сохраните новую, чтобы не потерять свежие записи.",
    "reminder.close": "Скрыть напоминание",
  }),
  en: Object.freeze({
    "app.name": "Steady State",
    "primary.label": "Log intake",
    "primary.other": "Another dose or time…",
    "toast.logged": "Logged: {mg} at {time}",
    "toast.deleted": "Deleted: {mg} at {time}",
    "toast.undo": "Undo",
    "dialog.duplicate": "There is already an intake at {time}. Add another?",
    "dialog.confirm": "Add",
    "dialog.cancel": "Cancel",
    "form.title": "Intake",
    "form.editTitle": "Edit intake",
    "form.dose": "Dose, mg",
    "form.chips": "Common doses",
    "form.time": "Date and time",
    "form.note": "Note (optional)",
    "form.noteCounter": "{count} of {max}",
    "form.save": "Save",
    "form.cancel": "Cancel",
    "form.delete": "Delete",
    "error.dose.empty": "Enter a dose.",
    "error.dose.invalid": "Enter a number, such as 10 or 2.5.",
    "error.dose.range": "The dose must be from 0.1 to 40 mg.",
    "error.dose.step": "Doses go in steps of 0.1 mg.",
    "error.time.empty": "Enter a date and time.",
    "error.time.invalid": "There is no such date or time.",
    "error.time.future": "This is more than an hour from now.",
    "error.note.tooLong": "Use at most {max} characters.",
    "warning.dose.aboveLabelMax":
      "More than 20 mg is above the label's maximum dose. Please check the value.",
    "banner.notSaved": "Your data is not being saved: storage is unavailable.",
    "blocked.text":
      "The saved data cannot be read. It has not been changed and will not be overwritten.",
    "unit.mg": "{mg} mg",
    "journal.title": "Journal",
    "journal.today": "Today",
    "journal.yesterday": "Yesterday",
    "journal.row": "{time} · {dose}",
    "journal.rowNote": "{time} · {dose} · {note}",
    "journal.gapHours": "gap {h} h",
    "journal.gapDays": "gap {d} d",
    "journal.gapDaysHours": "gap {d} d {h} h",
    "chart.label": "Modelled plasma level, ng/mL",
    "chart.axis": "ng/mL",
    "chart.band": "AGNP reference range: 15–80 ng/mL",
    "chart.now": "now",
    "chart.total": "Total: {level}",
    "chart.intake": "Intake {time} ({mg}): {level}",
    "chart.empty": "The chart appears after the first intake",
    "chart.presets": "Range",
    "chart.preset.7d": "7 d",
    "chart.preset.30d": "30 d",
    "chart.preset.90d": "90 d",
    "chart.preset.1y": "1 y",
    "chart.preset.all": "All",
    "unit.level": "{value} ng/mL",
    "unit.levelBelow": "< {value} ng/mL",
    "summary.now": "Now",
    "summary.last": "Last intake",
    "summary.steady": "Steady level",
    "summary.level": "≈\u00A0{value} ng/\u2060mL",
    "summary.levelBelow": "<\u00A0{value} ng/\u2060mL",
    "summary.lastLine": "{time}\u00A0· {mg}\u00A0mg",
    "summary.steadyReached": "reached",
    "summary.steadyHours": "in ≈\u00A0{h}\u00A0h",
    "summary.steadyDays.one": "in ≈\u00A0{d}\u00A0day",
    "summary.steadyDays.few": "in ≈\u00A0{d}\u00A0days",
    "summary.steadyDays.many": "in ≈\u00A0{d}\u00A0days",
    "summary.steadyDays.other": "in ≈\u00A0{d}\u00A0days",
    "menu.title": "Settings",
    "menu.done": "Done",
    "menu.model": "Model",
    "menu.modelNote":
      "Escitalopram is cleared mainly by the enzyme CYP2C19. Its activity is inherited and is determined by a genetic test. If you don't know your type, keep “Normal”.",
    "menu.phenotype.UM": "Ultrarapid (UM)",
    "menu.phenotype.NM": "Normal (NM)",
    "menu.phenotype.IM": "Intermediate (IM)",
    "menu.phenotype.PM": "Poor (PM)",
    "menu.halfLife": "t½ ≈\u00A0{h}\u00A0h",
    "menu.custom": "Custom half-life",
    "menu.customField": "t½, h",
    "menu.customHint": "from 10 to 150",
    "error.halfLife": "From 10 to 150 h, with at most one decimal.",
    "menu.chart": "Chart",
    "menu.band": "Reference range",
    "menu.bandNote": "15–80 ng/mL, AGNP TDM consensus",
    "menu.doses": "Per-intake curves",
    "menu.dosesNote": "Shown on ranges up to 90 days",
    "menu.language": "Language",
    "menu.locale.ru": "Русский",
    "menu.locale.en": "English",
    "backup.title": "Backup",
    "backup.last": "Last backup",
    "backup.none": "No backups yet",
    "backup.lastToday": "{day}, {time}",
    "backup.save": "Save a backup",
    "backup.saveNote": "JSON, all data",
    "backup.csv": "Export to CSV",
    "backup.csvNote": "for spreadsheets",
    "backup.import": "Restore from a file…",
    "backup.importNote": "replace or merge",
    "import.span": "from {from} to {to}",
    "import.summary.one": "The file has {n} intake, {span}.",
    "import.summary.few": "The file has {n} intakes, {span}.",
    "import.summary.many": "The file has {n} intakes, {span}.",
    "import.summary.other": "The file has {n} intakes, {span}.",
    "import.empty": "The file has no intakes.",
    "import.mergeLine":
      "Merge: {added} new, {already} already here, {skipped} skipped (same time and dose). The settings on this device won't change.",
    "import.replaceLine.one":
      "Replace: this device will hold exactly what the file holds, {n} intake instead of {local}, and the file's settings.",
    "import.replaceLine.few":
      "Replace: this device will hold exactly what the file holds, {n} intakes instead of {local}, and the file's settings.",
    "import.replaceLine.many":
      "Replace: this device will hold exactly what the file holds, {n} intakes instead of {local}, and the file's settings.",
    "import.replaceLine.other":
      "Replace: this device will hold exactly what the file holds, {n} intakes instead of {local}, and the file's settings.",
    "import.merge": "Merge",
    "import.replace": "Replace",
    "import.rejected":
      "This file can't be used: it isn't a Steady State backup, or it is damaged.",
    "import.ok": "OK",
    "recovery.saveText": "Save the text to a file",
    "recovery.saveTextNote": "{filename}\u00A0— to sort out by hand",
    "recovery.restore": "Restore from a backup…",
    "recovery.restoreNote": "from a backup file (JSON)",
    "recovery.startFresh": "Start over",
    "recovery.startFreshNote": "the saved data will be deleted",
    "recovery.restoreQuestion": "{summary} Restore it?",
    "recovery.restoreConfirm": "Restore",
    "recovery.freshQuestion":
      "The saved data will be deleted for good. Save it to a file first?",
    "recovery.freshSave": "Save to a file",
    "recovery.freshDelete": "Delete and start over",
    "toast.imported.one": "Added {n} intake",
    "toast.imported.few": "Added {n} intakes",
    "toast.imported.many": "Added {n} intakes",
    "toast.imported.other": "Added {n} intakes",
    "toast.importedNone": "No new intakes",
    "toast.replaced.one": "Data replaced: {n} intake",
    "toast.replaced.few": "Data replaced: {n} intakes",
    "toast.replaced.many": "Data replaced: {n} intakes",
    "toast.replaced.other": "Data replaced: {n} intakes",
    "install.text":
      "Add the app to your Home Screen: iOS may delete a site's data if it isn't opened for 7\u00A0days.",
    "install.how": "Tap Share, then Add to Home Screen.",
    "install.move":
      "There, the app opens with an empty journal. Save a backup here and restore it there: Settings → Restore from a file…",
    "install.close": "Hide this tip",
    "intro.title": "Before you start",
    "intro.lead":
      "This app keeps a log of your escitalopram intakes, and the chart shows a modelled blood concentration.",
    "intro.text":
      "This is a model estimate based on average population parameters, not a measured concentration. Individual values can differ by a factor of 1.5–2 or more. Do not use it for dosing decisions\u00A0— discuss them with your doctor.",
    "intro.ok": "Got it",
    "footer.text":
      "A model estimate, not a measured concentration. Do not use it for dosing decisions.",
    "footer.more": "More",
    "reminder.none":
      "No backup has been saved yet. Save one so the journal isn't lost.",
    "reminder.old":
      "The last backup was on {date}. Save a new one so recent entries aren't lost.",
    "reminder.close": "Hide this reminder",
  }),
});

const PLACEHOLDER = /\{(?<name>[^{}]*)\}/gu;

const stringsOf = (locale) => {
  if (!Object.hasOwn(STRINGS, locale)) {
    throw new RangeError(`no strings for the locale ${locale}`);
  }
  return STRINGS[locale];
};

export const t = (locale, key, params = {}) => {
  const strings = stringsOf(locale);
  if (!Object.hasOwn(strings, key)) {
    throw new RangeError(`no string ${key} in ${locale}`);
  }
  return strings[key].replaceAll(PLACEHOLDER, (placeholder) => {
    const name = placeholder.slice(1, -1);
    if (!Object.hasOwn(params, name)) {
      throw new TypeError(`${locale} ${key} needs the parameter ${name}`);
    }
    return String(params[name]);
  });
};

// v1-04 decision 1: every formatter is built once per locale, zone and
// options, and reused; the journal formats every intake at each draw.
const formatters = new Map();

const reused = (key, build) => {
  if (!formatters.has(key)) {
    formatters.set(key, build());
  }
  return formatters.get(key);
};

// v1-07 decision 6: the string of the count's plural category in the
// locale, `${key}.one`, `.few`, `.many` or `.other`; a category the locale
// lacks throws as a missing key does.
export const tPlural = (locale, key, count, params) => {
  stringsOf(locale);
  const rules = reused(`plural ${locale}`, () => new Intl.PluralRules(locale));
  return t(locale, `${key}.${rules.select(count)}`, params);
};

// Decision 2, round 2: 15 significant digits, so that float noise such as
// 0.1 + 0.2 does not show, and scientific notation below 0.001, so that no
// positive dose the store accepts reads as 0. Zero itself reads as 0 (v1-05:
// the chart's y-axis starts there).
const SIGNIFICANT_DIGITS = 15;
const SCIENTIFIC_BELOW = 0.001;

export const formatNumber = (value, locale) => {
  stringsOf(locale);
  const notation =
    value > 0 && value < SCIENTIFIC_BELOW ? "scientific" : "standard";
  const format = reused(
    `number ${locale} ${notation}`,
    () =>
      new Intl.NumberFormat(locale, {
        numberingSystem: "latn",
        useGrouping: false,
        maximumSignificantDigits: SIGNIFICANT_DIGITS,
        notation,
      }),
  );
  return format.format(value);
};

export const formatMg = (mg, locale) =>
  t(locale, "unit.mg", { mg: formatNumber(mg, locale) });

// Without this, Intl would format a missing instant as now: a clock read.
const requireMs = (ms) => {
  if (!Number.isFinite(ms)) {
    throw new TypeError(`an instant must be a finite number of ms, got ${ms}`);
  }
};

const partsOf = (format, ms) =>
  Object.fromEntries(
    format.formatToParts(ms).map(({ type, value }) => [type, value]),
  );

// 24-hour HH:mm in `timeZone`, assembled from parts so that no locale's
// separator or day period gets in.
export const formatTime = (ms, locale, timeZone) => {
  stringsOf(locale);
  requireMs(ms);
  const format = reused(
    `time ${locale} ${timeZone}`,
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone,
        numberingSystem: "latn",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
  );
  const { hour, minute } = partsOf(format, ms);
  return `${hour}:${minute}`;
};

// The calendar date of `ms` in `timeZone`, as numbers. The era is asked for
// because Intl writes year 0 as 1 BC, where ISO 8601 counts it as 0000.
const localDate = (ms, timeZone) => {
  const format = reused(
    `date ${timeZone}`,
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        calendar: "gregory",
        numberingSystem: "latn",
        era: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
  );
  const parts = partsOf(format, ms);
  const year = Number(parts.year);
  return {
    year: parts.era === "BC" ? 1 - year : year,
    month: Number(parts.month),
    day: Number(parts.day),
  };
};

const pad = (number, width = 2) => String(number).padStart(width, "0");

// v1-04 decision 1: the local calendar date, as YYYY-MM-DD.
export const localDay = (ms, timeZone) => {
  requireMs(ms);
  const { year, month, day } = localDate(ms, timeZone);
  const sign = year < 0 ? "-" : "";
  return `${sign}${pad(Math.abs(year), 4)}-${pad(month)}-${pad(day)}`;
};

const DAY_MS = 86_400_000;

// v1-04 decision 1's heading: the weekday, the day and the month, with the
// year when asked for.
const headingFormat = (locale, timeZone, withYear) =>
  reused(
    `heading ${locale} ${timeZone} ${withYear}`,
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "long",
        timeZone,
        ...(withYear ? { year: "numeric" } : {}),
      }),
  );

// A calendar date as a count of days, so that days compare as dates: a
// local day is 23 or 25 h long across a daylight-saving change.
const dayNumber = ({ year, month, day }) =>
  new Date(0).setUTCFullYear(year, month - 1, day) / DAY_MS;

// v1-04 decision 1: today, yesterday, or the weekday and the date, with the
// year only when it is not now's.
export const formatDayHeading = (ms, nowMs, locale, timeZone) => {
  stringsOf(locale);
  requireMs(ms);
  requireMs(nowMs);
  const date = localDate(ms, timeZone);
  const today = localDate(nowMs, timeZone);
  const daysAgo = dayNumber(today) - dayNumber(date);
  if (daysAgo === 0) {
    return t(locale, "journal.today");
  }
  if (daysAgo === 1) {
    return t(locale, "journal.yesterday");
  }
  return headingFormat(locale, timeZone, date.year !== today.year).format(ms);
};

// v1-09 decision 8: a date with its year, for an import's span. Russian is
// assembled from Intl's parts, which would end in "г."; English is as Intl
// writes it.
const DATE_LABELS = Object.freeze({
  ru: (format, ms) => {
    const { day, month, year } = partsOf(format, ms);
    return `${day} ${month} ${year}`;
  },
  en: (format, ms) => format.format(ms),
});

export const formatDate = (ms, locale, timeZone) => {
  stringsOf(locale);
  requireMs(ms);
  const format = reused(
    `fullDate ${locale} ${timeZone}`,
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone,
        numberingSystem: "latn",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
  );
  return DATE_LABELS[locale](format, ms);
};

// v1-05 decision 8: the tooltip's moment, as a day heading that never says
// today, then the time.
export const formatMoment = (ms, nowMs, locale, timeZone) => {
  requireMs(ms);
  requireMs(nowMs);
  const withYear =
    localDate(ms, timeZone).year !== localDate(nowMs, timeZone).year;
  const date = headingFormat(locale, timeZone, withYear).format(ms);
  return `${date}, ${formatTime(ms, locale, timeZone)}`;
};

// v1-05 decision 7: a level to one decimal, as Intl rounds it; from 10 on,
// decided on that rounded text, the whole number; below 0.05, "< 0.1".
const LEVEL_BELOW = 0.05;
const LEVEL_WHOLE_FROM = 10;

const levelFormat = (locale, digits) =>
  reused(
    `level ${locale} ${digits}`,
    () =>
      new Intl.NumberFormat(locale, {
        numberingSystem: "latn",
        useGrouping: false,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
  );

// v1-07 decision 2: the level's number without its unit, and whether it is
// the bound, so that the summary strip can write it with its own keys.
export const levelNumber = (value, locale) => {
  stringsOf(locale);
  const tenths = levelFormat(locale, 1);
  if (value < LEVEL_BELOW) {
    return { below: true, text: tenths.format(0.1) };
  }
  const parts = partsOf(tenths, value);
  const text =
    Number(parts.integer) >= LEVEL_WHOLE_FROM
      ? levelFormat(locale, 0).format(value)
      : tenths.format(value);
  return { below: false, text };
};

export const formatLevel = (value, locale) => {
  const { below, text } = levelNumber(value, locale);
  return t(locale, below ? "unit.levelBelow" : "unit.level", { value: text });
};

// v1-05 decision 6: an x-axis tick's label, by the density of its axis. The
// parts are assembled where Intl would add a comma or "г.".
const TICK_OPTIONS = Object.freeze({
  day: { weekday: "short", day: "numeric" },
  week: { day: "numeric", month: "short" },
  month: { month: "short" },
  monthYear: { month: "short", year: "numeric" },
  year: { year: "numeric" },
});

const tickFormat = (kind, locale, timeZone) =>
  reused(
    `tick ${kind} ${locale} ${timeZone}`,
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone,
        numberingSystem: "latn",
        ...TICK_OPTIONS[kind],
      }),
  );

const monthYear = (ms, locale, timeZone) => {
  const { month, year } = partsOf(
    tickFormat("monthYear", locale, timeZone),
    ms,
  );
  return `${month} ${year}`;
};

const TICK_LABELS = Object.freeze({
  day: (ms, locale, timeZone) => {
    const { weekday, day } = partsOf(tickFormat("day", locale, timeZone), ms);
    return `${weekday} ${day}`;
  },
  week: (ms, locale, timeZone) =>
    tickFormat("week", locale, timeZone).format(ms),
  month: (ms, locale, timeZone) =>
    localDate(ms, timeZone).month === 1
      ? monthYear(ms, locale, timeZone)
      : tickFormat("month", locale, timeZone).format(ms),
  quarter: monthYear,
  year: (ms, locale, timeZone) =>
    partsOf(tickFormat("year", locale, timeZone), ms).year,
});

export const formatTick = (ms, density, locale, timeZone) => {
  stringsOf(locale);
  return TICK_LABELS[density](ms, locale, timeZone);
};
