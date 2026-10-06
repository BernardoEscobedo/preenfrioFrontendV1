import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Building2, Pencil, Phone, Plus, RefreshCw, Search, Truck, Undo2, X } from "lucide-react";
import EncabezadoPagina from "../../components/layout/EncabezadoPagina";
import LineaFleteraFormulario from "../../components/lineasFleteras/LineaFleteraFormulario";
import ModalConfirmar from "../../components/ui/ModalConfirmar";
import Avisos from "../../components/ui/Avisos";
import { useAvisos } from "../../hooks/useAvisos";
import { mensajeError } from "../../api/axios";
import * as lineasService from "../../services/lineasFleteras.service";
import { conteo, normalizar } from "../../utils/formato";
import type { LineaFletera } from "../../types/lineaFletera";
import "../../styles/crud.css";
import "../../styles/usuarios.css";
import "../../styles/fincas.css";

// ============================================================================
// CATÁLOGO DE LÍNEAS FLETERAS · coordinador+
// ============================================================================
//   Alta, edición, baja lógica y reactivación.
//
// La línea es la primera pieza de un servicio de transporte. Se muestra
// cuántos operadores, tractos y cajas activos tiene cada una: una línea sin
// unidades no puede armar ningún servicio.
//
// La baja NO arrastra a sus operadores ni unidades: pueden pasarse a otra
// línea o quedar independientes. Sus servicios ya no se ofrecen en
// despachos nuevos.
// ============================================================================

type FiltroEstado = "activos" | "bajas" | "todos";

type ModalLinea =
    | { tipo: "formulario"; linea: LineaFletera | null }
    | { tipo: "baja"; linea: LineaFletera }
    | { tipo: "reactivar"; linea: LineaFletera }
    | null;

export default function LineasFleteras() {
    const { avisos, mostrar, quitar } = useAvisos();

    const [lineas, setLineas] = useState<LineaFletera[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("activos");
    const [modal, setModal] = useState<ModalLinea>(null);

    const cerrarModal = () => setModal(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setLineas(await lineasService.getLineas());
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
        const activas = lineas.filter((l) => Number(l.estado) === 1);
        return {
            activos: activas.length,
            bajas: lineas.length - activas.length,
            todos: lineas.length,
            unidades: activas.reduce(
                (s, l) => s + (conteo(l.tractocamiones_activos) ?? 0) + (conteo(l.cajas_activas) ?? 0),
                0
            )
        };
    }, [lineas]);

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());
        return lineas
            .filter((l) => {
                if (filtro === "activos" && Number(l.estado) !== 1) return false;
                if (filtro === "bajas" && Number(l.estado) !== 0) return false;
                if (texto && !normalizar(`${l.razon_social} ${l.rfc} ${l.telefono_contacto}`).includes(texto))
                    return false;
                return true;
            })
            .sort((a, b) => a.razon_social.localeCompare(b.razon_social, "es"));
    }, [lineas, busqueda, filtro]);

    // ---- Acciones ----
    const terminar = (mensaje: string, aviso?: string | null) => {
        cerrarModal();
        mostrar("exito", mensaje);
        if (aviso) mostrar("info", aviso);
        cargar();
    };

    const confirmarBaja = async () => {
        if (modal?.tipo !== "baja") return;
        const r = await lineasService.darDeBaja(modal.linea.id_linea_fletera);
        terminar(r?.mensaje ?? "Línea fletera dada de baja", r?.aviso);
    };

    const confirmarReactivar = async () => {
        if (modal?.tipo !== "reactivar") return;
        const r = await lineasService.reactivar(modal.linea.id_linea_fletera);
        terminar(r?.mensaje ?? "Línea fletera reactivada", r?.aviso);
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Líneas fleteras" subtitulo="Empresas transportistas que recogen la fruta">
                <button
                    type="button"
                    className="boton-encabezado boton-encabezado--primario"
                    onClick={() => setModal({ tipo: "formulario", linea: null })}
                >
                    <Plus size={18} />
                    <span>Nueva línea</span>
                </button>
            </EncabezadoPagina>

            <section className="crud__resumen">
                <div className="mini-kpi">
                    <Building2 size={22} />
                    <div>
                        <strong>{totales.activos}</strong>
                        <span>Líneas activas</span>
                    </div>
                </div>
                <div className="mini-kpi">
                    <Truck size={22} />
                    <div>
                        <strong>{totales.unidades}</strong>
                        <span>Tractos y cajas activos</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--gris">
                    <Ban size={22} />
                    <div>
                        <strong>{totales.bajas}</strong>
                        <span>Dadas de baja</span>
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
                            placeholder="Buscar por razón social, RFC o teléfono…"
                        />
                    </label>

                    <div className="segmentado" role="tablist">
                        {(
                            [
                                ["activos", "Activas"],
                                ["bajas", "Bajas"],
                                ["todos", "Todas"]
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

                {busqueda && (
                    <div className="filtros-activos">
                        <span className="chip chip--azul">"{busqueda}"</span>
                        <button type="button" className="enlace enlace--verde" onClick={() => setBusqueda("")}>
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
                        <p>Cargando líneas fleteras…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <Building2 size={40} />
                        <p>
                            {busqueda
                                ? "Ninguna línea coincide con la búsqueda."
                                : filtro === "bajas"
                                    ? "No hay líneas dadas de baja."
                                    : "Todavía no hay líneas fleteras registradas."}
                        </p>
                        {!busqueda && filtro !== "bajas" && (
                            <button
                                type="button"
                                className="boton boton--primario boton--auto"
                                onClick={() => setModal({ tipo: "formulario", linea: null })}
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
                                    <th>Línea fletera</th>
                                    <th>Teléfono</th>
                                    <th>Operadores</th>
                                    <th>Tractos</th>
                                    <th>Cajas</th>
                                    <th>Estado</th>
                                    <th className="acciones">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((l) => {
                                    const activa = Number(l.estado) === 1;
                                    return (
                                        <tr key={l.id_linea_fletera} className={activa ? "" : "fila--baja"}>
                                            <td data-etiqueta="Línea">
                                                <div className="celda-doble">
                                                    <strong>{l.razon_social}</strong>
                                                    <small className="mono">{l.rfc}</small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Teléfono">
                                                <span className="mono">
                                                    <Phone size={14} className="icono-en-linea" /> {l.telefono_contacto}
                                                </span>
                                            </td>
                                            <td data-etiqueta="Operadores">{conteo(l.operadores_activos) ?? "—"}</td>
                                            <td data-etiqueta="Tractos">{conteo(l.tractocamiones_activos) ?? "—"}</td>
                                            <td data-etiqueta="Cajas">{conteo(l.cajas_activas) ?? "—"}</td>
                                            <td data-etiqueta="Estado">
                                                <span className={`chip ${activa ? "chip--verde" : "chip--rojo"}`}>
                                                    {activa ? "Activa" : "Baja"}
                                                </span>
                                            </td>
                                            <td className="acciones">
                                                <button
                                                    type="button"
                                                    className="boton-icono"
                                                    onClick={() => setModal({ tipo: "formulario", linea: l })}
                                                    title="Editar"
                                                    aria-label={`Editar ${l.razon_social}`}
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                {activa ? (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--peligro"
                                                        onClick={() => setModal({ tipo: "baja", linea: l })}
                                                        title="Dar de baja"
                                                        aria-label={`Dar de baja ${l.razon_social}`}
                                                    >
                                                        <Ban size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--exito"
                                                        onClick={() => setModal({ tipo: "reactivar", linea: l })}
                                                        title="Reactivar"
                                                        aria-label={`Reactivar ${l.razon_social}`}
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
                        Mostrando {visibles.length} de {lineas.length} línea(s)
                    </p>
                )}
            </section>

            {/* ---- Modales ---- */}
            {modal?.tipo === "formulario" && (
                <LineaFleteraFormulario
                    linea={modal.linea}
                    existentes={lineas}
                    onGuardado={terminar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "baja" && (
                <ModalConfirmar
                    titulo={`Dar de baja ${modal.linea.razon_social}`}
                    etiquetaConfirmar="Dar de baja"
                    descripcion={
                        <>
                            <p>
                                Sus transportes dejarán de ofrecerse en despachos nuevos. Los despachos que ya la
                                usaron se conservan.
                            </p>
                            <p className="modal__advertencia">
                                Sus operadores, tractos y cajas <strong>no</strong> se dan de baja: puedes
                                cambiarlos a otra línea o dejarlos como independientes.
                            </p>
                        </>
                    }
                    onConfirmar={confirmarBaja}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reactivar" && (
                <ModalConfirmar
                    titulo={`Reactivar ${modal.linea.razon_social}`}
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
