import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, LogOut, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { MENU } from "../../config/menu";
import { NOMBRE_ROL, tieneRol } from "../../config/permissions";

// ============================================================================
// MENÚ LATERAL
// ============================================================================
// Fondo: /SIDEBAR_DASHBOARD.jpg con velo verde oscuro (ver layout.css).
// Las opciones se filtran por rol.
// En pantallas angostas es un cajón que se abre con el botón ☰.
// ============================================================================

interface Props {
    abierto: boolean;
    onCerrar: () => void;
}

export default function Sidebar({ abierto, onCerrar }: Props) {
    const { usuario, cerrarSesion } = useAuth();
    const location = useLocation();

    // El grupo empieza abierto si estás en una de sus páginas
    const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>(() => {
        const inicial: Record<string, boolean> = {};
        MENU.forEach((item) => {
            if (item.hijos?.some((h) => location.pathname.startsWith(h.ruta))) {
                inicial[item.ruta] = true;
            }
        });
        return inicial;
    });

    const visibles = MENU.filter((item) => tieneRol(usuario, item.rolMinimo));

    const nombre = [usuario?.nombre_empleado, usuario?.apellidos_empleado]
        .filter(Boolean)
        .join(" ");

    const iniciales = nombre
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase();

    return (
        <>
            {/* Velo para cerrar tocando fuera (solo pantallas angostas) */}
            <div
                className={`sidebar-velo ${abierto ? "sidebar-velo--visible" : ""}`}
                onClick={onCerrar}
                aria-hidden="true"
            />

            <aside className={`sidebar ${abierto ? "sidebar--abierto" : ""}`}>
                <div className="sidebar__marca">
                    <img src="/LOGO_CHANITOS.png" alt="Frutas Chanitos" />
                    <button className="sidebar__cerrar" onClick={onCerrar} aria-label="Cerrar menú">
                        <X size={22} />
                    </button>
                </div>

                <nav className="sidebar__nav">
                    {visibles.map((item) => {
                        const Icono = item.icono;

                        if (item.hijos) {
                            const hijos = item.hijos.filter((h) => tieneRol(usuario, h.rolMinimo));
                            const abiertoGrupo = Boolean(gruposAbiertos[item.ruta]);
                            const activo = hijos.some((h) => location.pathname.startsWith(h.ruta));

                            return (
                                <div key={item.ruta} className="sidebar__grupo">
                                    <button
                                        type="button"
                                        className={`sidebar__item ${activo ? "sidebar__item--padre-activo" : ""}`}
                                        onClick={() =>
                                            setGruposAbiertos((g) => ({ ...g, [item.ruta]: !g[item.ruta] }))
                                        }
                                        aria-expanded={abiertoGrupo}
                                    >
                                        <Icono size={20} />
                                        <span>{item.etiqueta}</span>
                                        <ChevronDown
                                            size={18}
                                            className={`sidebar__flecha ${abiertoGrupo ? "sidebar__flecha--abierta" : ""}`}
                                        />
                                    </button>

                                    {abiertoGrupo && (
                                        <div className="sidebar__hijos">
                                            {hijos.map((h) => (
                                                <NavLink
                                                    key={h.ruta}
                                                    to={h.ruta}
                                                    onClick={onCerrar}
                                                    className={({ isActive }) =>
                                                        `sidebar__hijo ${isActive ? "sidebar__hijo--activo" : ""}`
                                                    }
                                                >
                                                    {h.etiqueta}
                                                </NavLink>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <NavLink
                                key={item.ruta}
                                to={item.ruta}
                                end={item.ruta === "/"}
                                onClick={onCerrar}
                                className={({ isActive }) =>
                                    `sidebar__item ${isActive ? "sidebar__item--activo" : ""}`
                                }
                            >
                                <Icono size={20} />
                                <span>{item.etiqueta}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="sidebar__pie">
                    <div className="sidebar__usuario">
                        <span className="sidebar__avatar">{iniciales || "?"}</span>
                        <div>
                            <strong>{nombre || usuario?.usuario}</strong>
                            <small>{NOMBRE_ROL[usuario?.id_role ?? 0] ?? usuario?.rol}</small>
                        </div>
                    </div>

                    <button type="button" className="sidebar__salir" onClick={() => cerrarSesion()}>
                        <LogOut size={18} />
                        <span>Cerrar sesión</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
