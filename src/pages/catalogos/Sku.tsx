import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Layers, Package, PackageX, Pencil, Plus, RefreshCw, Search, Trash2, Undo2, X } from "lucide-react";
import EncabezadoPagina from "../../components/layout/EncabezadoPagina";
import SkuFormulario from "../../components/sku/SkuFormulario";
import ModalConfirmar from "../../components/ui/ModalConfirmar";
import Avisos from "../../components/ui/Avisos";
import { useAvisos } from "../../hooks/useAvisos";
import { useAuth } from "../../context/AuthContext";
import { ROLES, tieneRol } from "../../config/permissions";
import { mensajeError } from "../../api/axios";
import * as skuService from "../../services/sku.service";
import { TURNOS, cajasPorTarima } from "../../types/sku";
import type { Sku } from "../../types/sku";
import "../../styles/crud.css";
import "../../styles/usuarios.css";
import "../../styles/fincas.css";

// ============================================================================
// CATÁLOGO DE SKU
// ============================================================================
//   Ver, alta, edición, baja lógica y reactivación    coordinador+
//   Borrado físico                                     solo admin, y solo si
//                                                      ninguna producción lo usa
//
// TURNOS 1 A 5
//   Arriba se muestra cuántos SKU activos tiene cada turno; al tocar uno se
//   filtra la tabla. Con 5 turnos ya no caben como tarjetas sueltas, así
//   que van juntos en una sola franja.
// ============================================================================

type FiltroEstado = "activos" | "bajas" | "todos";

type Modal =
    | { tipo: "formulario"; sku: Sku | null }
    | { tipo: "baja"; sku: Sku }
    | { tipo: "reactivar"; sku: Sku }
    | { tipo: "eliminar"; sku: Sku }
    | null;

const normalizar = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const producciones = (s: Sku) => (s.total_producciones === undefined ? null : Number(s.total_producciones));
const cajas = (s: Sku) =>
    s.cajas_por_tarima !== undefined ? Number(s.cajas_por_tarima) : cajasPorTarima(s.codigo_sku);

export default function SkuCatalogo() {
    const { usuario } = useAuth();
    const esAdmin = tieneRol(usuario, ROLES.ADMIN);
    const { avisos, mostrar, quitar } = useAvisos();

    const [skus, setSkus] = useState<Sku[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("activos");
    const [filtroTurno, setFiltroTurno] = useState(0);
    const [filtroCalidad, setFiltroCalidad] = useState("");

    const [modal, setModal] = useState<Modal>(null);
    const cerrarModal = () => setModal(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setSkus(await skuService.getSkus());
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
        const activos = skus.filter((s) => Number(s.estado) === 1);
        return {
            activos: activos.length,
            bajas: skus.length - activos.length,
            todos: skus.length,
            cpl: activos.filter((s) => cajas(s) === 42).length,
            porTurno: TURNOS.map((t) => ({
                turno: t,
                total: activos.filter((s) => Number(s.turno) === t).length
            }))
        };
    }, [skus]);

    const calidades = useMemo(
        () => [...new Set(skus.map((s) => s.calidad.trim().toUpperCase()))].sort(),
        [skus]
    );

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());

        return skus
            .filter((s) => {
                if (filtro === "activos" && Number(s.estado) !== 1) return false;
                if (filtro === "bajas" && Number(s.estado) !== 0) return false;
                if (filtroTurno && Number(s.turno) !== filtroTurno) return false;
                if (filtroCalidad && s.calidad.trim().toUpperCase() !== filtroCalidad) return false;
                if (!texto) return true;
                return normalizar(`${s.codigo_sku} ${s.calidad}`).includes(texto);
            })
            .sort(
                (a, b) =>
                    a.codigo_sku.localeCompare(b.codigo_sku, "es", { numeric: true }) ||
                    a.calidad.localeCompare(b.calidad, "es")
            );
    }, [skus, busqueda, filtro, filtroTurno, filtroCalidad]);

    const hayFiltros = Boolean(busqueda || filtroTurno || filtroCalidad);

    const limpiarFiltros = () => {
        setBusqueda("");
        setFiltroTurno(0);
        setFiltroCalidad("");
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
        const r = await skuService.darDeBaja(modal.sku.id_sku);
        terminar(r?.mensaje ?? "SKU descontinuado", r?.aviso);
    };

    const confirmarReactivar = async () => {
        if (modal?.tipo !== "reactivar") return;
        const r = await skuService.reactivar(modal.sku.id_sku);
        terminar(r?.mensaje ?? "SKU reactivado", r?.aviso);
    };

    const confirmarEliminar = async () => {
        if (modal?.tipo !== "eliminar") return;
        const r = await skuService.eliminar(modal.sku.id_sku);
        terminar(r?.mensaje ?? "SKU eliminado", r?.aviso);
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="SKU" subtitulo="Empaques de producto terminado">
                <button
                    type="button"
                    className="boton-encabezado boton-encabezado--primario"
                    onClick={() => setModal({ tipo: "formulario", sku: null })}
                >
                    <Plus size={18} />
                    <span>Nuevo SKU</span>
                </button>
            </EncabezadoPagina>

            <section className="crud__resumen">
                <div className="mini-kpi">
                    <Package size={22} />
                    <div>
                        <strong>{totales.activos}</strong>
                        <span>SKU activos</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--ambar">
                    <Layers size={22} />
                    <div>
                        <strong>{totales.cpl}</strong>
                        <span>Familia CPL0813 (42 cajas)</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--gris">
                    <PackageX size={22} />
                    <div>
                        <strong>{totales.bajas}</strong>
                        <span>Descontinuados</span>
                    </div>
                </div>
            </section>

            {/* Franja de turnos: clic = filtrar */}
            <section
                className="panel"
                style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "12px 16px" }}
            >
                <strong style={{ fontSize: "0.88rem", color: "var(--gris-600)", marginRight: 4 }}>
                    SKU activos por turno
                </strong>
                {totales.porTurno.map(({ turno, total }) => (
                    <button
                        key={turno}
                        type="button"
                        className={`zona-opcion ${filtroTurno === turno ? "zona-opcion--activa" : ""}`}
                        style={{ padding: "6px 12px", font: "inherit" }}
                        onClick={() => setFiltroTurno((x) => (x === turno ? 0 : turno))}
                        title={filtroTurno === turno ? "Quitar filtro" : `Ver solo turno ${turno}`}
                    >
                        <span className="zona-opcion__letra mono">{turno}</span>
                        <span>
                            {total} SKU
                        </span>
                    </button>
                ))}
            </section>

            <section className="panel">
                <div className="crud__barra">
                    <label className="buscador">
                        <Search size={18} />
                        <input
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por código o calidad…"
                        />
                    </label>

                    <select
                        className="selector"
                        value={filtroCalidad}
                        onChange={(e) => setFiltroCalidad(e.target.value)}
                        aria-label="Filtrar por calidad"
                    >
                        <option value="">Todas las calidades</option>
                        {calidades.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>

                    <div className="segmentado" role="tablist">
                        {(
                            [
                                ["activos", "Activos"],
                                ["bajas", "Descontinuados"],
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
                        {filtroTurno > 0 && <span className="chip chip--azul">Turno {filtroTurno}</span>}
                        {filtroCalidad && <span className="chip chip--azul">{filtroCalidad}</span>}
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

                {cargando && skus.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando SKU…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <Boxes size={40} />
                        <p>
                            {hayFiltros
                                ? "Ningún SKU coincide con los filtros."
                                : filtro === "bajas"
                                    ? "No hay SKU descontinuados."
                                    : "Todavía no hay SKU registrados."}
                        </p>
                        {!hayFiltros && filtro !== "bajas" && (
                            <button
                                type="button"
                                className="boton boton--primario boton--auto"
                                onClick={() => setModal({ tipo: "formulario", sku: null })}
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
                                    <th>Código</th>
                                    <th>Calidad</th>
                                    <th>Turno</th>
                                    <th>Cajas / tarima</th>
                                    <th>Producciones</th>
                                    <th>Estado</th>
                                    <th className="acciones">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((s) => {
                                    const activo = Number(s.estado) === 1;
                                    const usos = producciones(s);
                                    const puedeEliminar = esAdmin && usos === 0;

                                    return (
                                        <tr key={s.id_sku} className={activo ? "" : "fila--baja"}>
                                            <td data-etiqueta="Código">
                                                <span className="lote-chip mono">{s.codigo_sku}</span>
                                            </td>
                                            <td data-etiqueta="Calidad">
                                                <strong>{s.calidad}</strong>
                                            </td>
                                            <td data-etiqueta="Turno">
                                                <span className="chip chip--azul mono">{Number(s.turno)}</span>
                                            </td>
                                            <td data-etiqueta="Cajas / tarima">{cajas(s)}</td>
                                            <td data-etiqueta="Producciones">{usos === null ? "—" : usos}</td>
                                            <td data-etiqueta="Estado">
                                                <span className={`chip ${activo ? "chip--verde" : "chip--rojo"}`}>
                                                    {activo ? "Activo" : "Descontinuado"}
                                                </span>
                                            </td>
                                            <td className="acciones">
                                                <button
                                                    type="button"
                                                    className="boton-icono"
                                                    onClick={() => setModal({ tipo: "formulario", sku: s })}
                                                    title="Editar"
                                                    aria-label={`Editar ${s.codigo_sku}`}
                                                >
                                                    <Pencil size={18} />
                                                </button>

                                                {activo ? (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--peligro"
                                                        onClick={() => setModal({ tipo: "baja", sku: s })}
                                                        title="Descontinuar"
                                                        aria-label={`Descontinuar ${s.codigo_sku}`}
                                                    >
                                                        <PackageX size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--exito"
                                                        onClick={() => setModal({ tipo: "reactivar", sku: s })}
                                                        title="Reactivar"
                                                        aria-label={`Reactivar ${s.codigo_sku}`}
                                                    >
                                                        <Undo2 size={18} />
                                                    </button>
                                                )}

                                                {esAdmin && (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--peligro"
                                                        onClick={() => setModal({ tipo: "eliminar", sku: s })}
                                                        disabled={!puedeEliminar}
                                                        title={
                                                            puedeEliminar
                                                                ? "Eliminar definitivamente"
                                                                : "Ya se usa en producción: solo puede descontinuarse"
                                                        }
                                                        aria-label={`Eliminar ${s.codigo_sku}`}
                                                    >
                                                        <Trash2 size={18} />
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
                        Mostrando {visibles.length} de {skus.length} SKU
                    </p>
                )}
            </section>

            {/* ---- Modales ---- */}
            {modal?.tipo === "formulario" && (
                <SkuFormulario sku={modal.sku} existentes={skus} onGuardado={terminar} onCerrar={cerrarModal} />
            )}

            {modal?.tipo === "baja" && (
                <ModalConfirmar
                    titulo={`Descontinuar ${modal.sku.codigo_sku} · ${modal.sku.calidad}`}
                    etiquetaConfirmar="Descontinuar"
                    descripcion={
                        <p>
                            Dejará de ofrecerse al planear producción. Los lotes que ya lo usan lo conservan y
                            se puede reactivar cuando quieras.
                        </p>
                    }
                    onConfirmar={confirmarBaja}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reactivar" && (
                <ModalConfirmar
                    titulo={`Reactivar ${modal.sku.codigo_sku} · ${modal.sku.calidad}`}
                    etiquetaConfirmar="Reactivar"
                    tono="primario"
                    descripcion={<p>Volverá a ofrecerse al planear producción.</p>}
                    onConfirmar={confirmarReactivar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "eliminar" && (
                <ModalConfirmar
                    titulo={`Eliminar ${modal.sku.codigo_sku} · ${modal.sku.calidad}`}
                    etiquetaConfirmar="Eliminar definitivamente"
                    descripcion={
                        <>
                            <p>
                                Se borra del catálogo <strong>sin posibilidad de recuperarlo</strong>. Úsalo solo
                                para altas por error.
                            </p>
                            <p className="modal__advertencia">
                                Si lo que buscas es dejar de usar este empaque, mejor descontínualo: se puede
                                reactivar después.
                            </p>
                        </>
                    }
                    onConfirmar={confirmarEliminar}
                    onCerrar={cerrarModal}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
