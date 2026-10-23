import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowRight,
    ArrowRightLeft,
    Boxes,
    Clock,
    History,
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
import ModalMotivo from "../components/ui/ModalMotivo";
import Avisos from "../components/ui/Avisos";
import { useAvisos } from "../hooks/useAvisos";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../config/permissions";
import { mensajeError } from "../api/axios";
import * as movimientosService from "../services/movimientos.service";
import { fechaCorta, hoyISO, normalizar } from "../utils/formato";
import type { CamaraStock, Movimiento, RespuestaTraslado, Trasladable } from "../types/movimiento";
import "../styles/crud.css";
import "../styles/usuarios.css";
import "../styles/fincas.css";
import "../styles/movimientos.css";

// ============================================================================
// MOVIMIENTOS · preenfrío → conservación y stock
// ============================================================================
//   Stock arriba          tarjetas por cámara (preenfrío y conserva) con lo
//                         que hay ahorita. Se refresca cada minuto.
//   Mover a conservación  fruta DENTRO de los preenfríos, ordenada por
//                         criticidad, con su botón Mover (supervisor+).
//   Registro              bitácora de movimientos con filtros. Revertir un
//                         traslado crea un movimiento inverso: quedan las
//                         dos filas en la bitácora (supervisor+).
//
// El inventario lo mueve la BD (trg_sync_ocupacion_movimiento). Esta
// pantalla solo registra el traslado y relee.
// ============================================================================

type Pestana = "mover" | "registro";

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

export default function Movimientos() {
    const { usuario } = useAuth();
    const { avisos, mostrar, quitar } = useAvisos();
    const puedeMover = tieneRol(usuario, ROLES.SUPERVISOR);

    const [pestana, setPestana] = useState<Pestana>("mover");
    const [stock, setStock] = useState<CamaraStock[]>([]);
    const [error, setError] = useState("");

    // ---- Mover ----
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
            setStock(await movimientosService.getStock());
        } catch (e) {
            setError(mensajeError(e));
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

    useEffect(() => {
        cargarStock();
        cargarTrasladables();
        const t = setInterval(cargarStock, REFRESCO_MS);
        return () => clearInterval(t);
    }, [cargarStock, cargarTrasladables]);

    useEffect(() => {
        if (pestana === "registro") cargarRegistro();
    }, [pestana, cargarRegistro]);

    const refrescarTodo = () => {
        setError("");
        cargarStock();
        cargarTrasladables();
        if (pestana === "registro") cargarRegistro();
    };

    // ---- Derivados ----
    const preenfrios = stock.filter((c) => Number(c.tipo_camara) === 1);
    const conservaciones = stock.filter((c) => Number(c.tipo_camara) === 2);

    const visiblesMover = useMemo(() => {
        const t = normalizar(buscarMover.trim());
        return trasladables.filter((p) => {
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
    }, [trasladables, preenfrio, buscarMover]);

    const visiblesReg = useMemo(() => {
        const t = normalizar(buscarReg.trim());
        if (!t) return movs;
        return movs.filter((m) =>
            normalizar(
                `${m.codigo_lote ?? ""} ${m.nombre_finca ?? ""} ${m.codigo_sku ?? ""} ${m.camara_origen ?? ""} ${m.camara_destino ?? ""} ${m.folio_despacho ?? ""}`
            ).includes(t)
        );
    }, [movs, buscarReg]);

    // Movimientos que son reversa de otro, y los que ya fueron revertidos
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
        cargarStock();
        cargarTrasladables();
    };

    const confirmarReversa = async (motivo: string) => {
        if (!revirtiendo) return;
        const r = await movimientosService.revertir(revirtiendo.id_movimiento, motivo);
        setRevirtiendo(null);
        mostrar("exito", r.mensaje);
        r.avisos?.forEach((a) => mostrar("info", a));
        cargarStock();
        cargarTrasladables();
        cargarRegistro();
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Movimientos" subtitulo="Preenfrío a conservación y stock en tiempo real">
                <button
                    type="button"
                    className="boton-icono boton-icono--borde"
                    onClick={refrescarTodo}
                    title="Actualizar"
                    aria-label="Actualizar"
                >
                    <RefreshCw size={18} className={cargandoMover || cargandoReg ? "girando" : ""} />
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
                <button
                    type="button"
                    role="tab"
                    aria-selected={pestana === "mover"}
                    className={pestana === "mover" ? "activo" : ""}
                    onClick={() => setPestana("mover")}
                >
                    <ArrowRightLeft size={16} /> Mover a conservación {trasladables.length > 0 && <span>{trasladables.length}</span>}
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={pestana === "registro"}
                    className={pestana === "registro" ? "activo" : ""}
                    onClick={() => setPestana("registro")}
                >
                    <History size={16} /> Registro
                </button>
            </div>

            {/* ================= MOVER ================= */}
            {pestana === "mover" && (
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
                            <select
                                className="selector"
                                value={preenfrio}
                                onChange={(e) => setPreenfrio(e.target.value)}
                                aria-label="Filtrar por preenfrío"
                            >
                                <option value="">Todos los preenfríos</option>
                                {preenfrios.map((c) => (
                                    <option key={c.id_camara} value={c.id_camara}>
                                        {c.nombre_camara}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {(buscarMover || preenfrio) && (
                        <div className="filtros-activos">
                            {preenfrio && (
                                <span className="chip chip--azul">
                                    {preenfrios.find((c) => String(c.id_camara) === preenfrio)?.nombre_camara}
                                </span>
                            )}
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
                            <p>{buscarMover || preenfrio ? "Nada coincide con los filtros." : "No hay fruta dentro de los preenfríos."}</p>
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
                                                    <span className={`chip ${CRITICIDAD[p.nivel_criticidad] ?? "chip--gris"}`}>
                                                        {p.criticidad_texto}
                                                    </span>
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
                                placeholder="Buscar lote, finca, SKU, cámara o folio…"
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
                                                            {esReversa ? "Reversa" : m.tipo_texto}
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
                                                        {Number(m.tipo_movimiento) === 2 && !esReversa && !yaRevertido && (
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
                            {visiblesReg.length} movimiento(s) ·{" "}
                            {visiblesReg.reduce((s, m) => s + num(m.cantidad_tarimas), 0)} tarimas
                        </p>
                    )}
                </section>
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
                                Regresan <strong>{num(revirtiendo.cantidad_tarimas)} tarimas</strong> de{" "}
                                {revirtiendo.camara_destino} a {revirtiendo.camara_origen}.
                            </p>
                            <p className="modal__advertencia">
                                <AlertTriangle size={14} className="icono-en-linea" /> No se borra nada: queda el traslado y su
                                reversa en el registro.
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
