import { Link } from "react-router-dom";
import { Construction } from "lucide-react";
import EncabezadoPagina from "../components/layout/EncabezadoPagina";

// ============================================================================
// PÁGINA EN CONSTRUCCIÓN
// ============================================================================
// Ocupa el lugar de los módulos que todavía no tienen pantalla, para que el
// menú y los enlaces del dashboard funcionen desde hoy. Cada vez que se
// construya un módulo, se reemplaza su ruta en App.tsx.
// ============================================================================

export default function PaginaPendiente({ titulo }: { titulo: string }) {
    return (
        <div className="dash">
            <EncabezadoPagina titulo={titulo} subtitulo="Módulo en construcción" />

            <section className="panel pendiente">
                <Construction size={48} />
                <h2>Esta pantalla todavía no está lista</h2>
                <p>El backend de este módulo ya funciona; falta construir su vista.</p>
                <Link to="/" className="boton boton--primario pendiente__boton">
                    Volver al inicio
                </Link>
            </section>
        </div>
    );
}
