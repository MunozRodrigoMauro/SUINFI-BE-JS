// Utilidades mínimas para formatear fecha/hora y estados
export const formatDateTime = (iso) => {
    try {
      if (!iso) return "-";
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch {
      return iso;
    }
  };
  
  export const STATUS_LABEL = {
    pending: "Pendiente",
    accepted: "Aceptada",
    rejected: "Rechazada",
    completed: "Completada",
    canceled: "Cancelada",
  };
  
  export const canClientCancel = (status) => ["pending", "accepted"].includes(status);
  export const canProComplete = (status) => status === "accepted";