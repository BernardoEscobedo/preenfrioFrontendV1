// ============================================================================
// TIPOS · MOVIMIENTOS DE INVENTARIO
// ============================================================================
// Espejo de vw_movimientos, vw_inventario_disponible (+horas_en_preenfrio)
// y vw_disponibilidad_camaras. Los SUM/COUNT llegan como texto: siempre
// pasar por Number().
//
//   tipo 1 = ingreso a preenfrío     (lo genera la recepción)
//   tipo 2 = preenfrío → conserva    (lo crea ESTE módulo)
//   tipo 3 = salida por despacho     (lo genera el despacho)
// ============================================================================

type Num = number | string;

export type NivelCriticidad = 1 | 2 | 3 | 4;

/** Stock por cámara (vw_disponibilidad_camaras) */
export interface CamaraStock {
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;
    tipo_camara_texto: string;
    ubicacion: string | null;
    capacidad_max_tarimas: number;
    tarimas_ocupadas: Num;
    cajas_ocupadas: Num;
    tarimas_en_espera: Num;
    tarimas_disponibles_operativas: Num;
    en_mantenimiento: boolean;
    porcentaje_ocupacion: Num;
}

/** Fruta dentro de un preenfrío, candidata a pasar a conservación */
export interface Trasladable {
    id_ocupacion: number;
    id_camara: number;
    nombre_camara: string;
    tarimas_disponibles: Num;
    cajas_disponibles: Num;
    fecha_ingreso: string;
    hora_ingreso: string;
    id_produccion: number | null;
    codigo_lote: string | null;
    fecha_empaque: string | null;
    dias_desde_empaque: number | null;
    fecha_entrega: string | null;
    holgura_dias: number | null;
    codigo_finca: string | null;
    nombre_finca: string | null;
    codigo_productor: string | null;
    nombre_productor: string | null;
    codigo_sku: string | null;
    calidad_sku: string | null;
    acronimo_cc: string | null;
    nivel_criticidad: NivelCriticidad;
    criticidad_texto: string;
    horas_en_preenfrio: Num | null;
}

/** Fila de la bitácora (vw_movimientos) */
export interface Movimiento {
    id_movimiento: number;
    tipo_movimiento: 1 | 2 | 3;
    tipo_texto: string;
    fecha_movimiento: string;
    hora_movimiento: string;
    cantidad_tarimas: Num;
    cantidad_cajas: Num;
    temperatura: Num | null;
    observaciones: string | null;
    id_camara_origen: number | null;
    camara_origen: string | null;
    id_camara_destino: number | null;
    camara_destino: string | null;
    folio_despacho: string | number | null;
    id_produccion: number | null;
    codigo_lote: string | null;
    codigo_finca: string | null;
    nombre_finca: string | null;
    nombre_productor: string | null;
    codigo_sku: string | null;
    calidad_sku: string | null;
    cliente: string | null;
    cedis: string | null;
    nombre_empleado: string | null;
    apellidos_empleado: string | null;
}

export interface NuevoTraslado {
    id_ocupacion_origen: number;
    id_camara_destino: number;
    fecha_movimiento: string;
    hora_movimiento: string;
    cantidad_tarimas: number;
    cantidad_cajas: number;
    temperatura: number | null;
    observaciones: string | null;
}

export interface RespuestaTraslado {
    mensaje: string;
    resultado: string;
    origen: { tarimas_restantes: Num; cerrada: boolean };
    avisos: string[];
}

export interface RespuestaReversa {
    mensaje: string;
    avisos: string[];
}
