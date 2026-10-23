import { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    Clock,
    Container,
    History,
    LogIn,
    Play,
    RefreshCw,
    Snowflake,
    Warehouse,
    Wrench,
    XCircle
} from "lucide-react";
import EncabezadoPagina from "../components/layout/EncabezadoPagina";
import ModalMantenimiento from "../components/mantenimientos/ModalMantenimiento";
import ModalFinalizar from "../components/mantenimientos/ModalFinalizar";
import ModalReubicar from "../components/mantenimientos/ModalReubicar";
import PanelFruta from "../components/mantenimientos/PanelFruta";
import ModalMotivo from "../components/ui/ModalMotivo";
import ModalConfirmar from "../components/ui/ModalConfirmar";
import Avisos from "../components/ui/Avisos";
import { useAvisos } from "../hooks/useAvisos";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../config/permissions";
import { mensajeError } from "../api/axios";
import * as mantenimientosService from "../services/mantenimientos.service";
import * as temporalesService from "../services/temporales.service";
import { fechaCorta, fechaHora, hoyISO } from "../utils/formato";
import type { CamaraMantenimiento, Mantenimiento, RespuestaMantenimiento, TableroMantenimientos } from "../types/mantenimiento";
import type { CajaTemporal, RespuestaReubicar } from "../types/temporal";
import "../styles/crud.css";
import "../styles/usuarios.css";
import "../styles/fincas.css";
import "../styles/mantenimientos.css";

// ============================================================================
// MANTENIMIENTOS DE CÁMARA
// ============================================================================
//   Cámaras           una tarjeta por cámara: operando, fuera de servicio o
//                     con preventivo programado.
//                       · Reportar falla       sale de servicio al guardar
//                       · Programar preventivo sale de servicio a su hora
//                       · Finalizar            vuelve a operar (solo sin
//                                              fruta dentro)
//                     Al quedar fuera de servicio con fruta, se abre "Sacar
//                     la fruta": caja de línea fletera, otra cámara o
//                     despacho. Es obligatorio.
//   Cajas temporales  cajas de línea fletera usadas como cámara temporal:
//                     su fruta, reingresar a una cámara y cerrar.
//   Historial         todos los mantenimientos, con filtros.
//
// Se refresca cada minuto (los preventivos arrancan solos a su hora).
// ============================================================================

type Pestana = "camaras" | "cajas" | "historial";

interface OrigenReubicar {
    id_camara: number;
    nombre_camara: string;
    tarimas_dentro: number;
    cajas_dentro: number;
    tarimas_en_cola: number;
    es_caja?: boolean;
}

const REFRESCO_MS = 60_000;
const num = (v: number | string | null | undefined) => Number(v ?? 0);

const TIPO_TEXTO: Record<number, string> = { 1: "Preventivo", 2: "Correctivo", 3: "Emergencia" };
const CHIP_ESTADO: Record<number, string> = { 1: "chip--azul", 2: "chip--rojo", 3: "chip--verde", 4: "chip--gris" };
const CHIP_TIPO: Record<number, string> = { 1: "chip--azul", 2: "chip--ambar", 3: "chip--rojo" };

const sumarDias = (iso: string, dias: number) => {
    const [a, m, d] = iso.split("-").map(Number);
    const f = new Date(a, m - 1, d + dias);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};

const persona = (n: string | null, a: string | null, u: string | null) => [n, a].filter(Boolean).join(" ") || u || "—";

export default function Mantenimientos() {
    const { usuario } = useAuth();
    const { avisos, mostrar, quitar } = useAvisos();
    const esCoordinador = tieneRol(usuario, ROLES.COORDINADOR);

    const [pestana, setPestana] = useState<Pestana>("camaras");
    const [tablero, setTablero] = useState<TableroMantenimientos | null>(null);
    const [cajas, setCajas] = useState<CajaTemporal[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [registrando, setRegistrando] = useState<{ camara: CamaraMantenimiento; modo: "falla" | "preventivo" } | null>(null);
    const [finalizando, setFinalizando] = useState<CamaraMantenimiento | null>(null);
    const [iniciando, setIniciando] = useState<CamaraMantenimiento | null>(null);
    const [cancelando, setCancelando] = useState<CamaraMantenimiento | null>(null);
    const [reubicando, setReubicando] = useState<OrigenReubicar | null>(null);
    const [cerrandoCaja, setCerrandoCaja] = useState<CajaTemporal | null>(null);
    const [pendienteSacar, setPendienteSacar] = useState<number | null>(null);

    // ---- Historial ----
    const [historial, setHistorial] = useState<Mantenimiento[]>([]);
    const [cargandoHist, setCargandoHist] = useState(false);
    const [fCamara, setFCamara] = useState("");
    const [fTipo, setFTipo] = useState("");
    const [fEstado, setFEstado] = useState("");
    const [desde, setDesde] = useState(sumarDias(hoyISO(), -90));
    const [hasta, setHasta] = useState(hoyISO());

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const [t, c] = await Promise.all([mantenimientosService.getTablero(), temporalesService.getCajas()]);
            setTablero(t);
            setCajas(c);
            setError("");
            return t;
        } catch (e) {
            setError(mensajeError(e));
            return null;
        } finally {
            setCargando(false);
        }
    }, []);

    const cargarHistorial = useCallback(async () => {
        setCargandoHist(true);
        try {
            setHistorial(
                await mantenimientosService.getHistorial({
                    id_camara: fCamara ? Number(fCamara) : null,
                    tipo: fTipo ? Number(fTipo) : null,
                    estado: fEstado ? Number(fEstado) : null,
                    fecha_desde: desde || undefined,
                    fecha_hasta: hasta || undefined
                })
            );
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargandoHist(false);
        }
    }, [fCamara, fTipo, fEstado, desde, hasta]);

    useEffect(() => {
        cargar();
        const t = setInterval(cargar, REFRESCO_MS);
        return () => clearInterval(t);
    }, [cargar]);

    useEffect(() => {
        if (pestana === "historial") cargarHistorial();
    }, [pestana, cargarHistorial]);

    // Al quedar fuera de servicio con fruta, se abre "Sacar la fruta"
    useEffect(() => {
        if (pendienteSacar === null || !tablero) return;
        const c = tablero.camaras.find((x) => x.id_camara === pendienteSacar);
        setPendienteSacar(null);
        if (c && (c.tarimas_dentro > 0 || c.tarimas_en_cola > 0)) setReubicando(c);
    }, [pendienteSacar, tablero]);

    const cerrarModales = () => {
        setRegistrando(null);
        setFinalizando(null);
        setIniciando(null);
        setCancelando(null);
        setReubicando(null);
        setCerrandoCaja(null);
    };

    const terminar = async (r: RespuestaMantenimiento) => {
        cerrarModales();
        mostrar("exito", r.mensaje);
        (r.avisos ?? []).forEach((a) => mostrar("info", a));
        await cargar();
        if (r.requiere_reubicar && r.id_camara) setPendienteSacar(r.id_camara);
        if (pestana === "historial") cargarHistorial();
    };

    const alReubicar = (r: RespuestaReubicar) => {
        cerrarModales();
        mostrar("exito", r.mensaje);
        r.avisos.forEach((a) => mostrar("info", a));
        cargar();
    };

    const iniciarYa = async () => {
        if (!iniciando?.id_programado) return;
        await terminar(await mantenimientosService.iniciar(iniciando.id_programado));
    };

    const cancelarProgramado = async (motivo: string) => {
        if (!cancelando?.id_programado) return;
        await terminar(await mantenimientosService.cancelar(cancelando.id_programado, motivo));
    };

    const cerrarCaja = async () => {
        if (!cerrandoCaja) return;
        const r = await temporalesService.cerrarCaja(cerrandoCaja.id_camara);
        cerrarModales();
        mostrar("exito", r.mensaje);
        cargar();
    };

    const camaras = tablero?.camaras ?? [];

    return (
        <div className="crud">
            <EncabezadoPagina titulo="Mantenimientos" subtitulo="Cámaras fuera de servicio, preventivos, cajas temporales e historial">
                <button
                    type="button"
                    className="boton-icono boton-icono--borde"
                    onClick={() => {
                        cargar();
                        if (pestana === "historial") cargarHistorial();
                    }}
                    disabled={cargando}
                    title="Actualizar"
                    aria-label="Actualizar"
                >
                    <RefreshCw size={18} className={cargando || cargandoHist ? "girando" : ""} />
                </button>
            </EncabezadoPagina>

            {error && <div className="alerta alerta--error">{error}</div>}

            {tablero && (
                <section className="crud__resumen crud__resumen--cuatro">
                    <div className="mini-kpi">
                        <CheckCircle2 size={22} />
                        <div>
                            <strong>{tablero.resumen.camaras - tablero.resumen.fuera_de_servicio}</strong>
                            <span>Operando</span>
                        </div>
                    </div>
                    <div className="mini-kpi" style={{ color: "var(--rojo)" }}>
                        <XCircle size={22} />
                        <div>
                            <strong>{tablero.resumen.fuera_de_servicio}</strong>
                            <span>Fuera de servicio</span>
                        </div>
                    </div>
                    <div className="mini-kpi mini-kpi--ambar">
                        <AlertTriangle size={22} />
                        <div>
                            <strong>{tablero.resumen.con_fruta_por_reubicar}</strong>
                            <span>Con fruta por sacar</span>
                        </div>
                    </div>
                    <div className="mini-kpi">
                        <Container size={22} />
                        <div>
                            <strong>{cajas.length}</strong>
                            <span>Cajas temporales abiertas</span>
                        </div>
                    </div>
                </section>
            )}

            <div className="segmentado mant__pestanas" role="tablist">
                <button type="button" role="tab" aria-selected={pestana === "camaras"} className={pestana === "camaras" ? "activo" : ""} onClick={() => setPestana("camaras")}>
                    <Wrench size={16} /> Cámaras
                </button>
                <button type="button" role="tab" aria-selected={pestana === "cajas"} className={pestana === "cajas" ? "activo" : ""} onClick={() => setPestana("cajas")}>
                    <Container size={16} /> Cajas temporales {cajas.length > 0 && <span>{cajas.length}</span>}
                </button>
                <button type="button" role="tab" aria-selected={pestana === "historial"} className={pestana === "historial" ? "activo" : ""} onClick={() => setPestana("historial")}>
                    <History size={16} /> Historial
                </button>
            </div>

            {/* ================= CÁMARAS ================= */}
            {pestana === "camaras" &&
                (cargando && !tablero ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando cámaras…</p>
                    </div>
                ) : (
                    <div className="mant__camaras">
                        {camaras.map((c) => {
                            const fuera = c.bloqueada;
                            const conFruta = c.tarimas_dentro > 0;
                            return (
                                <section key={c.id_camara} className={`panel mant__camara ${fuera ? "mant__camara--fuera" : ""}`}>
                                    <div className="mant__cabeza">
                                        {Number(c.tipo_camara) === 1 ? <Snowflake size={20} /> : <Warehouse size={20} />}
                                        <strong>{c.nombre_camara}</strong>
                                        <span className={`chip ${fuera ? "chip--rojo" : "chip--verde"}`}>{fuera ? "Fuera de servicio" : "Operando"}</span>
                                    </div>

                                    {fuera ? (
                                        <div className="mant__estado">
                                            {c.id_activo ? (
                                                <>
                                                    <span className={`chip ${CHIP_TIPO[c.tipo_activo ?? 2]}`}>{TIPO_TEXTO[c.tipo_activo ?? 2]}</span>
                                                    <strong>{c.motivo_activo}</strong>
                                                    <small>
                                                        <Clock size={12} className="icono-en-linea" /> Desde {fechaCorta(c.fecha_inicio_activo)}{" "}
                                                        {String(c.hora_inicio_activo ?? "").slice(0, 5)} · {num(c.horas_paro)} h fuera de servicio
                                                    </small>
                                                </>
                                            ) : (
                                                <small>Bloqueada sin mantenimiento ligado. Pide a un administrador que revise los bloqueos huérfanos.</small>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mant__estado">
                                            <small>
                                                {c.tarimas_dentro} tarima(s) dentro · {c.tarimas_en_cola} en espera
                                            </small>
                                        </div>
                                    )}

                                    {c.id_programado && (
                                        <div className="mant__programado">
                                            <CalendarClock size={16} />
                                            <div>
                                                <strong>Preventivo: {c.motivo_programado}</strong>
                                                <small>
                                                    {fechaCorta(c.fecha_programado)} a las {String(c.hora_programado ?? "").slice(0, 5)}
                                                    {fuera ? " · inicia cuando termine el paro actual" : ""}
                                                </small>
                                            </div>
                                            {!fuera && (
                                                <button type="button" className="boton-icono" onClick={() => setIniciando(c)} title="Iniciar ya" aria-label="Iniciar ya el preventivo">
                                                    <Play size={16} />
                                                </button>
                                            )}
                                            {esCoordinador && (
                                                <button type="button" className="boton-icono boton-icono--peligro" onClick={() => setCancelando(c)} title="Cancelar preventivo" aria-label="Cancelar preventivo">
                                                    <XCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {fuera && (conFruta || c.tarimas_en_cola > 0) && <PanelFruta camara={c} onSacar={() => setReubicando(c)} />}

                                    <div className="mant__acciones">
                                        {fuera ? (
                                            c.id_activo && (
                                                <button
                                                    type="button"
                                                    className="boton boton--primario boton--auto"
                                                    onClick={() => setFinalizando(c)}
                                                    disabled={conFruta}
                                                    title={conFruta ? "Primero saca la fruta de la cámara" : undefined}
                                                >
                                                    <CheckCircle2 size={16} /> Finalizar · vuelve a operar
                                                </button>
                                            )
                                        ) : (
                                            <button type="button" className="boton boton--peligro boton--auto" onClick={() => setRegistrando({ camara: c, modo: "falla" })}>
                                                <Wrench size={16} /> Reportar falla
                                            </button>
                                        )}
                                        <button type="button" className="boton boton--claro boton--auto" onClick={() => setRegistrando({ camara: c, modo: "preventivo" })}>
                                            <CalendarClock size={16} /> Programar preventivo
                                        </button>
                                    </div>
                                    {fuera && conFruta && c.id_activo && (
                                        <small className="mant__aviso-final">Para finalizar, primero saca la fruta de la cámara.</small>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                ))}

            {/* ================= CAJAS TEMPORALES ================= */}
            {pestana === "cajas" &&
                (cajas.length === 0 ? (
                    <div className="crud__vacio">
                        <Container size={40} />
                        <p>No hay cajas temporales abiertas. Se abren al sacar la fruta de una cámara fuera de servicio.</p>
                    </div>
                ) : (
                    <div className="mant__camaras">
                        {cajas.map((k) => (
                            <section key={k.id_camara} className="panel mant__camara mant__camara--caja">
                                <div className="mant__cabeza">
                                    <Container size={20} />
                                    <strong>{k.nombre_camara}</strong>
                                    <span className="chip chip--azul">Caja temporal</span>
                                </div>
                                <div className="mant__estado">
                                    <strong>{k.razon_social}</strong>
                                    <small>
                                        Placas {k.placas_caja} · Eco {k.numero_economico} · de {k.camara_origen ?? "—"}
                                    </small>
                                    <small>Abierta {fechaHora(k.fecha_hora_apertura)}</small>
                                    <small>
                                        <strong>{k.tarimas_dentro}</strong>/{k.capacidad_max_tarimas} tarimas · {k.cajas_dentro} cajas · {k.procesos} proceso(s)
                                        {k.tarimas_en_cola ? ` · ${k.tarimas_en_cola} en cola` : ""}
                                    </small>
                                </div>
                                <div className="mant__acciones">
                                    {k.tarimas_dentro + k.tarimas_en_cola > 0 ? (
                                        <button
                                            type="button"
                                            className="boton boton--primario boton--auto"
                                            onClick={() =>
                                                setReubicando({
                                                    id_camara: k.id_camara,
                                                    nombre_camara: k.nombre_camara,
                                                    tarimas_dentro: k.tarimas_dentro,
                                                    cajas_dentro: k.cajas_dentro,
                                                    tarimas_en_cola: k.tarimas_en_cola,
                                                    es_caja: true
                                                })
                                            }
                                        >
                                            <LogIn size={16} /> Reingresar a una cámara
                                        </button>
                                    ) : (
                                        <button type="button" className="boton boton--claro boton--auto" onClick={() => setCerrandoCaja(k)}>
                                            <XCircle size={16} /> Cerrar caja
                                        </button>
                                    )}
                                </div>
                                <small className="mant__aviso-final">También se puede despachar directo desde la caja en Despachos.</small>
                            </section>
                        ))}
                    </div>
                ))}

            {/* ================= HISTORIAL ================= */}
            {pestana === "historial" && (
                <section className="panel">
                    <div className="crud__barra">
                        <select className="selector" value={fCamara} onChange={(e) => setFCamara(e.target.value)} aria-label="Cámara">
                            <option value="">Todas las cámaras</option>
                            {camaras.map((c) => (
                                <option key={c.id_camara} value={c.id_camara}>
                                    {c.nombre_camara}
                                </option>
                            ))}
                        </select>
                        <select className="selector" value={fTipo} onChange={(e) => setFTipo(e.target.value)} aria-label="Tipo">
                            <option value="">Todo tipo</option>
                            <option value="1">Preventivo</option>
                            <option value="2">Correctivo</option>
                            <option value="3">Emergencia</option>
                        </select>
                        <select className="selector" value={fEstado} onChange={(e) => setFEstado(e.target.value)} aria-label="Estado">
                            <option value="">Todo estado</option>
                            <option value="1">Programado</option>
                            <option value="2">En proceso</option>
                            <option value="3">Finalizado</option>
                            <option value="4">Cancelado</option>
                        </select>
                        <label className="mant__fecha">
                            Desde
                            <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
                        </label>
                        <label className="mant__fecha">
                            Hasta
                            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                        </label>
                    </div>

                    {cargandoHist && historial.length === 0 ? (
                        <div className="crud__vacio">
                            <div className="spinner" />
                        </div>
                    ) : historial.length === 0 ? (
                        <div className="crud__vacio">
                            <History size={40} />
                            <p>No hay mantenimientos con esos filtros.</p>
                        </div>
                    ) : (
                        <div className="tabla-contenedor">
                            <table className="tabla tabla--crud">
                                <thead>
                                    <tr>
                                        <th>Cámara</th>
                                        <th>Tipo</th>
                                        <th>Motivo</th>
                                        <th>Inicio / Fin</th>
                                        <th>Horas fuera</th>
                                        <th>Estado</th>
                                        <th>Registró / Cerró</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historial.map((m) => (
                                        <tr key={m.id_mantenimiento}>
                                            <td data-etiqueta="Cámara">{m.nombre_camara}</td>
                                            <td data-etiqueta="Tipo">
                                                <div className="estados">
                                                    <span className={`chip ${CHIP_TIPO[m.tipo] ?? "chip--gris"}`}>{m.tipo_texto}</span>
                                                    <small>Prioridad {m.prioridad_texto.toLowerCase()}</small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Motivo">
                                                <div className="celda-doble">
                                                    <strong>{m.motivo}</strong>
                                                    {m.observaciones && <small>{m.observaciones}</small>}
                                                    {m.comentario_cierre && <small className="mant__cierre">Cierre: {m.comentario_cierre}</small>}
                                                </div>
                                            </td>
                                            <td data-etiqueta="Fechas">
                                                <div className="celda-doble">
                                                    <span>
                                                        {fechaCorta(m.fecha_inicio)} {String(m.hora_inicio).slice(0, 5)}
                                                    </span>
                                                    <small>{m.fecha_fin ? `${fechaCorta(m.fecha_fin)} ${String(m.hora_fin ?? "").slice(0, 5)}` : "—"}</small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Horas">
                                                {m.horas_paro !== null
                                                    ? `${num(m.horas_paro)} h`
                                                    : m.estado === 1 && m.horas_para_inicio !== null
                                                        ? `Inicia en ${num(m.horas_para_inicio)} h`
                                                        : "—"}
                                            </td>
                                            <td data-etiqueta="Estado">
                                                <span className={`chip ${CHIP_ESTADO[m.estado] ?? "chip--gris"}`}>{m.estado === 2 ? "Fuera de servicio" : m.estado_texto}</span>
                                            </td>
                                            <td data-etiqueta="Personas">
                                                <div className="celda-doble">
                                                    <span>{persona(m.nombre_registro, m.apellidos_registro, m.usuario_registro)}</span>
                                                    {(m.usuario_cierre || m.nombre_cierre) && <small>Cerró: {persona(m.nombre_cierre, m.apellidos_cierre, m.usuario_cierre)}</small>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!cargandoHist && historial.length > 0 && (
                        <p className="crud__pie">
                            {historial.length} mantenimiento(s) ·{" "}
                            {historial.filter((m) => m.estado === 3).reduce((s, m) => s + num(m.horas_paro), 0).toFixed(1)} h fuera de servicio (finalizados)
                        </p>
                    )}
                </section>
            )}

            {registrando && (
                <ModalMantenimiento camara={registrando.camara} modo={registrando.modo} onGuardado={terminar} onCerrar={() => setRegistrando(null)} />
            )}

            {finalizando && <ModalFinalizar camara={finalizando} onGuardado={terminar} onCerrar={() => setFinalizando(null)} />}

            {reubicando && <ModalReubicar origen={reubicando} onGuardado={alReubicar} onCerrar={() => setReubicando(null)} />}

            {iniciando && (
                <ModalConfirmar
                    titulo={`Iniciar ya el preventivo · ${iniciando.nombre_camara}`}
                    etiquetaConfirmar="Poner fuera de servicio"
                    descripcion={
                        <>
                            <p>
                                <strong>{iniciando.motivo_programado}</strong> estaba programado para el {fechaCorta(iniciando.fecha_programado)} a las{" "}
                                {String(iniciando.hora_programado ?? "").slice(0, 5)}. La cámara sale de servicio ahora.
                            </p>
                            {iniciando.tarimas_dentro > 0 && (
                                <p className="modal__advertencia">Tiene {iniciando.tarimas_dentro} tarima(s) dentro: después tendrás que sacarlas.</p>
                            )}
                        </>
                    }
                    onConfirmar={iniciarYa}
                    onCerrar={() => setIniciando(null)}
                />
            )}

            {cancelando && (
                <ModalMotivo
                    titulo={`Cancelar preventivo · ${cancelando.nombre_camara}`}
                    descripcion={<p>{cancelando.motivo_programado}. La cámara sigue operando.</p>}
                    obligatorio
                    etiquetaConfirmar="Cancelar preventivo"
                    onConfirmar={cancelarProgramado}
                    onCerrar={() => setCancelando(null)}
                />
            )}

            {cerrandoCaja && (
                <ModalConfirmar
                    titulo={`Cerrar ${cerrandoCaja.nombre_camara}`}
                    etiquetaConfirmar="Cerrar caja"
                    tono="primario"
                    descripcion={<p>La caja está vacía y deja de aparecer como cámara. Su historial se conserva.</p>}
                    onConfirmar={cerrarCaja}
                    onCerrar={() => setCerrandoCaja(null)}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
