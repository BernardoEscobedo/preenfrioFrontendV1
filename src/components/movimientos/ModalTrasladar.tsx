import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as movimientosService from "../../services/movimientos.service";
import { fechaCorta, hoyISO } from "../../utils/formato";
import type { CamaraStock, RespuestaTraslado, Trasladable } from "../../types/movimiento";

// ============================================================================
// TRASLADAR A CONSERVACIÓN · supervisor+
// ============================================================================
// Mueve fruta de un proceso que está DENTRO de un preenfrío a una cámara de
// conservación. El trigger trg_sync_ocupacion_movimiento descuenta del
// preenfrío y suma en la conserva: esta pantalla no toca inventario.
//
//   · Puede ser parcial: el resto se queda en el preenfrío.
//   · Las cajas se proponen en proporción a las tarimas, editables.
//   · Se propone la conservación de la misma ubicación (planta) que el
//     preenfrío; se puede elegir otra.
//   · Avisa (no bloquea) si la conserva no tiene espacio o si la fruta lleva
//     pocas horas enfriándose.
// ============================================================================

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const HORAS_MINIMAS = 12;

const horaActual = () => {
    const h = new Date();
    return `${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}`;
};

interface Props {
    proceso: Trasladable;
    conservaciones: CamaraStock[];
    ubicacionOrigen: string | null;
    onGuardado: (r: RespuestaTraslado) => void;
    onCerrar: () => void;
}

export default function ModalTrasladar({ proceso, conservaciones, ubicacionOrigen, onGuardado, onCerrar }: Props) {
    const maxTar = num(proceso.tarimas_disponibles);
    const maxCaj = num(proceso.cajas_disponibles);

    const opciones = useMemo(
        () => conservaciones.filter((c) => !c.en_mantenimiento),
        [conservaciones]
    );
    const sugerida =
        opciones.find((c) => ubicacionOrigen && c.ubicacion && c.ubicacion === ubicacionOrigen) ?? opciones[0];

    const [destino, setDestino] = useState(sugerida ? String(sugerida.id_camara) : "");
    const [tarimas, setTarimas] = useState(String(maxTar));
    const [cajas, setCajas] = useState(String(maxCaj));
    const [cajasManual, setCajasManual] = useState(false);
    const [temperatura, setTemperatura] = useState("");
    const [fecha, setFecha] = useState(hoyISO());
    const [hora, setHora] = useState(horaActual());
    const [observaciones, setObservaciones] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const camaraDestino = opciones.find((c) => String(c.id_camara) === destino);
    const libres = camaraDestino ? Math.max(num(camaraDestino.tarimas_disponibles_operativas), 0) : 0;
    const nTar = tarimas === "" ? 0 : Number(tarimas);
    const nCaj = cajas === "" ? 0 : Number(cajas);
    const horas = proceso.horas_en_preenfrio === null ? null : num(proceso.horas_en_preenfrio);

    const cambiarTarimas = (v: string) => {
        setTarimas(v);
        if (!cajasManual) {
            const t = Number(v);
            if (v === "" || isNaN(t)) setCajas("");
            else if (t >= maxTar) setCajas(String(maxCaj));
            else setCajas(String(maxTar > 0 ? Math.round((maxCaj / maxTar) * t) : 0));
        }
    };

    const guardar = async () => {
        if (!destino) return setError("Elige la cámara de conservación.");
        if (!Number.isInteger(nTar) || nTar < 0 || !Number.isInteger(nCaj) || nCaj < 0)
            return setError("Tarimas y cajas deben ser enteros mayores o iguales a 0.");
        if (nTar === 0 && nCaj === 0) return setError("Indica cuánto se mueve.");
        if (nTar > maxTar) return setError(`Solo hay ${maxTar} tarimas de este proceso en el preenfrío.`);
        if (nCaj > maxCaj) return setError(`Solo hay ${maxCaj} cajas de este proceso en el preenfrío.`);
        if (nTar > 0 && nCaj > 0 && nTar > nCaj) return setError(`${nTar} tarimas con ${nCaj} cajas no es posible.`);
        if (fecha > hoyISO()) return setError("La fecha no puede ser futura.");
        if (temperatura.trim() !== "") {
            const t = Number(temperatura);
            if (isNaN(t) || t < -5 || t > 45) return setError("La temperatura debe estar entre -5 y 45 °C.");
        }

        setError("");
        setEnviando(true);
        try {
            const r = await movimientosService.trasladar({
                id_ocupacion_origen: proceso.id_ocupacion,
                id_camara_destino: Number(destino),
                fecha_movimiento: fecha,
                hora_movimiento: hora,
                cantidad_tarimas: nTar,
                cantidad_cajas: nCaj,
                temperatura: temperatura.trim() === "" ? null : Number(temperatura),
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
            titulo="Mover a conservación"
            subtitulo={`${proceso.codigo_lote ?? "Sin lote"} · ${proceso.codigo_sku ?? ""} · desde ${proceso.nombre_camara}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="button" className="boton boton--primario" onClick={guardar} disabled={enviando || !destino}>
                        {enviando ? <span className="spinner spinner--chico" /> : `Mover ${nTar} tarima(s)`}
                    </button>
                </>
            }
        >
            <div className="mov__resumen">
                <div>
                    <small>Finca</small>
                    <strong>
                        {proceso.codigo_productor} {proceso.codigo_finca} {proceso.nombre_finca}
                    </strong>
                </div>
                <div>
                    <small>Empaque</small>
                    <strong>{proceso.fecha_empaque ? fechaCorta(proceso.fecha_empaque) : "—"}</strong>
                </div>
                <div>
                    <small>Cita</small>
                    <strong>{proceso.fecha_entrega ? fechaCorta(proceso.fecha_entrega) : "Sin cita"}</strong>
                </div>
                <div>
                    <small>En preenfrío</small>
                    <strong>
                        {maxTar} tar · {maxCaj} cj
                    </strong>
                </div>
                <div>
                    <small>Tiempo enfriando</small>
                    <strong>{horas === null ? "—" : `${horas} h`}</strong>
                </div>
            </div>

            {horas !== null && horas < HORAS_MINIMAS && (
                <div className="alerta alerta--aviso">
                    <AlertTriangle size={16} className="icono-en-linea" /> Lleva {horas} h en preenfrío. Verifica que ya
                    alcanzó su temperatura antes de moverla.
                </div>
            )}

            {opciones.length === 0 && (
                <div className="alerta alerta--error">No hay cámaras de conservación operativas.</div>
            )}

            {error && <div className="alerta alerta--error">{error}</div>}

            <div className="formulario">
                <label className="campo campo--completo">
                    <span>Conservación destino</span>
                    <select value={destino} onChange={(e) => setDestino(e.target.value)} disabled={enviando}>
                        <option value="">Selecciona…</option>
                        {opciones.map((c) => (
                            <option key={c.id_camara} value={c.id_camara}>
                                {c.nombre_camara} · {Math.max(num(c.tarimas_disponibles_operativas), 0)} libres de{" "}
                                {c.capacidad_max_tarimas}
                            </option>
                        ))}
                    </select>
                    {camaraDestino && nTar > libres && (
                        <small className="campo__mensaje">
                            Solo hay {libres} espacio(s) libre(s): la conserva quedará sobreocupada.
                        </small>
                    )}
                </label>

                <label className="campo">
                    <span>
                        Tarimas <small>(máx. {maxTar})</small>
                    </span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={maxTar}
                        step={1}
                        value={tarimas}
                        onChange={(e) => cambiarTarimas(e.target.value)}
                        disabled={enviando}
                        autoFocus
                    />
                    {nTar > 0 && nTar < maxTar && (
                        <small className="campo__ayuda">Quedan {maxTar - nTar} tarima(s) en el preenfrío.</small>
                    )}
                </label>
                <label className="campo">
                    <span>
                        Cajas <small>(máx. {maxCaj})</small>
                    </span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={maxCaj}
                        step={1}
                        value={cajas}
                        onChange={(e) => {
                            setCajas(e.target.value);
                            setCajasManual(true);
                        }}
                        disabled={enviando}
                    />
                </label>

                <label className="campo">
                    <span>
                        Temperatura de salida (°C) <small>(opcional)</small>
                    </span>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={temperatura}
                        onChange={(e) => setTemperatura(e.target.value)}
                        disabled={enviando}
                    />
                </label>
                <label className="campo">
                    <span>Fecha</span>
                    <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} disabled={enviando} />
                </label>
                <label className="campo">
                    <span>Hora</span>
                    <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={enviando} />
                </label>
                <label className="campo campo--completo">
                    <span>
                        Observaciones <small>(opcional)</small>
                    </span>
                    <input
                        type="text"
                        maxLength={250}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        disabled={enviando}
                    />
                </label>
            </div>
        </Modal>
    );
}
