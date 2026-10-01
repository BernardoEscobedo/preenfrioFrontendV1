import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "../components/layout/Sidebar";
import "../styles/layout.css";

// ============================================================================
// MARCO DE LA APLICACIÓN
// ============================================================================
// Menú lateral fijo + área de contenido donde se pinta cada página.
// En pantallas angostas el menú se vuelve cajón y aparece el botón ☰.
// ============================================================================

export default function MainLayout() {
    const [menuAbierto, setMenuAbierto] = useState(false);

    return (
        <div className="app">
            <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

            <button
                type="button"
                className="app__hamburguesa"
                onClick={() => setMenuAbierto(true)}
                aria-label="Abrir menú"
            >
                <Menu size={24} />
            </button>

            <main className="app__contenido">
                <Outlet />
            </main>
        </div>
    );
}
