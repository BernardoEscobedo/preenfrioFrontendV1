import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRightLeft, PackageCheck } from "lucide-react";
import { mensajeError } from "../../api/axios";
import * as mantenimientosService from "../../services/mantenimientos.service";
import { fechaCorta } from "../../utils/formato";
import type { CamaraMantenimiento, FrutaDentro } from "../../types/mantenimiento";

// ============================================================================
// FRUTA POR SACAR (obligatorio)
// ============================================================================
// La cámara está fuera de servicio y todavía tiene fruta. Hay que sacarla:
//   · Sacar fruta  → a una caja temporal (línea fletera) u otra cámara
//   · Despachar    → módulo de Despachos
// El mantenimiento no se puede finalizar mientras haya fruta dentro.
// ============================================================================

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const CRITICIDAD: Record<number, string> = { 1: "chip--rojo", 2: "chip--ambar", 3: "chip--azul", 4: "chip--gris" };

export default function PanelFruta({ camara, onSacar }: { camara: CamaraMantenimiento; onSacar: () => void }) {
    const [lotes, setLotes] = useState<FrutaDentro[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let vivo = true;
        setCargando(true);
        mantenimientosService
            .getFrutaDentro(camara.id_camara)
            .then((l) => vivo && setLotes(l))
            .catch((e) => vivo && setError(mensajeError(e)))
            .finally(() => vivo && setCargando(false));
        return () => {
            vivo = false;
        };
    }, [camara.id_camara, camara.tarimas_dentro]);

    return (
        <div className="mant__fruta">
            <div className="mant__fruta-cabeza">
                <AlertTriangle size={18} />
                <strong>
                    Hay que sacar la fruta: {camara.tarimas_dentro} tarima(s) · {camara.cajas_dentro} cajas
                    {camara.tarimas_en_cola ? ` · ${camara.tarimas_en_cola} en cola` : ""}
                </strong>
                <div className="mant__fruta-acciones">
                    <button type="button" className="boton boton--primario boton--auto boton--chico" onClick={onSacar}>
                        <ArrowRightLeft size={14} /> Sacar fruta
                    </button>
                    <Link to="/despachos" className="boton boton--claro boton--auto boton--chico">
                        <PackageCheck size={14} /> Despachar
                    </Link>
                </div>
            </div>
            {error && <small className="campo__mensaje">{error}</small>}
            {cargando ? (
                <div className="spinner spinner--chico" />
            ) : (
                <ul className="mant__lotes">
                    {lotes.map((l) => (
                        <li key={l.id_ocupacion}>
                            <span className="lote-chip mono">{l.codigo_lote ?? "—"}</span>
                            <span>
                                {l.codigo_sku} · {l.codigo_productor} {l.codigo_finca} {l.nombre_finca}
                            </span>
                            <small>
                                {num(l.tarimas_disponibles)} tar · {num(l.cajas_disponibles)} cj · {l.acronimo_cc ?? ""} · empaque {fechaCorta(l.fecha_empaque)}
                            </small>
                            <span className={`chip ${CRITICIDAD[l.nivel_criticidad] ?? "chip--gris"}`}>{l.criticidad_texto}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
