import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../ui/Modal";
import ChipCriticidad from "./ChipCriticidad";
import { mensajeError } from "../../api/axios";
import * as ocupacionesService from "../../services/ocupaciones.service";
import { fechaCorta, hoyISO } from "../../utils/formato";
import type { FilaCola, RespuestaIngreso } from "../../types/ocupacion";

// ============================================================================
// INGRESAR A CÁMARA (de la cola) · operativo+
// ============================================================================
// Se ingresa cuando físicamente se mete la fruta. Se puede ingresar una
// parte: el resto sigue en cola en su mismo lugar.
//
// La BD nunca deja meter más de lo que espera ni de lo que cabe
// (fn_promover_de_cola recorta con LEAST). Aquí se propone el máximo posible.
//
// FUERA DE ORDEN: si delante hay fruta más crítica, se avisa y se pide
// confirmar. No se bloquea: en el piso a veces la tarima accesible es otra.
// ============================================================================

const num = (v: number | string | null | undefined) => Number(v ?? 0);

const horaActual = () => {
    const h = new Date();
    return `${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}`;
};

interface Props {
    fila: FilaCola;
    nombreCamara: string;
    espacio: number;
    /** Filas que van antes en la cola y son más críticas */
    saltadas: FilaCola[];
    onGuardado: (r: RespuestaIngreso) => void;
    onCerrar: () => void;
}

export default function ModalIngresar({ fila, nombreCamara, espacio, saltadas, onGuardado, onCerrar }: Props) {
    const enEspera = num(fila.tarimas_en_espera);
    const maximo = Math.max(Math.min(enEspera, espacio), 0);

    const [tarimas, setTarimas] = useState(String(maximo));
    const [fecha, setFecha] = useState(hoyISO());
    const [hora, setHora] = useState(horaActual());
    const [confirmaOrden, setConfirmaOrden] = useState(false);
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const n = Number(tarimas);
    const fueraDeOrden = saltadas.length > 0;

    const guardar = async () => {
        if (!Number.isInteger(n) || n <= 0) return setError("Indica cuántas tarimas entran (entero mayor a 0).");
        if (n > enEspera) return setError(`Solo hay ${enEspera} tarimas en espera de este proceso.`);
        if (n > espacio) return setError(`La cámara solo tiene espacio para ${espacio} tarima(s).`);
        if (fecha > hoyISO()) return setError("La fecha de ingreso no puede ser futura.");
        if (fueraDeOrden && !confirmaOrden) return setError("Confirma que vas a ingresar fuera del orden sugerido.");

        setError("");
        setEnviando(true);
        try {
            onGuardado(await ocupacionesService.ingresar(fila.id_ocupacion, n, fecha, hora));
        } catch (e) {
            setError(mensajeError(e));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={`Ingresar a ${nombreCamara}`}
            subtitulo={`${fila.codigo_lote ?? "Sin lote"} · ${fila.codigo_sku ?? ""}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="boton boton--primario"
                        onClick={guardar}
                        disabled={enviando || maximo === 0}
                    >
                        {enviando ? <span className="spinner spinner--chico" /> : `Ingresar ${n > 0 ? n : ""} tarima(s)`}
                    </button>
                </>
            }
        >
            <div className="cola__resumen">
                <div>
                    <small>Finca</small>
                    <strong>
                        {fila.codigo_finca} {fila.nombre_finca}
                    </strong>
                </div>
                <div>
                    <small>Empaque</small>
                    <strong>
                        {fila.fecha_empaque ? fechaCorta(fila.fecha_empaque) : "—"}
                        {fila.dias_desde_empaque !== null ? ` · ${fila.dias_desde_empaque} d` : ""}
                    </strong>
                </div>
                <div>
                    <small>Cita</small>
                    <strong>{fila.fecha_entrega ? fechaCorta(fila.fecha_entrega) : "Sin cita"}</strong>
                </div>
                <div>
                    <small>Criticidad</small>
                    <ChipCriticidad nivel={fila.nivel_criticidad} texto={fila.criticidad_texto} />
                </div>
                <div>
                    <small>En espera</small>
                    <strong>{enEspera} tar</strong>
                </div>
                <div>
                    <small>Espacio en cámara</small>
                    <strong>{espacio} tar</strong>
                </div>
            </div>

            {maximo === 0 && (
                <div className="alerta alerta--error">La cámara no tiene espacio. Despacha o mueve fruta antes de ingresar.</div>
            )}

            {fueraDeOrden && (
                <div className="alerta alerta--aviso">
                    <AlertTriangle size={16} className="icono-en-linea" /> Delante hay {saltadas.length} proceso(s) más
                    crítico(s). El más apremiante es <strong>{saltadas[0].codigo_lote}</strong>: {saltadas[0].motivo_criticidad}.
                    <label className="interruptor cola__confirma">
                        <input
                            type="checkbox"
                            checked={confirmaOrden}
                            onChange={(e) => setConfirmaOrden(e.target.checked)}
                            disabled={enviando}
                        />
                        Ingresar de todas formas
                    </label>
                </div>
            )}

            {error && <div className="alerta alerta--error">{error}</div>}

            <div className="formulario">
                <label className="campo">
                    <span>
                        Tarimas que entran <small>(máx. {maximo})</small>
                    </span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={maximo}
                        step={1}
                        value={tarimas}
                        onChange={(e) => setTarimas(e.target.value)}
                        disabled={enviando || maximo === 0}
                        autoFocus
                    />
                    {n > 0 && n < enEspera && (
                        <small className="campo__ayuda">Quedan {enEspera - n} tarima(s) en cola, en el mismo lugar.</small>
                    )}
                </label>
                <label className="campo">
                    <span>Fecha</span>
                    <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} disabled={enviando} />
                </label>
                <label className="campo">
                    <span>Hora</span>
                    <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={enviando} />
                </label>
            </div>
        </Modal>
    );
}
