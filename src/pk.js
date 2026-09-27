// The PK engine of SPEC §4: one compartment, first-order absorption and
// elimination, superposed over doses. Pure: no DOM, no clock, no randomness,
// importable from Node. Times are UTC ms at the API and hours inside;
// concentrations are ng/mL.

const HOUR_MS = 3_600_000;
const CUTOFF_HALF_LIVES = 10;

export const DEFAULTS = Object.freeze({
  V: 1100,
  CL: 25,
  ka: 1,
  phenotypeMultipliers: Object.freeze({ UM: 1.3, NM: 1, IM: 0.75, PM: 0.5 }),
});

const show = (value) =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

const requirePositive = (value, field) => {
  if (typeof value !== "number") {
    throw new TypeError(`${field} must be a number, got ${show(value)}`);
  }
  if (!(Number.isFinite(value) && value > 0)) {
    throw new RangeError(`${field} must be finite and > 0, got ${show(value)}`);
  }
};

const requireFinite = (value, field) => {
  if (typeof value !== "number") {
    throw new TypeError(`${field} must be a number, got ${show(value)}`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`${field} must be finite, got ${value}`);
  }
};

// Decision 4: up to 1000 mg, no product in concAt overflows for any finite s.
const MAX_MG = 1000;

const requireMg = (value, field) => {
  requirePositive(value, field);
  if (value > MAX_MG) {
    throw new RangeError(`${field} must be at most ${MAX_MG}, got ${value}`);
  }
};

// Ten half-lives of the slower phase: when ke > ka the tail follows ka.
const cutoffHours = (p) =>
  CUTOFF_HALF_LIVES * Math.max(p.halfLifeH, Math.LN2 / p.ka);

const withOverride = (halfLifeH) => {
  requirePositive(halfLifeH, "halfLifeOverrideH");
  const { V, ka } = DEFAULTS;
  const ke = Math.LN2 / halfLifeH;
  const CL = ke * V;
  if (!Number.isFinite(CL)) {
    throw new RangeError(
      `halfLifeOverrideH ${halfLifeH} gives a clearance that is not finite`,
    );
  }
  const p = { V, CL, ka, ke, halfLifeH };
  if (!Number.isFinite(cutoffHours(p))) {
    throw new RangeError(
      `halfLifeOverrideH ${halfLifeH} gives a cutoff that is not finite`,
    );
  }
  return p;
};

const withPhenotype = (phenotype) => {
  const { V, ka, phenotypeMultipliers } = DEFAULTS;
  if (typeof phenotype !== "string") {
    throw new TypeError(`phenotype must be a string, got ${show(phenotype)}`);
  }
  if (!Object.hasOwn(phenotypeMultipliers, phenotype)) {
    throw new RangeError(
      `phenotype must be one of ${Object.keys(phenotypeMultipliers).join(", ")}, got ${show(phenotype)}`,
    );
  }
  const CL = DEFAULTS.CL * phenotypeMultipliers[phenotype];
  const ke = CL / V;
  return { V, CL, ka, ke, halfLifeH: Math.LN2 / ke };
};

export const params = (settings) =>
  Object.freeze(
    settings.halfLifeOverrideH === null
      ? withPhenotype(settings.phenotype)
      : withOverride(settings.halfLifeOverrideH),
  );

// SPEC's formula, rearranged: the smaller rate's exponential is factored out,
// so no intermediate overflows, and expm1 keeps close rates from cancelling.
// Equal rates, where SPEC's formula divides by zero, take its limit, with
// s · e^(−ka·s) formed first so that no product overflows for any finite s.
// The dose meets 1000 / V, not 1000, and the gap divides expm1 before the
// small exponential joins. With mg ≤ 1000 no product overflows for any finite
// s. No accuracy is promised below 1e-290 ng/mL, since an intermediate can
// underflow at either end: e^(−min·s) at a large s, |ka−ke|·s at a tiny one.
const concAt = (mg, hours, { V, ka, ke }) => {
  const scale = mg * (1000 / V);
  if (ka === ke) {
    return scale * ka * (hours * Math.exp(-ka * hours));
  }
  const gap = Math.abs(ka - ke);
  return (
    scale *
    ka *
    (-Math.expm1(-gap * hours) / gap) *
    Math.exp(-Math.min(ka, ke) * hours)
  );
};

export const concSingle = (mg, hoursSince, p) => {
  requireMg(mg, "mg");
  requireFinite(hoursSince, "hoursSince");
  return hoursSince < 0 ? 0 : concAt(mg, hoursSince, p);
};

// Decision 6: doses arrive as the store keeps them, in any order. Each call
// parses and sorts its own copy; a dose it cannot read is a bug worth seeing.
const readDose = (dose, index, seen) => {
  if (typeof dose !== "object" || dose === null) {
    throw new TypeError(`doses[${index}] must be an object, got ${show(dose)}`);
  }
  const { id, takenAt, mg } = dose;
  const name = `doses[${index}] (id ${show(id)})`;
  if (typeof id !== "string") {
    throw new TypeError(`${name}: id must be a string`);
  }
  if (id === "") {
    throw new RangeError(`${name}: id must not be empty`);
  }
  if (seen.has(id)) {
    throw new RangeError(`${name}: id is also doses[${seen.get(id)}]'s`);
  }
  seen.set(id, index);
  if (typeof takenAt !== "string") {
    throw new TypeError(
      `${name}: takenAt must be a string, got ${show(takenAt)}`,
    );
  }
  const ms = Date.parse(takenAt);
  if (!(Number.isFinite(ms) && new Date(ms).toISOString() === takenAt)) {
    throw new RangeError(
      `${name}: takenAt must be UTC ISO 8601 as toISOString() writes it, got ${show(takenAt)}`,
    );
  }
  requireMg(mg, `${name}: mg`);
  return { id, ms, mg };
};

const readDoses = (doses) => {
  if (!Array.isArray(doses)) {
    throw new TypeError(`doses must be an array, got ${show(doses)}`);
  }
  const seen = new Map();
  return doses.map((dose, index) => readDose(dose, index, seen));
};

// Ties are broken by id, so the order, and every sum, is the same for any
// order of the input.
const byTakenAt = (a, b) => a.ms - b.ms || (a.id < b.id ? -1 : 1);

const sortedDoses = (doses) => readDoses(doses).sort(byTakenAt);

const isExpired = (ms, t, cutoffH) => (t - ms) / HOUR_MS > cutoffH;

export const concTotal = (doses, tMs, p) => {
  requireFinite(tMs, "tMs");
  const sorted = sortedDoses(doses);
  const cutoffH = cutoffHours(p);
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (isExpired(sorted[middle].ms, tMs, cutoffH)) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  let total = 0;
  for (let i = low; i < sorted.length && sorted[i].ms <= tMs; i += 1) {
    const { mg, ms } = sorted[i];
    total += concAt(mg, (tMs - ms) / HOUR_MS, p);
  }
  return total;
};

const MAX_POINTS = 100_000;

// Decision 8: fromMs + k·stepMs up to toMs, then toMs itself if the grid
// missed it; one instant is one point. Every point is later than the last, so
// a step below float resolution at this magnitude throws instead of repeating
// t. The loop stops one point past the cap, so a bad step costs little.
const gridTimes = (fromMs, toMs, stepMs) => {
  requireFinite(fromMs, "fromMs");
  requireFinite(toMs, "toMs");
  requirePositive(stepMs, "stepMs");
  if (toMs < fromMs) {
    throw new RangeError(`toMs ${toMs} is before fromMs ${fromMs}`);
  }
  if (fromMs === toMs) {
    return [fromMs];
  }
  const times = [fromMs];
  for (
    let k = 1;
    fromMs + k * stepMs <= toMs && times.length <= MAX_POINTS;
    k += 1
  ) {
    const t = fromMs + k * stepMs;
    if (t <= times.at(-1)) {
      throw new RangeError(
        `stepMs ${stepMs} is too small to move t past ${times.at(-1)}`,
      );
    }
    times.push(t);
  }
  if (times.at(-1) < toMs) {
    times.push(toMs);
  }
  if (times.length > MAX_POINTS) {
    throw new RangeError(
      `a series is at most ${MAX_POINTS} points; this range and step give more`,
    );
  }
  return times;
};

// The window of doses slides forward with t: `next` passes each dose at its
// intake, `oldest` past it at the cutoff. Cost is points × doses in window.
export const series = (doses, fromMs, toMs, stepMs, p) => {
  const times = gridTimes(fromMs, toMs, stepMs);
  const sorted = sortedDoses(doses);
  const cutoffH = cutoffHours(p);
  let oldest = 0;
  let next = 0;
  return times.map((t) => {
    while (next < sorted.length && sorted[next].ms <= t) {
      next += 1;
    }
    while (oldest < next && isExpired(sorted[oldest].ms, t, cutoffH)) {
      oldest += 1;
    }
    const perDose = new Map();
    let total = 0;
    for (let i = oldest; i < next; i += 1) {
      const { id, mg, ms } = sorted[i];
      const c = concAt(mg, (t - ms) / HOUR_MS, p);
      perDose.set(id, c);
      total += c;
    }
    return { t, total, perDose };
  });
};
