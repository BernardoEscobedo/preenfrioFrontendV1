import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPinned, Pencil, Plus, RefreshCw, Search, TreePalm, Undo2, X } from "lucide-react";
import EncabezadoPagina from "../../components/layout/EncabezadoPagina";
import FincaFormulario from "../../components/fincas/FincaFormulario";
import ModalConfirmar from "../../components/ui/ModalConfirmar";
import Avisos from "../../components/ui/Avisos";
import { useAvisos } from "../../hooks/useAvisos";
import { mensajeError } from "../../api/axios";
import * as fincasService from "../../services/fincas.service";
import * as productoresService from "../../services/productores.service";
import { ZONAS } from "../../types/finca";
import type { Finca } from "../../types/finca";
import type { Productor } from "../../types/productor";
import "../../styles/crud.css";
import "../../styles/usuarios.css";
import "../../styles/fincas.css";

// ============================================================================
// CATÁLOGO DE FINCAS · coordinador+
// ============================================================================
//   Alta, edición, baja lógica y reactivación.
//   Filtros por productor y por zona, además de búsqueda.
//
// Cada fila muestra el INICIO DEL CÓDIGO DE LOTE que generará la finca
// (zona + productor + finca), que es lo que más se consulta en planta.
//
// El productor se resuelve desde /productores: así funciona aunque el
// listado de fincas no traiga el JOIN con el nombre.
// ============================================================================

type FiltroEstado = "activas" | "bajas" | "todas";

type Modal =
    | { tipo: "formulario"; finca: Finca | null }
    | { tipo: "baja"; finca: Finca }
    | { tipo: "reactivar"; finca: Finca }
    | null;

const normalizar = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Fincas() {
    const { avisos, mostrar, quitar } = useAvisos();

    const [fincas, setFincas] = useState<Finca[]>([]);
    const [productores, setProductores] = useState<Productor[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("activas");
    const [filtroProductor, setFiltroProductor] = useState(0);
    const [filtroZona, setFiltroZona] = useState(0);

    const [modal, setModal] = useState<Modal>(null);
    const cerrarModal = () => setModal(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const [listaFincas, listaProductores] = await Promise.all([
                fincasService.getFincas(),
                productoresService.getProductores()
            ]);
            setFincas(listaFincas);
            setProductores(listaProductores);
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // ---- Productor de cada finca ----
    const productorPorId = useMemo(
        () => new Map(productores.map((p) => [p.id_productor, p])),
        [productores]
    );

    const datosProductor = (f: Finca) => {
        const p = productorPorId.get(Number(f.id_productor));
        return {
            codigo: p?.codigo_productor ?? f.codigo_productor ?? "",
            nombre: p?.nombre ?? f.nombre_productor ?? "Productor desconocido",
            activo: p ? Number(p.estado) === 1 : Number(f.productor_estado ?? 1) === 1
        };
    };

    const inicioLote = (f: Finca) =>
        `${ZONAS[Number(f.zona)]?.letra ?? "?"}${datosProductor(f).codigo.slice(-2).padStart(2, "0")}${f.codigo_finca
            .slice(-3)
            .padStart(3, "0")}`;

    // ---- Derivados ----
    const totales = useMemo(() => {
        const activas = fincas.filter((f) => Number(f.estado) === 1);
        return {
            activas: activas.length,
            bajas: fincas.length - activas.length,
            todas: fincas.length,
            porZona: Object.keys(ZONAS).map((z) => ({
                zona: Number(z),
                total: activas.filter((f) => Number(f.zona) === Number(z)).length
            }))
        };
    }, [fincas]);

    // Productores que tienen al menos una finca (para el filtro)
    const productoresConFincas = useMemo(() => {
        const ids = new Set(fincas.map((f) => Number(f.id_productor)));
        return productores
            .filter((p) => ids.has(p.id_productor))
            .sort((a, b) => a.codigo_productor.localeCompare(b.codigo_productor, "es", { numeric: true }));
    }, [fincas, productores]);

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());

        return fincas
            .filter((f) => {
                if (filtro === "activas" && Number(f.estado) !== 1) return false;
                if (filtro === "bajas" && Number(f.estado) !== 0) return false;
                if (filtroProductor && Number(f.id_productor) !== filtroProductor) return false;
                if (filtroZona && Number(f.zona) !== filtroZona) return false;
                if (!texto) return true;

                const p = datosProductor(f);
                return normalizar(
                    [f.codigo_finca, f.nombre, f.org_inv_nombre, p.codigo, p.nombre, inicioLote(f)].join(" ")
                ).includes(texto);
            })
            .sort((a, b) => inicioLote(a).localeCompare(inicioLote(b), "es", { numeric: true }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fincas, busqueda, filtro, filtroProductor, filtroZona, productorPorId]);

    const hayFiltros = Boolean(busqueda || filtroProductor || filtroZona);

    const limpiarFiltros = () => {
        setBusqueda("");
        setFiltroProductor(0);
        setFiltroZona(0);
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
        const r = await fincasService.darDeBaja(modal.finca.id_finca);
        terminar(r?.mensaje ?? "Finca dada de baja", r?.aviso);
    };

    const confirmarReactivar = async () => {
        if (modal?.tipo !== "reactivar") return;
        const r = await fincasService.reactivar(modal.finca.id_finca);
        terminar(r?.mensaje ?? "Finca reactivada", r?.aviso);
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Fincas" subtitulo="Origen de la fruta y base del código de lote">
                <button
                    type="button"
                    className="boton-encabezado boton-encabezado--primario"
                    onClick={() => setModal({ tipo: "formulario", finca: null })}
                >
                    <Plus size={18} />
                    <span>Nueva finca</span>
                </button>
            </EncabezadoPagina>

            {/* Resumen: activas y una tarjeta por zona (clic = filtrar) */}
            <section className="crud__resumen crud__resumen--cuatro">
                <div className="mini-kpi">
                    <TreePalm size={22} />
                    <div>
                        <strong>{totales.activas}</strong>
                        <span>Fincas activas</span>
                    </div>
                </div>
                {totales.porZona.map(({ zona, total }) => (
                    <button
                        key={zona}
                        type="button"
                        className={`mini-kpi mini-kpi--boton ${filtroZona === zona ? "mini-kpi--seleccionado" : ""}`}
                        onClick={() => setFiltroZona((z) => (z === zona ? 0 : zona))}
                        title={filtroZona === zona ? "Quitar filtro" : `Ver solo ${ZONAS[zona].nombre}`}
                    >
                        <span className="zona-letra mono">{ZONAS[zona].letra}</span>
                        <div>
                            <strong>{total}</strong>
                            <span>{ZONAS[zona].nombre}</span>
                        </div>
                    </button>
                ))}
            </section>

            <section className="panel">
                {/* Barra de herramientas */}
                <div className="crud__barra">
                    <label className="buscador">
                        <Search size={18} />
                        <input
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por código, nombre, productor o lote (B12015)…"
                        />
                    </label>

                    <select
                        className="selector"
                        value={filtroProductor}
                        onChange={(e) => setFiltroProductor(Number(e.target.value))}
                        aria-label="Filtrar por productor"
                    >
                        <option value={0}>Todos los productores</option>
                        {productoresConFincas.map((p) => (
                            <option key={p.id_productor} value={p.id_productor}>
                                {p.codigo_productor} · {p.nombre}
                            </option>
                        ))}
                    </select>

                    <div className="segmentado" role="tablist">
                        {(
                            [
                                ["activas", "Activas"],
                                ["bajas", "Bajas"],
                                ["todas", "Todas"]
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
                        {filtroZona > 0 && <span className="chip chip--azul">Zona {ZONAS[filtroZona].nombre}</span>}
                        {filtroProductor > 0 && (
                            <span className="chip chip--azul">
                                {productorPorId.get(filtroProductor)?.nombre ?? "Productor"}
                            </span>
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

                {/* Tabla */}
                {cargando && fincas.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando fincas…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <MapPinned size={40} />
                        <p>
                            {hayFiltros
                                ? "Ninguna finca coincide con los filtros."
                                : filtro === "bajas"
                                    ? "No hay fincas dadas de baja."
                                    : "Todavía no hay fincas registradas."}
                        </p>
                        {!hayFiltros && filtro !== "bajas" && (
                            <button
                                type="button"
                                className="boton boton--primario boton--auto"
                                onClick={() => setModal({ tipo: "formulario", finca: null })}
                            >
                                <Plus size={18} /> Registrar la primera
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="tabla-contenedor">
                        <table className="tabla tabla--crud">
                            <thead>
                                <tr>
                                    <th>Lote</th>
                                    <th>Finca</th>
                                    <th>Productor</th>
                                    <th>Zona</th>
                                    <th>Org. inventario</th>
                                    <th>Estado</th>
                                    <th className="acciones">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((f) => {
                                    const activa = Number(f.estado) === 1;
                                    const p = datosProductor(f);
                                    return (
                                        <tr key={f.id_finca} className={activa ? "" : "fila--baja"}>
                                            <td data-etiqueta="Lote">
                                                <span className="lote-chip mono">{inicioLote(f)}</span>
                                            </td>
                                            <td data-etiqueta="Finca">
                                                <div className="celda-doble">
                                                    <strong>{f.nombre}</strong>
                                                    <small className="mono">Código {f.codigo_finca}</small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Productor">
                                                <div className="celda-doble">
                                                    <span>{p.nombre}</span>
                                                    <small className="mono">
                                                        {p.codigo}
                                                        {!p.activo && <span className="chip chip--rojo chip--mini">Baja</span>}
                                                    </small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Zona">{ZONAS[Number(f.zona)]?.nombre ?? "—"}</td>
                                            <td data-etiqueta="Org. inventario">{f.org_inv_nombre}</td>
                                            <td data-etiqueta="Estado">
                                                <span className={`chip ${activa ? "chip--verde" : "chip--rojo"}`}>
                                                    {activa ? "Activa" : "Baja"}
                                                </span>
                                            </td>
                                            <td className="acciones">
                                                <button
                                                    type="button"
                                                    className="boton-icono"
                                                    onClick={() => setModal({ tipo: "formulario", finca: f })}
                                                    title="Editar"
                                                    aria-label={`Editar ${f.nombre}`}
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                {activa ? (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--peligro"
                                                        onClick={() => setModal({ tipo: "baja", finca: f })}
                                                        title="Dar de baja"
                                                        aria-label={`Dar de baja ${f.nombre}`}
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--exito"
                                                        onClick={() => setModal({ tipo: "reactivar", finca: f })}
                                                        disabled={!p.activo}
                                                        title={
                                                            p.activo
                                                                ? "Reactivar"
                                                                : "El productor está dado de baja: reactívalo primero"
                                                        }
                                                        aria-label={`Reactivar ${f.nombre}`}
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
                        Mostrando {visibles.length} de {fincas.length} finca(s)
                    </p>
                )}
            </section>

            {/* ---- Modales ---- */}
            {modal?.tipo === "formulario" && (
                <FincaFormulario
                    finca={modal.finca}
                    existentes={fincas}
                    productores={productores}
                    productorInicial={filtroProductor || undefined}
                    onGuardado={terminar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "baja" && (
                <ModalConfirmar
                    titulo={`Dar de baja la finca ${modal.finca.nombre}`}
                    etiquetaConfirmar="Dar de baja"
                    descripcion={
                        <p>
                            Dejará de aparecer al planear producción. Las producciones y lotes que ya tiene
                            (<strong className="mono">{inicioLote(modal.finca)}…</strong>) se conservan.
                        </p>
                    }
                    onConfirmar={confirmarBaja}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reactivar" && (
                <ModalConfirmar
                    titulo={`Reactivar la finca ${modal.finca.nombre}`}
                    etiquetaConfirmar="Reactivar"
                    tono="primario"
                    descripcion={<p>Volverá a aparecer al planear producción.</p>}
                    onConfirmar={confirmarReactivar}
                    onCerrar={cerrarModal}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
