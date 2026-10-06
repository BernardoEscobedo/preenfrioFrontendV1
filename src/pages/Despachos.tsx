import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, FileText, Lock, PackageCheck, Plus, RefreshCw, Search, ShieldAlert, ShieldQuestion, X } from "lucide-react";
import EncabezadoPagina from "../components/layout/EncabezadoPagina";
import DespachoFormulario from "../components/despachos/DespachoFormulario";
import DetalleDespacho from "../components/despachos/DetalleDespacho";
import ChipInocuidad from "../components/despachos/ChipInocuidad";
import Avisos from "../components/ui/Avisos";
import { useAvisos } from "../hooks/useAvisos";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../config/permissions";
import { mensajeError } from "../api/axios";
import * as despachosService from "../services/despachos.service";
import { fechaCorta, normalizar } from "../utils/formato";
import type { Despacho } from "../types/despacho";
import "../styles/crud.css";
import "../styles/usuarios.css";
import "../styles/fincas.css";
import "../styles/despachos.css";

// ============================================================================
// DESPACHOS · operativo+ (cada acción con su propio rol, ver DetalleDespacho)
// ============================================================================
// Dos vistas en la misma página:
//   · LISTADO   borradores y cerrados, con su estado de inocuidad
//   · DETALLE   un documento: datos, fruta cargada, inspección y cierre
//
// El backend ya recorta por alcance de cámara: un supervisor ve los
// despachos con fruta de SUS cámaras, más los borradores vacíos.
//
// Los indicadores de inspección pendiente y rechazada funcionan como
// filtro: son lo que detiene la salida de un camión.
// ============================================================================

type FiltroEstado = "borradores" | "cerrados" | "todos";
type FiltroInocuidad = "" | "pendiente" | "aprobada" | "rechazada";

const coincideInocuidad = (d: Despacho, f: FiltroInocuidad) => {
    if (!f) return true;
    if (f === "pendiente") return d.inocuidad === null || d.inocuidad === undefined;
    if (f === "aprobada") return Number(d.inocuidad) === 1 && d.inocuidad !== null;
    return d.inocuidad !== null && d.inocuidad !== undefined && Number(d.inocuidad) === 0;
};

const num = (v: number | string | null | undefined) => Number(v ?? 0);

export default function Despachos() {
    const { usuario } = useAuth();
    const { avisos, mostrar, quitar } = useAvisos();

    const [despachos, setDespachos] = useState<Despacho[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("borradores");
    const [filtroInocuidad, setFiltroInocuidad] = useState<FiltroInocuidad>("");

    const [seleccionado, setSeleccionado] = useState<number | null>(null);
    const [creando, setCreando] = useState(false);

    const puedeCrear = tieneRol(usuario, ROLES.COORDINADOR);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setDespachos(await despachosService.getDespachos());
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // ---- Derivados ----
    const totales = useMemo(() => {
        const borradores = despachos.filter((d) => Number(d.estado) === 1);
        return {
            borradores: borradores.length,
            cerrados: despachos.length - borradores.length,
            todos: despachos.length,
            pendientes: borradores.filter((d) => coincideInocuidad(d, "pendiente")).length,
            rechazados: borradores.filter((d) => coincideInocuidad(d, "rechazada")).length
        };
    }, [despachos]);

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());
        return despachos.filter((d) => {
            if (filtro === "borradores" && Number(d.estado) !== 1) return false;
            if (filtro === "cerrados" && Number(d.estado) !== 2) return false;
            if (!coincideInocuidad(d, filtroInocuidad)) return false;
            if (
                texto &&
                !normalizar(
                    [
                        d.folio_despacho,
                        d.cliente,
                        d.cedis,
                        d.cita,
                        d.orden_venta,
                        d.placas_caja,
                        d.placas_tracto,
                        d.nombre_operador,
                        d.razon_social
                    ]
                        .filter(Boolean)
                        .join(" ")
                ).includes(texto)
            )
                return false;
            return true;
        });
    }, [despachos, busqueda, filtro, filtroInocuidad]);

    const hayFiltros = Boolean(busqueda || filtroInocuidad);

    const limpiarFiltros = () => {
        setBusqueda("");
        setFiltroInocuidad("");
    };

    // Los indicadores de inspección filtran solo borradores
    const alternarInocuidad = (valor: FiltroInocuidad) => {
        setFiltro("borradores");
        setFiltroInocuidad((actual) => (actual === valor ? "" : valor));
    };

    // ---- Vista de detalle ----
    if (seleccionado !== null) {
        return (
            <>
                <DetalleDespacho
                    idDespacho={seleccionado}
                    onVolver={() => setSeleccionado(null)}
                    onCambio={cargar}
                    mostrar={mostrar}
                />
                <Avisos avisos={avisos} onCerrar={quitar} />
            </>
        );
    }

    // ---- Vista de listado ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Despachos" subtitulo="Salida de fruta a clientes y CEDIS">
                {puedeCrear && (
                    <button
                        type="button"
                        className="boton-encabezado boton-encabezado--primario"
                        onClick={() => setCreando(true)}
                    >
                        <Plus size={18} />
                        <span>Nuevo despacho</span>
                    </button>
                )}
            </EncabezadoPagina>

            <section className="crud__resumen crud__resumen--cuatro">
                <div className="mini-kpi">
                    <FileText size={22} />
                    <div>
                        <strong>{totales.borradores}</strong>
                        <span>Borradores</span>
                    </div>
                </div>
                <button
                    type="button"
                    className={`mini-kpi mini-kpi--ambar mini-kpi--boton ${filtroInocuidad === "pendiente" ? "mini-kpi--seleccionado" : ""}`}
                    onClick={() => alternarInocuidad("pendiente")}
                    title="Ver borradores sin inspección"
                >
                    <ShieldQuestion size={22} />
                    <div>
                        <strong>{totales.pendientes}</strong>
                        <span>Inspección pendiente</span>
                    </div>
                </button>
                <button
                    type="button"
                    className={`mini-kpi mini-kpi--boton ${filtroInocuidad === "rechazada" ? "mini-kpi--seleccionado" : ""}`}
                    style={{ color: "var(--rojo)" }}
                    onClick={() => alternarInocuidad("rechazada")}
                    title="Ver borradores con caja rechazada"
                >
                    <ShieldAlert size={22} />
                    <div>
                        <strong>{totales.rechazados}</strong>
                        <span>Caja rechazada</span>
                    </div>
                </button>
                <div className="mini-kpi mini-kpi--gris">
                    <Lock size={22} />
                    <div>
                        <strong>{totales.cerrados}</strong>
                        <span>Cerrados</span>
                    </div>
                </div>
            </section>

            <section className="panel">
                <div className="crud__barra">
                    <label className="buscador">
                        <Search size={18} />
                        <input
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar folio, cliente, cita, orden de venta o placas…"
                        />
                    </label>

                    <select
                        className="selector"
                        value={filtroInocuidad}
                        onChange={(e) => setFiltroInocuidad(e.target.value as FiltroInocuidad)}
                        aria-label="Filtrar por inocuidad"
                    >
                        <option value="">Toda inocuidad</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="aprobada">Aprobada</option>
                        <option value="rechazada">Rechazada</option>
                    </select>

                    <div className="segmentado" role="tablist">
                        {(
                            [
                                ["borradores", "Borradores"],
                                ["cerrados", "Cerrados"],
                                ["todos", "Todos"]
                            ] as const
                        ).map(([valor, etiqueta]) => (
                            <button
                                key={valor}
                                type="button"
                                role="tab"
                                aria-selected={filtro === valor}
                                className={filtro === valor ? "activo" : ""}
                                onClick={() => setFiltro(valor)}
                            >
                                {etiqueta} <span>{totales[valor]}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className="boton-icono boton-icono--borde"
                        onClick={cargar}
                        disabled={cargando}
                        title="Actualizar"
                        aria-label="Actualizar"
                    >
                        <RefreshCw size={18} className={cargando ? "girando" : ""} />
                    </button>
                </div>

                {hayFiltros && (
                    <div className="filtros-activos">
                        {filtroInocuidad && (
                            <span className="chip chip--azul">Inocuidad {filtroInocuidad}</span>
                        )}
                        {busqueda && <span className="chip chip--azul">"{busqueda}"</span>}
                        <button type="button" className="enlace enlace--verde" onClick={limpiarFiltros}>
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

                {cargando && despachos.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando despachos…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <PackageCheck size={40} />
                        <p>
                            {hayFiltros
                                ? "Ningún despacho coincide con los filtros."
                                : filtro === "borradores"
                                    ? "No hay despachos en borrador."
                                    : filtro === "cerrados"
                                        ? "No hay despachos cerrados."
                                        : "Todavía no hay despachos."}
                        </p>
                        {!hayFiltros && filtro !== "cerrados" && puedeCrear && (
                            <button
                                type="button"
                                className="boton boton--primario boton--auto"
                                onClick={() => setCreando(true)}
                            >
                                <Plus size={18} /> Crear despacho
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="tabla-contenedor">
                        <table className="tabla tabla--crud">
                            <thead>
                                <tr>
                                    <th>Folio</th>
                                    <th>Fecha</th>
                                    <th>Cliente / CEDIS</th>
                                    <th>Transporte</th>
                                    <th>Carga</th>
                                    <th>Inocuidad</th>
                                    <th>Estado</th>
                                    <th className="acciones">Ver</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((d) => {
                                    const borrador = Number(d.estado) === 1;
                                    return (
                                        <tr
                                            key={d.id_despacho}
                                            onClick={() => setSeleccionado(d.id_despacho)}
                                            style={{ cursor: "pointer" }}
                                        >
                                            <td data-etiqueta="Folio">
                                                <span className="lote-chip mono">{d.folio_despacho}</span>
                                            </td>
                                            <td data-etiqueta="Fecha">
                                                <div className="celda-doble">
                                                    <span>{fechaCorta(d.fecha_despacho)}</span>
                                                    {d.cita && <small className="mono">Cita {d.cita}</small>}
                                                </div>
                                            </td>
                                            <td data-etiqueta="Cliente">
                                                <div className="celda-doble">
                                                    <strong>{d.cliente}</strong>
                                                    <small>{d.cedis}</small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Transporte">
                                                <div className="celda-doble">
                                                    <span className="mono">{d.placas_caja ?? "—"}</span>
                                                    {d.nombre_operador && <small>{d.nombre_operador}</small>}
                                                </div>
                                            </td>
                                            <td data-etiqueta="Carga">
                                                <div className="celda-doble">
                                                    <span>
                                                        {num(d.cantidad_tarimas)} tar · {num(d.cantidad_cajas)} cj
                                                    </span>
                                                    <small>{num(d.lineas)} línea(s)</small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Inocuidad">
                                                <ChipInocuidad valor={d.inocuidad} />
                                            </td>
                                            <td data-etiqueta="Estado">
                                                <span className={`chip ${borrador ? "chip--azul" : "chip--gris"}`}>
                                                    {borrador ? "Borrador" : "Cerrado"}
                                                </span>
                                            </td>
                                            <td className="acciones">
                                                <button
                                                    type="button"
                                                    className="boton-icono"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSeleccionado(d.id_despacho);
                                                    }}
                                                    title="Ver despacho"
                                                    aria-label={`Ver despacho ${d.folio_despacho}`}
                                                >
                                                    <Eye size={18} />
                                                </button>
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
                        Mostrando {visibles.length} de {despachos.length} despacho(s)
                    </p>
                )}
            </section>

            {creando && (
                <DespachoFormulario
                    modo="alta"
                    despacho={null}
                    onGuardado={(mensaje, avisosAlta, id) => {
                        setCreando(false);
                        mostrar("exito", mensaje);
                        (avisosAlta ?? []).forEach((a) => mostrar("info", a));
                        cargar();
                        if (id) setSeleccionado(id);
                    }}
                    onCerrar={() => setCreando(false)}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
