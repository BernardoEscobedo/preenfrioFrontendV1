import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { tieneRol } from "../config/permissions";
import type { Rol } from "../config/permissions";

// ============================================================================
// RUTA PROTEGIDA
// ============================================================================
// Sin sesión → al login, recordando a dónde quería ir.
// Con rolMinimo y sin el rol → al inicio.
// ============================================================================

interface Props {
    rolMinimo?: Rol;
}

export default function RutaProtegida({ rolMinimo }: Props) {
    const { autenticado, cargando, usuario } = useAuth();
    const location = useLocation();

    if (cargando) {
        return (
            <div className="pantalla-carga">
                <div className="spinner" />
                <p>Validando sesión…</p>
            </div>
        );
    }

    if (!autenticado) {
        return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
    }

    if (rolMinimo && !tieneRol(usuario, rolMinimo)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
