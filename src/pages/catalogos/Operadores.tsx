import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Pencil, Phone, Plus, RefreshCw, Search, Undo2, UserRound, Users, X } from "lucide-react";
import EncabezadoPagina from "../../components/layout/EncabezadoPagina";
import OperadorFormulario from "../../components/operadores/OperadorFormulario";
import ModalConfirmar from "../../components/ui/ModalConfirmar";
import Avisos from "../../components/ui/Avisos";
import { useAvisos } from "../../hooks/useAvisos";
import { mensajeError } from "../../api/axios";
import * as operadoresService from "../../services/operadores.service";
import * as lineasService from "../../services/lineasFleteras.service";
import { conteo, normalizar } from "../../utils/formato";
import type { Operador } from "../../types/operador";
import type { LineaFletera } from "../../types/lineaFletera";
import "../../styles/crud.css";
import "../../styles/usuarios.css";
import "../../styles/fincas.css";

// ============================================================================
// CATÁLOGO DE OPERADORES · coordinador+
// ============================================================================
//   Alta, edición, baja lógica y reactivación.
//
// Filtro por línea fletera, con una opción para ver solo los independientes.
// El celular se muestra destacado: es con lo que se localiza al operador
// cuando el camión no llega a la cita.
// ============================================================================

type FiltroEstado = "activos" | "bajas" | "todos";

const SIN_LINEA = "sin";

type ModalOperador =
    | { tipo: "formulario"; operador: Operador | null }
    | { tipo: "baja"; operador: Operador }
    | { tipo: "reactivar"; operador: Operador }
    | null;

const iniciales = (nombre: string) =>
    nombre
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase();

export default function Operadores() {
    const { avisos, mostrar, quitar } = useAvisos();

    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [lineas, setLineas] = useState<LineaFletera[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("activos");
    const [filtroLinea, setFiltroLinea] = useState("");
    const [modal, setModal] = useState<ModalOperador>(null);

    const cerrarModal = () => setModal(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const [ops, lins] = await Promise.all([operadoresService.getOperadores(), lineasService.getLineas()]);
            setOperadores(ops);
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
        const activos = operadores.filter((o) => Number(o.estado) === 1);
        return {
            activos: activos.length,
            bajas: operadores.length - activos.length,
            todos: operadores.length,
            independientes: activos.filter((o) => o.id_linea_fletera === null).length
        };
    }, [operadores]);

    const nombreLinea = useMemo(() => {
        const mapa = new Map(lineas.map((l) => [l.id_linea_fletera, l.razon_social]));
        return (o: Operador) =>
            o.id_linea_fletera === null ? null : o.razon_social_linea ?? mapa.get(o.id_linea_fletera) ?? null;
    }, [lineas]);

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());
        return operadores
            .filter((o) => {
                if (filtro === "activos" && Number(o.estado) !== 1) return false;
                if (filtro === "bajas" && Number(o.estado) !== 0) return false;
                if (filtroLinea === SIN_LINEA && o.id_linea_fletera !== null) return false;
                if (filtroLinea && filtroLinea !== SIN_LINEA && String(o.id_linea_fletera) !== filtroLinea)
                    return false;
                if (texto && !normalizar(`${o.nombre} ${o.celular} ${nombreLinea(o) ?? ""}`).includes(texto))
                    return false;
                return true;
            })
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }, [operadores, busqueda, filtro, filtroLinea, nombreLinea]);

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
        const r = await operadoresService.darDeBaja(modal.operador.id_operador);
        terminar(r?.mensaje ?? "Operador dado de baja", r?.aviso);
    };

    const confirmarReactivar = async () => {
        if (modal?.tipo !== "reactivar") return;
        const r = await operadoresService.reactivar(modal.operador.id_operador);
        terminar(r?.mensaje ?? "Operador reactivado", r?.aviso);
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Operadores" subtitulo="Choferes que manejan las unidades">
                <button
                    type="button"
                    className="boton-encabezado boton-encabezado--primario"
                    onClick={() => setModal({ tipo: "formulario", operador: null })}
                >
                    <Plus size={18} />
                    <span>Nuevo operador</span>
                </button>
            </EncabezadoPagina>

            <section className="crud__resumen">
                <div className="mini-kpi">
                    <Users size={22} />
                    <div>
                        <strong>{totales.activos}</strong>
                        <span>Operadores activos</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--ambar">
                    <UserRound size={22} />
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
                            placeholder="Buscar por nombre, celular o línea…"
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

                {cargando && operadores.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando operadores…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <Users size={40} />
                        <p>
                            {hayFiltros
                                ? "Ningún operador coincide con los filtros."
                                : filtro === "bajas"
                                    ? "No hay operadores dados de baja."
                                    : "Todavía no hay operadores registrados."}
                        </p>
                        {!hayFiltros && filtro !== "bajas" && (
                            <button
                                type="button"
                                className="boton boton--primario boton--auto"
                                onClick={() => setModal({ tipo: "formulario", operador: null })}
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
                                    <th>Operador</th>
                                    <th>Celular</th>
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
                                        <tr key={o.id_operador} className={activo ? "" : "fila--baja"}>
                                            <td data-etiqueta="Empleado">
                                                <div className="persona">
                                                    <span className="persona__avatar">{iniciales(o.nombre)}</span>
                                                    <div>
                                                        <strong>{o.nombre}</strong>
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Celular">
                                                <span className="mono">
                                                    <Phone size={14} className="icono-en-linea" /> {o.celular}
                                                </span>
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
                                                    onClick={() => setModal({ tipo: "formulario", operador: o })}
                                                    title="Editar"
                                                    aria-label={`Editar ${o.nombre}`}
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                {activo ? (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--peligro"
                                                        onClick={() => setModal({ tipo: "baja", operador: o })}
                                                        title="Dar de baja"
                                                        aria-label={`Dar de baja ${o.nombre}`}
                                                    >
                                                        <Ban size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--exito"
                                                        onClick={() => setModal({ tipo: "reactivar", operador: o })}
                                                        title="Reactivar"
                                                        aria-label={`Reactivar ${o.nombre}`}
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
                        Mostrando {visibles.length} de {operadores.length} operador(es)
                    </p>
                )}
            </section>

            {/* ---- Modales ---- */}
            {modal?.tipo === "formulario" && (
                <OperadorFormulario
                    operador={modal.operador}
                    existentes={operadores}
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
                    titulo={`Dar de baja a ${modal.operador.nombre}`}
                    etiquetaConfirmar="Dar de baja"
                    descripcion={
                        <p>
                            Sus servicios de transporte dejarán de ofrecerse en despachos nuevos. Los despachos
                            que ya hizo se conservan.
                        </p>
                    }
                    onConfirmar={confirmarBaja}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reactivar" && (
                <ModalConfirmar
                    titulo={`Reactivar a ${modal.operador.nombre}`}
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
