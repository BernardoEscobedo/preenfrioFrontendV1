// ============================================================================
// TIPOS · TRACTOCAMIONES
// ============================================================================
// La unidad motriz. Puede pertenecer a una línea fletera o ser
// independiente (id_linea_fletera = null).
//
// La llave de negocio son las PLACAS, comparadas sin guiones ni espacios:
// "15AN7H", "15-AN-7H" y "15 AN 7H" son la misma unidad.
// ============================================================================

export interface Tractocamion {
    id_tractocamion: number;
    id_linea_fletera: number | null;
    razon_social_linea?: string | null;
    placas: string;
    numero_economico: string;
    estado: number;                          // 1 activo · 0 dado de baja
    transportes_activos?: number | string;
}

export interface TractocamionForm {
    id_linea_fletera: number | null;
    placas: string;
    numero_economico: string;
}
