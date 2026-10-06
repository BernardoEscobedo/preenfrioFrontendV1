import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Pencil, Plus, RefreshCw, Search, Undo2, Link2, Truck, X } from "lucide-react";
import EncabezadoPagina from "../../components/layout/EncabezadoPagina";
import TractocamionFormulario from "../../components/tractocamiones/TractocamionFormulario";
import ModalConfirmar from "../../components/ui/ModalConfirmar";
import Avisos from "../../components/ui/Avisos";
import { useAvisos } from "../../hooks/useAvisos";
import { mensajeError } from "../../api/axios";
import * as tractosService from "../../services/tractocamiones.service";
import * as lineasService from "../../services/lineasFleteras.service";
import { conteo, normalizar } from "../../utils/formato";
import type { Tractocamion } from "../../types/tractocamion";
import type { LineaFletera } from "../../types/lineaFletera";
import "../../styles/crud.css";
import "../../styles/usuarios.css";
import "../../styles/fincas.css";

// ============================================================================
// CATÁLOGO DE TRACTOCAMIONES · coordinador+
// ============================================================================
//   Alta, edición, baja lógica y reactivación.
//
// Filtro por línea fletera, con una opción para ver solo los independientes.
// Las placas se muestran tal como las guarda el backend: sin guiones ni
// espacios, que es como se comparan para evitar duplicados.
// ============================================================================

type FiltroEstado = "activos" | "bajas" | "todos";

const SIN_LINEA = "sin";

type ModalTractocamiones =
    | { tipo: "formulario"; tracto: Tractocamion | null }
    | { tipo: "baja"; tracto: Tractocamion }
    | { tipo: "reactivar"; tracto: Tractocamion }
    | null;

export default function Tractocamiones() {
    const { avisos, mostrar, quitar } = useAvisos();

    const [registros, setRegistros] = useState<Tractocamion[]>([]);
    const [lineas, setLineas] = useState<LineaFletera[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("activos");
    const [filtroLinea, setFiltroLinea] = useState("");
    const [modal, setModal] = useState<ModalTractocamiones>(null);

    const cerrarModal = () => setModal(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const [regs, lins] = await Promise.all([tractosService.getTractocamiones(), lineasService.getLineas()]);
            setRegistros(regs);
            setLineas(lins);
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
        const activos = registros.filter((o) => Number(o.estado) === 1);
        return {
            activos: activos.length,
            bajas: registros.length - activos.length,
            todos: registros.length,
            independientes: activos.filter((o) => o.id_linea_fletera === null).length
        };
    }, [registros]);

    const nombreLinea = useMemo(() => {
        const mapa = new Map(lineas.map((l) => [l.id_linea_fletera, l.razon_social]));
        return (o: Tractocamion) =>
            o.id_linea_fletera === null ? null : o.razon_social_linea ?? mapa.get(o.id_linea_fletera) ?? null;
    }, [lineas]);

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());
        return registros
            .filter((o) => {
                if (filtro === "activos" && Number(o.estado) !== 1) return false;
                if (filtro === "bajas" && Number(o.estado) !== 0) return false;
                if (filtroLinea === SIN_LINEA && o.id_linea_fletera !== null) return false;
                if (filtroLinea && filtroLinea !== SIN_LINEA && String(o.id_linea_fletera) !== filtroLinea)
                    return false;
                if (texto && !normalizar(`${o.placas} ${o.numero_economico} ${nombreLinea(o) ?? ""}`).includes(texto))
                    return false;
                return true;
            })
            .sort((a, b) => a.placas.localeCompare(b.placas, "es"));
    }, [registros, busqueda, filtro, filtroLinea, nombreLinea]);

    const hayFiltros = Boolean(busqueda || filtroLinea);
    const etiquetaFiltroLinea =
        filtroLinea === SIN_LINEA
            ? "Independientes"
            : lineas.find((l) => String(l.id_linea_fletera) === filtroLinea)?.razon_social;

    const limpiarFiltros = () => {
        setBusqueda("");
        setFiltroLinea("");
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
        const r = await tractosService.darDeBaja(modal.tracto.id_tractocamion);
        terminar(r?.mensaje ?? "Tractocamión dado de baja", r?.aviso);
    };

    const confirmarReactivar = async () => {
        if (modal?.tipo !== "reactivar") return;
        const r = await tractosService.reactivar(modal.tracto.id_tractocamion);
        terminar(r?.mensaje ?? "Tractocamión reactivado", r?.aviso);
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Tractocamiones" subtitulo="Unidades motrices que jalan las cajas">
                <button
                    type="button"
                    className="boton-encabezado boton-encabezado--primario"
                    onClick={() => setModal({ tipo: "formulario", tracto: null })}
                >
                    <Plus size={18} />
                    <span>Nuevo tractocamión</span>
                </button>
            </EncabezadoPagina>

            <section className="crud__resumen">
                <div className="mini-kpi">
                    <Truck size={22} />
                    <div>
                        <strong>{totales.activos}</strong>
                        <span>Tractos activos</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--ambar">
                    <Link2 size={22} />
                    <div>
                        <strong>{totales.independientes}</strong>
                        <span>Independientes</span>
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
                            placeholder="Buscar por placas, número económico o línea…"
                        />
                    </label>

                    <select
                        className="selector"
                        value={filtroLinea}
                        onChange={(e) => setFiltroLinea(e.target.value)}
                        aria-label="Filtrar por línea fletera"
                    >
                        <option value="">Todas las líneas</option>
                        <option value={SIN_LINEA}>Independientes</option>
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
                        {etiquetaFiltroLinea && <span className="chip chip--azul">{etiquetaFiltroLinea}</span>}
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

                {cargando && registros.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando tractocamiones…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <Truck size={40} />
                        <p>
                            {hayFiltros
                                ? "Ningún tractocamión coincide con los filtros."
                                : filtro === "bajas"
                                    ? "No hay tractocamiones dados de baja."
                                    : "Todavía no hay tractocamiones registrados."}
                        </p>
                        {!hayFiltros && filtro !== "bajas" && (
                            <button
                                type="button"
                                className="boton boton--primario boton--auto"
                                onClick={() => setModal({ tipo: "formulario", tracto: null })}
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
                                    <th>Placas</th>
                                    <th>Núm. económico</th>
                                    <th>Línea fletera</th>
                                    <th>Servicios</th>
                                    <th>Estado</th>
                                    <th className="acciones">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((o) => {
                                    const activo = Number(o.estado) === 1;
                                    const linea = nombreLinea(o);
                                    return (
                                        <tr key={o.id_tractocamion} className={activo ? "" : "fila--baja"}>
                                            <td data-etiqueta="Placas">
                                                <span className="lote-chip mono">{o.placas}</span>
                                            </td>
                                            <td data-etiqueta="Núm. económico">
                                                <span className="mono">{o.numero_economico}</span>
                                            </td>
                                            <td data-etiqueta="Línea">
                                                {linea ?? <span className="chip chip--ambar">Independiente</span>}
                                            </td>
                                            <td data-etiqueta="Servicios">{conteo(o.transportes_activos) ?? "—"}</td>
                                            <td data-etiqueta="Estado">
                                                <span className={`chip ${activo ? "chip--verde" : "chip--rojo"}`}>
                                                    {activo ? "Activo" : "Baja"}
                                                </span>
                                            </td>
                                            <td className="acciones">
                                                <button
                                                    type="button"
                                                    className="boton-icono"
                                                    onClick={() => setModal({ tipo: "formulario", tracto: o })}
                                                    title="Editar"
                                                    aria-label={`Editar ${o.placas}`}
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                {activo ? (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--peligro"
                                                        onClick={() => setModal({ tipo: "baja", tracto: o })}
                                                        title="Dar de baja"
                                                        aria-label={`Dar de baja ${o.placas}`}
                                                    >
                                                        <Ban size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--exito"
                                                        onClick={() => setModal({ tipo: "reactivar", tracto: o })}
                                                        title="Reactivar"
                                                        aria-label={`Reactivar ${o.placas}`}
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
                        Mostrando {visibles.length} de {registros.length} tractocamión(s)
                    </p>
                )}
            </section>

            {/* ---- Modales ---- */}
            {modal?.tipo === "formulario" && (
                <TractocamionFormulario
                    tracto={modal.tracto}
                    existentes={registros}
                    lineas={lineas}
                    lineaInicial={
                        filtroLinea && filtroLinea !== SIN_LINEA ? Number(filtroLinea) : null
                    }
                    onGuardado={terminar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "baja" && (
                <ModalConfirmar
                    titulo={`Dar de baja el tractocamión ${modal.tracto.placas}`}
                    etiquetaConfirmar="Dar de baja"
                    descripcion={
                        <p>
                            Sus servicios de transporte dejarán de ofrecerse en despachos nuevos. Los despachos que ya hizo se conservan.
                        </p>
                    }
                    onConfirmar={confirmarBaja}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reactivar" && (
                <ModalConfirmar
                    titulo={`Reactivar el tractocamión ${modal.tracto.placas}`}
                    etiquetaConfirmar="Reactivar"
                    tono="primario"
                    descripcion={<p>Volverá a poder usarse para armar servicios de transporte.</p>}
                    onConfirmar={confirmarReactivar}
                    onCerrar={cerrarModal}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
