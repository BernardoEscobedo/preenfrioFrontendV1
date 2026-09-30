import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { NOMBRE_ROL } from "../config/permissions";
import { obtenerMisCamaras } from "../services/auth.service";
import { mensajeError } from "../api/axios";
import type { Camara } from "../types/auth";
import "../styles/dashboard.css";

// ============================================================================
// DASHBOARD (provisional)
// ============================================================================
// Solo confirma que la sesión funciona de punta a punta: usuario, rol y sus
// cámaras con el alcance aplicado por el backend.
// ============================================================================

export default function Dashboard() {
    const { usuario, cerrarSesion } = useAuth();
    const [camaras, setCamaras] = useState<Camara[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        obtenerMisCamaras()
            .then(setCamaras)
            .catch((err) => setError(mensajeError(err)));
    }, []);

    const nombre = [usuario?.nombre_empleado, usuario?.apellidos_empleado]
        .filter(Boolean)
        .join(" ");

    return (
        <div className="dashboard">
            <header className="dashboard__barra">
                <div className="dashboard__marca">
                    <img src="/LOGO_CHANITOS.png" alt="Frutas Chanitos" />
                    <div>
                        <strong>Control de Preenfrío</strong>
                        <span className="dashboard__sub">Frutas Chanitos</span>
                    </div>
                </div>

                <div className="dashboard__usuario">
                    <div className="dashboard__usuario-texto">
                        <span>{nombre || usuario?.usuario}</span>
                        <small>{NOMBRE_ROL[usuario?.id_role ?? 0] ?? usuario?.rol}</small>
                    </div>
                    <button className="boton boton--secundario" onClick={() => cerrarSesion()}>
                        Cerrar sesión
                    </button>
                </div>
            </header>

            <main className="dashboard__contenido">
                <h1>Hola, {usuario?.nombre_empleado || usuario?.usuario} 👋</h1>
                <p className="dashboard__texto">
                    {usuario && usuario.id_role <= 2
                        ? "Tu rol tiene acceso a todas las cámaras."
                        : "Solo ves las cámaras de tu zona de trabajo."}
                </p>

                {error && <div className="alerta alerta--error">{error}</div>}

                <section className="dashboard__camaras">
                    {camaras.length === 0 && !error && (
                        <p className="dashboard__vacio">
                            No tienes cámaras asignadas. Pide al administrador tu zona de trabajo.
                        </p>
                    )}

                    {camaras.map((c) => (
                        <article key={c.id_camara} className="tarjeta-camara">
                            <span className={`etiqueta etiqueta--${c.tipo_camara === 1 ? "preenfrio" : "conserva"}`}>
                                {c.tipo_camara === 1 ? "Preenfrío" : "Conservación"}
                            </span>
                            <h3>{c.nombre_camara}</h3>
                            <p>{c.ubicacion}</p>
                        </article>
                    ))}
                </section>
            </main>
        </div>
    );
}
