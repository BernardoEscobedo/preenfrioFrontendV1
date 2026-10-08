// ============================================================================
// TIPOS · RECEPCIONES
// ============================================================================
// Los SUM y COUNT de PostgreSQL llegan como texto: siempre se pasan por
// Number() antes de operar.
// ============================================================================

type Num = number | string;

export type EstadoRecepcion = "pendiente" | "no_llego" | "parcial" | "completa";
export type TipoCierre = "parcial" | "completa" | "no_llego";

/** Una línea esperada (lote + SKU + destino) de GET /recepciones/esperadas */
export interface LineaEsperada {
    id_produccion: number;
    semana: number;
    region: string | null;
    fecha_empaque: string;
    transito: number | null;
    fecha_entrega: string | null;
    comentarios: string | null;
    codigo_lote: string | null;
    codigo_finca: string;
    nombre_finca: string;
    codigo_productor: string;
    nombre_productor: string;
    codigo_sku: string;
    calidad_sku: string;
    cliente: string;
    cedis: string;
    acronimo_cc: string;
    id_camara: number;
    nombre_camara: string;
    cajas_esperadas: Num;
    tarimas_esperadas: Num;
    cajas_recibidas: Num;
    tarimas_recibidas: Num;
    cajas_pendientes: Num;
    tarimas_pendientes: Num;
    estado: number;
    // Confirmación
    id_cierre: number | null;
    fecha_hora_cierre: string | null;
    diferencia_cajas_cierre: Num | null;
    diferencia_tarimas_cierre: Num | null;
    alerta_estado: number | null;
    veces_no_llego: Num;
    ultimo_no_llego: string | null;
    recepciones: Num;
    estado_recepcion: EstadoRecepcion;
}

/** Lo que se captura por línea al recibir un camión */
export interface CapturaLinea {
    id_produccion: number;
    cajas: number;
    tarimas: number;
    cierre: TipoCierre;
    observaciones?: string | null;
}

export interface RecepcionLotePayload {
    fecha_recepcion: string;
    hora_recepcion: string;
    temperatura: number | null;
    observaciones: string | null;
    lineas: CapturaLinea[];
}

export interface ResultadoLinea {
    id_produccion: number;
    codigo_lote: string | null;
    codigo_sku: string;
    cierre: TipoCierre;
    recibido_ahora: { cajas: number; tarimas: number };
    entraron: number;
    en_cola: number;
    total: { cajas: number; tarimas: number };
    plan: { cajas: number; tarimas: number };
    diferencia: { cajas: number; tarimas: number } | null;
    alerta: boolean;
}

export interface RespuestaLote {
    mensaje: string;
    alertas: number;
    avisos: string[];
    lineas: ResultadoLinea[];
}

/** Alerta de diferencia o "no llegó" para el coordinador */
export interface AlertaRecepcion {
    id_cierre: number;
    id_produccion: number;
    tipo_cierre: 1 | 2;
    tipo_alerta: "DIFERENCIA" | "NO_LLEGO";
    fecha_cierre: string;
    cajas_planeadas: Num;
    tarimas_planeadas: Num;
    cajas_recibidas: Num;
    tarimas_recibidas: Num;
    diferencia_cajas: Num;
    diferencia_tarimas: Num;
    observaciones: string | null;
    fecha_hora: string;
    vigente: boolean;
    motivo_reapertura: string | null;
    alerta_estado: 1 | 2;
    alerta_comentario: string | null;
    alerta_fecha_atencion: string | null;
    codigo_lote: string | null;
    semana: number;
    fecha_empaque: string;
    region: string | null;
    codigo_finca: string;
    nombre_finca: string;
    codigo_productor: string;
    nombre_productor: string;
    codigo_sku: string;
    calidad_sku: string;
    cliente: string;
    cedis: string;
    acronimo_cc: string;
    nombre_camara: string | null;
    usuario_registro: string | null;
    nombre_registro: string | null;
    apellidos_registro: string | null;
    usuario_atencion: string | null;
    nombre_atencion: string | null;
    apellidos_atencion: string | null;
}

export interface ResumenAlertas {
    pendientes: Num;
    diferencias: Num;
    no_llego: Num;
}
