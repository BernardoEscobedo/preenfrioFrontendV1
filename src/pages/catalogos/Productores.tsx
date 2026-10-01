import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Sprout, UserCheck, UserX } from "lucide-react";
import EncabezadoPagina from "../../components/layout/EncabezadoPagina";
import ProductorFormulario from "../../components/productores/ProductorFormulario";
import ModalConfirmar from "../../components/ui/ModalConfirmar";
import Avisos from "../../components/ui/Avisos";
import { useAvisos } from "../../hooks/useAvisos";
import { mensajeError } from "../../api/axios";
import * as productoresService from "../../services/productores.service";
import type { Productor } from "../../types/productor";
import "../../styles/crud.css";
import "../../styles/usuarios.css";

// ============================================================================
// CATÁLOGO DE PRODUCTORES · coordinador+
// ============================================================================
//   Alta, edición, baja lógica y reactivación.
//   La baja no borra: sus fincas y su producción histórica se conservan.
//   Un productor de baja no aparece en los selectores de fincas ni de
//   producción.
// ============================================================================

type FiltroEstado = "activos" | "bajas" | "todos";

type Modal =
    | { tipo: "formulario"; productor: Productor | null }
    | { tipo: "baja"; productor: Productor }
    | { tipo: "reactivar"; productor: Productor }
    | null;

const normalizar = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Conteo opcional del backend; si no viene, null para no mostrar "0" falso */
const conteo = (v: number | string | undefined) => (v === undefined || v === null ? null : Number(v));

export default function Productores() {
    const { avisos, mostrar, quitar } = useAvisos();

    const [productores, setProductores] = useState<Productor[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("activos");

    const [modal, setModal] = useState<Modal>(null);
    const cerrarModal = () => setModal(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setProductores(await productoresService.getProductores());
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const totales = useMemo(
        () => ({
            activos: productores.filter((p) => Number(p.estado) === 1).length,
            bajas: productores.filter((p) => Number(p.estado) === 0).length,
            todos: productores.length
        }),
        [productores]
    );

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());

        return productores
            .filter((p) => {
                if (filtro === "activos" && Number(p.estado) !== 1) return false;
                if (filtro === "bajas" && Number(p.estado) !== 0) return false;
                if (!texto) return true;
                return normalizar(`${p.codigo_productor} ${p.nombre}`).includes(texto);
            })
            .sort((a, b) => a.codigo_productor.localeCompare(b.codigo_productor, "es", { numeric: true }));
    }, [productores, busqueda, filtro]);

    const terminar = (mensaje: string, aviso?: string | null) => {
        cerrarModal();
        mostrar("exito", mensaje);
        if (aviso) mostrar("info", aviso);
        cargar();
    };

    const confirmarBaja = async () => {
        if (modal?.tipo !== "baja") return;
        const r = await productoresService.darDeBaja(modal.productor.id_productor);
        terminar(r?.mensaje ?? "Productor dado de baja", r?.aviso);
    };

    const confirmarReactivar = async () => {
        if (modal?.tipo !== "reactivar") return;
        const r = await productoresService.reactivar(modal.productor.id_productor);
        terminar(r?.mensaje ?? "Productor reactivado", r?.aviso);
    };

    return (
        <div className="crud">
            <EncabezadoPagina titulo="Productores" subtitulo="Dueños de las fincas que surten la fruta">
                <button
                    type="button"
                    className="boton-encabezado boton-encabezado--primario"
                    onClick={() => setModal({ tipo: "formulario", productor: null })}
                >
                    <Plus size={18} />
                    <span>Nuevo productor</span>
                </button>
            </EncabezadoPagina>

            <section className="crud__resumen">
                <div className="mini-kpi">
                    <Sprout size={22} />
                    <div>
                        <strong>{totales.activos}</strong>
                        <span>Productores activos</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--gris">
                    <UserX size={22} />
                    <div>
                        <strong>{totales.bajas}</strong>
                        <span>Dados de baja</span>
                    </div>
                </div>
                <div className="mini-kpi">
                    <Sprout size={22} />
                    <div>
                        <strong>{totales.todos}</strong>
                        <span>Registrados en total</span>
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
                            placeholder="Buscar por código o nombre…"
                        />
                    </label>

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

                {error && (
                    <div className="alerta alerta--error">
                        {error}{" "}
                        <button type="button" className="enlace" onClick={cargar}>
                            Reintentar
                        </button>
                    </div>
                )}

                {cargando && productores.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando productores…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <Sprout size={40} />
                        <p>
                            {busqueda
                                ? `Ningún productor coincide con "${busqueda}".`
                                : filtro === "bajas"
                                    ? "No hay productores dados de baja."
                                    : "Todavía no hay productores registrados."}
                        </p>
                        {!busqueda && filtro !== "bajas" && (
                            <button
                                type="button"
                                className="boton boton--primario boton--auto"
                                onClick={() => setModal({ tipo: "formulario", productor: null })}
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
                                    <th>Productor</th>
                                    <th>Fincas</th>
                                    <th>Estado</th>
                                    <th className="acciones">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((p) => {
                                    const activo = Number(p.estado) === 1;
                                    const fincas = conteo(p.total_fincas);
                                    return (
                                        <tr key={p.id_productor} className={activo ? "" : "fila--baja"}>
                                            <td data-etiqueta="Código">
                                                <span className="chip chip--azul mono">{p.codigo_productor}</span>
                                            </td>
                                            <td data-etiqueta="Productor">
                                                <strong>{p.nombre}</strong>
                                            </td>
                                            <td data-etiqueta="Fincas">{fincas === null ? "—" : fincas}</td>
                                            <td data-etiqueta="Estado">
                                                <span className={`chip ${activo ? "chip--verde" : "chip--rojo"}`}>
                                                    {activo ? "Activo" : "Baja"}
                                                </span>
                                            </td>
                                            <td className="acciones">
                                                <button
                                                    type="button"
                                                    className="boton-icono"
                                                    onClick={() => setModal({ tipo: "formulario", productor: p })}
                                                    title="Editar"
                                                    aria-label={`Editar ${p.nombre}`}
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                {activo ? (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--peligro"
                                                        onClick={() => setModal({ tipo: "baja", productor: p })}
                                                        title="Dar de baja"
                                                        aria-label={`Dar de baja ${p.nombre}`}
                                                    >
                                                        <UserX size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--exito"
                                                        onClick={() => setModal({ tipo: "reactivar", productor: p })}
                                                        title="Reactivar"
                                                        aria-label={`Reactivar ${p.nombre}`}
                                                    >
                                                        <UserCheck size={18} />
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
                        Mostrando {visibles.length} de {productores.length} productor(es)
                    </p>
                )}
            </section>

            {modal?.tipo === "formulario" && (
                <ProductorFormulario
                    productor={modal.productor}
                    existentes={productores}
                    onGuardado={terminar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "baja" && (
                <ModalConfirmar
                    titulo={`Dar de baja a ${modal.productor.nombre}`}
                    etiquetaConfirmar="Dar de baja"
                    descripcion={
                        <>
                            <p>
                                Dejará de aparecer al dar de alta fincas y al planear producción. Sus fincas y su
                                producción anterior se conservan.
                            </p>
                            {(conteo(modal.productor.total_fincas) ?? 0) > 0 && (
                                <p className="modal__advertencia">
                                    Tiene {conteo(modal.productor.total_fincas)} finca(s) registrada(s). Revisa si
                                    también deben darse de baja.
                                </p>
                            )}
                        </>
                    }
                    onConfirmar={confirmarBaja}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reactivar" && (
                <ModalConfirmar
                    titulo={`Reactivar a ${modal.productor.nombre}`}
                    etiquetaConfirmar="Reactivar"
                    tono="primario"
                    descripcion={<p>Volverá a aparecer al dar de alta fincas y al planear producción.</p>}
                    onConfirmar={confirmarReactivar}
                    onCerrar={cerrarModal}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
