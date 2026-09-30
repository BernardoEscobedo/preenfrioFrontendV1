import axios from "axios";
import type { AxiosError } from "axios";

// ============================================================================
// CLIENTE HTTP
// ============================================================================
// baseURL ya incluye /api/preenfrio: los services solo escriben la parte
// del módulo ("/auth/login"...).
//
// El token se inyecta en cada petición. Ante un 401 de sesión (vencida o
// cuenta deshabilitada) se avisa al AuthContext para mandar al login.
// ============================================================================

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api/preenfrio",
    timeout: 20000
});

// ---- Token ----
// localStorage si marcó "mantener sesión"; si no, sessionStorage (se borra
// al cerrar el navegador: lo sensato en las tablets compartidas de planta).
const CLAVE_TOKEN = "preenfrio_token";

export const leerToken = (): string | null =>
    localStorage.getItem(CLAVE_TOKEN) || sessionStorage.getItem(CLAVE_TOKEN);

export const borrarToken = (): void => {
    localStorage.removeItem(CLAVE_TOKEN);
    sessionStorage.removeItem(CLAVE_TOKEN);
};

export const guardarToken = (token: string, recordar: boolean): void => {
    borrarToken();
    (recordar ? localStorage : sessionStorage).setItem(CLAVE_TOKEN, token);
};

api.interceptors.request.use((config) => {
    const token = leerToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ---- Sesión caída ----
type AlPerderSesion = (motivo: string) => void;
let alPerderSesion: AlPerderSesion | null = null;

export const registrarAlPerderSesion = (fn: AlPerderSesion): void => {
    alPerderSesion = fn;
};

interface ErrorApi {
    error?: string;
    expirado?: boolean;
    deshabilitado?: boolean;
}

api.interceptors.response.use(
    (respuesta) => respuesta,
    (error: AxiosError<ErrorApi>) => {
        const status = error.response?.status;
        const datos = error.response?.data ?? {};
        const esLogin = error.config?.url?.includes("/auth/login");

        // En el login, un 401 es "contraseña incorrecta": lo maneja el form
        if (status === 401 && !esLogin && alPerderSesion) {
            alPerderSesion(
                datos.deshabilitado
                    ? "Tu cuenta fue deshabilitada. Contacta al administrador."
                    : datos.expirado
                        ? "Tu sesión expiró. Vuelve a iniciar sesión."
                        : "Tu sesión ya no es válida. Vuelve a iniciar sesión."
            );
        }

        return Promise.reject(error);
    }
);

/** Mensaje legible de cualquier error de axios. */
export const mensajeError = (error: unknown): string => {
    const err = error as AxiosError<ErrorApi>;
    if (err.response?.data?.error) return err.response.data.error;
    if (err.code === "ECONNABORTED") return "El servidor tardó demasiado en responder.";
    if (!err.response) return "No hay conexión con el servidor. Revisa que el backend esté encendido.";
    return "Ocurrió un error inesperado.";
};

export default api;
