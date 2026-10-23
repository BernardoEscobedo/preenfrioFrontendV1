// ============================================================================
// TIPOS · MANTENIMIENTOS DE CÁMARA
// ============================================================================
//   tipo       1 Preventivo · 2 Correctivo · 3 Emergencia
//   prioridad  1 Alta · 2 Media · 3 Baja
//   estado     1 Programado · 2 En proceso (fuera de servicio) · 3 Finalizado · 4 Cancelado
// ============================================================================

type Num = number | string;

export type TipoMantenimiento = 1 | 2 | 3;

/** Una cámara con su situación (GET /mantenimientos/tablero) */
export interface CamaraMantenimiento {
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;
    ubicacion: string | null;
    capacidad_max_tarimas: number;
    bloqueada: boolean;
    id_activo: number | null;
    tipo_activo: TipoMantenimiento | null;
    motivo_activo: string | null;
    fecha_inicio_activo: string | null;
    hora_inicio_activo: string | null;
    horas_paro: Num | null;
    id_programado: number | null;
    motivo_programado: string | null;
    fecha_programado: string | null;
    hora_programado: string | null;
    tarimas_dentro: number;
    cajas_dentro: number;
    tarimas_en_cola: number;
}

export interface TableroMantenimientos {
    resumen: { camaras: number; fuera_de_servicio: number; programados: number; con_fruta_por_reubicar: number };
    camaras: CamaraMantenimiento[];
}

/** Fila del historial (GET /mantenimientos) */
export interface Mantenimiento {
    id_mantenimiento: number;
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;
    fecha_inicio: string;
    hora_inicio: string;
    fecha_fin: string | null;
    hora_fin: string | null;
    tipo: TipoMantenimiento;
    tipo_texto: string;
    motivo: string;
    prioridad: number;
    prioridad_texto: string;
    estado: 1 | 2 | 3 | 4;
    estado_texto: string;
    observaciones: string | null;
    comentario_cierre: string | null;
    horas_paro: Num | null;
    horas_para_inicio: Num | null;
    usuario_registro: string | null;
    nombre_registro: string | null;
    apellidos_registro: string | null;
    usuario_cierre: string | null;
    nombre_cierre: string | null;
    apellidos_cierre: string | null;
}

export interface NuevoMantenimiento {
    id_camara: number;
    tipo: TipoMantenimiento;
    fecha_inicio: string;
    hora_inicio: string;
    motivo: string;
    prioridad: 1 | 2 | 3;
    estado: 1 | 2;
    observaciones: string | null;
}

/** Lote dentro de una cámara (para reubicar) */
export interface FrutaDentro {
    id_ocupacion: number;
    id_produccion: number | null;
    codigo_lote: string | null;
    codigo_sku: string | null;
    calidad_sku: string | null;
    codigo_productor: string | null;
    codigo_finca: string | null;
    nombre_finca: string | null;
    acronimo_cc: string | null;
    fecha_empaque: string | null;
    fecha_entrega: string | null;
    tarimas_disponibles: Num;
    cajas_disponibles: Num;
    nivel_criticidad: number;
    criticidad_texto: string;
}

export interface RespuestaMantenimiento {
    mensaje: string;
    avisos?: string[];
}
