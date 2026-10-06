import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Link2, Pencil, Plus, RefreshCw, Search, Truck, Undo2, X } from "lucide-react";
import EncabezadoPagina from "../../components/layout/EncabezadoPagina";
import TransporteFormulario from "../../components/transportes/TransporteFormulario";
import ModalConfirmar from "../../components/ui/ModalConfirmar";
import Avisos from "../../components/ui/Avisos";
import { useAvisos } from "../../hooks/useAvisos";
import { mensajeError } from "../../api/axios";
import * as transportesService from "../../services/transportes.service";
import * as lineasService from "../../services/lineasFleteras.service";
import * as operadoresService from "../../services/operadores.service";
import * as tractosService from "../../services/tractocamiones.service";
import * as cajasService from "../../services/cajasRefrigeradas.service";
import { conteo, fechaCorta, normalizar } from "../../utils/formato";
import type { Transporte } from "../../types/transporte";
import type { LineaFletera } from "../../types/lineaFletera";
import type { Operador } from "../../types/operador";
import type { Tractocamion } from "../../types/tractocamion";
import type { CajaRefrigerada } from "../../types/cajaRefrigerada";
import "../../styles/crud.css";
import "../../styles/usuarios.css";
import "../../styles/fincas.css";
import "../../styles/despachos.css";

// ============================================================================
// CATÁLOGO DE TRANSPORTES (servicios) · coordinador+
// ============================================================================
//   Alta, edición, baja lógica y reactivación.
//
// Cada fila es un SERVICIO: línea + operador + tracto + caja, elegidos de
// sus catálogos. Se marcan dos casos que impiden usarlo en un despacho:
//   · "Sin catálogos"     registro anterior a la etapa 1, sin sus 4 IDs
//   · "Pieza de baja"     alguna de sus piezas está dada de baja
//
// La inocuidad YA NO se marca aquí: se inspecciona en cada despacho.
// ============================================================================

type FiltroEstado = "activos" | "bajas" | "todos";

type ModalTransporte =
    | { tipo: "formulario"; transporte: Transporte | null }
    | { tipo: "baja"; transporte: Transporte }
    | { tipo: "reactivar"; transporte: Transporte }
    | null;

/** Por qué un servicio activo no se puede usar en un despacho, o null. */
const problemaServicio = (t: Transporte): string | null => {
    if (!t.catalogos_completos) return "Sin catálogos";
    if (!t.catalogos_activos) return "Pieza de baja";
    return null;
};

export default function Transportes() {
    const { avisos, mostrar, quitar } = useAvisos();

    const [transportes, setTransportes] = useState<Transporte[]>([]);
    const [lineas, setLineas] = useState<LineaFletera[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [tractos, setTractos] = useState<Tractocamion[]>([]);
    const [cajas, setCajas] = useState<CajaRefrigerada[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("activos");
    const [filtroLinea, setFiltroLinea] = useState("");
    const [soloProblemas, setSoloProblemas] = useState(false);
    const [modal, setModal] = useState<ModalTransporte>(null);

    const cerrarModal = () => setModal(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const [ts, ls, os, trs, cs] = await Promise.all([
                transportesService.getTransportes(),
                lineasService.getLineas(),
                operadoresService.getOperadores(),
                tractosService.getTractocamiones(),
                cajasService.getCajas()
            ]);
            setTransportes(ts);
            setLineas(ls);
            setOperadores(os);
            setTractos(trs);
            setCajas(cs);
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
        const activos = transportes.filter((t) => Number(t.estado) === 1);
        return {
            activos: activos.length,
            bajas: transportes.length - activos.length,
            todos: transportes.length,
            listos: activos.filter((t) => problemaServicio(t) === null).length,
            problemas: activos.filter((t) => problemaServicio(t) !== null).length
        };
    }, [transportes]);

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());
        return transportes
            .filter((t) => {
                if (filtro === "activos" && Number(t.estado) !== 1) return false;
                if (filtro === "bajas" && Number(t.estado) !== 0) return false;
                if (filtroLinea && String(t.id_linea_fletera) !== filtroLinea) return false;
                if (soloProblemas && problemaServicio(t) === null) return false;
                if (
                    texto &&
                    !normalizar(
                        [
                            t.razon_social,
                            t.rfc_linea_fletera,
                            t.nombre_operador,
                            t.celular,
                            t.placas_tracto,
                            t.no_economico_tracto,
                            t.placas_caja,
                            t.no_economico_caja
                        ]
                            .filter(Boolean)
                            .join(" ")
                    ).includes(texto)
                )
                    return false;
                return true;
            })
            .sort(
                (a, b) =>
                    (a.razon_social ?? "").localeCompare(b.razon_social ?? "", "es") ||
                    (a.nombre_operador ?? "").localeCompare(b.nombre_operador ?? "", "es")
            );
    }, [transportes, busqueda, filtro, filtroLinea, soloProblemas]);

    const hayFiltros = Boolean(busqueda || filtroLinea || soloProblemas);
    const etiquetaLinea = lineas.find((l) => String(l.id_linea_fletera) === filtroLinea)?.razon_social;

    const limpiarFiltros = () => {
        setBusqueda("");
        setFiltroLinea("");
        setSoloProblemas(false);
    };

    // ---- Acciones ----
    const terminar = (mensaje: string, aviso?: string | null) => {
        cerrarModal();
        mostrar("exito", mensaje);
        if (aviso) mostrar("info", aviso);
        cargar();
    };

    const confirmarBaja = async () => {
        if (modal?.tipo !== "baja") return;
        const r = await transportesService.darDeBaja(modal.transporte.id_transporte);
        terminar(r?.mensaje ?? "Transporte dado de baja", r?.aviso);
    };

    const confirmarReactivar = async () => {
        if (modal?.tipo !== "reactivar") return;
        const r = await transportesService.reactivar(modal.transporte.id_transporte);
        terminar(r?.mensaje ?? "Transporte reactivado", r?.aviso);
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Transportes" subtitulo="Servicios: línea, operador, tracto y caja">
                <button
                    type="button"
                    className="boton-encabezado boton-encabezado--primario"
                    onClick={() => setModal({ tipo: "formulario", transporte: null })}
                >
                    <Plus size={18} />
                    <span>Nuevo transporte</span>
                </button>
            </EncabezadoPagina>

            <section className="crud__resumen crud__resumen--cuatro">
                <div className="mini-kpi">
                    <Truck size={22} />
                    <div>
                        <strong>{totales.listos}</strong>
                        <span>Listos para despachar</span>
                    </div>
                </div>
                <button
                    type="button"
                    className={`mini-kpi mini-kpi--ambar mini-kpi--boton ${soloProblemas ? "mini-kpi--seleccionado" : ""}`}
                    onClick={() => setSoloProblemas((v) => !v)}
                    title="Ver solo los que no se pueden usar"
                >
                    <AlertTriangle size={22} />
                    <div>
                        <strong>{totales.problemas}</strong>
                        <span>Activos que no se pueden usar</span>
                    </div>
                </button>
                <div className="mini-kpi">
                    <Link2 size={22} />
                    <div>
                        <strong>{totales.activos}</strong>
                        <span>Servicios activos</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--gris">
                    <Ban size={22} />
                    <div>
                        <strong>{totales.bajas}</strong>
                        <span>Dados de baja</span>
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
                            placeholder="Buscar por línea, operador, placas o número económico…"
                        />
                    </label>

                    <select
                        className="selector"
                        value={filtroLinea}
                        onChange={(e) => setFiltroLinea(e.target.value)}
                        aria-label="Filtrar por línea fletera"
                    >
                        <option value="">Todas las líneas</option>
                        {lineas.map((l) => (
                            <option key={l.id_linea_fletera} value={l.id_linea_fletera}>
                                {l.razon_social}
                            </option>
                        ))}
                    </select>

                    <div className="segmentado" role="tablist">
                        {(
                            [
                                ["activos", "Activos"],
                                ["bajas", "Bajas"],
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
                        {etiquetaLinea && <span className="chip chip--azul">{etiquetaLinea}</span>}
                        {soloProblemas && <span className="chip chip--ambar">No se pueden usar</span>}
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

                {cargando && transportes.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando transportes…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <Truck size={40} />
                        <p>
                            {hayFiltros
                                ? "Ningún transporte coincide con los filtros."
                                : filtro === "bajas"
                                    ? "No hay transportes dados de baja."
                                    : "Todavía no hay transportes registrados."}
                        </p>
                        {!hayFiltros && filtro !== "bajas" && (
                            <button
                                type="button"
                                className="boton boton--primario boton--auto"
                                onClick={() => setModal({ tipo: "formulario", transporte: null })}
                            >
                                <Plus size={18} /> Registrar el primero
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="tabla-contenedor">
                        <table className="tabla tabla--crud">
                            <thead>
                                <tr>
                                    <th>Línea fletera</th>
                                    <th>Operador</th>
                                    <th>Tracto</th>
                                    <th>Caja</th>
                                    <th>Despachos</th>
                                    <th>Estado</th>
                                    <th className="acciones">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((t) => {
                                    const activo = Number(t.estado) === 1;
                                    const problema = problemaServicio(t);
                                    const despachos = conteo(t.total_despachos);
                                    return (
                                        <tr key={t.id_transporte} className={activo ? "" : "fila--baja"}>
                                            <td data-etiqueta="Línea">
                                                <div className="celda-doble">
                                                    <strong>{t.razon_social ?? "—"}</strong>
                                                    <small>Transporte #{t.id_transporte}</small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Operador">
                                                <div className="celda-doble">
                                                    <span>{t.nombre_operador ?? "—"}</span>
                                                    {t.celular && <small className="mono">{t.celular}</small>}
                                                </div>
                                            </td>
                                            <td data-etiqueta="Tracto">
                                                <div className="celda-doble">
                                                    <span className="mono">{t.placas_tracto ?? "—"}</span>
                                                    {t.no_economico_tracto && (
                                                        <small className="mono">{t.no_economico_tracto}</small>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-etiqueta="Caja">
                                                <div className="celda-doble">
                                                    <span className="mono">{t.placas_caja ?? "—"}</span>
                                                    {t.no_economico_caja && (
                                                        <small className="mono">
                                                            {t.no_economico_caja}
                                                            {t.largo_caja_pies ? ` · ${t.largo_caja_pies}'` : ""}
                                                        </small>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-etiqueta="Despachos">
                                                <div className="celda-doble">
                                                    <span>{despachos ?? "—"}</span>
                                                    {t.ultimo_despacho && (
                                                        <small>Último {fechaCorta(t.ultimo_despacho)}</small>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-etiqueta="Estado">
                                                <div className="estados">
                                                    <span className={`chip ${activo ? "chip--verde" : "chip--rojo"}`}>
                                                        {activo ? "Activo" : "Baja"}
                                                    </span>
                                                    {activo && problema && (
                                                        <span className="chip chip--ambar">{problema}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="acciones">
                                                <button
                                                    type="button"
                                                    className="boton-icono"
                                                    onClick={() => setModal({ tipo: "formulario", transporte: t })}
                                                    title={
                                                        (despachos ?? 0) > 0
                                                            ? "Ver (ya tiene despachos: no se puede cambiar)"
                                                            : "Editar"
                                                    }
                                                    aria-label={`Editar transporte ${t.id_transporte}`}
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                {activo ? (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--peligro"
                                                        onClick={() => setModal({ tipo: "baja", transporte: t })}
                                                        title="Dar de baja"
                                                        aria-label={`Dar de baja transporte ${t.id_transporte}`}
                                                    >
                                                        <Ban size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--exito"
                                                        onClick={() => setModal({ tipo: "reactivar", transporte: t })}
                                                        disabled={!t.catalogos_completos || !t.catalogos_activos}
                                                        title={
                                                            !t.catalogos_completos
                                                                ? "Registro anterior sin catálogos: crea el servicio de nuevo"
                                                                : !t.catalogos_activos
                                                                    ? "Alguna pieza está dada de baja"
                                                                    : "Reactivar"
                                                        }
                                                        aria-label={`Reactivar transporte ${t.id_transporte}`}
                                                    >
                                                        <Undo2 size={18} />
                                                    </button>
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
                        Mostrando {visibles.length} de {transportes.length} transporte(s)
                    </p>
                )}
            </section>

            {/* ---- Modales ---- */}
            {modal?.tipo === "formulario" && (
                <TransporteFormulario
                    transporte={modal.transporte}
                    existentes={transportes}
                    lineas={lineas}
                    operadores={operadores}
                    tractos={tractos}
                    cajas={cajas}
                    onGuardado={terminar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "baja" && (
                <ModalConfirmar
                    titulo={`Dar de baja el transporte #${modal.transporte.id_transporte}`}
                    etiquetaConfirmar="Dar de baja"
                    descripcion={
                        <>
                            <p>
                                <strong>{transportesService.describirTransporte(modal.transporte)}</strong>
                            </p>
                            <p>
                                Dejará de ofrecerse al crear despachos. Los despachos que ya lo usaron se
                                conservan.
                            </p>
                        </>
                    }
                    onConfirmar={confirmarBaja}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reactivar" && (
                <ModalConfirmar
                    titulo={`Reactivar el transporte #${modal.transporte.id_transporte}`}
                    etiquetaConfirmar="Reactivar"
                    tono="primario"
                    descripcion={
                        <p>
                            <strong>{transportesService.describirTransporte(modal.transporte)}</strong> volverá a
                            ofrecerse al crear despachos.
                        </p>
                    }
                    onConfirmar={confirmarReactivar}
                    onCerrar={cerrarModal}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
