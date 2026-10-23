import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as movimientosService from "../../services/movimientos.service";
import { hoyISO } from "../../utils/formato";
import type { CamaraStock, RespuestaTrasladoBloque } from "../../types/movimiento";
import type { BloqueTarimas } from "../../types/tarima";

// ============================================================================
// TRASLADAR BLOQUE A CONSERVACIÓN · supervisor+
// ============================================================================
// El bloque sale completo. Se desmarcan las tarimas que todavía no llegan a
// la temperatura óptima: esas se quedan en el preenfrío.
//
// El backend mueve el inventario (por lote) y la ubicación de las tarimas en
// una sola operación: o se mueve todo o nada.
// ============================================================================

const num = (v: number | string | null | undefined) => Number(v ?? 0);

const horaActual = () => {
    const h = new Date();
    return `${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}`;
};

interface Props {
    bloque: BloqueTarimas;
    nombreOrigen: string;
    conservaciones: CamaraStock[];
    ubicacionOrigen: string | null;
    onGuardado: (r: RespuestaTrasladoBloque) => void;
    onCerrar: () => void;
}

export default function ModalTrasladarBloque({ bloque, nombreOrigen, conservaciones, ubicacionOrigen, onGuardado, onCerrar }: Props) {
    const opciones = conservaciones.filter((c) => !c.en_mantenimiento);
    const sugerida = opciones.find((c) => ubicacionOrigen && c.ubicacion === ubicacionOrigen) ?? opciones[0];

    const [destino, setDestino] = useState(sugerida ? String(sugerida.id_camara) : "");
    const [elegidas, setElegidas] = useState<Set<number>>(new Set(bloque.tarimas.map((t) => t.id_tarima)));
    const [temperatura, setTemperatura] = useState("");
    const [fecha, setFecha] = useState(hoyISO());
    const [hora, setHora] = useState(horaActual());
    const [observaciones, setObservaciones] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const alternar = (id: number) =>
        setElegidas((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    const seleccion = bloque.tarimas.filter((t) => elegidas.has(t.id_tarima));
    const cajas = seleccion.reduce((s, t) => s + t.lotes.reduce((x, l) => x + Number(l.cantidad_cajas), 0), 0);

    const camaraDestino = opciones.find((c) => String(c.id_camara) === destino);
    const libres = camaraDestino ? Math.max(num(camaraDestino.tarimas_disponibles_operativas), 0) : 0;

    // Lo que viaja, por lote
    const porLote = useMemo(() => {
        const m = new Map<string, { lote: string; sku: string; cajas: number }>();
        for (const t of seleccion) {
            for (const l of t.lotes) {
                const k = String(l.id_produccion);
                const a = m.get(k) ?? { lote: l.codigo_lote ?? "—", sku: l.codigo_sku ?? "", cajas: 0 };
                a.cajas += Number(l.cantidad_cajas);
                m.set(k, a);
            }
        }
        return [...m.values()];
    }, [seleccion]);

    const guardar = async () => {
        if (!destino) return setError("Elige la conservación destino.");
        if (seleccion.length === 0) return setError("Marca al menos una tarima.");
        if (!fecha || !hora) return setError("Indica fecha y hora.");
        if (fecha > hoyISO()) return setError("La fecha no puede ser futura.");
        if (temperatura.trim() !== "") {
            const t = Number(temperatura);
            if (isNaN(t) || t < -5 || t > 45) return setError("La temperatura debe estar entre -5 y 45 °C.");
        }
        setError("");
        setEnviando(true);
        try {
            const r = await movimientosService.trasladarBloque({
                id_bloque: bloque.id_bloque,
                id_tarimas: seleccion.map((t) => t.id_tarima),
                id_camara_destino: Number(destino),
                fecha_movimiento: fecha,
                hora_movimiento: hora,
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
            titulo={`Mover bloque ${bloque.codigo_bloque} a conservación`}
            subtitulo={`Desde ${nombreOrigen}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="button" className="boton boton--primario" onClick={guardar} disabled={enviando || !destino}>
                        {enviando ? <span className="spinner spinner--chico" /> : `Mover ${seleccion.length} tarima(s)`}
                    </button>
                </>
            }
        >
            {error && <div className="alerta alerta--error">{error}</div>}

            <label className="campo campo--completo">
                <span>Conservación destino</span>
                <select value={destino} onChange={(e) => setDestino(e.target.value)} disabled={enviando}>
                    <option value="">Selecciona…</option>
                    {opciones.map((c) => (
                        <option key={c.id_camara} value={c.id_camara}>
                            {c.nombre_camara} · {Math.max(num(c.tarimas_disponibles_operativas), 0)} libres de {c.capacidad_max_tarimas}
                        </option>
                    ))}
                </select>
                {camaraDestino && seleccion.length > libres && (
                    <small className="campo__mensaje">Solo hay {libres} espacio(s) libre(s): la conserva quedará sobreocupada.</small>
                )}
            </label>

            <p className="pieza__vacio">Desmarca las tarimas que no han llegado a la temperatura óptima: se quedan en el preenfrío.</p>
            <ul className="mover__lista">
                {bloque.tarimas.map((t) => (
                    <li key={t.id_tarima}>
                        <label className="interruptor">
                            <input type="checkbox" checked={elegidas.has(t.id_tarima)} onChange={() => alternar(t.id_tarima)} disabled={enviando} />
                            Tarima {t.posicion} · {[...new Set(t.lotes.map((l) => l.codigo_sku))].join(", ")}
                        </label>
                        <small>
                            {t.ultima_temperatura === null ? "Sin pulpeo" : `${num(t.ultima_temperatura)} °C`} · {num(t.horas_en_camara)} h
                            {t.alerta_5h ? " · ⚠ más de 5 h" : ""}
                        </small>
                    </li>
                ))}
            </ul>

            {porLote.length > 0 && (
                <p className="formulario__nota">
                    Viajan {seleccion.length} tarima(s) y {cajas} cajas: {porLote.map((l) => `${l.lote} ${l.sku} ${l.cajas} cj`).join(" · ")}
                </p>
            )}

            {seleccion.some((t) => t.ultima_temperatura === null) && (
                <div className="alerta alerta--aviso">
                    <AlertTriangle size={16} className="icono-en-linea" /> Hay tarimas marcadas sin ningún pulpeo registrado.
                </div>
            )}

            <div className="formulario">
                <label className="campo">
                    <span>
                        Temperatura de salida (°C) <small>(opcional)</small>
                    </span>
                    <input type="number" inputMode="decimal" step="0.1" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} disabled={enviando} />
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
                    <input type="text" maxLength={150} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} disabled={enviando} />
                </label>
            </div>
        </Modal>
    );
}
