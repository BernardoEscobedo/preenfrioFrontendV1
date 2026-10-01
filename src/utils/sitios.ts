// ============================================================================
// SITIO DE UNA CÁMARA
// ============================================================================
// Mismo criterio que el selector del dashboard: el sitio sale del NOMBRE de
// la cámara, quitando la palabra del tipo.
//
//   "PREENFRIO NELLY"      → NELLY
//   "CONSERVACION NELLY"   → NELLY
//   "PREENFRÍO FORTALEZA"  → FORTALEZA
//
// Si el nombre no sigue ese formato, se usa la ubicación.
// ============================================================================

const PREFIJO_TIPO =
    /^\s*(pre\s*-?\s*enfr[ií]amiento|pre\s*-?\s*enfr[ií]o|conservaci[oó]n|conserva)(?=[\s\-_:]|$)[\s\-_:]*/i;

export const claveSitio = (nombreCamara: string, ubicacion: string): string => {
    const limpio = nombreCamara.replace(PREFIJO_TIPO, "").trim();
    return (limpio || ubicacion).toUpperCase();
};

/** "DOÑA NELLY" → "Doña Nelly" */
export const etiquetaSitio = (clave: string): string =>
    clave.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
