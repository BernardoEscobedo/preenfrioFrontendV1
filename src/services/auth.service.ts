import api from "../api/axios";
import type { Camara, RespuestaLogin, Usuario } from "../types/auth";

// ============================================================================
// AUTENTICACIÓN · endpoints de /auth
// ============================================================================

// El usuario va en minúsculas y sin espacios: así se guarda al darlo de
// alta, y el login compara exacto. Sin esto "BEscobedo" no entraría.
export const login = async (usuario: string, password: string): Promise<RespuestaLogin> => {
    const { data } = await api.post<RespuestaLogin>("/auth/login", {
        usuario: usuario.trim().toLowerCase(),
        password
    });
    return data;
};

export const obtenerPerfil = async (): Promise<Usuario> => {
    const { data } = await api.get<Usuario>("/auth/perfil");
    return data;
};

export const obtenerMisCamaras = async (): Promise<Camara[]> => {
    const { data } = await api.get<Camara[]>("/auth/miscamaras");
    return data;
};
