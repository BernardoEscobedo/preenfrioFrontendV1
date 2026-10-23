// ============================================================================
// TIPOS · BLOQUES POR TARIMA Y PULPEOS
// ============================================================================

type Num = number | string;

/** al_dia <60 min · toca 60–75 · vencido >75 o 60 min sin pulpeo · primero recién entró · libre conservación */
export type EstadoPulpeo = "al_dia" | "toca" | "vencido" | "primero" | "libre";

export interface LoteTarima {
    id_produccion: number;
    cantidad_cajas: number;
    codigo_lote: string | null;
    fecha_empaque: string | null;
    codigo_sku: string | null;
    calidad_sku: string | null;
    codigo_finca: string | null;
    nombre_finca: string | null;
    codigo_productor: string | null;
    acronimo_cc: string | null;
}

export interface Tarima {
    id_tarima: number;
    id_bloque: number;
    posicion: number;
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;
    fecha_hora_ingreso: string;
    fecha_hora_traslado: string | null;
    /** En preenfrío: desde el ingreso. En conservación: desde el traslado. */
    horas_en_camara: Num;
    ultimo_pulpeo: number | null;
    fecha_ultimo_pulpeo: string | null;
    ultima_temperatura: Num | null;
    ultima_evidencia: number | null;
    minutos_desde_pulpeo: Num | null;
    pulpeos: number;
    lotes: LoteTarima[];
    estado_pulpeo: EstadoPulpeo;
    alerta_5h: boolean;
}

/** Posición del bloque que ya está en otra cámara (traslado parcial) */
export interface PosicionFuera {
    posicion: number;
    nombre_camara: string;
}

export interface BloqueTarimas {
    id_bloque: number;
    codigo_bloque: string;
    posiciones: number;
    fecha_hora_armado: string;
    tarimas: Tarima[];
    posiciones_fuera: PosicionFuera[];
}

export interface RespuestaBloques {
    resumen: { bloques: number; tarimas: number; por_pulpear: number; vencidas: number; alerta_5h: number };
    bloques: BloqueTarimas[];
}

export interface LoteCamara {
    id_produccion: number;
    codigo_lote: string | null;
    codigo_sku: string | null;
    calidad_sku: string | null;
    codigo_finca: string | null;
    nombre_finca: string | null;
    codigo_productor: string | null;
    acronimo_cc: string | null;
    fecha_empaque: string | null;
    tarimas_disponibles: number;
    cajas_disponibles: number;
    cajas_en_bloques: number;
}

export interface TarimaCaptura {
    posicion: number;
    lotes: { id_produccion: number; cantidad_cajas: number }[];
}

export interface PulpeoHistorial {
    id_pulpeo: number;
    numero_pulpeo: number | null;
    fecha_hora: string;
    temperatura_promedio: Num;
    observaciones: string | null;
    nombre_camara: string | null;
    nombre_empleado: string | null;
    apellidos_empleado: string | null;
    usuario: string | null;
    evidencias: number[];
}

export interface CamaraBloques {
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;
    en_mantenimiento: boolean;
}
