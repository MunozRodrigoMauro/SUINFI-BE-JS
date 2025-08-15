// src/utils/schedule.js
// Determina si la hora actual (en el huso horario elegido) cae dentro del
// bloque de disponibilidad configurado para el día de hoy.
//
// availabilitySchedule esperado (ejemplo):
// {
//   lunes:     { from: "09:00", to: "18:00" },
//   miércoles: { from: "14:00", to: "20:30" },
//   sábado:    { from: "10:00", to: "14:00" }
// }

const TZ = process.env.TZ || "America/Argentina/Buenos_Aires";

// Obtiene "HH:MM" de la hora actual en la TZ deseada
function nowHHMM() {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
  // Formato "HH:MM"
  return formatter.format(new Date());
}

// Obtiene el nombre del día en español en la TZ deseada ("lunes", "martes", "miércoles"...)
function todayKeyES() {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    timeZone: TZ,
  });
  // toLowerCase para empatar claves como "miércoles"
  return formatter.format(new Date()).toLowerCase();
}

// Compara rangos "HH:MM". Soporta rangos que cruzan medianoche (p.ej. 22:00 -> 02:00).
function isTimeInRange(current, from, to) {
  // Casos normales (no cruza medianoche): from <= to
  if (from <= to) {
    return current >= from && current < to;
  }
  // Caso cruza medianoche: from > to (ej: 22:00 a 02:00)
  // Está dentro si es >= from (misma noche) o < to (madrugada)
  return current >= from || current < to;
}

/**
 * Devuelve true/false si AHORA cae dentro del horario del día actual.
 * @param {Object} availabilitySchedule - Mapa de días -> { from, to }
 * @returns {boolean}
 */
export default function isNowWithinSchedule(availabilitySchedule = {}) {
  if (!availabilitySchedule || typeof availabilitySchedule !== "object") return false;

  const day = todayKeyES();       // ej: "miércoles"
  const slot = availabilitySchedule[day];
  if (!slot || !slot.from || !slot.to) return false;

  const now = nowHHMM();          // ej: "15:37"
  const from = slot.from.trim();  // "HH:MM"
  const to = slot.to.trim();      // "HH:MM"

  // Validación simple de formato HH:MM
  const re = /^\d{2}:\d{2}$/;
  if (!re.test(from) || !re.test(to)) return false;

  return isTimeInRange(now, from, to);
}