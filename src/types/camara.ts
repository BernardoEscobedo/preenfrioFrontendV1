// ============================================================================
// TIPOS · CÁMARAS
// ============================================================================
// GET /camaras/camaras devuelve la fila de la tabla. Los números pueden
// llegar como texto desde PostgreSQL: siempre pasarlos por Number().
// ============================================================================

export interface Camara {
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;                    // 1 preenfrío · 2 conservación
    ubicacion: string;
    capacidad_max_tarimas: number | string;
    capacidad_max_cajas: number | string;
    capacidad_max_bloques: number | string;
    estado: number;                         // 1 operativa · 0 fuera de servicio
}

export interface CamaraForm {
    nombre_camara: string;
    tipo_camara: number;
    ubicacion: string;
    capacidad_max_tarimas: number;
    capacidad_max_cajas: number;
    capacidad_max_bloques: number;
}

/** Lo que aporta el tablero de ocupación a cada cámara (opcional). */
export interface OcupacionCamara {
    tarimas_ocupadas: number;
    tarimas_en_espera: number;
    procesos_en_espera: number;
    en_mantenimiento: boolean;
}

export const TIPO_CAMARA: Record<number, string> = {
    1: "Preenfrío",
    2: "Conservación"
};

/** Cajas por tarima de referencia (42 en la familia CPL0813). */
export const CAJAS_POR_TARIMA = 48;
