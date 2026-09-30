import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RutaProtegida from "./components/RutaProtegida";

// ============================================================================
// RUTAS
// ============================================================================
//   /login   pública
//   /        requiere sesión
//
// Para proteger por rol una pantalla futura:
//   <Route element={<RutaProtegida rolMinimo={ROLES.COORDINADOR} />}>
//       <Route path="/productores" element={<Productores />} />
//   </Route>
// ============================================================================

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<RutaProtegida />}>
                <Route path="/" element={<Dashboard />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
