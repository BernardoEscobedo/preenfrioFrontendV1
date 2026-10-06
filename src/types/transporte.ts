// ============================================================================
// TIPOS · TRANSPORTES (servicios)
// ============================================================================
// Un transporte es un SERVICIO: la combinación línea + operador + tracto +
// caja tal como se presenta en el andén. Se arma eligiendo una pieza de
// cada catálogo; ya no se captura con texto libre.
//
// catalogos_completos = false → registro anterior a la etapa de catálogos.
//   Se puede consultar, pero no se puede usar en un despacho nuevo ni
//   inspeccionar hasta vincularlo.
// catalogos_activos = false → alguna de sus piezas está dada de baja.
//
// La inocuidad YA NO es un dato del transporte: se registra en cada
// despacho.
// ============================================================================

export interface Transporte {
    id_transporte: number;
    estado: number;                          // 1 activo · 0 dado de baja
    id_linea_fletera: number | null;
    id_operador: number | null;
    id_tractocamion: number | null;
    id_caja_refrigerada: number | null;
    razon_social: string | null;
    rfc_linea_fletera?: string | null;
    telefono_contacto?: string | null;
    nombre_operador: string | null;
    celular: string | null;
    placas_tracto: string | null;
    no_economico_tracto?: string | null;
    placas_caja: string | null;
    no_economico_caja: string | null;
    largo_caja_pies?: number | null;
    catalogos_completos: boolean;
    catalogos_activos: boolean;
    total_despachos?: number | string;
    ultimo_despacho?: string | null;
}

export interface TransporteForm {
    id_linea_fletera: number;
    id_operador: number;
    id_tractocamion: number;
    id_caja_refrigerada: number;
}
