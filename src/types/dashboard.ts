// ============================================================================
// TIPOS DEL DASHBOARD
// ============================================================================
// Reflejan lo que devuelven los endpoints del backend.
//
// ⚠️ PostgreSQL entrega COUNT, SUM y ROUND como TEXTO ("12", "78.5"), no
// como número. Por eso esos campos se tipan como Num y siempre se pasan por
// num() antes de sumar o comparar.
// ============================================================================

export type Num = number | string;

/** Convierte lo que venga de la BD a número; null/undefined/texto raro → 0. */
export const num = (valor: Num | null | undefined): number => {
    const n = Number(valor ?? 0);
    return Number.isFinite(n) ? n : 0;
};

// GET /ocupaciones/tablero
export interface CamaraTablero {
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;            // 1 preenfrío · 2 conservación
    ubicacion: string;
    estado: number;
    capacidad_max_tarimas: Num;
    tarimas_ocupadas: Num;
    tarimas_en_espera: Num;
    procesos_en_espera: Num;
    tarimas_disponibles_operativas: Num;
    en_mantenimiento: boolean;
    porcentaje_ocupacion: Num;
    tarimas_criticas_en_cola: Num;
    procesos_criticos_en_cola: Num;
}

export interface Tablero {
    resumen: { camaras: number; con_fruta_critica: number; tarimas_criticas: number };
    camaras: CamaraTablero[];
}

// GET /ocupaciones/criticas
export type TipoCriticidad = "CITA_VENCIDA" | "SALE_HOY" | "FRUTA_VIEJA";

export interface FrutaCritica {
    id_ocupacion: number;
    id_camara: number;
    nombre_camara: string;
    codigo_lote: string | null;
    cliente: string | null;
    cedis: string | null;
    tarimas_en_espera: Num;
    fecha_entrega: string | null;
    holgura_dias: Num | null;
    motivo_criticidad: string;
    tipo_criticidad: TipoCriticidad;
}

export interface Criticas {
    resumen: { total: number; cita_vencida: number; sale_hoy: number; fruta_vieja: number; tarimas: number };
    cita_vencida: FrutaCritica[];
    sale_hoy: FrutaCritica[];
    fruta_vieja: FrutaCritica[];
}

// GET /recepciones/esperadas
export interface RecepcionEsperada {
    id_produccion: number;
    codigo_lote: string | null;
    nombre_productor: string;
    nombre_finca: string;
    codigo_sku: string;
    cliente: string;
    tarimas_pendientes: Num;
    id_camara: number | null;       // null = CEDA directo
    nombre_camara: string | null;
    fecha_empaque: string;
    fecha_entrega: string | null;
}

// GET /pulpeos/pendientes
export interface BloquePendiente {
    id_bloque: number;
    codigo_bloque: string;
    horas_desde_armado: Num;
    horas_sin_medicion: Num | null;
    temperatura_promedio: Num | null;
    temperatura_objetivo: Num | null;
    situacion: "SIN_PULPEO" | "FUERA_DE_OBJETIVO" | "AL_DIA";
}

export interface PulpeosPendientes {
    resumen: { total: number; sin_pulpeo: number; fuera_de_objetivo: number; sin_medicion_reciente: number };
    sin_pulpeo: BloquePendiente[];
    fuera_de_objetivo: BloquePendiente[];
    sin_medicion_reciente: BloquePendiente[];
}

// GET /mantenimientos/activos
export interface MantenimientoActivo {
    id_mantenimiento: number;
    id_camara: number;
    nombre_camara: string;
    motivo: string;
    fecha_inicio: string;
    hora_inicio: string;
    horas_paro: Num | null;
}

// GET /despachos?estado=1
export interface DespachoResumen {
    id_despacho: number;
    folio_despacho: string;
    cliente: string;
    cedis: string;
    cantidad_tarimas: Num;
    lineas: Num;
    estado: number;
    estado_texto: string;
    fecha_despacho: string;
}

export interface DatosDashboard {
    camaras: CamaraTablero[];
    criticas: FrutaCritica[];
    esperadas: RecepcionEsperada[];
    pulpeos: PulpeosPendientes | null;
    mantenimientos: MantenimientoActivo[];
    despachos: DespachoResumen[];
}
