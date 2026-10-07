// ============================================================================
// FORMATO · helpers compartidos
// ============================================================================

/** Para búsquedas: sin acentos y en minúsculas. */
export const normalizar = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Los COUNT de PostgreSQL llegan como texto: siempre a número, con respaldo. */
export const conteo = (v: number | string | null | undefined) =>
    v === undefined || v === null || v === "" ? null : Number(v);

/**
 * "AAAA-MM-DD" de lo que mande el backend (DATE o ISO completo).
 * Se corta el texto en vez de usar new Date(): convertir con la zona del
 * navegador puede recorrer la fecha un día.
 */
export const soloFecha = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : "");

/** "05/10/2026" sin pasar por new Date(). */
export const fechaCorta = (v: string | null | undefined) => {
    const f = soloFecha(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return f || "—";
    const [a, m, d] = f.split("-");
    return `${d}/${m}/${a}`;
};

/** "14:30" de un TIME de PostgreSQL ("14:30:00"). */
export const horaCorta = (v: string | null | undefined) => (v ? String(v).slice(0, 5) : "");

/** Fecha de hoy en la zona del navegador, como "AAAA-MM-DD". */
export const hoyISO = () => {
    const h = new Date();
    const mm = String(h.getMonth() + 1).padStart(2, "0");
    const dd = String(h.getDate()).padStart(2, "0");
    return `${h.getFullYear()}-${mm}-${dd}`;
};

/** Fecha y hora legible de un TIMESTAMP (aquí sí importa la hora local). */
export const fechaHora = (v: string | null | undefined) => {
    if (!v) return "—";
    const f = new Date(v);
    if (isNaN(f.getTime())) return String(v);
    return f.toLocaleString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};
