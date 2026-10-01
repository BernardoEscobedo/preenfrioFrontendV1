import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PaginaPendiente from "./pages/PaginaPendiente";
import RutaProtegida from "./components/RutaProtegida";
import MainLayout from "./layouts/MainLayout";
import { RUTAS_MENU } from "./config/menu";
import Productores from "./pages/catalogos/Productores";
import Fincas from "./pages/catalogos/Fincas";
import Empleados from "./pages/catalogos/Empleados";
import Camaras from "./pages/catalogos/Camaras";
import Usuarios from "./pages/Usuarios";

// ============================================================================
// RUTAS
// ============================================================================
// PARA AGREGAR UN MÓDULO NUEVO: solo se agrega una línea en MODULOS con su
// ruta (la misma de menu.ts). Lo que no esté aquí muestra "en construcción".
// ============================================================================

const MODULOS: Record<string, ReactElement> = {
    "/catalogos/productores": <Productores />,
    "/catalogos/fincas": <Fincas />,
    "/catalogos/empleados": <Empleados />,
    "/catalogos/camaras": <Camaras />,
    "/usuarios": <Usuarios />
};

const RUTAS = RUTAS_MENU.filter((r) => r.ruta !== "/");

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<RutaProtegida />}>
                <Route element={<MainLayout />}>
                    <Route index element={<Dashboard />} />

                    {RUTAS.map((r) => (
                        <Route key={r.ruta} element={<RutaProtegida rolMinimo={r.rolMinimo} />}>
                            <Route
                                path={r.ruta}
                                element={MODULOS[r.ruta] ?? <PaginaPendiente titulo={r.etiqueta} />}
                            />
                        </Route>
                    ))}
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
