import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PaginaPendiente from "./pages/PaginaPendiente";
import RutaProtegida from "./components/RutaProtegida";
import MainLayout from "./layouts/MainLayout";
import { RUTAS_MENU } from "./config/menu";
import Empleados from "./pages/catalogos/Empleados";

// ============================================================================
// RUTAS
// ============================================================================
//   /login            pública
//   /                 dashboard (con menú lateral)
//   resto del menú    generadas desde config/menu.ts, cada una protegida
//                     con el rol mínimo de su opción
//
// PARA AGREGAR UN MÓDULO NUEVO: solo se agrega una línea en MODULOS con su
// ruta (la misma de menu.ts). Lo que no esté aquí muestra "en construcción".
// ============================================================================

const MODULOS: Record<string, ReactElement> = {
    "/catalogos/empleados": <Empleados />
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
