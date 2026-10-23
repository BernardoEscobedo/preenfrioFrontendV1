// ============================================================================
// TIPOS · DESPACHO EN UN PASO (asistente)
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

/** Proceso en stock (GET /despachos/inventario) */
export interface StockProceso {
    id_ocupacion: number;
    id_camara: number;
    nombre_camara: string;
    tipo_camara_texto: string;
    tarimas_disponibles: Num;
    cajas_disponibles: Num;
    codigo_lote: string | null;
    fecha_empaque: string | null;
    fecha_entrega: string | null;
    codigo_finca: string | null;
    nombre_finca: string | null;
    codigo_productor: string | null;
    nombre_productor: string | null;
    codigo_sku: string | null;
    calidad_sku: string | null;
    id_cc: number | null;
    cliente: string | null;
    cedis: string | null;
    acronimo_cc: string | null;
    nivel_criticidad: 1 | 2 | 3 | 4;
    criticidad_texto: string;
    es_de_otro_cliente: boolean;
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
    lineas: { id_ocupacion_origen: number; cantidad_tarimas: number; cantidad_cajas: number }[];
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
