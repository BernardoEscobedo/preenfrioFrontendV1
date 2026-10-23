import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as mantenimientosService from "../../services/mantenimientos.service";
import { hoyISO } from "../../utils/formato";
import type { CamaraMantenimiento, RespuestaMantenimiento, TipoMantenimiento } from "../../types/mantenimiento";

// ============================================================================
// REGISTRAR MANTENIMIENTO · operativo+
// ============================================================================
//   modo "falla"       correctivo o emergencia: la cámara sale de servicio
//                      AL GUARDAR. La hora es cuando empezó la falla (no
//                      puede ser futura).
//   modo "preventivo"  se programa: la cámara sigue operando y sale de
//                      servicio a la hora programada (si ya pasó, al
//                      guardar).
//
// motivo  = resumen corto (60), lo que se lee en la tarjeta de la cámara
// observaciones = técnico, proveedor y detalle (500)
// ============================================================================

const horaActual = () => {
    const h = new Date();
    return `${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}`;
};

interface Props {
    camara: CamaraMantenimiento;
    modo: "falla" | "preventivo";
    onGuardado: (r: RespuestaMantenimiento) => void;
    onCerrar: () => void;
}

export default function ModalMantenimiento({ camara, modo, onGuardado, onCerrar }: Props) {
    const falla = modo === "falla";
    const [tipo, setTipo] = useState<TipoMantenimiento>(falla ? 2 : 1);
    const [fecha, setFecha] = useState(hoyISO());
    const [hora, setHora] = useState(horaActual());
    const [motivo, setMotivo] = useState("");
    const [prioridad, setPrioridad] = useState<1 | 2 | 3>(falla ? 1 : 2);
    const [observaciones, setObservaciones] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const ahora = `${hoyISO()}T${horaActual()}`;
    const inicio = `${fecha}T${hora}`;
    const yaPaso = inicio <= ahora;

    const guardar = async () => {
        const m = motivo.trim();
        if (m.length < 5) return setError("Escribe el motivo (al menos 5 caracteres).");
        if (m.length > 60) return setError("El motivo es de máximo 60 caracteres: el detalle va en observaciones.");
        if (!fecha || !hora) return setError("Indica fecha y hora.");
        if (falla && inicio > ahora) return setError("La falla no puede empezar en el futuro.");
        if (observaciones.length > 500) return setError("Las observaciones son de máximo 500 caracteres.");

        setError("");
        setEnviando(true);
        try {
            const r = await mantenimientosService.registrar({
                id_camara: camara.id_camara,
                tipo,
                fecha_inicio: fecha,
                hora_inicio: hora,
                motivo: m,
                prioridad,
                estado: falla ? 2 : 1,
                observaciones: observaciones.trim() || null
            });
            onGuardado(r);
        } catch (e) {
            setError(mensajeError(e));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={falla ? `Reportar falla · ${camara.nombre_camara}` : `Programar preventivo · ${camara.nombre_camara}`}
            subtitulo={falla ? "La cámara sale de servicio al guardar" : "La cámara sale de servicio a la hora programada"}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="button" className={`boton ${falla ? "boton--peligro" : "boton--primario"}`} onClick={guardar} disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : falla ? "Poner fuera de servicio" : "Programar"}
                    </button>
                </>
            }
        >
            {error && <div className="alerta alerta--error">{error}</div>}

            {camara.tarimas_dentro > 0 && (falla || yaPaso) && (
                <div className="alerta alerta--aviso">
                    <AlertTriangle size={16} className="icono-en-linea" /> {camara.nombre_camara} tiene {camara.tarimas_dentro} tarima(s) y{" "}
                    {camara.cajas_dentro} cajas dentro. Después de guardar tendrás que reubicarlas.
                </div>
            )}

            <div className="formulario">
                {falla && (
                    <label className="campo campo--completo">
                        <span>Tipo</span>
                        <div className="segmentado">
                            <button type="button" className={tipo === 2 ? "activo" : ""} onClick={() => setTipo(2)}>
                                Correctivo
                            </button>
                            <button
                                type="button"
                                className={tipo === 3 ? "activo" : ""}
                                onClick={() => {
                                    setTipo(3);
                                    setPrioridad(1);
                                }}
                            >
                                Emergencia
                            </button>
                        </div>
                    </label>
                )}

                <label className="campo">
                    <span>{falla ? "Fecha de la falla" : "Fecha programada"}</span>
                    <input type="date" value={fecha} min={falla ? undefined : hoyISO()} max={falla ? hoyISO() : undefined} onChange={(e) => setFecha(e.target.value)} disabled={enviando} />
                </label>
                <label className="campo">
                    <span>{falla ? "Hora en que falló" : "Hora programada"}</span>
                    <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={enviando} />
                    {!falla && yaPaso && <small className="campo__ayuda">Esa hora ya pasó: la cámara sale de servicio al guardar.</small>}
                </label>

                <label className="campo campo--completo">
                    <span>
                        Motivo <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        maxLength={60}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder={falla ? "Ej. No baja temperatura, falla del compresor" : "Ej. Limpieza de evaporadores"}
                        disabled={enviando}
                        autoFocus
                    />
                    <small className="campo__contador">{motivo.length}/60</small>
                </label>

                <label className="campo">
                    <span>Prioridad</span>
                    <select value={prioridad} onChange={(e) => setPrioridad(Number(e.target.value) as 1 | 2 | 3)} disabled={enviando || tipo === 3}>
                        <option value={1}>Alta</option>
                        <option value={2}>Media</option>
                        <option value={3}>Baja</option>
                    </select>
                </label>

                <label className="campo campo--completo">
                    <span>
                        Observaciones <small>(técnico, proveedor, detalle)</small>
                    </span>
                    <textarea rows={3} maxLength={500} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} disabled={enviando} />
                    <small className="campo__contador">{observaciones.length}/500</small>
                </label>
            </div>
        </Modal>
    );
}
