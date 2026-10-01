import api from "../api/axios";
import type {
    CamaraCatalogo,
    EmpleadoLibre,
    RolCatalogo,
    UsuarioAltaForm,
    UsuarioCuenta,
    UsuarioEdicionForm,
    ZonaTrabajo
} from "../types/usuario";

// ============================================================================
// USUARIOS · endpoints (todo el módulo es solo ADMIN)
// ============================================================================
//   GET    /usuarios/usuarios                       listado
//   GET    /usuarios/roles                          catálogo de roles
//   POST   /usuarios/registrarusuario               alta
//   PUT    /usuarios/actualizarusuario/:id          edición (sin contraseña)
//   PATCH  /usuarios/deshabilitar/:id               { motivo } obligatorio
//   PATCH  /usuarios/habilitar/:id                  { motivo } opcional
//   PATCH  /usuarios/resetpassword/:id              { password }
//   DELETE /usuarios/eliminarusuario/:id            solo cuentas sin registros
//   GET    /usuarios/zonatrabajo/:id                cámaras asignadas
//   POST   /usuarios/zonatrabajo/:id                { camaras: [ids] }
//
//   GET    /empleados/sinusuario                    empleados activos sin cuenta
//   GET    /camaras/camaras                         catálogo de cámaras
// ============================================================================

/**
 * El usuario se guarda en minúsculas y sin espacios: es como lo envía el
 * login (auth.service), así que si se guardara distinto no podría entrar.
 */
export const normalizarUsuario = (texto: string) => texto.trim().toLowerCase().replace(/\s+/g, "");

interface RespuestaMensaje {
    mensaje: string;
    aviso?: string | null;
    avisos?: string[];
}

export const getUsuarios = async (): Promise<UsuarioCuenta[]> => {
    const { data } = await api.get<UsuarioCuenta[]>("/usuarios/usuarios");
    return data;
};

export const getRoles = async (): Promise<RolCatalogo[]> => {
    const { data } = await api.get<RolCatalogo[]>("/usuarios/roles");
    return data;
};

export const getEmpleadosSinUsuario = async (): Promise<EmpleadoLibre[]> => {
    const { data } = await api.get<EmpleadoLibre[]>("/empleados/sinusuario");
    return data;
};

export const getCamaras = async (): Promise<CamaraCatalogo[]> => {
    const { data } = await api.get<CamaraCatalogo[] | { camaras: CamaraCatalogo[] }>("/camaras/camaras");
    // Se acepta la lista directa o envuelta, según cómo responda el controller
    return Array.isArray(data) ? data : data.camaras ?? [];
};

export const crearUsuario = async (datos: UsuarioAltaForm) => {
    const { data } = await api.post<{ usuario: UsuarioCuenta; avisos: string[] }>(
        "/usuarios/registrarusuario",
        { ...datos, usuario: normalizarUsuario(datos.usuario) }
    );
    return data;
};

export const actualizarUsuario = async (id: number, datos: UsuarioEdicionForm) => {
    const { data } = await api.put<UsuarioCuenta & { aviso?: string | null }>(
        `/usuarios/actualizarusuario/${id}`,
        { ...datos, usuario: normalizarUsuario(datos.usuario) }
    );
    return data;
};

export const deshabilitar = async (id: number, motivo: string) => {
    const { data } = await api.patch<RespuestaMensaje>(`/usuarios/deshabilitar/${id}`, { motivo });
    return data;
};

export const habilitar = async (id: number, motivo: string) => {
    const { data } = await api.patch<RespuestaMensaje>(
        `/usuarios/habilitar/${id}`,
        motivo ? { motivo } : {}
    );
    return data;
};

export const restablecerPassword = async (id: number, password: string) => {
    const { data } = await api.patch<RespuestaMensaje>(`/usuarios/resetpassword/${id}`, { password });
    return data;
};

export const eliminarUsuario = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/usuarios/eliminarusuario/${id}`);
    return data;
};

export const getZonaTrabajo = async (id: number): Promise<ZonaTrabajo> => {
    const { data } = await api.get<ZonaTrabajo>(`/usuarios/zonatrabajo/${id}`);
    return data;
};

export const guardarZonaTrabajo = async (id: number, camaras: number[]) => {
    const { data } = await api.post<RespuestaMensaje>(`/usuarios/zonatrabajo/${id}`, { camaras });
    return data;
};
