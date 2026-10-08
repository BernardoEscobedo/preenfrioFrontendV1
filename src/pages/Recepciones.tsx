import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    Bell,
    ClipboardCheck,
    Clock,
    LockOpen,
    MapPin,
    PackageCheck,
    PackageX,
    RefreshCw,
    Search,
    Snowflake,
    Truck,
    X
} from "lucide-react";
import EncabezadoPagina from "../components/layout/EncabezadoPagina";
import ModalRecibirProceso from "../components/recepciones/ModalRecibirProceso";
import AlertasRecepcion from "../components/recepciones/AlertasRecepcion";
import ModalMotivo from "../components/ui/ModalMotivo";
import Avisos from "../components/ui/Avisos";
import { useAvisos } from "../hooks/useAvisos";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../config/permissions";
import { mensajeError } from "../api/axios";
import * as recepcionesService from "../services/recepciones.service";
import { fechaCorta, fechaHora, normalizar } from "../utils/formato";
import type { EstadoRecepcion, LineaEsperada, RespuestaLote } from "../types/recepcion";
import "../styles/crud.css";
import "../styles/usuarios.css";
import "../styles/fincas.css";
import "../styles/recepciones.css";

// ============================================================================
// RECEPCIONES · lo que el preenfrío espera recibir
// ============================================================================
//   Por recibir   operativo+    una fila por PROCESO (lote + SKU + destino),
//                               con su finca de origen
//   Alertas       coordinador+  diferencias y "no llegó"
//
// Cada proceso se recibe desde su propia fila con el botón "Recibir": el
// modal muestra solo ese proceso.
//
// El backend ya recorta por alcance de cámara: el supervisor y el operativo
// solo ven lo asignado a sus preenfríos.
// ============================================================================

type Pestana = "recibir" | "alertas";

const num = (v: number | string | null | undefined) => Number(v ?? 0);

const CHIP_ESTADO: Record<EstadoRecepcion, { clase: string; texto: string }> = {
    pendiente: { clase: "chip--gris", texto: "Por llegar" },
    no_llego: { clase: "chip--rojo", texto: "No llegó" },
    parcial: { clase: "chip--azul", texto: "Parcial" },
    completa: { clase: "chip--verde", texto: "Completa" }
};

export default function Recepciones() {
    const { usuario } = useAuth();
    const { avisos, mostrar, quitar } = useAvisos();
    const esCoordinador = tieneRol(usuario, ROLES.COORDINADOR);

    const [pestana, setPestana] = useState<Pestana>("recibir");
    const [lineas, setLineas] = useState<LineaEsperada[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [verConfirmadas, setVerConfirmadas] = useState(false);
    const [buscar, setBuscar] = useState("");
    const [camara, setCamara] = useState("");

    const [recibiendo, setRecibiendo] = useState<LineaEsperada | null>(null);
    const [reabriendo, setReabriendo] = useState<LineaEsperada | null>(null);
    const [alertasPendientes, setAlertasPendientes] = useState(0);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setLineas(await recepcionesService.getEsperadas({ todas: verConfirmadas }));
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargando(false);
        }
    }, [verConfirmadas]);

    const cargarResumen = useCallback(async () => {
        if (!esCoordinador) return;
        try {
            const r = await recepcionesService.getResumenAlertas();
            setAlertasPendientes(num(r.pendientes));
        } catch {
            // El contador es informativo: si falla, no bloquea la pantalla
        }
    }, [esCoordinador]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    useEffect(() => {
        cargarResumen();
    }, [cargarResumen]);

    // ---- Derivados ----
    const camaras = useMemo(() => {
        const mapa = new Map<number, string>();
        lineas.forEach((l) => mapa.set(l.id_camara, l.nombre_camara));
        return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
    }, [lineas]);

    const visibles = useMemo(() => {
        const t = normalizar(buscar.trim());
        return lineas.filter((l) => {
            if (camara && String(l.id_camara) !== camara) return false;
            if (
                t &&
                !normalizar(
                    `${l.codigo_lote ?? ""} ${l.codigo_productor} ${l.nombre_productor} ${l.codigo_finca} ${l.nombre_finca} ${l.codigo_sku} ${l.calidad_sku} ${l.acronimo_cc} ${l.cliente}`
                ).includes(t)
            )
                return false;
            return true;
        });
    }, [lineas, buscar, camara]);

    const totales = useMemo(() => {
        const abiertas = lineas.filter((l) => l.estado_recepcion !== "completa");
        return {
            procesos: abiertas.length,
            tarimas: abiertas.reduce((s, l) => s + Math.max(num(l.tarimas_esperadas) - num(l.tarimas_recibidas), 0), 0),
            parciales: abiertas.filter((l) => l.estado_recepcion === "parcial").length,
            noLlego: abiertas.filter((l) => l.estado_recepcion === "no_llego").length
        };
    }, [lineas]);

    const hayFiltros = Boolean(buscar || camara);
    const mostrarReabrir = esCoordinador && verConfirmadas;

    // ---- Acciones ----
    const alGuardar = (r: RespuestaLote) => {
        setRecibiendo(null);
        mostrar("exito", r.mensaje);
        if (r.alertas > 0) mostrar("info", `Se envió alerta al coordinador.`);
        r.avisos.forEach((a) => mostrar("info", a));
        cargar();
        cargarResumen();
    };

    const reabrir = async (motivo: string) => {
        if (!reabriendo?.id_cierre) return;
        const r = await recepcionesService.reabrirLinea(reabriendo.id_cierre, motivo);
        setReabriendo(null);
        mostrar("exito", r.mensaje);
        cargar();
        cargarResumen();
    };

    return (
        <div className="crud">
            <EncabezadoPagina titulo="Recepciones" subtitulo="Lo que el preenfrío espera recibir">
                <button
                    type="button"
                    className="boton-icono boton-icono--borde"
                    onClick={() => {
                        cargar();
                        cargarResumen();
                    }}
                    disabled={cargando}
                    title="Actualizar"
                    aria-label="Actualizar todo"
                >
                    <RefreshCw size={18} className={cargando ? "girando" : ""} />
                </button>
            </EncabezadoPagina>

            {esCoordinador && (
                <div className="segmentado recepciones__pestanas" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={pestana === "recibir"}
                        className={pestana === "recibir" ? "activo" : ""}
                        onClick={() => setPestana("recibir")}
                    >
                        <Truck size={16} /> Por recibir
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={pestana === "alertas"}
                        className={pestana === "alertas" ? "activo" : ""}
                        onClick={() => setPestana("alertas")}
                    >
                        <Bell size={16} /> Alertas {alertasPendientes > 0 && <span>{alertasPendientes}</span>}
                    </button>
                </div>
            )}

            {pestana === "alertas" && esCoordinador ? (
                <AlertasRecepcion mostrar={mostrar} onCambio={cargarResumen} />
            ) : (
                <>
                    <section className="crud__resumen crud__resumen--cuatro">
                        <div className="mini-kpi">
                            <Truck size={22} />
                            <div>
                                <strong>{totales.procesos}</strong>
                                <span>Procesos por recibir</span>
                            </div>
                        </div>
                        <div className="mini-kpi">
                            <Snowflake size={22} />
                            <div>
                                <strong>{totales.tarimas}</strong>
                                <span>Tarimas pendientes</span>
                            </div>
                        </div>
                        <div className="mini-kpi mini-kpi--ambar">
                            <Clock size={22} />
                            <div>
                                <strong>{totales.parciales}</strong>
                                <span>Parciales</span>
                            </div>
                        </div>
                        <div className="mini-kpi mini-kpi--gris">
                            <PackageX size={22} />
                            <div>
                                <strong>{totales.noLlego}</strong>
                                <span>Marcados "no llegó"</span>
                            </div>
                        </div>
                    </section>

                    <section className="panel">
                        <div className="crud__barra">
                            <label className="buscador">
                                <Search size={18} />
                                <input
                                    type="search"
                                    value={buscar}
                                    onChange={(e) => setBuscar(e.target.value)}
                                    placeholder="Buscar lote, productor, finca, SKU o destino…"
                                />
                            </label>

                            {camaras.length > 1 && (
                                <select
                                    className="selector"
                                    value={camara}
                                    onChange={(e) => setCamara(e.target.value)}
                                    aria-label="Filtrar por preenfrío"
                                >
                                    <option value="">Todos los preenfríos</option>
                                    {camaras.map(([id, nombre]) => (
                                        <option key={id} value={id}>
                                            {nombre}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <label className="interruptor">
                                <input
                                    type="checkbox"
                                    checked={verConfirmadas}
                                    onChange={(e) => setVerConfirmadas(e.target.checked)}
                                />
                                Ver confirmadas
                            </label>
                        </div>

                        {hayFiltros && (
                            <div className="filtros-activos">
                                {camara && (
                                    <span className="chip chip--azul">
                                        {camaras.find(([id]) => String(id) === camara)?.[1]}
                                    </span>
                                )}
                                {buscar && <span className="chip chip--azul">"{buscar}"</span>}
                                <button
                                    type="button"
                                    className="enlace enlace--verde"
                                    onClick={() => {
                                        setBuscar("");
                                        setCamara("");
                                    }}
                                >
                                    <X size={14} /> Quitar filtros
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="alerta alerta--error">
                                {error}{" "}
                                <button type="button" className="enlace" onClick={cargar}>
                                    Reintentar
                                </button>
                            </div>
                        )}

                        {cargando && lineas.length === 0 ? (
                            <div className="crud__vacio">
                                <div className="spinner" />
                                <p>Cargando lo que se espera recibir…</p>
                            </div>
                        ) : visibles.length === 0 && !error ? (
                            <div className="crud__vacio">
                                <PackageCheck size={40} />
                                <p>
                                    {hayFiltros
                                        ? "Ningún proceso coincide con los filtros."
                                        : "No hay fruta pendiente de recibir en tus preenfríos."}
                                </p>
                            </div>
                        ) : (
                            <div className="tabla-contenedor">
                                <table className="tabla tabla--crud">
                                    <thead>
                                        <tr>
                                            <th>Finca de origen</th>
                                            <th>Lote</th>
                                            <th>SKU</th>
                                            <th>Destino</th>
                                            <th>Plan</th>
                                            <th>Recibido</th>
                                            <th>Estado</th>
                                            <th className="acciones">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibles.map((l) => {
                                            const chip = CHIP_ESTADO[l.estado_recepcion];
                                            const difC = num(l.diferencia_cajas_cierre);
                                            const difT = num(l.diferencia_tarimas_cierre);
                                            const completa = l.estado_recepcion === "completa";
                                            const conDif = completa && (difC !== 0 || difT !== 0);
                                            return (
                                                <tr key={l.id_produccion} className={completa ? "fila--baja" : ""}>
                                                    <td data-etiqueta="Finca">
                                                        <div className="celda-doble">
                                                            <strong>
                                                                {l.codigo_productor} {l.codigo_finca} {l.nombre_finca}
                                                            </strong>
                                                            <small>
                                                                {l.nombre_productor}
                                                                {l.region && (
                                                                    <>
                                                                        {" · "}
                                                                        <MapPin size={11} className="icono-en-linea" /> {l.region}
                                                                    </>
                                                                )}
                                                            </small>
                                                        </div>
                                                    </td>
                                                    <td data-etiqueta="Lote">
                                                        <div className="celda-doble">
                                                            <span className="lote-chip mono">{l.codigo_lote ?? "—"}</span>
                                                            <small>
                                                                Empaque {fechaCorta(l.fecha_empaque)} · S{l.semana}
                                                                {camaras.length > 1 ? ` · ${l.nombre_camara}` : ""}
                                                            </small>
                                                        </div>
                                                    </td>
                                                    <td data-etiqueta="SKU">
                                                        <div className="celda-doble">
                                                            <span className="mono">{l.codigo_sku}</span>
                                                            <small>{l.calidad_sku}</small>
                                                        </div>
                                                    </td>
                                                    <td data-etiqueta="Destino">
                                                        <div className="celda-doble">
                                                            <span>{l.acronimo_cc}</span>
                                                            <small>
                                                                {l.fecha_entrega ? `Entrega ${fechaCorta(l.fecha_entrega)}` : l.cliente}
                                                            </small>
                                                        </div>
                                                    </td>
                                                    <td data-etiqueta="Plan">
                                                        {num(l.cajas_esperadas)} cj · {num(l.tarimas_esperadas)} tar
                                                    </td>
                                                    <td data-etiqueta="Recibido">
                                                        <div className="celda-doble">
                                                            <span>
                                                                {num(l.cajas_recibidas)} cj · {num(l.tarimas_recibidas)} tar
                                                            </span>
                                                            {num(l.recepciones) > 1 && <small>{num(l.recepciones)} viajes</small>}
                                                        </div>
                                                    </td>
                                                    <td data-etiqueta="Estado">
                                                        <div className="estados">
                                                            <span className={`chip ${chip.clase}`}>{chip.texto}</span>
                                                            {conDif && (
                                                                <span className="chip chip--ambar">
                                                                    <AlertTriangle size={12} /> {difC > 0 ? "+" : ""}
                                                                    {difC} cj
                                                                    {difT !== 0 ? ` · ${difT > 0 ? "+" : ""}${difT} tar` : ""}
                                                                </span>
                                                            )}
                                                            {!completa && num(l.veces_no_llego) > 0 && l.ultimo_no_llego && (
                                                                <small>No llegó el {fechaCorta(l.ultimo_no_llego)}</small>
                                                            )}
                                                            {completa && l.fecha_hora_cierre && (
                                                                <small>{fechaHora(l.fecha_hora_cierre)}</small>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="acciones">
                                                        {!completa ? (
                                                            <button
                                                                type="button"
                                                                className="boton boton--primario boton--auto boton--chico"
                                                                onClick={() => setRecibiendo(l)}
                                                                aria-label={`Recibir ${l.codigo_lote ?? ""} ${l.codigo_sku}`}
                                                            >
                                                                <ClipboardCheck size={16} /> Recibir
                                                            </button>
                                                        ) : (
                                                            mostrarReabrir &&
                                                            l.id_cierre && (
                                                                <button
                                                                    type="button"
                                                                    className="boton-icono"
                                                                    onClick={() => setReabriendo(l)}
                                                                    title="Reabrir para recibir más fruta"
                                                                    aria-label={`Reabrir ${l.codigo_lote ?? ""} ${l.codigo_sku}`}
                                                                >
                                                                    <LockOpen size={18} />
                                                                </button>
                                                            )
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!cargando && visibles.length > 0 && (
                            <p className="crud__pie">
                                Mostrando {visibles.length} de {lineas.length} proceso(s)
                            </p>
                        )}
                    </section>
                </>
            )}

            {recibiendo && (
                <ModalRecibirProceso linea={recibiendo} onGuardado={alGuardar} onCerrar={() => setRecibiendo(null)} />
            )}

            {reabriendo && (
                <ModalMotivo
                    titulo={`Reabrir ${reabriendo.codigo_lote ?? ""} · ${reabriendo.codigo_sku}`}
                    descripcion={
                        <p>
                            El proceso volverá a aceptar recepciones y tendrá que confirmarse de nuevo. Si su alerta seguía
                            pendiente, quedará atendida con este motivo.
                        </p>
                    }
                    obligatorio
                    etiquetaConfirmar="Reabrir"
                    tono="primario"
                    onConfirmar={reabrir}
                    onCerrar={() => setReabriendo(null)}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
