// utils/slugify.js

/**
 * Convierte un string en un slug amigable para URLs
 * Reemplaza espacios, quita tildes, símbolos raros, etc.
 * @param {string} text
 * @returns {string} slug formateado
 */
export function slugify(text) {
    if (!text) return "";
  
    return text
      .toString()
      .normalize("NFD")                    // Descompone tildes (á → a + ´)
      .replace(/[\u0300-\u036f]/g, "")    // Quita los acentos y diéresis
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")       // Quita caracteres no válidos
      .replace(/\s+/g, "-")               // Reemplaza espacios por guiones
      .replace(/-+/g, "-");               // Evita guiones dobles
  }
  