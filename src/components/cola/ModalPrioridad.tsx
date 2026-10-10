import { useState } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as ocupacionesService from "../../services/ocupaciones.service";
import type { FilaCola, RespuestaPrioridad } from "../../types/ocupacion";

// ============================================================================
// PRIORIDAD MANUAL EN LA COLA · supervisor+
// ============================================================================
//   0      orden automático (criticidad → fruta más vieja → llegada)
//   1–10   urgente; a mayor número, más al frente. GANA sobre el automático.
//
// El motivo es obligatorio al priorizar: saltarse el orden tiene que quedar
// justificado.
//
// "Al frente" calcula la prioridad que deja esta fila primero de su cámara.
// ============================================================================

interface Props {
    fila: FilaCola;
    prioridadMaxima: number;
    modo: "frente" | "editar" | "quitar";
    onGuardado: (r: RespuestaPrioridad) => void;
    onCerrar: () => void;
}

export default function ModalPrioridad({ fila, prioridadMaxima, modo, onGuardado, onCerrar }: Props) {
    const alFrente = Math.min(prioridadMaxima + 1, 10);
    const inicial = modo === "frente" ? alFrente : modo === "quitar" ? 0 : Math.max(fila.prioridad, 1);

    const [prioridad, setPrioridad] = useState(String(inicial));
    const [motivo, setMotivo] = useState(modo === "quitar" ? "" : fila.motivo_prioridad ?? "");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const n = Number(prioridad);

    const guardar = async () => {
        if (!Number.isInteger(n) || n < 0 || n > 10) return setError("La prioridad va de 0 a 10.");
        if (n > 0 && motivo.trim().length < 5) return setError("Explica por qué se adelanta (al menos 5 caracteres).");
        if (motivo.length > 200) return setError("El motivo no puede exceder 200 caracteres.");
        setError("");
        setEnviando(true);
        try {
            onGuardado(await ocupacionesService.setPrioridad(fila.id_ocupacion, n, n > 0 ? motivo.trim() : null));
        } catch (e) {
            setError(mensajeError(e));
            setEnviando(false);
        }
    };

    const titulo =
        modo === "quitar" ? "Regresar al orden automático" : modo === "frente" ? "Mandar al frente de la cola" : "Prioridad manual";

    return (
        <Modal
            titulo={titulo}
            subtitulo={`${fila.codigo_lote ?? "Sin lote"} · ${fila.codigo_sku ?? ""} · posición ${fila.posicion}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            ancho="chico"
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="button" className="boton boton--primario" onClick={guardar} disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : "Guardar"}
                    </button>
                </>
            }
        >
            {error && <div className="alerta alerta--error">{error}</div>}

            {modo === "quitar" ? (
                <p>
                    La fila vuelve a ordenarse sola: primero lo crítico (cita encima o fruta vieja), luego la fruta más
                    antigua y al final por llegada.
                </p>
            ) : (
                <div className="formulario">
                    <label className="campo">
                        <span>Prioridad (1 a 10)</span>
                        <input
                            type="number"
                            min={0}
                            max={10}
                            step={1}
                            value={prioridad}
                            onChange={(e) => setPrioridad(e.target.value)}
                            disabled={enviando}
                        />
                        <small className="campo__ayuda">
                            Mayor número, más al frente. Con {alFrente} queda primero de esta cámara.
                        </small>
                    </label>
                    <label className="campo campo--completo">
                        <span>
                            Motivo <em className="campo__requerido">*</em>
                        </span>
                        <textarea
                            rows={3}
                            maxLength={200}
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Ej. El cliente adelantó la cita / camión de McAllen ya en andén"
                            disabled={enviando}
                            autoFocus
                        />
                        <small className="campo__contador">{motivo.length}/200</small>
                    </label>
                </div>
            )}
        </Modal>
    );
}
