// ============================================================================
// TIPOS · EMPLEADOS
// ============================================================================
// Reflejan lo que devuelve GET /empleados/empleados (empleados.model.js →
// getEmpleados): la fila del empleado más su cuenta, si tiene.
// ============================================================================

export interface Empleado {
    id_empleado: number;
    nombre: string;
    apellidos: string;
    turno: string;
    zona: string;
    estado: number;                 // 1 activo · 0 dado de baja
    tiene_usuario: boolean;
    id_usuario: number | null;
    usuario: string | null;
}

/** Lo que se captura en el formulario. El estado NO va aquí: tiene su
 *  propio flujo de baja con motivo (módulo de bajas, solo admin). */
export interface EmpleadoForm {
    nombre: string;
    apellidos: string;
    turno: string;
    zona: string;
}

/** Respuesta de PATCH /bajas/empleados/:id y /reactivar */
export interface RespuestaCambioEstado {
    mensaje: string;
    cuenta?: string | null;         // al dar de baja: "Su cuenta X se deshabilitó…"
    aviso?: string | null;          // al reactivar: "Su cuenta sigue deshabilitada…"
}
