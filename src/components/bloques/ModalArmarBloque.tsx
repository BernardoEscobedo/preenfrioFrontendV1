import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as tarimasService from "../../services/tarimas.service";
import { fechaCorta } from "../../utils/formato";
import type { BloqueTarimas, CamaraBloques, LoteCamara, TarimaCaptura } from "../../types/tarima";

// ============================================================================
// ARMAR BLOQUE (o completar posiciones de uno existente) · operativo+
// ============================================================================
// Bloque de 10 o 12 posiciones. Cada posición es una tarima que lleva uno o
// más lotes/SKU, con sus cajas. No es obligatorio llenar todas al armar:
// las libres se completan después.
//
// Las posiciones que ya están en otra cámara (traslado parcial) cuentan
// como ocupadas.
//
// La hora de ingreso al preenfrío es desde donde cuentan las 5 horas. Por
// defecto es ahora; se puede ajustar si se registra después de meterla.
// ============================================================================

interface LineaCaptura {
    id_produccion: string;
    cajas: string;
}

interface Props {
    camara: CamaraBloques;
    /** Si viene, se completan posiciones libres de este bloque */
    bloque?: BloqueTarimas | null;
    onGuardado: (mensaje: string) => void;
    onCerrar: () => void;
}

const ahoraLocal = () => {
    const h = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${h.getFullYear()}-${p(h.getMonth() + 1)}-${p(h.getDate())}T${p(h.getHours())}:${p(h.getMinutes())}`;
};

export default function ModalArmarBloque({ camara, bloque, onGuardado, onCerrar }: Props) {
    const completar = Boolean(bloque);
    const [lotes, setLotes] = useState<LoteCamara[]>([]);
    const [cargando, setCargando] = useState(true);
    const [codigo, setCodigo] = useState("");
    const [posiciones, setPosiciones] = useState<10 | 12>((bloque?.posiciones as 10 | 12) ?? 12);
    const [ingreso, setIngreso] = useState(ahoraLocal());
    const [captura, setCaptura] = useState<Record<number, LineaCaptura[]>>({});
    const [abierta, setAbierta] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        let vivo = true;
        tarimasService
            .getLotes(camara.id_camara)
            .then((l) => vivo && setLotes(l))
            .catch((e) => vivo && setError(mensajeError(e)))
            .finally(() => vivo && setCargando(false));
        return () => {
            vivo = false;
        };
    }, [camara.id_camara]);

    const ocupadas = useMemo(() => {
        const m = new Map<number, string>();
        bloque?.tarimas.forEach((t) => m.set(t.posicion, "Ocupada"));
        bloque?.posiciones_fuera.forEach((f) => m.set(f.posicion, `En ${f.nombre_camara}`));
        return m;
    }, [bloque]);

    const loteDe = (id: string) => lotes.find((l) => String(l.id_produccion) === id);

    const capturadas = Object.entries(captura)
        .map(([pos, ls]) => ({ posicion: Number(pos), lineas: ls.filter((l) => l.id_produccion) }))
        .filter((t) => t.lineas.length > 0);

    const ponerLinea = (pos: number, i: number, cambios: Partial<LineaCaptura>) =>
        setCaptura((c) => {
            const lista = [...(c[pos] ?? [])];
            lista[i] = { ...lista[i], ...cambios };
            return { ...c, [pos]: lista };
        });

    const agregarLinea = (pos: number) =>
        setCaptura((c) => ({ ...c, [pos]: [...(c[pos] ?? []), { id_produccion: "", cajas: "" }] }));

    const quitarLinea = (pos: number, i: number) =>
        setCaptura((c) => ({ ...c, [pos]: (c[pos] ?? []).filter((_, k) => k !== i) }));

    const abrir = (pos: number) => {
        setAbierta(pos);
        if (!captura[pos]?.length) setCaptura((c) => ({ ...c, [pos]: [{ id_produccion: "", cajas: "" }] }));
    };

    const guardar = async () => {
        if (capturadas.length === 0) return setError("Captura al menos una tarima con su lote.");
        const tarimas: TarimaCaptura[] = [];
        for (const t of capturadas) {
            if (t.posicion > posiciones) return setError(`El bloque es de ${posiciones}: quita la tarima ${t.posicion}.`);
            const ids = new Set<string>();
            const ls: { id_produccion: number; cantidad_cajas: number }[] = [];
            let suma = 0;
            for (const l of t.lineas) {
                const cj = Number(l.cajas);
                if (!Number.isInteger(cj) || cj <= 0) return setError(`Tarima ${t.posicion}: captura las cajas de cada lote.`);
                if (ids.has(l.id_produccion)) return setError(`Tarima ${t.posicion}: un lote está repetido.`);
                ids.add(l.id_produccion);
                suma += cj;
                ls.push({ id_produccion: Number(l.id_produccion), cantidad_cajas: cj });
            }
            if (suma > 80) return setError(`Tarima ${t.posicion}: ${suma} cajas no caben en una tarima.`);
            tarimas.push({ posicion: t.posicion, lotes: ls });
        }
        if (codigo && !/^[A-Za-z0-9_-]+$/.test(codigo.replace(/\s+/g, ""))) return setError("El código solo admite letras, números y guiones.");

        setError("");
        setEnviando(true);
        try {
            const r =
                completar && bloque
                    ? await tarimasService.agregarTarimas(bloque.id_bloque, ingreso || null, tarimas)
                    : await tarimasService.armarBloque({
                          codigo_bloque: codigo.trim() || null,
                          id_camara: camara.id_camara,
                          posiciones,
                          fecha_hora_ingreso: ingreso || null,
                          tarimas
                      });
            onGuardado(r.mensaje);
        } catch (e) {
            setError(mensajeError(e));
            setEnviando(false);
        }
    };

    const lineasAbierta = abierta !== null ? captura[abierta] ?? [] : [];

    return (
        <Modal
            titulo={completar ? `Completar bloque ${bloque?.codigo_bloque}` : "Armar bloque"}
            subtitulo={camara.nombre_camara}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="button" className="boton boton--primario" onClick={guardar} disabled={enviando || cargando}>
                        {enviando ? <span className="spinner spinner--chico" /> : `Guardar ${capturadas.length} tarima(s)`}
                    </button>
                </>
            }
        >
            {error && <div className="alerta alerta--error">{error}</div>}

            <div className="formulario">
                {!completar && (
                    <>
                        <label className="campo">
                            <span>
                                Código <small>(vacío = automático)</small>
                            </span>
                            <input
                                type="text"
                                className="mono"
                                maxLength={50}
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                                placeholder="B261023-01"
                            />
                        </label>
                        <label className="campo">
                            <span>Tamaño del bloque</span>
                            <div className="segmentado">
                                {([10, 12] as const).map((n) => (
                                    <button key={n} type="button" className={posiciones === n ? "activo" : ""} onClick={() => setPosiciones(n)}>
                                        {n} tarimas
                                    </button>
                                ))}
                            </div>
                        </label>
                    </>
                )}
                {Number(camara.tipo_camara) === 1 && (
                    <label className="campo">
                        <span>Ingreso al preenfrío</span>
                        <input type="datetime-local" value={ingreso} max={ahoraLocal()} onChange={(e) => setIngreso(e.target.value)} />
                        <small className="campo__ayuda">Desde aquí cuentan las 5 horas.</small>
                    </label>
                )}
            </div>

            {cargando ? (
                <div className="crud__vacio">
                    <div className="spinner" />
                </div>
            ) : lotes.length === 0 ? (
                <p className="pieza__vacio">No hay fruta dentro de {camara.nombre_camara} para armar bloques.</p>
            ) : (
                <>
                    <p className="pieza__vacio">Toca una posición para capturar sus lotes.</p>
                    <div className={`bloque__rejilla bloque__rejilla--${posiciones}`}>
                        {Array.from({ length: posiciones }, (_, i) => i + 1).map((pos) => {
                            const ocupada = ocupadas.get(pos);
                            const n = (captura[pos] ?? []).filter((l) => l.id_produccion).length;
                            return (
                                <button
                                    key={pos}
                                    type="button"
                                    className={`posicion ${ocupada ? "posicion--ocupada" : n ? "posicion--capturada" : ""} ${abierta === pos ? "posicion--abierta" : ""}`}
                                    onClick={() => !ocupada && abrir(pos)}
                                    disabled={Boolean(ocupada) || enviando}
                                >
                                    <strong>{pos}</strong>
                                    <small>{ocupada ?? (n ? `${n} lote(s)` : "Libre")}</small>
                                </button>
                            );
                        })}
                    </div>

                    {abierta !== null && (
                        <div className="armar__tarima">
                            <div className="pieza__cabeza">
                                <strong>Tarima {abierta}</strong>
                                <button type="button" className="enlace enlace--verde" onClick={() => agregarLinea(abierta)}>
                                    <Plus size={14} /> Otro lote/SKU
                                </button>
                            </div>
                            {lineasAbierta.map((l, i) => {
                                const lote = loteDe(l.id_produccion);
                                return (
                                    <div key={i} className="armar__linea">
                                        <select value={l.id_produccion} onChange={(e) => ponerLinea(abierta, i, { id_produccion: e.target.value })}>
                                            <option value="">Lote…</option>
                                            {lotes.map((lt) => (
                                                <option key={lt.id_produccion} value={lt.id_produccion}>
                                                    {lt.codigo_lote} · {lt.codigo_sku} · {lt.codigo_productor} {lt.codigo_finca} {lt.nombre_finca} ·{" "}
                                                    {Math.max(lt.cajas_disponibles - lt.cajas_en_bloques, 0)} cj sin bloque
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            value={l.cajas}
                                            onChange={(e) => ponerLinea(abierta, i, { cajas: e.target.value })}
                                            placeholder="Cajas"
                                        />
                                        <button type="button" className="boton-icono" onClick={() => quitarLinea(abierta, i)} aria-label="Quitar lote">
                                            <X size={16} />
                                        </button>
                                        {lote && (
                                            <small className="armar__detalle">
                                                {lote.calidad_sku} · {lote.acronimo_cc} · empaque {fechaCorta(lote.fecha_empaque)}
                                            </small>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </Modal>
    );
}
