import { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    ArrowLeft,
    ClipboardList,
    FileText,
    Lock,
    LockOpen,
    Pencil,
    Plus,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    ShieldQuestion,
    Trash2,
    Truck,
    X
} from "lucide-react";
import EncabezadoPagina from "../layout/EncabezadoPagina";
import ModalConfirmar from "../ui/ModalConfirmar";
import ModalMotivo from "../ui/ModalMotivo";
import DespachoFormulario from "./DespachoFormulario";
import type { ModoDespacho } from "./DespachoFormulario";
import ModalInocuidad from "./ModalInocuidad";
import ModalAgregarFruta from "./ModalAgregarFruta";
import { estadoInocuidad } from "./ChipInocuidad";
import { useAuth } from "../../context/AuthContext";
import { ROLES, tieneRol } from "../../config/permissions";
import { mensajeError } from "../../api/axios";
import * as despachosService from "../../services/despachos.service";
import { fechaCorta, fechaHora, horaCorta } from "../../utils/formato";
import type { TipoAviso } from "../../hooks/useAvisos";
import type { DespachoCompleto, LineaDespacho, LineaOtroCliente } from "../../types/despacho";

// ============================================================================
// DETALLE DEL DESPACHO
// ============================================================================
// Todo lo que se hace sobre UN documento:
//
//   Acción               Rol            Cuándo
//   ─────────────────    ───────────    ──────────────────────────────────
//   Agregar / quitar     operativo+     borrador
//   Inspeccionar         supervisor+    borrador
//   Cerrar               supervisor+    borrador con líneas e inocuidad = 1
//   Editar               coordinador+   borrador
//   Corregir             coordinador+   cerrado (con motivo, auditado)
//   Reabrir              admin          cerrado (con motivo, auditado)
//   Eliminar             admin          borrador SIN líneas
//
// Ocultar botones es comodidad: quien decide de verdad es el backend, y sus
// mensajes (409/403) se muestran tal cual.
//
// CIERRE CON FRUTA DE OTRO CLIENTE
//   El backend responde 409 con la lista de líneas. Se muestran y, si el
//   supervisor confirma, se vuelve a cerrar con ?confirmar=1 (queda en la
//   auditoría).
// ============================================================================

type ModalDetalle =
    | { tipo: "formulario"; modo: ModoDespacho }
    | { tipo: "inocuidad" }
    | { tipo: "fruta" }
    | { tipo: "quitar"; linea: LineaDespacho }
    | { tipo: "cerrar" }
    | { tipo: "reasignacion"; lineas: LineaOtroCliente[] }
    | { tipo: "reabrir" }
    | { tipo: "eliminar" }
    | null;

interface Props {
    idDespacho: number;
    onVolver: () => void;
    onCambio: () => void;
    mostrar: (tipo: TipoAviso, texto: string) => void;
}

const num = (v: number | string | null | undefined) => Number(v ?? 0);

export default function DetalleDespacho({ idDespacho, onVolver, onCambio, mostrar }: Props) {
    const { usuario } = useAuth();

    const [despacho, setDespacho] = useState<DespachoCompleto | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [modal, setModal] = useState<ModalDetalle>(null);

    const cerrarModal = () => setModal(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setDespacho(await despachosService.getDespacho(idDespacho));
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setCargando(false);
        }
    }, [idDespacho]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const terminar = (mensaje: string, avisos?: string[] | string | null) => {
        cerrarModal();
        mostrar("exito", mensaje);
        const lista = Array.isArray(avisos) ? avisos : avisos ? [avisos] : [];
        lista.forEach((a) => mostrar("info", a));
        cargar();
        onCambio();
    };

    // ---- Estados de carga ----
    if (cargando && !despacho) {
        return (
            <div className="crud">
                <div className="crud__vacio">
                    <div className="spinner" />
                    <p>Cargando despacho…</p>
                </div>
            </div>
        );
    }

    if (!despacho) {
        return (
            <div className="crud">
                <button type="button" className="detalle__volver" onClick={onVolver}>
                    <ArrowLeft size={18} /> Volver a despachos
                </button>
                <div className="alerta alerta--error">
                    {error || "No se encontró el despacho."}{" "}
                    <button type="button" className="enlace" onClick={cargar}>
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    // ---- Permisos y estado ----
    const esBorrador = Number(despacho.estado) === 1;
    const lineas = num(despacho.lineas);
    const inspeccion = estadoInocuidad(despacho.inocuidad);

    const puedeCargar = tieneRol(usuario, ROLES.OPERATIVO) && esBorrador;
    const puedeInspeccionar = tieneRol(usuario, ROLES.SUPERVISOR) && esBorrador;
    const puedeCerrar = tieneRol(usuario, ROLES.SUPERVISOR) && esBorrador;
    const puedeEditar = tieneRol(usuario, ROLES.COORDINADOR);
    const esAdmin = tieneRol(usuario, ROLES.ADMIN);

    const motivoNoCierre =
        lineas === 0
            ? "Agrega fruta antes de cerrar."
            : despacho.inocuidad === null || despacho.inocuidad === undefined
                ? "Falta registrar la inspección de inocuidad."
                : Number(despacho.inocuidad) !== 1
                    ? "La inspección está rechazada: cambia de unidad o vuelve a inspeccionar."
                    : null;

    // ---- Acciones ----
    const confirmarQuitar = async () => {
        if (modal?.tipo !== "quitar") return;
        const r = await despachosService.quitarLinea(despacho.id_despacho, modal.linea.id_detalle);
        terminar(r?.mensaje ?? "Línea quitada: la fruta regresó a su cámara");
    };

    // Si el backend responde con fruta de otro cliente, se pasa a pedir la
    // confirmación en lugar de mostrarlo como error
    const confirmarCerrar = async () => {
        try {
            const r = await despachosService.cerrarDespacho(despacho.id_despacho);
            terminar(r?.mensaje ?? "Despacho cerrado");
        } catch (err) {
            const lista = despachosService.lineasDeOtroClienteEnError(err);
            if (lista) {
                setModal({ tipo: "reasignacion", lineas: lista });
                return;
            }
            throw err;
        }
    };

    const confirmarReasignacion = async () => {
        const r = await despachosService.cerrarDespacho(despacho.id_despacho, true);
        terminar(r?.mensaje ?? "Despacho cerrado con reasignación registrada");
    };

    const confirmarReabrir = async (motivo: string) => {
        const r = await despachosService.reabrirDespacho(despacho.id_despacho, motivo);
        terminar(r?.mensaje ?? "Despacho reabierto a borrador");
    };

    const confirmarEliminar = async () => {
        const r = await despachosService.eliminarDespacho(despacho.id_despacho);
        cerrarModal();
        mostrar("exito", r?.mensaje ?? "Despacho eliminado");
        onCambio();
        onVolver();
    };

    const IconoInspeccion =
        inspeccion.tono === "aprobada" ? ShieldCheck : inspeccion.tono === "rechazada" ? ShieldAlert : ShieldQuestion;

    // ---- Vista ----
    return (
        <div className="crud">
            <button type="button" className="detalle__volver" onClick={onVolver}>
                <ArrowLeft size={18} /> Volver a despachos
            </button>

            <EncabezadoPagina
                titulo={
                    <>
                        Despacho <span className="mono">{despacho.folio_despacho}</span>
                    </>
                }
                subtitulo={`${despacho.cliente} · ${despacho.cedis} · ${fechaCorta(despacho.fecha_despacho)}`}
            >
                <span className={`chip ${esBorrador ? "chip--azul" : "chip--gris"}`}>
                    {esBorrador ? "Borrador" : "Cerrado"}
                </span>
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
            </EncabezadoPagina>

            {error && <div className="alerta alerta--error">{error}</div>}

            {despacho.lineas_de_otro_cliente.length > 0 && (
                <div className="alerta alerta--aviso">
                    <AlertTriangle size={16} className="icono-en-linea" />{" "}
                    {despacho.lineas_de_otro_cliente.length} línea(s) llevan fruta planeada para otro cliente.
                    {esBorrador ? " Al cerrar se pedirá confirmar la reasignación." : ""}
                </div>
            )}

            <div className="detalle__grid">
                {/* ---- Columna principal ---- */}
                <div className="detalle__columna">
                    <section className="panel">
                        <div className="panel__titulo">
                            <h2>
                                <FileText size={20} /> Documento
                            </h2>
                            {puedeEditar && (
                                <button
                                    type="button"
                                    className="boton boton--claro boton--auto"
                                    onClick={() =>
                                        setModal({ tipo: "formulario", modo: esBorrador ? "edicion" : "correccion" })
                                    }
                                >
                                    <Pencil size={16} /> {esBorrador ? "Editar" : "Corregir"}
                                </button>
                            )}
                        </div>
                        <dl className="ficha">
                            <div>
                                <dt>Cliente</dt>
                                <dd>{despacho.cliente}</dd>
                            </div>
                            <div>
                                <dt>CEDIS</dt>
                                <dd>{despacho.cedis}</dd>
                            </div>
                            <div>
                                <dt>Fecha de despacho</dt>
                                <dd>{fechaCorta(despacho.fecha_despacho)}</dd>
                            </div>
                            <div>
                                <dt>Hora de salida</dt>
                                <dd>{horaCorta(despacho.hora_salida) || "—"}</dd>
                            </div>
                            <div>
                                <dt>Cita</dt>
                                <dd className="mono">{despacho.cita || "—"}</dd>
                            </div>
                            <div>
                                <dt>Fecha de cita</dt>
                                <dd>{despacho.fecha_cita ? fechaCorta(despacho.fecha_cita) : "—"}</dd>
                            </div>
                            <div>
                                <dt>Orden de venta</dt>
                                <dd className="mono">{despacho.orden_venta || "—"}</dd>
                            </div>
                            <div>
                                <dt>Temp. de salida</dt>
                                <dd>
                                    {despacho.temperatura_salida === null || despacho.temperatura_salida === undefined
                                        ? "—"
                                        : `${despacho.temperatura_salida} °C`}
                                </dd>
                            </div>
                            {despacho.observaciones && (
                                <div className="ficha__ancha">
                                    <dt>Observaciones</dt>
                                    <dd>{despacho.observaciones}</dd>
                                </div>
                            )}
                        </dl>
                    </section>

                    <section className="panel">
                        <div className="panel__titulo">
                            <h2>
                                <Truck size={20} /> Transporte
                            </h2>
                        </div>
                        <dl className="ficha">
                            <div>
                                <dt>Línea fletera</dt>
                                <dd>{despacho.razon_social || "—"}</dd>
                            </div>
                            <div>
                                <dt>Operador</dt>
                                <dd>
                                    {despacho.nombre_operador || "—"}
                                    {despacho.celular && (
                                        <>
                                            <br />
                                            <small className="mono">{despacho.celular}</small>
                                        </>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Tracto</dt>
                                <dd className="mono">{despacho.placas_tracto || "—"}</dd>
                            </div>
                            <div>
                                <dt>Caja</dt>
                                <dd className="mono">
                                    {despacho.placas_caja || "—"}
                                    {despacho.no_economico_caja ? ` · ${despacho.no_economico_caja}` : ""}
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section className="panel">
                        <div className="panel__titulo">
                            <h2>
                                <ClipboardList size={20} /> Fruta cargada
                            </h2>
                            {puedeCargar && (
                                <button
                                    type="button"
                                    className="boton boton--primario boton--auto"
                                    onClick={() => setModal({ tipo: "fruta" })}
                                >
                                    <Plus size={18} /> Agregar fruta
                                </button>
                            )}
                        </div>

                        {despacho.detalle.length === 0 ? (
                            <div className="crud__vacio">
                                <ClipboardList size={36} />
                                <p>Todavía no se ha subido fruta a este despacho.</p>
                            </div>
                        ) : (
                            <div className="tabla-contenedor">
                                <table className="tabla tabla--crud">
                                    <thead>
                                        <tr>
                                            <th>Lote</th>
                                            <th>Cámara</th>
                                            <th>Tarimas</th>
                                            <th>Cajas</th>
                                            <th>Temp.</th>
                                            {puedeCargar && <th className="acciones">Quitar</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {despacho.detalle.map((l) => {
                                            const otro = despacho.lineas_de_otro_cliente.some(
                                                (o) => o.id_detalle === l.id_detalle
                                            );
                                            return (
                                                <tr key={l.id_detalle}>
                                                    <td data-etiqueta="Lote">
                                                        <span className="lote-chip mono">{l.codigo_lote ?? "—"}</span>
                                                        {otro && (
                                                            <span className="chip chip--ambar chip--mini">Otro cliente</span>
                                                        )}
                                                    </td>
                                                    <td data-etiqueta="Cámara">{l.camara_origen ?? "—"}</td>
                                                    <td data-etiqueta="Tarimas">{num(l.cantidad_tarimas)}</td>
                                                    <td data-etiqueta="Cajas">{num(l.cantidad_cajas)}</td>
                                                    <td data-etiqueta="Temp.">
                                                        {l.temperatura === null || l.temperatura === undefined
                                                            ? "—"
                                                            : `${l.temperatura} °C`}
                                                    </td>
                                                    {puedeCargar && (
                                                        <td className="acciones">
                                                            <button
                                                                type="button"
                                                                className="boton-icono boton-icono--peligro"
                                                                onClick={() => setModal({ tipo: "quitar", linea: l })}
                                                                title="Quitar y devolver a la cámara"
                                                                aria-label={`Quitar lote ${l.codigo_lote ?? l.id_detalle}`}
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    {despacho.auditoria.length > 0 && (
                        <section className="panel">
                            <div className="panel__titulo">
                                <h2>
                                    <FileText size={20} /> Auditoría
                                </h2>
                            </div>
                            <ul className="auditoria">
                                {despacho.auditoria.map((a, i) => (
                                    <li key={a.id_auditoria ?? i}>
                                        <strong>{a.motivo}</strong>
                                        <span>{a.cambios}</span>
                                        <br />
                                        <small>
                                            {fechaHora(a.fecha_hora)}
                                            {a.nombre_usuario || a.usuario ? ` · ${a.nombre_usuario ?? a.usuario}` : ""}
                                        </small>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                {/* ---- Columna lateral ---- */}
                <div className="detalle__columna">
                    <section className="panel">
                        <div className="totales">
                            <div>
                                <strong>{num(despacho.cantidad_tarimas)}</strong>
                                <span>Tarimas</span>
                            </div>
                            <div>
                                <strong>{num(despacho.cantidad_cajas)}</strong>
                                <span>Cajas</span>
                            </div>
                            <div>
                                <strong>{lineas}</strong>
                                <span>Líneas</span>
                            </div>
                        </div>
                    </section>

                    <section className={`inocuidad inocuidad--${inspeccion.tono}`}>
                        <div className="inocuidad__cabeza">
                            <IconoInspeccion size={26} />
                            <strong>Inocuidad {inspeccion.texto.toLowerCase()}</strong>
                        </div>
                        {inspeccion.tono === "pendiente" ? (
                            <p>
                                Revisa la caja <strong className="mono">{despacho.placas_caja ?? "—"}</strong> antes
                                de cargar. Sin inspección aprobada el despacho no se puede cerrar.
                            </p>
                        ) : (
                            <p>
                                {despacho.inocuidad_fecha ? fechaHora(despacho.inocuidad_fecha) : ""}
                                {despacho.inocuidad_usuario ? ` · ${despacho.inocuidad_usuario}` : ""}
                                {despacho.inocuidad_observaciones && (
                                    <>
                                        <br />
                                        {despacho.inocuidad_observaciones}
                                    </>
                                )}
                            </p>
                        )}
                        {puedeInspeccionar && (
                            <button
                                type="button"
                                className={`boton ${inspeccion.tono === "pendiente" ? "boton--primario" : "boton--claro"}`}
                                onClick={() => setModal({ tipo: "inocuidad" })}
                            >
                                {inspeccion.tono === "pendiente" ? "Registrar inspección" : "Volver a inspeccionar"}
                            </button>
                        )}
                    </section>

                    {(puedeCerrar || esAdmin) && (
                        <section className="panel acciones-doc">
                            {puedeCerrar && (
                                <>
                                    <button
                                        type="button"
                                        className="boton boton--primario"
                                        onClick={() => setModal({ tipo: "cerrar" })}
                                        disabled={motivoNoCierre !== null}
                                    >
                                        <Lock size={18} /> Cerrar despacho
                                    </button>
                                    {motivoNoCierre && <p className="acciones-doc__motivo">{motivoNoCierre}</p>}
                                </>
                            )}
                            {esAdmin && !esBorrador && (
                                <button
                                    type="button"
                                    className="boton boton--claro"
                                    onClick={() => setModal({ tipo: "reabrir" })}
                                >
                                    <LockOpen size={18} /> Reabrir a borrador
                                </button>
                            )}
                            {esAdmin && esBorrador && (
                                <>
                                    <button
                                        type="button"
                                        className="boton boton--peligro"
                                        onClick={() => setModal({ tipo: "eliminar" })}
                                        disabled={lineas > 0}
                                    >
                                        <Trash2 size={18} /> Eliminar borrador
                                    </button>
                                    {lineas > 0 && (
                                        <p className="acciones-doc__motivo">
                                            Quita primero la fruta para devolverla a sus cámaras.
                                        </p>
                                    )}
                                </>
                            )}
                        </section>
                    )}
                </div>
            </div>

            {/* ---- Modales ---- */}
            {modal?.tipo === "formulario" && (
                <DespachoFormulario
                    modo={modal.modo}
                    despacho={despacho}
                    onGuardado={(m, avisos) => terminar(m, avisos)}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "inocuidad" && (
                <ModalInocuidad despacho={despacho} onGuardado={terminar} onCerrar={cerrarModal} />
            )}

            {modal?.tipo === "fruta" && (
                <ModalAgregarFruta despacho={despacho} onGuardado={terminar} onCerrar={cerrarModal} />
            )}

            {modal?.tipo === "quitar" && (
                <ModalConfirmar
                    titulo={`Quitar lote ${modal.linea.codigo_lote ?? ""}`}
                    etiquetaConfirmar="Quitar"
                    descripcion={
                        <p>
                            Las {num(modal.linea.cantidad_tarimas)} tarimas y {num(modal.linea.cantidad_cajas)} cajas
                            regresan a <strong>{modal.linea.camara_origen ?? "su cámara"}</strong>.
                        </p>
                    }
                    onConfirmar={confirmarQuitar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "cerrar" && (
                <ModalConfirmar
                    titulo={`Cerrar despacho ${despacho.folio_despacho}`}
                    etiquetaConfirmar="Cerrar despacho"
                    tono="primario"
                    descripcion={
                        <>
                            <p>
                                Confirmas que salieron <strong>{num(despacho.cantidad_tarimas)} tarimas</strong> y{" "}
                                <strong>{num(despacho.cantidad_cajas)} cajas</strong> a {despacho.cliente} ·{" "}
                                {despacho.cedis}.
                            </p>
                            <p className="modal__advertencia">
                                Después de cerrar ya no se puede cargar ni quitar fruta. Corregir el documento queda
                                registrado en la auditoría.
                            </p>
                        </>
                    }
                    onConfirmar={confirmarCerrar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reasignacion" && (
                <ModalConfirmar
                    titulo="Fruta de otro cliente"
                    etiquetaConfirmar="Confirmar y cerrar"
                    descripcion={
                        <>
                            <p>Estas líneas estaban planeadas para otro cliente:</p>
                            <ul>
                                {modal.lineas.map((l) => (
                                    <li key={l.id_detalle}>
                                        <span className="mono">{l.codigo_lote ?? `Línea ${l.id_detalle}`}</span> ·{" "}
                                        {num(l.cantidad_tarimas)} tar · planeada para {l.cliente_fruta}
                                        {l.cedis_fruta ? ` · ${l.cedis_fruta}` : ""}
                                    </li>
                                ))}
                            </ul>
                            <p className="modal__advertencia">
                                Si la reasignación es correcta, el despacho se cierra y queda registrado en la
                                auditoría. Si no, cancela y quita esas líneas.
                            </p>
                        </>
                    }
                    onConfirmar={confirmarReasignacion}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reabrir" && (
                <ModalMotivo
                    titulo={`Reabrir despacho ${despacho.folio_despacho}`}
                    descripcion={
                        <p>
                            Vuelve a borrador para corregirlo. La inspección se conserva; si cambias el transporte,
                            habrá que volver a inspeccionar.
                        </p>
                    }
                    obligatorio
                    etiquetaConfirmar="Reabrir"
                    tono="primario"
                    onConfirmar={confirmarReabrir}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "eliminar" && (
                <ModalConfirmar
                    titulo={`Eliminar despacho ${despacho.folio_despacho}`}
                    etiquetaConfirmar="Eliminar"
                    descripcion={<p>El borrador se elimina por completo. Esta acción no se puede deshacer.</p>}
                    onConfirmar={confirmarEliminar}
                    onCerrar={cerrarModal}
                />
            )}
        </div>
    );
}
