import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";

// ============================================================================
// SELECTOR DE PIEZA · elegir de la lista o dar de alta ahí mismo
// ============================================================================
// Se usa para operador, tracto y cada caja. En modo "nuevo" muestra los
// campos de alta; la pieza se registra en la BD hasta confirmar el despacho
// (todo en una sola transacción).
// ============================================================================

export interface OpcionPieza {
    id: number;
    texto: string;
    detalle?: string;
}

interface Props {
    titulo: string;
    nuevo: boolean;
    idElegido: string;
    opciones: OpcionPieza[];
    vacio: string;
    textoNuevo: string;
    error?: string;
    deshabilitado?: boolean;
    onElegir: (id: string) => void;
    onModoNuevo: (nuevo: boolean) => void;
    children: ReactNode;
}

export default function SelectorPieza({
    titulo,
    nuevo,
    idElegido,
    opciones,
    vacio,
    textoNuevo,
    error,
    deshabilitado,
    onElegir,
    onModoNuevo,
    children
}: Props) {
    return (
        <div className={`pieza ${error ? "pieza--error" : ""}`}>
            <div className="pieza__cabeza">
                <strong>{titulo}</strong>
                <button
                    type="button"
                    className="enlace enlace--verde pieza__cambiar"
                    onClick={() => onModoNuevo(!nuevo)}
                    disabled={deshabilitado}
                >
                    {nuevo ? (
                        <>
                            <X size={14} /> Elegir de la lista
                        </>
                    ) : (
                        <>
                            <Plus size={14} /> {textoNuevo}
                        </>
                    )}
                </button>
            </div>

            {nuevo ? (
                <div className="formulario pieza__nuevo">{children}</div>
            ) : opciones.length === 0 ? (
                <p className="pieza__vacio">
                    {vacio}{" "}
                    <button type="button" className="enlace enlace--verde" onClick={() => onModoNuevo(true)}>
                        Darlo de alta
                    </button>
                </p>
            ) : (
                <select value={idElegido} onChange={(e) => onElegir(e.target.value)} disabled={deshabilitado}>
                    <option value="">Selecciona…</option>
                    {opciones.map((o) => (
                        <option key={o.id} value={o.id}>
                            {o.texto}
                            {o.detalle ? ` · ${o.detalle}` : ""}
                        </option>
                    ))}
                </select>
            )}

            {error && <small className="campo__mensaje">{error}</small>}
        </div>
    );
}
