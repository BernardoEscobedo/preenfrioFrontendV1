// ============================================================================
// TIPOS · PRODUCCIÓN E IMPORTACIÓN DESDE EXCEL
// ============================================================================

/** Una fila tal como viene del Excel (más la elección de lote). */
export interface FilaExcel {
    fila: number;
    semana: string | number | null;
    region: string | number | null;
    finca: string | number | null;
    productor: string | number | null;
    fecha_empaque: string | number | null;
    transito: string | number | null;
    fecha_entrega: string | number | null;
    cedis: string | number | null;
    cliente: string | number | null;
    sku: string | number | null;
    cajas: string | number | null;
    estiba: string | number | null;
    comentarios: string | number | null;
    lote: string | number | null;
    usar_lote?: "sugerido" | "excel";
}

export type EstadoFila = "ok" | "aviso" | "error" | "omitida";

export type CodigoMensaje =
    | "semana" | "fechas" | "finca" | "productor" | "destino"
    | "sku" | "cantidades" | "lote" | "duplicado" | "otro";

export interface MensajeFila {
    nivel: "error" | "aviso";
    codigo: CodigoMensaje;
    texto: string;
}

export interface ResultadoFila {
    fila: number;
    estado: EstadoFila;
    mensajes: MensajeFila[];
    datos: {
        semana?: number;
        region?: string | null;
        id_finca?: number;
        id_productor?: number;
        finca?: string;
        productor?: string;
        fecha_empaque?: string;
        transito?: number | null;
        fecha_entrega?: string | null;
        id_cc?: number;
        destino?: string;
        acronimo_cc?: string;
        id_sku?: number;
        codigo_sku?: string;
        calidad?: string;
        cajas?: number;
        tarimas?: number;
        comentarios?: string | null;
        codigo_lote?: string | null;
    };
    destino: {
        clave: string | null;
        cedis_excel: string;
        cliente_excel: string;
        id_cc: number | null;
        origen: "equivalencia" | "seleccion" | null;
    };
    lote: {
        excel: string | null;
        excel_valido: boolean;
        sugerido: string | null;
        usar: "sugerido" | "excel";
    };
    huella: string | null;
}

export interface DestinoPendiente {
    clave: string;
    cedis_excel: string;
    cliente_excel: string;
    filas: number;
}

export interface VistaPrevia {
    filas: ResultadoFila[];
    resumen: {
        total: number;
        ok: number;
        aviso: number;
        error: number;
        omitida: number;
        cajas: number;
        tarimas: number;
    };
    destinos_pendientes: DestinoPendiente[];
}

export interface CatalogosCorreccion {
    fincas: {
        id_finca: number;
        codigo_finca: string;
        nombre: string;
        zona: number;
        id_productor: number;
        codigo_productor: string;
        nombre_productor: string;
    }[];
    skus: { id_sku: number; codigo_sku: string; calidad: string; turno: number }[];
    cedis: { id_cc: number; cliente: string; cedis: string; acronimo: string }[];
}

/** Producción sin preenfrío asignado. */
export interface ProduccionSinCamara {
    id_produccion: number;
    semana: number;
    codigo_lote: string | null;
    fecha_empaque: string;
    fecha_entrega: string | null;
    transito: number | null;
    cajas_procesadas: number;
    estiba_pallets: number;
    comentarios: string | null;
    codigo_finca: string;
    nombre_finca: string;
    codigo_productor: string;
    nombre_productor: string;
    codigo_sku: string;
    calidad_sku: string;
    cliente: string;
    cedis: string;
    acronimo_cc: string;
}

export interface CamaraPreenfrio {
    id_camara: number;
    nombre_camara: string;
    ubicacion: string;
    capacidad_max_tarimas: number;
    tarimas_ocupadas: number | string;
    tarimas_en_espera: number | string;
    en_mantenimiento: boolean;
    tarimas_disponibles_operativas: number | string;
}

/** Fila de GET /produccion (SELECT_PRODUCCION del backend). */
export interface Produccion {
    id_produccion: number;
    semana: number;
    codigo_lote: string | null;
    fecha_empaque: string;
    fecha_entrega: string | null;
    codigo_productor: string;
    nombre_productor: string;
    codigo_finca: string;
    nombre_finca: string;
    zona_nombre: string;
    cliente: string;
    cedis: string;
    acronimo_cc: string;
    codigo_sku: string;
    calidad_sku: string;
    cajas_procesadas: number;
    estiba_pallets: number;
    id_camara: number | null;
    nombre_camara: string | null;
    estado: number;
    estado_texto: string;
    comentarios: string | null;
}
