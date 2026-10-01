import { useState } from "react";
import type { ReactNode } from "react";
import Modal from "./Modal";
import { mensajeError } from "../../api/axios";

// ============================================================================
// MODAL DE CONFIRMACIÓN CON MOTIVO
// ============================================================================
// Para bajas y reactivaciones. El motivo queda en el historial, por eso se
// exige un mínimo de 10 caracteres (mismo criterio que el backend).
//
// onConfirmar debe lanzar error si falla: el modal lo muestra y se queda
// abierto. Si sale bien, el padre lo cierra.
// ============================================================================

const MINIMO = 10;
const MAXIMO = 250;

interface Props {
    titulo: string;
    descripcion?: ReactNode;
    obligatorio: boolean;
    etiquetaConfirmar: string;
    tono: "peligro" | "primario";
    onConfirmar: (motivo: string) => Promise<void>;
    onCerrar: () => void;
}

export default function ModalMotivo({
    titulo,
    descripcion,
    obligatorio,
    etiquetaConfirmar,
    tono,
    onConfirmar,
    onCerrar
}: Props) {
    const [motivo, setMotivo] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const confirmar = async () => {
        const texto = motivo.trim();

        if (obligatorio && texto.length === 0) {
            setError("Escribe el motivo: queda registrado en el historial.");
            return;
        }

        if (texto.length > 0 && texto.length < MINIMO) {
            setError(`Explica un poco más: usa al menos ${MINIMO} caracteres.`);
            return;
        }

        setError("");
        setEnviando(true);

        try {
            await onConfirmar(texto);
        } catch (err) {
            setError(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={titulo}
            onCerrar={onCerrar}
            bloqueado={enviando}
            ancho="chico"
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={`boton ${tono === "peligro" ? "boton--peligro" : "boton--primario"}`}
                        onClick={confirmar}
                        disabled={enviando}
                    >
                        {enviando ? <span className="spinner spinner--chico" /> : etiquetaConfirmar}
                    </button>
                </>
            }
        >
            {descripcion && <div className="modal__descripcion">{descripcion}</div>}

            {error && <div className="alerta alerta--error">{error}</div>}

            <label className="campo">
                <span>
                    Motivo {obligatorio ? <em className="campo__requerido">*</em> : <small>(opcional)</small>}
                </span>
                <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    maxLength={MAXIMO}
                    rows={3}
                    placeholder="Ej. Terminó su contrato el 30 de septiembre"
                    disabled={enviando}
                    autoFocus
                />
                <small className="campo__contador">
                    {motivo.length}/{MAXIMO}
                </small>
            </label>
        </Modal>
    );
}
