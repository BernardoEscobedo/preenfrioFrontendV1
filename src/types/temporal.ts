// ============================================================================
// TIPOS · CAJAS TEMPORALES (resguardo en caja de línea fletera)
// ============================================================================
// Una caja temporal es una cámara tipo 3: la fruta sigue en el inventario.
// ============================================================================

type Num = number | string;

export interface CajaTemporal {
    id_camara: number;
    nombre_camara: string;
    capacidad_max_tarimas: number;
    id_camara_origen: number | null;
    camara_origen: string | null;
    fecha_hora_apertura: string;
    razon_social: string | null;
    placas_caja: string | null;
    numero_economico: string | null;
    tarimas_dentro: number;
    cajas_dentro: number;
    procesos: number;
    tarimas_en_cola: number;
    espacio: Num;
}

export interface DestinoCamara {
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;
    capacidad_max_tarimas: number;
    espacio: Num;
}

export type DestinoReubicar =
    | { id_camara: number }
    | { nueva: { id_linea_fletera: number; id_caja_refrigerada: number; capacidad: number } };

export interface RespuestaReubicar {
    mensaje: string;
    id_camara_destino: number;
    avisos: string[];
}

/** Dónde recibir (GET /temporales/recepcion/:id_camara) */
export interface OpcionRecepcion {
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;
    es_temporal: boolean;
    id_camara_origen: number | null;
    bloqueada: boolean;
    espacio: Num;
}

export interface DestinosRecepcion {
    planeada: OpcionRecepcion | null;
    opciones: OpcionRecepcion[];
}
