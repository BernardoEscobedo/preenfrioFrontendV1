import { useState } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as mantenimientosService from "../../services/mantenimientos.service";
import { fechaCorta, hoyISO } from "../../utils/formato";
import type { CamaraMantenimiento, RespuestaMantenimiento } from "../../types/mantenimiento";

// ============================================================================
// FINALIZAR MANTENIMIENTO · operativo+
// ============================================================================
// La cámara vuelve a operar. Se captura cuándo quedó lista y qué se hizo.
// ============================================================================

const horaActual = () => {
    const h = new Date();
    return `${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}`;
};

interface Props {
    camara: CamaraMantenimiento;
    onGuardado: (r: RespuestaMantenimiento) => void;
    onCerrar: () => void;
}

export default function ModalFinalizar({ camara, onGuardado, onCerrar }: Props) {
    const [fecha, setFecha] = useState(hoyISO());
    const [hora, setHora] = useState(horaActual());
    const [comentario, setComentario] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const inicio = `${String(camara.fecha_inicio_activo ?? "").slice(0, 10)}T${String(camara.hora_inicio_activo ?? "").slice(0, 5)}`;

    const guardar = async () => {
        if (!fecha || !hora) return setError("Indica fecha y hora.");
        const fin = `${fecha}T${hora}`;
        if (fin > `${hoyISO()}T${horaActual()}`) return setError("La hora no puede ser futura.");
        if (fin < inicio) return setError("No puede terminar antes de que empezó.");
        if (comentario.trim().length < 5) return setError("Escribe qué se hizo (al menos 5 caracteres).");

        setError("");
        setEnviando(true);
        try {
            if (!camara.id_activo) throw new Error("La cámara no tiene un mantenimiento en proceso");
            onGuardado(await mantenimientosService.finalizar(camara.id_activo, { fecha, hora, comentario: comentario.trim() }));
        } catch (e) {
            setError(e instanceof Error && !("response" in e) ? e.message : mensajeError(e));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={`Finalizar mantenimiento · ${camara.nombre_camara}`}
            subtitulo={`${camara.motivo_activo ?? ""} · desde ${fechaCorta(camara.fecha_inicio_activo)} ${String(camara.hora_inicio_activo ?? "").slice(0, 5)}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="button" className="boton boton--primario" onClick={guardar} disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : "La cámara vuelve a operar"}
                    </button>
                </>
            }
        >
            {error && <div className="alerta alerta--error">{error}</div>}
            <div className="formulario">
                <label className="campo">
                    <span>Fecha en que quedó lista</span>
                    <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} disabled={enviando} />
                </label>
                <label className="campo">
                    <span>Hora</span>
                    <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={enviando} />
                </label>
                <label className="campo campo--completo">
                    <span>
                        ¿Qué se hizo? <em className="campo__requerido">*</em>
                    </span>
                    <textarea
                        rows={3}
                        maxLength={500}
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        placeholder="Ej. Se cambió el capacitor del compresor. Técnico: Frío Sur."
                        disabled={enviando}
                        autoFocus
                    />
                    <small className="campo__contador">{comentario.length}/500</small>
                </label>
            </div>
        </Modal>
    );
}
