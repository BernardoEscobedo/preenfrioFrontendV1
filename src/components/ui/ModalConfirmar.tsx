import { useState } from "react";
import type { ReactNode } from "react";
import Modal from "./Modal";
import { mensajeError } from "../../api/axios";

// ============================================================================
// MODAL DE CONFIRMACIÓN SIMPLE
// ============================================================================
// Para acciones que no necesitan motivo (por ejemplo, eliminar una cuenta
// creada por error). Si onConfirmar falla, el error se muestra aquí y el
// modal se queda abierto.
// ============================================================================

interface Props {
    titulo: string;
    descripcion: ReactNode;
    etiquetaConfirmar: string;
    tono?: "peligro" | "primario";
    onConfirmar: () => Promise<void>;
    onCerrar: () => void;
}

export default function ModalConfirmar({
    titulo,
    descripcion,
    etiquetaConfirmar,
    tono = "peligro",
    onConfirmar,
    onCerrar
}: Props) {
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState("");

    const confirmar = async () => {
        setError("");
        setEnviando(true);
        try {
            await onConfirmar();
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
            <div className="modal__descripcion">{descripcion}</div>
            {error && <div className="alerta alerta--error">{error}</div>}
        </Modal>
    );
}
