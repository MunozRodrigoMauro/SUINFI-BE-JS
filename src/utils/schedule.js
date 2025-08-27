// src/utils/schedule.js
const TZ = process.env.TZ || "America/Argentina/Buenos_Aires";

const DAY_KEYS = [
  "domingo","lunes","martes","miércoles","jueves","viernes","sábado",
];

function nowZoned() {
  const d = new Date();
  const hh = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", hour12: false, timeZone: TZ }).format(d);
  const mm = new Intl.DateTimeFormat("es-AR", { minute: "2-digit", timeZone: TZ }).format(d);
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: TZ }).format(d).toLowerCase();
  return { hhmm: `${hh}:${mm}`, weekday };
}

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const H = Number(m[1]), M = Number(m[2]);
  if (H < 0 || H > 23 || M < 0 || M > 59) return null;
  return H * 60 + M;
}

const strip = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function canonicalDayKey(k = "") {
  const s = strip(k);
  if (s === "miercoles") return "miércoles";
  if (s === "sabado")   return "sábado";
  return s;
}
function normalizeSchedule(scheduleLike) {
  const obj = scheduleLike instanceof Map ? Object.fromEntries(scheduleLike)
            : (typeof scheduleLike === "object" && scheduleLike) ? scheduleLike : {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const canon = canonicalDayKey(k);
    if (!canon) continue;
    out[canon] = v || {};
  }
  return out;
}

// ⬅️ fin EXCLUSIVO
function isTimeInRangeMin(nowMin, fromMin, toMin) {
  if (fromMin == null || toMin == null || nowMin == null) return false;
  if (fromMin < toMin) {
    // rango dentro del día: [from, to)
    return nowMin >= fromMin && nowMin < toMin;
  }
  // cruza medianoche: [from, 24h) ∪ [0, to)
  return nowMin >= fromMin || nowMin < toMin;
}

export default function isNowWithinSchedule(availabilitySchedule = {}) {
  const schedule = normalizeSchedule(availabilitySchedule);
  const { hhmm, weekday } = nowZoned();
  const dayKey = canonicalDayKey(weekday);
  if (!DAY_KEYS.includes(dayKey)) return false;

  const slot = schedule[dayKey];
  if (!slot || !slot.from || !slot.to) return false;

  const nowMin  = toMinutes(hhmm);
  const fromMin = toMinutes(slot.from);
  const toMin   = toMinutes(slot.to);
  if (fromMin == null || toMin == null || nowMin == null) return false;
  if (fromMin === toMin) return false;

  return isTimeInRangeMin(nowMin, fromMin, toMin);
}
