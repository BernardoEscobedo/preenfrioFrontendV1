// ============================================================================
// TIPOS · CAJAS REFRIGERADAS
// ============================================================================
// El remolque donde viaja la fruta: la pieza que se INSPECCIONA en cada
// despacho. Su inspección no vive aquí: es del despacho.
//
// largo_pies es la longitud nominal (48, 53…), no la capacidad de carga.
// ============================================================================

export interface CajaRefrigerada {
    id_caja_refrigerada: number;
    id_linea_fletera: number | null;
    razon_social_linea?: string | null;
    placas: string;
    numero_economico: string;
    largo_pies: number | null;
    estado: number;                          // 1 activa · 0 dada de baja
    transportes_activos?: number | string;
}

export interface CajaRefrigeradaForm {
    id_linea_fletera: number | null;
    placas: string;
    numero_economico: string;
    largo_pies: number | null;
}
