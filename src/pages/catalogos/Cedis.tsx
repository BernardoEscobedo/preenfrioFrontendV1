import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, MapPinOff, Pencil, Plus, RefreshCw, Search, Store, Undo2, X } from "lucide-react";
import EncabezadoPagina from "../../components/layout/EncabezadoPagina";
import CedisFormulario from "../../components/cedis/CedisFormulario";
import ModalConfirmar from "../../components/ui/ModalConfirmar";
import Avisos from "../../components/ui/Avisos";
import { useAvisos } from "../../hooks/useAvisos";
import { mensajeError } from "../../api/axios";
import * as cedisService from "../../services/cedis.service";
import type { Cedis } from "../../types/cedis";
import "../../styles/crud.css";
import "../../styles/usuarios.css";
import "../../styles/fincas.css";

// ============================================================================
// CATÁLOGO DE CLIENTES / CEDIS · coordinador+
// ============================================================================
//   Alta, edición, baja lógica y reactivación.
//
// La tabla se agrupa por CLIENTE: cada cliente tiene una fila de encabezado
// con cuántos CEDIS tiene y un botón para agregarle otro sin volver a
// escribir su nombre (así no termina "WALMART" y "WAL-MART" como dos
// clientes distintos).
//
// El acrónimo se muestra destacado: es lo que trae el Excel de planeación.
// ============================================================================

type FiltroEstado = "activos" | "bajas" | "todos";

type Modal =
    | { tipo: "formulario"; destino: Cedis | null; cliente?: string }
    | { tipo: "baja"; destino: Cedis }
    | { tipo: "reactivar"; destino: Cedis }
    | null;

interface Grupo {
    cliente: string;
    destinos: Cedis[];
}

const normalizar = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const conteo = (v: number | string | undefined) => (v === undefined || v === null ? null : Number(v));

export default function CedisCatalogo() {
    const { avisos, mostrar, quitar } = useAvisos();

    const [destinos, setDestinos] = useState<Cedis[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("activos");
    const [filtroCliente, setFiltroCliente] = useState("");

    const [modal, setModal] = useState<Modal>(null);
    const cerrarModal = () => setModal(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setDestinos(await cedisService.getCedis());
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
        const activos = destinos.filter((d) => Number(d.estado) === 1);
        return {
            activos: activos.length,
            bajas: destinos.length - activos.length,
            todos: destinos.length,
            clientes: new Set(activos.map((d) => d.cliente.trim().toUpperCase())).size
        };
    }, [destinos]);

    const clientes = useMemo(
        () => [...new Set(destinos.map((d) => d.cliente.trim().toUpperCase()))].sort(),
        [destinos]
    );

    const grupos = useMemo<Grupo[]>(() => {
        const texto = normalizar(busqueda.trim());
        const mapa = new Map<string, Cedis[]>();

        for (const d of destinos) {
            if (filtro === "activos" && Number(d.estado) !== 1) continue;
            if (filtro === "bajas" && Number(d.estado) !== 0) continue;

            const cliente = d.cliente.trim().toUpperCase();
            if (filtroCliente && cliente !== filtroCliente) continue;
            if (texto && !normalizar(`${d.cliente} ${d.cedis} ${d.acronimo}`).includes(texto)) continue;

            mapa.set(cliente, [...(mapa.get(cliente) ?? []), d]);
        }

        return [...mapa.entries()]
            .map(([cliente, lista]) => ({
                cliente,
                destinos: lista.sort((a, b) => a.cedis.localeCompare(b.cedis, "es"))
            }))
            .sort((a, b) => a.cliente.localeCompare(b.cliente, "es"));
    }, [destinos, busqueda, filtro, filtroCliente]);

    const visibles = grupos.reduce((s, g) => s + g.destinos.length, 0);
    const hayFiltros = Boolean(busqueda || filtroCliente);

    const limpiarFiltros = () => {
        setBusqueda("");
        setFiltroCliente("");
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
        const r = await cedisService.darDeBaja(modal.destino.id_cc);
        terminar(r?.mensaje ?? "Destino dado de baja", r?.aviso);
    };

    const confirmarReactivar = async () => {
        if (modal?.tipo !== "reactivar") return;
        const r = await cedisService.reactivar(modal.destino.id_cc);
        terminar(r?.mensaje ?? "Destino reactivado", r?.aviso);
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Clientes / CEDIS" subtitulo="Destinos de entrega de la fruta">
                <button
                    type="button"
                    className="boton-encabezado boton-encabezado--primario"
                    onClick={() => setModal({ tipo: "formulario", destino: null })}
                >
                    <Plus size={18} />
                    <span>Nuevo destino</span>
                </button>
            </EncabezadoPagina>

            <section className="crud__resumen">
                <div className="mini-kpi">
                    <Store size={22} />
                    <div>
                        <strong>{totales.clientes}</strong>
                        <span>Clientes activos</span>
                    </div>
                </div>
                <div className="mini-kpi">
                    <Building2 size={22} />
                    <div>
                        <strong>{totales.activos}</strong>
                        <span>CEDIS activos</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--gris">
                    <MapPinOff size={22} />
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
                            placeholder="Buscar por cliente, CEDIS o acrónimo…"
                        />
                    </label>

                    <select
                        className="selector"
                        value={filtroCliente}
                        onChange={(e) => setFiltroCliente(e.target.value)}
                        aria-label="Filtrar por cliente"
                    >
                        <option value="">Todos los clientes</option>
                        {clientes.map((c) => (
                            <option key={c} value={c}>
                                {c}
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
                        {filtroCliente && <span className="chip chip--azul">{filtroCliente}</span>}
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

                {cargando && destinos.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando destinos…</p>
                    </div>
                ) : visibles === 0 && !error ? (
                    <div className="crud__vacio">
                        <Store size={40} />
                        <p>
                            {hayFiltros
                                ? "Ningún destino coincide con los filtros."
                                : filtro === "bajas"
                                    ? "No hay destinos dados de baja."
                                    : "Todavía no hay clientes registrados."}
                        </p>
                        {!hayFiltros && filtro !== "bajas" && (
                            <button
                                type="button"
                                className="boton boton--primario boton--auto"
                                onClick={() => setModal({ tipo: "formulario", destino: null })}
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
                                    <th>Acrónimo</th>
                                    <th>CEDIS</th>
                                    <th>Producciones</th>
                                    <th>Estado</th>
                                    <th className="acciones">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grupos.map((g) => (
                                    <Fragment key={g.cliente}>
                                        {/* Encabezado del cliente */}
                                        <tr className="fila-grupo">
                                            <td
                                                colSpan={5}
                                                style={{ background: "#f2faf5", borderBottom: "1px solid #dcefe3" }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        gap: 12,
                                                        flexWrap: "wrap"
                                                    }}
                                                >
                                                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                        <Store size={18} color="var(--verde-700)" />
                                                        <strong style={{ fontSize: "0.98rem" }}>{g.cliente}</strong>
                                                        <span className="chip chip--gris">
                                                            {g.destinos.length} CEDIS
                                                        </span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="enlace enlace--verde"
                                                        style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                                                        onClick={() =>
                                                            setModal({ tipo: "formulario", destino: null, cliente: g.cliente })
                                                        }
                                                    >
                                                        <Plus size={15} /> Agregar CEDIS
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {g.destinos.map((d) => {
                                            const activo = Number(d.estado) === 1;
                                            const usos = conteo(d.total_producciones);
                                            return (
                                                <tr key={d.id_cc} className={activo ? "" : "fila--baja"}>
                                                    <td data-etiqueta="Acrónimo">
                                                        <span className="lote-chip mono">{d.acronimo}</span>
                                                    </td>
                                                    <td data-etiqueta="CEDIS">
                                                        <strong>{d.cedis}</strong>
                                                    </td>
                                                    <td data-etiqueta="Producciones">{usos === null ? "—" : usos}</td>
                                                    <td data-etiqueta="Estado">
                                                        <span className={`chip ${activo ? "chip--verde" : "chip--rojo"}`}>
                                                            {activo ? "Activo" : "Baja"}
                                                        </span>
                                                    </td>
                                                    <td className="acciones">
                                                        <button
                                                            type="button"
                                                            className="boton-icono"
                                                            onClick={() => setModal({ tipo: "formulario", destino: d })}
                                                            title="Editar"
                                                            aria-label={`Editar ${d.acronimo}`}
                                                        >
                                                            <Pencil size={18} />
                                                        </button>
                                                        {activo ? (
                                                            <button
                                                                type="button"
                                                                className="boton-icono boton-icono--peligro"
                                                                onClick={() => setModal({ tipo: "baja", destino: d })}
                                                                title="Dar de baja"
                                                                aria-label={`Dar de baja ${d.acronimo}`}
                                                            >
                                                                <MapPinOff size={18} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="boton-icono boton-icono--exito"
                                                                onClick={() => setModal({ tipo: "reactivar", destino: d })}
                                                                title="Reactivar"
                                                                aria-label={`Reactivar ${d.acronimo}`}
                                                            >
                                                                <Undo2 size={18} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!cargando && visibles > 0 && (
                    <p className="crud__pie">
                        Mostrando {visibles} de {destinos.length} destino(s) en {grupos.length} cliente(s)
                    </p>
                )}
            </section>

            {/* ---- Modales ---- */}
            {modal?.tipo === "formulario" && (
                <CedisFormulario
                    destino={modal.destino}
                    existentes={destinos}
                    clienteInicial={modal.cliente}
                    onGuardado={terminar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "baja" && (
                <ModalConfirmar
                    titulo={`Dar de baja ${modal.destino.cliente} · ${modal.destino.cedis}`}
                    etiquetaConfirmar="Dar de baja"
                    descripcion={
                        <>
                            <p>
                                Dejará de ofrecerse al planear producción y al crear despachos. La producción y los
                                despachos que ya lo usan se conservan.
                            </p>
                            <p className="modal__advertencia">
                                Si el Excel de planeación todavía trae el acrónimo{" "}
                                <strong className="mono">{modal.destino.acronimo}</strong>, esas filas se rechazarán
                                al importar.
                            </p>
                        </>
                    }
                    onConfirmar={confirmarBaja}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reactivar" && (
                <ModalConfirmar
                    titulo={`Reactivar ${modal.destino.cliente} · ${modal.destino.cedis}`}
                    etiquetaConfirmar="Reactivar"
                    tono="primario"
                    descripcion={<p>Volverá a ofrecerse al planear producción y al crear despachos.</p>}
                    onConfirmar={confirmarReactivar}
                    onCerrar={cerrarModal}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
