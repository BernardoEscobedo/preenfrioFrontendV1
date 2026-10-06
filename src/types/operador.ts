// ============================================================================
// TIPOS · OPERADORES
// ============================================================================
// Quien maneja la unidad. Puede pertenecer a una línea fletera o ser
// independiente (id_linea_fletera = null).
//
// La llave de negocio es el CELULAR (10 dígitos): identifica a la persona y
// es con lo que se le localiza cuando el camión no llega a la cita.
// ============================================================================

export interface Operador {
    id_operador: number;
    id_linea_fletera: number | null;
    razon_social_linea?: string | null;
    nombre: string;
    celular: string;
    estado: number;                          // 1 activo · 0 dado de baja
    transportes_activos?: number | string;
}

export interface OperadorForm {
    id_linea_fletera: number | null;
    nombre: string;
    celular: string;
}
