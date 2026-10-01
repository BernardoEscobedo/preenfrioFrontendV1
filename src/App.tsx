import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PaginaPendiente from "./pages/PaginaPendiente";
import RutaProtegida from "./components/RutaProtegida";
import MainLayout from "./layouts/MainLayout";
import { RUTAS_MENU } from "./config/menu";

// ============================================================================
// RUTAS
// ============================================================================
//   /login            pública
//   /                 dashboard (con menú lateral)
//   resto del menú    generadas desde config/menu.ts, cada una protegida
//                     con el rol mínimo de su opción
//
// Cuando se construya un módulo, se agrega su Route ANTES del map y se
// quita de la lista de pendientes, por ejemplo:
//   <Route path="/recepciones" element={<Recepciones />} />
// ============================================================================

const PENDIENTES = RUTAS_MENU.filter((r) => r.ruta !== "/");

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<RutaProtegida />}>
                <Route element={<MainLayout />}>
                    <Route index element={<Dashboard />} />

                    {PENDIENTES.map((r) => (
                        <Route key={r.ruta} element={<RutaProtegida rolMinimo={r.rolMinimo} />}>
                            <Route path={r.ruta} element={<PaginaPendiente titulo={r.etiqueta} />} />
                        </Route>
                    ))}
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
