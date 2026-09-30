import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { leerToken, guardarToken, borrarToken, registrarAlPerderSesion } from "../api/axios";
import * as authService from "../services/auth.service";
import type { Usuario } from "../types/auth";

// ============================================================================
// SESIÓN
// ============================================================================
// Al abrir la app con un token guardado NO se confía a ciegas: se pide
// /auth/perfil. Si la cuenta se deshabilitó o le cambiaron el rol, el
// backend lo refleja ahí.
// ============================================================================

interface AuthContextValue {
    usuario: Usuario | null;
    cargando: boolean;
    autenticado: boolean;
    avisoSesion: string | null;
    iniciarSesion: (usuario: string, password: string, recordar: boolean) => Promise<Usuario>;
    cerrarSesion: (motivo?: string | null) => void;
    refrescarPerfil: () => Promise<Usuario>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();

    const [usuario, setUsuario] = useState<Usuario | null>(null);
    // true mientras se valida el token guardado: evita el parpadeo del login
    const [cargando, setCargando] = useState(true);
    const [avisoSesion, setAvisoSesion] = useState<string | null>(null);

    const cerrarSesion = useCallback(
        (motivo: string | null = null) => {
            borrarToken();
            setUsuario(null);
            setAvisoSesion(motivo);
            navigate("/login", { replace: true });
        },
        [navigate]
    );

    // El interceptor de axios llama a esto ante un 401 de sesión
    useEffect(() => {
        registrarAlPerderSesion(cerrarSesion);
    }, [cerrarSesion]);

    // ---- Restaurar sesión al abrir ----
    useEffect(() => {
        if (!leerToken()) {
            setCargando(false);
            return;
        }

        authService
            .obtenerPerfil()
            .then(setUsuario)
            .catch(() => borrarToken())
            .finally(() => setCargando(false));
    }, []);

    const iniciarSesion = async (usuarioTexto: string, password: string, recordar: boolean) => {
        const { token, usuario: datos } = await authService.login(usuarioTexto, password);
        guardarToken(token, recordar);
        setUsuario(datos);
        setAvisoSesion(null);
        return datos;
    };

    const refrescarPerfil = async () => {
        const perfil = await authService.obtenerPerfil();
        setUsuario(perfil);
        return perfil;
    };

    return (
        <AuthContext.Provider
            value={{
                usuario,
                cargando,
                autenticado: usuario !== null,
                avisoSesion,
                iniciarSesion,
                cerrarSesion,
                refrescarPerfil
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
    const contexto = useContext(AuthContext);
    if (!contexto) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
    return contexto;
};
