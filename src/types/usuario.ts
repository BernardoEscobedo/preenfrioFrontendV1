// ============================================================================
// TIPOS · USUARIOS
// ============================================================================
// Reflejan lo que devuelve el backend (usuarios.model.js · SELECT_USUARIO).
// ⚠️ COUNT llega de PostgreSQL como texto: camaras_asignadas se pasa por
// Number() antes de comparar.
// ============================================================================

export interface UsuarioCuenta {
    id_usuario: number;
    usuario: string;
    id_role: number;
    rol: string;
    estado: number;                 // 1 habilitada · 0 deshabilitada
    estado_texto: string;
    id_empleado: number;
    nombre_empleado: string;
    apellidos_empleado: string;
    empleado_estado: number;        // 0 = el empleado está dado de baja
    turno: string;
    zona: string;
    camaras_asignadas: number | string;
    alcance_total: boolean;         // admin y coordinador ven todas las cámaras
}

export interface RolCatalogo {
    id_role: number;
    tipo: string;
}

/** GET /empleados/sinusuario · empleados activos que aún no tienen cuenta */
export interface EmpleadoLibre {
    id_empleado: number;
    nombre: string;
    apellidos: string;
    turno: string;
    zona: string;
}

/** GET /camaras/camaras */
export interface CamaraCatalogo {
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;            // 1 preenfrío · 2 conservación
    ubicacion: string;
    estado: number;
}

/** Una fila de GET /usuarios/zonatrabajo/:id */
export interface AsignacionCamara {
    id_usuario_camara: number;
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;
    ubicacion: string;
    camara_estado: number;
    fecha_asignacion: string;
    fecha_fin: string | null;
    vigente: boolean;
}

export interface ZonaTrabajo {
    nota: string | null;
    camaras: AsignacionCamara[];
}

export interface UsuarioAltaForm {
    usuario: string;
    password: string;
    id_empleado: number;
    id_role: number;
}

export interface UsuarioEdicionForm {
    usuario: string;
    id_empleado: number;
    id_role: number;
}
