// utils/capitalizeWords.js

/**
 * Capitaliza la primera letra de cada palabra en un string
 * Compatible con tildes y caracteres en español
 * @param {string} str - Texto original
 * @returns {string} Texto capitalizado
 */
export function capitalizeWords(str) {
    if (!str) return "";
  
    return str
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .split(" ")
      .map(word => word.charAt(0).toLocaleUpperCase("es-AR") + word.slice(1))
      .join(" ");
  }
  