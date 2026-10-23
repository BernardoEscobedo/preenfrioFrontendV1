import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowRight,
    ArrowRightLeft,
    Boxes,
    Clock,
    History,
    Layers,
    RefreshCw,
    Search,
    Snowflake,
    Thermometer,
    Undo2,
    Warehouse,
    X
} from "lucide-react";
import EncabezadoPagina from "../components/layout/EncabezadoPagina";
import ModalTrasladar from "../components/movimientos/ModalTrasladar";
import ModalTrasladarBloque from "../components/movimientos/ModalTrasladarBloque";
import ModalMotivo from "../components/ui/ModalMotivo";
import Avisos from "../components/ui/Avisos";
import { useAvisos } from "../hooks/useAvisos";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../config/permissions";
import { mensajeError } from "../api/axios";
import * as movimientosService from "../services/movimientos.service";
import * as tarimasService from "../services/tarimas.service";
import { fechaCorta, hoyISO, normalizar } from "../utils/formato";
import type { CamaraStock, Movimiento, RespuestaTraslado, RespuestaTrasladoBloque, Trasladable } from "../types/movimiento";
import type { BloqueTarimas } from "../types/tarima";
import "../styles/crud.css";
import "../styles/usuarios.css";
import "../styles/fincas.css";
import "../styles/movimientos.css";
import "../styles/bloques.css";

// ============================================================================
// MOVIMIENTOS · preenfrío → conservación y stock
// ============================================================================
//   Stock arriba       tarjetas por cámara (preenfrío y conserva). Se
//                      refresca cada minuto.
//   Mover bloques      los bloques de los preenfríos. "Mover" lo pasa a
//                      conservación completo o parcial: mueve el inventario
//                      y la ubicación de sus tarimas (supervisor+).
//   Fruta sin bloque   lotes dentro del preenfrío que no están armados en
//                      ningún bloque; se mueven sueltos (supervisor+).
//   Registro           bitácora con filtros. Revertir crea el movimiento
//                      inverso (los de traslado de bloque no se revierten
//                      sueltos).
//
// El inventario lo mueve la BD (trg_sync_ocupacion_movimiento).
// ============================================================================

type Pestana = "bloques" | "sueltos" | "registro";

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const REFRESCO_MS = 60_000;

const CRITICIDAD: Record<number, string> = { 1: "chip--rojo", 2: "chip--ambar", 3: "chip--azul", 4: "chip--gris" };

const TIPOS: { valor: 1 | 2 | 3 | null; texto: string }[] = [
    { valor: null, texto: "Todos" },
    { valor: 1, texto: "Ingresos" },
    { valor: 2, texto: "A conserva" },
    { valor: 3, texto: "Despachos" }
];

const sumarDias = (iso: string, dias: number) => {
    const [a, m, d] = iso.split("-").map(Number);
    const f = new Date(a, m - 1, d + dias);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};

interface BloqueEnPreenfrio {
    bloque: BloqueTarimas;
    camara: CamaraStock;
}

export default function Movimientos() {
    const { usuario } = useAuth();
    const { avisos, mostrar, quitar } = useAvisos();
    const puedeMover = tieneRol(usuario, ROLES.SUPERVISOR);

    const [pestana, setPestana] = useState<Pestana>("bloques");
    const [stock, setStock] = useState<CamaraStock[]>([]);
    const [error, setError] = useState("");

    // ---- Bloques ----
    const [bloques, setBloques] = useState<BloqueEnPreenfrio[]>([]);
    const [cargandoBloques, setCargandoBloques] = useState(true);
    const [moviendoBloque, setMoviendoBloque] = useState<BloqueEnPreenfrio | null>(null);

    // ---- Fruta sin bloque ----
    const [trasladables, setTrasladables] = useState<Trasladable[]>([]);
    const [preenfrio, setPreenfrio] = useState("");
    const [buscarMover, setBuscarMover] = useState("");
    const [cargandoMover, setCargandoMover] = useState(true);
    const [moviendo, setMoviendo] = useState<Trasladable | null>(null);

    // ---- Registro ----
    const [movs, setMovs] = useState<Movimiento[]>([]);
    const [desde, setDesde] = useState(sumarDias(hoyISO(), -6));
    const [hasta, setHasta] = useState(hoyISO());
    const [tipo, setTipo] = useState<1 | 2 | 3 | null>(2);
    const [buscarReg, setBuscarReg] = useState("");
    const [cargandoReg, setCargandoReg] = useState(false);
    const [revirtiendo, setRevirtiendo] = useState<Movimiento | null>(null);

    // ---- Carga ----
    const cargarStock = useCallback(async () => {
        try {
            const s = await movimientosService.getStock();
            setStock(s);
            return s;
        } catch (e) {
            setError(mensajeError(e));
            return [];
        }
    }, []);

    const cargarBloques = useCallback(async (camaras: CamaraStock[]) => {
        setCargandoBloques(true);
        try {
            const pre = camaras.filter((c) => Number(c.tipo_camara) === 1);
            const respuestas = await Promise.all(pre.map((c) => tarimasService.getBloques(c.id_camara)));
            setBloques(respuestas.flatMap((r, i) => r.bloques.map((b) => ({ bloque: b, camara: pre[i] }))));
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargandoBloques(false);
        }
    }, []);

    const cargarTrasladables = useCallback(async () => {
        setCargandoMover(true);
        try {
            setTrasladables(await movimientosService.getTrasladables());
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargandoMover(false);
        }
    }, []);

    const cargarRegistro = useCallback(async () => {
        setCargandoReg(true);
        try {
            setMovs(
                await movimientosService.getMovimientos({
                    fecha_desde: desde || undefined,
                    fecha_hasta: hasta || undefined,
                    tipo_movimiento: tipo
                })
            );
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargandoReg(false);
        }
    }, [desde, hasta, tipo]);

    const recargar = useCallback(async () => {
        setError("");
        const s = await cargarStock();
        await Promise.all([cargarBloques(s), cargarTrasladables()]);
    }, [cargarStock, cargarBloques, cargarTrasladables]);

    useEffect(() => {
        recargar();
        const t = setInterval(cargarStock, REFRESCO_MS);
        return () => clearInterval(t);
    }, [recargar, cargarStock]);

    useEffect(() => {
        if (pestana === "registro") cargarRegistro();
    }, [pestana, cargarRegistro]);

    // ---- Derivados ----
    const preenfrios = stock.filter((c) => Number(c.tipo_camara) === 1);
    const conservaciones = stock.filter((c) => Number(c.tipo_camara) === 2);

    const sueltos = trasladables.filter((p) => num(p.cajas_en_bloques) === 0);
    const enBloque = trasladables.length - sueltos.length;

    const visiblesMover = useMemo(() => {
        const t = normalizar(buscarMover.trim());
        return sueltos.filter((p) => {
            if (preenfrio && String(p.id_camara) !== preenfrio) return false;
            if (
                t &&
                !normalizar(
                    `${p.codigo_lote ?? ""} ${p.codigo_productor ?? ""} ${p.codigo_finca ?? ""} ${p.nombre_finca ?? ""} ${p.codigo_sku ?? ""} ${p.acronimo_cc ?? ""}`
                ).includes(t)
            )
                return false;
            return true;
        });
    }, [sueltos, preenfrio, buscarMover]);

    const visiblesReg = useMemo(() => {
        const t = normalizar(buscarReg.trim());
        if (!t) return movs;
        return movs.filter((m) =>
            normalizar(
                `${m.codigo_lote ?? ""} ${m.nombre_finca ?? ""} ${m.codigo_sku ?? ""} ${m.camara_origen ?? ""} ${m.camara_destino ?? ""} ${m.folio_despacho ?? ""} ${m.observaciones ?? ""}`
            ).includes(t)
        );
    }, [movs, buscarReg]);

    const revertidos = useMemo(() => {
        const ids = new Set<number>();
        for (const m of movs) {
            const r = m.observaciones?.match(/^Reversa del movimiento #(\d+)/);
            if (r) ids.add(Number(r[1]));
        }
        return ids;
    }, [movs]);

    const ubicacionDe = (id_camara: number) => preenfrios.find((c) => c.id_camara === id_camara)?.ubicacion ?? null;

    // ---- Acciones ----
    const alTrasladar = (r: RespuestaTraslado) => {
        setMoviendo(null);
        mostrar("exito", r.resultado || r.mensaje);
        r.avisos?.forEach((a) => mostrar("info", a));
        recargar();
    };

    const alTrasladarBloque = (r: RespuestaTrasladoBloque) => {
        setMoviendoBloque(null);
        mostrar("exito", r.mensaje);
        r.avisos?.forEach((a) => mostrar("info", a));
        recargar();
    };

    const confirmarReversa = async (motivo: string) => {
        if (!revirtiendo) return;
        const r = await movimientosService.revertir(revirtiendo.id_movimiento, motivo);
        setRevirtiendo(null);
        mostrar("exito", r.mensaje);
        r.avisos?.forEach((a) => mostrar("info", a));
        recargar();
        cargarRegistro();
    };

    const cargando = cargandoBloques || cargandoMover || cargandoReg;

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Movimientos" subtitulo="Preenfrío a conservación y stock en tiempo real">
                <button
                    type="button"
                    className="boton-icono boton-icono--borde"
                    onClick={() => {
                        recargar();
                        if (pestana === "registro") cargarRegistro();
                    }}
                    title="Actualizar"
                    aria-label="Actualizar"
                >
                    <RefreshCw size={18} className={cargando ? "girando" : ""} />
                </button>
            </EncabezadoPagina>

            {error && <div className="alerta alerta--error">{error}</div>}

            {/* ---- Stock ---- */}
            <section className="mov__stock">
                {stock.map((c) => {
                    const pre = Number(c.tipo_camara) === 1;
                    const pct = Math.min(num(c.porcentaje_ocupacion), 100);
                    return (
                        <div key={c.id_camara} className={`mov__camara ${pre ? "" : "mov__camara--conserva"}`}>
                            <div className="mov__camara-cabeza">
                                {pre ? <Snowflake size={18} /> : <Warehouse size={18} />}
                                <strong>{c.nombre_camara}</strong>
                                <span className="chip chip--gris">{pre ? "Preenfrío" : "Conservación"}</span>
                            </div>
                            <div className="mov__barra" aria-hidden="true">
                                <span style={{ width: `${pct}%` }} className={pct >= 100 ? "llena" : ""} />
                            </div>
                            <div className="mov__camara-datos">
                                <span>
                                    <strong>{num(c.tarimas_ocupadas)}</strong>/{c.capacidad_max_tarimas} tar
                                </span>
                                <span>
                                    <strong>{num(c.cajas_ocupadas).toLocaleString("es-MX")}</strong> cj
                                </span>
                                {pre && num(c.tarimas_en_espera) > 0 && (
                                    <span>
                                        <Clock size={12} className="icono-en-linea" /> {num(c.tarimas_en_espera)} en espera
                                    </span>
                                )}
                                {c.en_mantenimiento && <span className="mov__alerta">Mantenimiento</span>}
                            </div>
                        </div>
                    );
                })}
            </section>

            <div className="segmentado mov__pestanas" role="tablist">
                <button type="button" role="tab" aria-selected={pestana === "bloques"} className={pestana === "bloques" ? "activo" : ""} onClick={() => setPestana("bloques")}>
                    <Layers size={16} /> Mover bloques {bloques.length > 0 && <span>{bloques.length}</span>}
                </button>
                <button type="button" role="tab" aria-selected={pestana === "sueltos"} className={pestana === "sueltos" ? "activo" : ""} onClick={() => setPestana("sueltos")}>
                    <ArrowRightLeft size={16} /> Fruta sin bloque {sueltos.length > 0 && <span>{sueltos.length}</span>}
                </button>
                <button type="button" role="tab" aria-selected={pestana === "registro"} className={pestana === "registro" ? "activo" : ""} onClick={() => setPestana("registro")}>
                    <History size={16} /> Registro
                </button>
            </div>

            {/* ================= MOVER BLOQUES ================= */}
            {pestana === "bloques" && (
                <section className="panel">
                    {cargandoBloques && bloques.length === 0 ? (
                        <div className="crud__vacio">
                            <div className="spinner" />
                            <p>Cargando bloques del preenfrío…</p>
                        </div>
                    ) : bloques.length === 0 ? (
                        <div className="crud__vacio">
                            <Layers size={40} />
                            <p>No hay bloques en los preenfríos. Se arman en Bloques y pulpeos.</p>
                        </div>
                    ) : (
                        <div className="tabla-contenedor">
                            <table className="tabla tabla--crud">
                                <thead>
                                    <tr>
                                        <th>Bloque</th>
                                        <th>Preenfrío</th>
                                        <th>Tarimas</th>
                                        <th>Temperatura</th>
                                        <th>Tiempo dentro</th>
                                        <th>Lotes</th>
                                        {puedeMover && <th className="acciones">Acción</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {bloques.map(({ bloque: b, camara: c }) => {
                                        const temps = b.tarimas.filter((t) => t.ultima_temperatura !== null).map((t) => num(t.ultima_temperatura));
                                        const sinPulpeo = b.tarimas.length - temps.length;
                                        const horas = Math.max(...b.tarimas.map((t) => num(t.horas_en_camara)));
                                        const alertas = b.tarimas.filter((t) => t.alerta_5h).length;
                                        const cajas = b.tarimas.reduce((s, t) => s + t.lotes.reduce((x, l) => x + Number(l.cantidad_cajas), 0), 0);
                                        const lotes = [...new Set(b.tarimas.flatMap((t) => t.lotes.map((l) => `${l.codigo_lote} ${l.codigo_sku}`)))];
                                        return (
                                            <tr key={`${c.id_camara}-${b.id_bloque}`}>
                                                <td data-etiqueta="Bloque">
                                                    <span className="lote-chip mono">{b.codigo_bloque}</span>
                                                </td>
                                                <td data-etiqueta="Preenfrío">{c.nombre_camara}</td>
                                                <td data-etiqueta="Tarimas">
                                                    <div className="celda-doble">
                                                        <span>
                                                            {b.tarimas.length} de {b.posiciones}
                                                        </span>
                                                        <small>
                                                            {cajas} cj
                                                            {b.posiciones_fuera.length ? ` · ${b.posiciones_fuera.length} ya en conserva` : ""}
                                                        </small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Temperatura">
                                                    <div className="celda-doble">
                                                        <span>
                                                            <Thermometer size={12} className="icono-en-linea" />{" "}
                                                            {temps.length ? `${Math.min(...temps)}–${Math.max(...temps)} °C` : "Sin pulpeo"}
                                                        </span>
                                                        {sinPulpeo > 0 && temps.length > 0 && <small>{sinPulpeo} sin pulpeo</small>}
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Tiempo">
                                                    <div className="estados">
                                                        <span>{horas} h</span>
                                                        {alertas > 0 && (
                                                            <span className="chip chip--rojo">
                                                                <AlertTriangle size={12} /> {alertas} con más de 5 h
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Lotes">
                                                    <small>{lotes.join(" · ")}</small>
                                                </td>
                                                {puedeMover && (
                                                    <td className="acciones">
                                                        <button
                                                            type="button"
                                                            className="boton boton--primario boton--auto boton--chico"
                                                            onClick={() => setMoviendoBloque({ bloque: b, camara: c })}
                                                            disabled={conservaciones.length === 0}
                                                            aria-label={`Mover bloque ${b.codigo_bloque}`}
                                                        >
                                                            <ArrowRight size={16} /> Mover
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            {/* ================= FRUTA SIN BLOQUE ================= */}
            {pestana === "sueltos" && (
                <section className="panel">
                    <div className="crud__barra">
                        <label className="buscador">
                            <Search size={18} />
                            <input
                                type="search"
                                value={buscarMover}
                                onChange={(e) => setBuscarMover(e.target.value)}
                                placeholder="Buscar lote, finca, SKU o destino…"
                            />
                        </label>
                        {preenfrios.length > 1 && (
                            <select className="selector" value={preenfrio} onChange={(e) => setPreenfrio(e.target.value)} aria-label="Filtrar por preenfrío">
                                <option value="">Todos los preenfríos</option>
                                {preenfrios.map((c) => (
                                    <option key={c.id_camara} value={c.id_camara}>
                                        {c.nombre_camara}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {enBloque > 0 && (
                        <p className="pieza__vacio">
                            {enBloque} montón(es) de fruta están armados en bloques: se mueven en <strong>Mover bloques</strong>.
                        </p>
                    )}

                    {(buscarMover || preenfrio) && (
                        <div className="filtros-activos">
                            {preenfrio && <span className="chip chip--azul">{preenfrios.find((c) => String(c.id_camara) === preenfrio)?.nombre_camara}</span>}
                            {buscarMover && <span className="chip chip--azul">"{buscarMover}"</span>}
                            <button
                                type="button"
                                className="enlace enlace--verde"
                                onClick={() => {
                                    setBuscarMover("");
                                    setPreenfrio("");
                                }}
                            >
                                <X size={14} /> Quitar filtros
                            </button>
                        </div>
                    )}

                    {cargandoMover && trasladables.length === 0 ? (
                        <div className="crud__vacio">
                            <div className="spinner" />
                            <p>Cargando fruta en preenfrío…</p>
                        </div>
                    ) : visiblesMover.length === 0 ? (
                        <div className="crud__vacio">
                            <Boxes size={40} />
                            <p>{buscarMover || preenfrio ? "Nada coincide con los filtros." : "No hay fruta suelta en los preenfríos."}</p>
                        </div>
                    ) : (
                        <div className="tabla-contenedor">
                            <table className="tabla tabla--crud">
                                <thead>
                                    <tr>
                                        <th>Finca de origen</th>
                                        <th>Lote / SKU</th>
                                        <th>Preenfrío</th>
                                        <th>Empaque / Cita</th>
                                        <th>Tiempo enfriando</th>
                                        <th>Cantidad</th>
                                        <th>Criticidad</th>
                                        {puedeMover && <th className="acciones">Acción</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visiblesMover.map((p) => {
                                        const horas = p.horas_en_preenfrio === null ? null : num(p.horas_en_preenfrio);
                                        return (
                                            <tr key={p.id_ocupacion}>
                                                <td data-etiqueta="Finca">
                                                    <div className="celda-doble">
                                                        <strong>
                                                            {p.codigo_productor} {p.codigo_finca} {p.nombre_finca}
                                                        </strong>
                                                        <small>{p.nombre_productor}</small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Lote">
                                                    <div className="celda-doble">
                                                        <span className="lote-chip mono">{p.codigo_lote ?? "—"}</span>
                                                        <small>
                                                            {p.codigo_sku} · {p.acronimo_cc}
                                                        </small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Preenfrío">{p.nombre_camara}</td>
                                                <td data-etiqueta="Fechas">
                                                    <div className="celda-doble">
                                                        <span>{p.fecha_empaque ? fechaCorta(p.fecha_empaque) : "—"}</span>
                                                        <small>{p.fecha_entrega ? `Cita ${fechaCorta(p.fecha_entrega)}` : "Sin cita"}</small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Enfriando">
                                                    <div className="celda-doble">
                                                        <span>{horas === null ? "—" : `${horas} h`}</span>
                                                        <small>
                                                            Desde {fechaCorta(p.fecha_ingreso)} {String(p.hora_ingreso ?? "").slice(0, 5)}
                                                        </small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Cantidad">
                                                    {num(p.tarimas_disponibles)} tar · {num(p.cajas_disponibles)} cj
                                                </td>
                                                <td data-etiqueta="Criticidad">
                                                    <span className={`chip ${CRITICIDAD[p.nivel_criticidad] ?? "chip--gris"}`}>{p.criticidad_texto}</span>
                                                </td>
                                                {puedeMover && (
                                                    <td className="acciones">
                                                        <button
                                                            type="button"
                                                            className="boton boton--primario boton--auto boton--chico"
                                                            onClick={() => setMoviendo(p)}
                                                            disabled={conservaciones.length === 0}
                                                            aria-label={`Mover ${p.codigo_lote ?? ""} a conservación`}
                                                        >
                                                            <ArrowRight size={16} /> Mover
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            {/* ================= REGISTRO ================= */}
            {pestana === "registro" && (
                <section className="panel">
                    <div className="crud__barra">
                        <label className="buscador">
                            <Search size={18} />
                            <input
                                type="search"
                                value={buscarReg}
                                onChange={(e) => setBuscarReg(e.target.value)}
                                placeholder="Buscar lote, bloque, finca, SKU, cámara o folio…"
                            />
                        </label>
                        <label className="mov__fecha">
                            Desde
                            <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
                        </label>
                        <label className="mov__fecha">
                            Hasta
                            <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
                        </label>
                        <div className="segmentado" role="tablist">
                            {TIPOS.map((t) => (
                                <button
                                    key={String(t.valor)}
                                    type="button"
                                    role="tab"
                                    aria-selected={tipo === t.valor}
                                    className={tipo === t.valor ? "activo" : ""}
                                    onClick={() => setTipo(t.valor)}
                                >
                                    {t.texto}
                                </button>
                            ))}
                        </div>
                    </div>

                    {cargandoReg && movs.length === 0 ? (
                        <div className="crud__vacio">
                            <div className="spinner" />
                            <p>Cargando movimientos…</p>
                        </div>
                    ) : visiblesReg.length === 0 ? (
                        <div className="crud__vacio">
                            <History size={40} />
                            <p>No hay movimientos en ese periodo.</p>
                        </div>
                    ) : (
                        <div className="tabla-contenedor">
                            <table className="tabla tabla--crud">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Tipo</th>
                                        <th>Origen → Destino</th>
                                        <th>Finca / Lote</th>
                                        <th>Cantidad</th>
                                        <th>Temp.</th>
                                        <th>Registró</th>
                                        {puedeMover && <th className="acciones">Revertir</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visiblesReg.map((m) => {
                                        const esReversa = Boolean(m.observaciones?.startsWith("Reversa del movimiento #"));
                                        const esBloque = Boolean(m.observaciones?.startsWith("Traslado bloque"));
                                        const yaRevertido = revertidos.has(m.id_movimiento);
                                        return (
                                            <tr key={m.id_movimiento} className={yaRevertido ? "fila--baja" : ""}>
                                                <td data-etiqueta="Fecha">
                                                    <div className="celda-doble">
                                                        <span>{fechaCorta(m.fecha_movimiento)}</span>
                                                        <small>
                                                            {String(m.hora_movimiento ?? "").slice(0, 5)} · #{m.id_movimiento}
                                                        </small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Tipo">
                                                    <div className="estados">
                                                        <span className={`chip ${esReversa ? "chip--ambar" : "chip--azul"}`}>
                                                            {esReversa ? "Reversa" : esBloque ? "Bloque a conserva" : m.tipo_texto}
                                                        </span>
                                                        {yaRevertido && <small>Revertido</small>}
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Ruta">
                                                    <div className="celda-doble">
                                                        <span>
                                                            {m.camara_origen ?? "—"} <ArrowRight size={12} className="icono-en-linea" />{" "}
                                                            {m.camara_destino ?? (m.folio_despacho ? `Despacho ${m.folio_despacho}` : "—")}
                                                        </span>
                                                        {m.observaciones && <small>{m.observaciones}</small>}
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Lote">
                                                    <div className="celda-doble">
                                                        <span>
                                                            {m.codigo_finca} {m.nombre_finca}
                                                        </span>
                                                        <small className="mono">
                                                            {m.codigo_lote ?? "—"} · {m.codigo_sku}
                                                        </small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Cantidad">
                                                    {num(m.cantidad_tarimas)} tar · {num(m.cantidad_cajas)} cj
                                                </td>
                                                <td data-etiqueta="Temp.">
                                                    {m.temperatura === null ? (
                                                        "—"
                                                    ) : (
                                                        <>
                                                            <Thermometer size={12} className="icono-en-linea" /> {num(m.temperatura)} °C
                                                        </>
                                                    )}
                                                </td>
                                                <td data-etiqueta="Registró">
                                                    {[m.nombre_empleado, m.apellidos_empleado].filter(Boolean).join(" ") || "—"}
                                                </td>
                                                {puedeMover && (
                                                    <td className="acciones">
                                                        {Number(m.tipo_movimiento) === 2 && !esReversa && !esBloque && !yaRevertido && (
                                                            <button
                                                                type="button"
                                                                className="boton-icono boton-icono--peligro"
                                                                onClick={() => setRevirtiendo(m)}
                                                                title="Revertir (regresa la fruta al preenfrío)"
                                                                aria-label={`Revertir movimiento ${m.id_movimiento}`}
                                                            >
                                                                <Undo2 size={18} />
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!cargandoReg && visiblesReg.length > 0 && (
                        <p className="crud__pie">
                            {visiblesReg.length} movimiento(s) · {visiblesReg.reduce((s, m) => s + num(m.cantidad_tarimas), 0)} tarimas
                        </p>
                    )}
                </section>
            )}

            {moviendoBloque && (
                <ModalTrasladarBloque
                    bloque={moviendoBloque.bloque}
                    nombreOrigen={moviendoBloque.camara.nombre_camara}
                    conservaciones={conservaciones}
                    ubicacionOrigen={moviendoBloque.camara.ubicacion}
                    onGuardado={alTrasladarBloque}
                    onCerrar={() => setMoviendoBloque(null)}
                />
            )}

            {moviendo && (
                <ModalTrasladar
                    proceso={moviendo}
                    conservaciones={conservaciones}
                    ubicacionOrigen={ubicacionDe(moviendo.id_camara)}
                    onGuardado={alTrasladar}
                    onCerrar={() => setMoviendo(null)}
                />
            )}

            {revirtiendo && (
                <ModalMotivo
                    titulo={`Revertir movimiento #${revirtiendo.id_movimiento}`}
                    descripcion={
                        <>
                            <p>
                                Regresan <strong>{num(revirtiendo.cantidad_tarimas)} tarimas</strong> de {revirtiendo.camara_destino} a{" "}
                                {revirtiendo.camara_origen}.
                            </p>
                            <p className="modal__advertencia">
                                <AlertTriangle size={14} className="icono-en-linea" /> No se borra nada: queda el traslado y su reversa en el registro.
                            </p>
                        </>
                    }
                    obligatorio
                    etiquetaConfirmar="Revertir"
                    onConfirmar={confirmarReversa}
                    onCerrar={() => setRevirtiendo(null)}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
