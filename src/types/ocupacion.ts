// ============================================================================
// TIPOS · COLA DE CÁMARA E INGRESO
// ============================================================================
// Espejo de vw_disponibilidad_camaras, vw_cola_espera y
// vw_inventario_disponible. Los SUM/COUNT de PostgreSQL llegan como texto:
// siempre se pasan por Number() antes de operar.
//
// NIVELES DE CRITICIDAD (los calcula la BD)
//   1 CRÍTICA   cita encima (holgura ≤ 0) · o fruta con 5+ días de empacada
//   2 URGENTE   debe salir mañana (holgura = 1)
//   3 NORMAL    2 a 4 días de margen
//   4 HOLGADA   5+ días de margen · o sin cita
//
//   holgura = días para la cita − tránsito − 1 día de preenfrío
// ============================================================================

type Num = number | string;

export type NivelCriticidad = 1 | 2 | 3 | 4;

export interface CamaraTablero {
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;
    tipo_camara_texto: string;
    ubicacion: string | null;
    estado: number;
    capacidad_max_tarimas: number;
    tarimas_ocupadas: Num;
    cajas_ocupadas: Num;
    tarimas_en_espera: Num;
    cajas_en_espera: Num;
    procesos_en_espera: Num;
    tarimas_disponibles_operativas: Num;
    en_mantenimiento: boolean;
    porcentaje_ocupacion: Num;
    tarimas_criticas_en_cola: Num;
    procesos_criticos_en_cola: Num;
    holgura_minima: number | null;
}

export interface TableroCamaras {
    resumen: { camaras: number; con_fruta_critica: number; tarimas_criticas: number };
    camaras: CamaraTablero[];
}

/** Fila de la cola (vw_cola_espera) */
export interface FilaCola {
    id_ocupacion: number;
    id_camara: number;
    nombre_camara: string;
    posicion: Num;
    tarimas_en_espera: Num;
    cajas_en_espera: Num;
    fecha_llegada: string;
    hora_llegada: string;
    prioridad: number;
    motivo_prioridad: string | null;
    id_produccion: number | null;
    codigo_lote: string | null;
    fecha_empaque: string | null;
    semana: number | null;
    fecha_entrega: string | null;
    transito: number;
    dias_desde_empaque: number | null;
    dias_para_cita: number | null;
    holgura_dias: number | null;
    codigo_finca: string | null;
    nombre_finca: string | null;
    nombre_productor: string | null;
    codigo_sku: string | null;
    calidad_sku: string | null;
    cliente: string | null;
    cedis: string | null;
    acronimo_cc: string | null;
    nivel_criticidad: NivelCriticidad;
    criticidad_texto: string;
    motivo_criticidad: string;
}

/** Fruta dentro de la cámara (vw_inventario_disponible) */
export interface FilaInventario {
    id_ocupacion: number;
    id_camara: number;
    tarimas_disponibles: Num;
    cajas_disponibles: Num;
    fecha_ingreso: string;
    hora_ingreso: string;
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
}

export interface RespuestaIngreso {
    mensaje: string;
    lote: string | null;
    cola_restante: number;
    cola_cerrada: boolean;
    avisos: string[];
}

export interface RespuestaPrioridad {
    mensaje: string;
    cola: FilaCola[];
    avisos: string[];
}
