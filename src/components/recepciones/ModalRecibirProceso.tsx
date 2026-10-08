import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as recepcionesService from "../../services/recepciones.service";
import { fechaCorta, hoyISO } from "../../utils/formato";
import type { LineaEsperada, RespuestaLote, TipoCierre } from "../../types/recepcion";

// ============================================================================
// RECIBIR UN PROCESO · operativo+
// ============================================================================
// Un proceso = una línea de producción (lote + SKU + destino). Se abre desde
// su fila en el listado y se captura solo ese proceso.
//
//   Completa   ya no llega más → se compara contra el plan
//   Parcial    llega más después (otro camión u otro día)
//   No llegó   hoy no llegó nada → alerta; el proceso sigue abierto
//
// Las cantidades NO se precargan: se cuentan y se capturan. "= Plan" llena
// lo pendiente cuando sí cuadra.
//
// SIN TOLERANCIA: en "Completa", una caja de más o de menos ya es alerta.
// Usa el mismo endpoint que el lote (POST /recepciones/lote) con una sola
// línea: el backend no cambia.
// ============================================================================

const num = (v: number | string | null | undefined) => Number(v ?? 0);

const horaActual = () => {
    const h = new Date();
    return `${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}`;
};

const OPCIONES: { valor: TipoCierre; texto: string }[] = [
    { valor: "completa", texto: "Completa" },
    { valor: "parcial", texto: "Parcial" },
    { valor: "no_llego", texto: "No llegó" }
];

interface Props {
    linea: LineaEsperada;
    onGuardado: (respuesta: RespuestaLote) => void;
    onCerrar: () => void;
}

export default function ModalRecibirProceso({ linea, onGuardado, onCerrar }: Props) {
    const [fecha, setFecha] = useState(hoyISO());
    const [hora, setHora] = useState(horaActual());
    const [cajas, setCajas] = useState("");
    const [tarimas, setTarimas] = useState("");
    const [cierre, setCierre] = useState<TipoCierre>("completa");
    const [temperatura, setTemperatura] = useState("");
    const [observaciones, setObservaciones] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const planCajas = num(linea.cajas_esperadas);
    const planTarimas = num(linea.tarimas_esperadas);
    const yaCajas = num(linea.cajas_recibidas);
    const yaTarimas = num(linea.tarimas_recibidas);
    const yaRecibio = yaCajas + yaTarimas > 0;

    const nCajas = cajas === "" ? 0 : Number(cajas);
    const nTarimas = tarimas === "" ? 0 : Number(tarimas);
    const totalCajas = yaCajas + nCajas;
    const totalTarimas = yaTarimas + nTarimas;
    const difCajas = totalCajas - planCajas;
    const difTarimas = totalTarimas - planTarimas;
    const conDiferencia = cierre === "completa" && (difCajas !== 0 || difTarimas !== 0);
    const capturo = cajas !== "" || tarimas !== "";

    const elegirCierre = (c: TipoCierre) => {
        setCierre(c);
        setError("");
        if (c === "no_llego") {
            setCajas("");
            setTarimas("");
        }
    };

    const igualAlPlan = () => {
        setCajas(String(Math.max(planCajas - yaCajas, 0)));
        setTarimas(String(Math.max(planTarimas - yaTarimas, 0)));
        setCierre("completa");
        setError("");
    };

    const validar = (): string | null => {
        if (!fecha) return "Indica la fecha de recepción";
        if (fecha > hoyISO()) return "La fecha de recepción no puede ser futura";
        if (!Number.isInteger(nCajas) || nCajas < 0 || !Number.isInteger(nTarimas) || nTarimas < 0)
            return "Cajas y tarimas deben ser enteros mayores o iguales a 0";
        if (cierre === "parcial" && nCajas === 0 && nTarimas === 0) return "Captura lo que llegó en este viaje";
        if (cierre === "completa" && totalCajas + totalTarimas === 0)
            return 'No se ha recibido nada: si no llegó, márcalo como "No llegó"';
        if (nTarimas > 0 && nCajas > 0 && nTarimas > nCajas) return `${nTarimas} tarimas con ${nCajas} cajas no es posible`;
        if (nTarimas > 0 && nCajas > nTarimas * 60) return `${nCajas} cajas no caben en ${nTarimas} tarimas`;
        if (temperatura.trim() !== "") {
            const t = Number(temperatura);
            if (isNaN(t) || t < -5 || t > 45) return "La temperatura debe estar entre -5 y 45 °C";
        }
        return null;
    };

    const guardar = async () => {
        const problema = validar();
        if (problema) {
            setError(problema);
            return;
        }
        setError("");
        setEnviando(true);
        try {
            const r = await recepcionesService.recibirLote({
                fecha_recepcion: fecha,
                hora_recepcion: hora,
                temperatura: temperatura.trim() === "" ? null : Number(temperatura),
                observaciones: observaciones.trim() || null,
                lineas: [
                    {
                        id_produccion: linea.id_produccion,
                        cajas: nCajas,
                        tarimas: nTarimas,
                        cierre,
                        observaciones: observaciones.trim() || null
                    }
                ]
            });
            onGuardado(r);
        } catch (e) {
            setError(mensajeError(e));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={`Recibir ${linea.codigo_sku}`}
            subtitulo={`${linea.codigo_productor} ${linea.codigo_finca} ${linea.nombre_finca} · Lote ${linea.codigo_lote ?? "—"}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="button" className="boton boton--primario" onClick={guardar} disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : "Registrar recepción"}
                    </button>
                </>
            }
        >
            <div className="recibir__resumen">
                <div>
                    <small>Producto</small>
                    <strong>{linea.calidad_sku}</strong>
                </div>
                <div>
                    <small>Destino</small>
                    <strong>{linea.acronimo_cc}</strong>
                </div>
                <div>
                    <small>Empaque</small>
                    <strong>{fechaCorta(linea.fecha_empaque)}</strong>
                </div>
                <div>
                    <small>Plan</small>
                    <strong>
                        {planCajas} cj · {planTarimas} tar
                    </strong>
                </div>
                {yaRecibio && (
                    <div>
                        <small>Ya recibido</small>
                        <strong>
                            {yaCajas} cj · {yaTarimas} tar
                        </strong>
                    </div>
                )}
            </div>

            {error && <div className="alerta alerta--error">{error}</div>}

            <div className="segmentado recibir__cierre" role="radiogroup" aria-label="Cómo queda el proceso">
                {OPCIONES.map((o) => (
                    <button
                        key={o.valor}
                        type="button"
                        role="radio"
                        aria-checked={cierre === o.valor}
                        className={cierre === o.valor ? "activo" : ""}
                        onClick={() => elegirCierre(o.valor)}
                        disabled={enviando}
                    >
                        {o.texto}
                    </button>
                ))}
            </div>

            <div className="formulario">
                {cierre !== "no_llego" && (
                    <>
                        <label className="campo">
                            <span>Cajas recibidas</span>
                            <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={1}
                                value={cajas}
                                onChange={(e) => setCajas(e.target.value)}
                                autoFocus
                                disabled={enviando}
                            />
                        </label>
                        <label className="campo">
                            <span>Tarimas recibidas</span>
                            <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={1}
                                value={tarimas}
                                onChange={(e) => setTarimas(e.target.value)}
                                disabled={enviando}
                            />
                            <button type="button" className="enlace enlace--verde" onClick={igualAlPlan} disabled={enviando}>
                                Llenar con lo pendiente del plan
                            </button>
                        </label>
                    </>
                )}

                <label className="campo">
                    <span>Fecha de recepción</span>
                    <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} disabled={enviando} />
                </label>
                <label className="campo">
                    <span>Hora</span>
                    <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={enviando} />
                </label>

                {cierre !== "no_llego" && (
                    <label className="campo">
                        <span>
                            Temperatura (°C) <small>(opcional)</small>
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
                )}

                <label className="campo campo--completo">
                    <span>
                        Observaciones <small>(opcional)</small>
                    </span>
                    <input
                        type="text"
                        maxLength={250}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder={cierre === "no_llego" ? "Motivo, si se sabe" : "Placas, chofer, estado de la fruta…"}
                        disabled={enviando}
                    />
                </label>
            </div>

            {cierre === "completa" && (capturo || yaRecibio) && (
                <p className={`recibir__previa ${conDiferencia ? "recibir__previa--alerta" : ""}`}>
                    {conDiferencia ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} Total {totalCajas} cj ·{" "}
                    {totalTarimas} tar
                    {conDiferencia
                        ? ` — diferencia ${difCajas > 0 ? "+" : ""}${difCajas} cj, ${difTarimas > 0 ? "+" : ""}${difTarimas} tar. Se enviará alerta al coordinador.`
                        : " — cuadra con el plan."}
                </p>
            )}
            {cierre === "parcial" && capturo && (
                <p className="recibir__previa">
                    <CheckCircle2 size={16} /> Llevará {totalCajas} cj · {totalTarimas} tar de {planCajas} cj · {planTarimas} tar.
                    El proceso sigue abierto.
                </p>
            )}
            {cierre === "no_llego" && (
                <p className="recibir__previa recibir__previa--alerta">
                    <AlertTriangle size={16} /> Se avisará al coordinador. El proceso sigue abierto por si llega después.
                </p>
            )}
        </Modal>
    );
}
