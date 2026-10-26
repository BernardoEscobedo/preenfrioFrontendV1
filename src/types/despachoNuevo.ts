// ============================================================================
// TIPOS · DESPACHO EN UN PASO (asistente)
// ============================================================================
// La fruta sale por TARIMA de bloque, entera (completa, media o mixta).
// ============================================================================

type Num = number | string;

/** Destino con fruta disponible (GET /despachos/clientes-disponibles) */
export interface ClienteDisponible {
    id_cc: number;
    cliente: string;
    cedis: string;
    acronimo_cc: string;
    procesos: Num;
    tarimas_disponibles: Num;
    cajas_disponibles: Num;
    fecha_entrega_proxima: string | null;
    nivel_criticidad: number;
}

/** Lote dentro de una tarima de bloque */
export interface LoteEnTarima {
    id_produccion: number;
    cantidad_cajas: number;
    codigo_lote: string | null;
    codigo_sku: string | null;
    calidad_sku: string | null;
    codigo_finca: string | null;
    nombre_finca: string | null;
    codigo_productor: string | null;
    id_cc: number | null;
    acronimo_cc: string | null;
    fecha_empaque: string | null;
}

/** Tarima física de un bloque (GET /despachos/tarimas) */
export interface TarimaDespacho {
    id_tarima: number;
    posicion: number;
    id_camara: number;
    nombre_camara: string;
    horas: Num | null;
    ultima_temperatura: Num | null;
    cajas: number;
    fecha_empaque: string | null;
    lotes: LoteEnTarima[];
    mixta: boolean;
    de_otro_cliente: boolean;
}

export interface BloqueDespacho {
    id_bloque: number;
    codigo_bloque: string;
    posiciones: number;
    tarimas: TarimaDespacho[];
}

export interface TarimasDisponibles {
    bloques: BloqueDespacho[];
    /** Fruta del cliente que no está armada en bloques (hay que armarla) */
    sin_bloque: { lotes: number; cajas: number };
}

/** Una pieza elegida de la lista o dada de alta en el momento */
export type Pieza<N> = { id: number } | { nuevo: N };

export interface NuevoOperador { nombre: string; celular: string }
export interface NuevoTracto { placas: string; numero_economico: string }
export interface NuevaCaja { placas: string; numero_economico: string; largo_pies: number | null }

export interface DespachoCompletoPayload {
    id_cc: number;
    fecha_despacho: string;
    hora_salida: string;
    orden_venta: string | null;
    cita: string | null;
    fecha_cita: string | null;
    temperatura_salida: number | null;
    observaciones: string | null;
    confirmar_reasignacion: boolean;
    id_tarimas: number[];
    transporte: {
        id_linea_fletera: number;
        operador: Pieza<NuevoOperador>;
        tractocamion: Pieza<NuevoTracto>;
        tipo_unidad: 1 | 2;
        cajas: Pieza<NuevaCaja>[];
    };
    inspeccion: { inocuidad: 1; observaciones: string | null }[];
}

export interface RespuestaDespachoCompleto {
    mensaje: string;
    despacho: { id_despacho: number; folio_despacho: Num };
    avisos: string[];
}
