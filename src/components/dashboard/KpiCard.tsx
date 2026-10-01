import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ============================================================================
// TARJETA DE INDICADOR
// ============================================================================
// Toda la tarjeta es un enlace al módulo correspondiente.
// alerta = true pinta el borde izquierdo de color: se usa cuando el valor
// requiere acción (hay fruta crítica, hay pulpeos vencidos).
// ============================================================================

export type Tono = "rojo" | "azul" | "verde" | "ambar";

interface Props {
    icono: LucideIcon;
    titulo: string;
    valor: string | number;
    detalle: string;
    tono: Tono;
    to: string;
    alerta?: boolean;
    barra?: number;         // 0 a 100, opcional
}

export default function KpiCard({ icono: Icono, titulo, valor, detalle, tono, to, alerta, barra }: Props) {
    return (
        <Link to={to} className={`kpi kpi--${tono} ${alerta ? "kpi--alerta" : ""}`}>
            <span className="kpi__icono">
                <Icono size={26} />
            </span>

            <div className="kpi__cuerpo">
                <span className="kpi__titulo">{titulo}</span>
                <strong className="kpi__valor">{valor}</strong>

                {barra !== undefined && (
                    <span className="barra">
                        <span
                            className="barra__relleno"
                            style={{ width: `${Math.min(Math.max(barra, 0), 100)}%` }}
                        />
                    </span>
                )}

                <span className="kpi__detalle">{detalle}</span>
            </div>

            <ChevronRight size={20} className="kpi__flecha" />
        </Link>
    );
}
