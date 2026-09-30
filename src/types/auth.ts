// ============================================================================
// TIPOS DE SESIÓN
// ============================================================================
// Reflejan lo que devuelve el backend en /auth/login y /auth/perfil
// (auth.model.js → buscarPorUsuario / getPerfil).
// ============================================================================

export interface Usuario {
    id_usuario: number;
    usuario: string;
    id_role: number;
    rol: string;
    estado?: number;
    id_empleado: number;
    nombre_empleado: string;
    apellidos_empleado: string;
    turno?: string;
    zona?: string;
    camaras: number[];          // ids visibles (fn_camaras_usuario)
    alcance_total?: boolean;
}

export interface RespuestaLogin {
    token: string;
    usuario: Usuario;
}

export interface Camara {
    id_camara: number;
    nombre_camara: string;
    tipo_camara: number;        // 1 preenfrío · 2 conservación
    ubicacion: string;
}
