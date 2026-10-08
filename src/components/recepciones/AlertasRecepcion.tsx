import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageSquare, PackageX, RefreshCw, X } from "lucide-react";
import ModalMotivo from "../ui/ModalMotivo";
import { mensajeError } from "../../api/axios";
import * as recepcionesService from "../../services/recepciones.service";
import { fechaCorta, fechaHora } from "../../utils/formato";
import type { TipoAviso } from "../../hooks/useAvisos";
import type { AlertaRecepcion } from "../../types/recepcion";

// ============================================================================
// ALERTAS DE RECEPCIÓN · coordinador+
// ============================================================================
// Dos tipos:
//   DIFERENCIA  la línea se confirmó completa y no cuadró con el plan
//               (de más o de menos, sin tolerancia)
//   NO LLEGÓ    el operativo marcó que no llegó; la línea sigue abierta
//
// Atender exige comentario: lo que se hizo (se ajustó el plan, era fruta
// comprada, se reclamó al productor…). Queda quién y cuándo.
// ============================================================================

type Filtro = 1 | 2 | null;

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const conSigno = (n: number) => (n > 0 ? `+${n}` : String(n));
const persona = (nombre: string | null, apellidos: string | null, usuario: string | null) =>
    [nombre, apellidos].filter(Boolean).join(" ") || usuario || "—";

interface Props {
    mostrar: (tipo: TipoAviso, texto: string) => void;
    onCambio: () => void;
}

export default function AlertasRecepcion({ mostrar, onCambio }: Props) {
    const [alertas, setAlertas] = useState<AlertaRecepcion[]>([]);
    const [filtro, setFiltro] = useState<Filtro>(1);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [atendiendo, setAtendiendo] = useState<AlertaRecepcion | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setAlertas(await recepcionesService.getAlertas(filtro));
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargando(false);
        }
    }, [filtro]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const atender = async (comentario: string) => {
        if (!atendiendo) return;
        const r = await recepcionesService.atenderAlerta(atendiendo.id_cierre, comentario);
        setAtendiendo(null);
        mostrar("exito", r.mensaje);
        cargar();
        onCambio();
    };

    return (
        <section className="panel">
            <div className="crud__barra">
                <div className="segmentado" role="tablist">
                    {(
                        [
                            [1, "Pendientes"],
                            [2, "Atendidas"],
                            [null, "Todas"]
                        ] as const
                    ).map(([valor, etiqueta]) => (
                        <button
                            key={String(valor)}
                            type="button"
                            role="tab"
                            aria-selected={filtro === valor}
                            className={filtro === valor ? "activo" : ""}
                            onClick={() => setFiltro(valor)}
                        >
                            {etiqueta}
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

            {error && <div className="alerta alerta--error">{error}</div>}

            {cargando && alertas.length === 0 ? (
                <div className="crud__vacio">
                    <div className="spinner" />
                    <p>Cargando alertas…</p>
                </div>
            ) : alertas.length === 0 && !error ? (
                <div className="crud__vacio">
                    <CheckCircle2 size={40} />
                    <p>{filtro === 1 ? "No hay alertas pendientes." : "No hay alertas."}</p>
                </div>
            ) : (
                <div className="alertas__lista">
                    {alertas.map((a) => {
                        const esDiferencia = a.tipo_cierre === 1;
                        const difCajas = num(a.diferencia_cajas);
                        const difTarimas = num(a.diferencia_tarimas);
                        const pendiente = Number(a.alerta_estado) === 1;
                        return (
                            <article
                                key={a.id_cierre}
                                className={`alerta-rec ${pendiente ? "alerta-rec--pendiente" : "alerta-rec--atendida"}`}
                            >
                                <header className="alerta-rec__cabeza">
                                    <span className={`chip ${esDiferencia ? "chip--ambar" : "chip--rojo"}`}>
                                        {esDiferencia ? <AlertTriangle size={12} /> : <PackageX size={12} />}{" "}
                                        {esDiferencia ? "Diferencia" : "No llegó"}
                                    </span>
                                    <span className="lote-chip mono">{a.codigo_lote ?? `Línea ${a.id_produccion}`}</span>
                                    <span className="mono">{a.codigo_sku}</span>
                                    <small>{fechaHora(a.fecha_hora)}</small>
                                </header>

                                <div className="alerta-rec__cuerpo">
                                    <div>
                                        <strong>
                                            {a.codigo_productor} {a.codigo_finca} {a.nombre_finca}
                                        </strong>
                                        <small>
                                            {a.nombre_productor} · {a.acronimo_cc} · {a.nombre_camara ?? "—"} · Empaque{" "}
                                            {fechaCorta(a.fecha_empaque)}
                                        </small>
                                    </div>

                                    <table className="alerta-rec__cifras">
                                        <thead>
                                            <tr>
                                                <th />
                                                <th>Plan</th>
                                                <th>Recibido</th>
                                                <th>Diferencia</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <th>Cajas</th>
                                                <td>{num(a.cajas_planeadas)}</td>
                                                <td>{num(a.cajas_recibidas)}</td>
                                                <td className={difCajas !== 0 ? "alerta-rec__dif" : ""}>
                                                    {esDiferencia ? conSigno(difCajas) : "—"}
                                                </td>
                                            </tr>
                                            <tr>
                                                <th>Tarimas</th>
                                                <td>{num(a.tarimas_planeadas)}</td>
                                                <td>{num(a.tarimas_recibidas)}</td>
                                                <td className={difTarimas !== 0 ? "alerta-rec__dif" : ""}>
                                                    {esDiferencia ? conSigno(difTarimas) : "—"}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <footer className="alerta-rec__pie">
                                    <small>
                                        Registró {persona(a.nombre_registro, a.apellidos_registro, a.usuario_registro)}
                                        {a.observaciones ? ` · "${a.observaciones}"` : ""}
                                    </small>
                                    {pendiente ? (
                                        <button
                                            type="button"
                                            className="boton boton--primario boton--auto"
                                            onClick={() => setAtendiendo(a)}
                                        >
                                            <MessageSquare size={16} /> Atender
                                        </button>
                                    ) : (
                                        <small className="alerta-rec__atencion">
                                            <CheckCircle2 size={14} /> {persona(a.nombre_atencion, a.apellidos_atencion, a.usuario_atencion)}
                                            {a.alerta_fecha_atencion ? ` · ${fechaHora(a.alerta_fecha_atencion)}` : ""}
                                            {a.alerta_comentario ? ` · "${a.alerta_comentario}"` : ""}
                                        </small>
                                    )}
                                </footer>
                            </article>
                        );
                    })}
                </div>
            )}

            {atendiendo && (
                <ModalMotivo
                    titulo={`Atender alerta · ${atendiendo.codigo_lote ?? ""} ${atendiendo.codigo_sku}`}
                    descripcion={
                        <p>
                            Escribe qué se hizo con esta alerta. Si la línea necesita recibir más fruta, usa{" "}
                            <strong>Reabrir</strong> en la pestaña Por recibir.
                        </p>
                    }
                    obligatorio
                    etiquetaConfirmar="Marcar como atendida"
                    tono="primario"
                    onConfirmar={atender}
                    onCerrar={() => setAtendiendo(null)}
                />
            )}

            {filtro !== 1 && (
                <button type="button" className="enlace enlace--verde" onClick={() => setFiltro(1)}>
                    <X size={14} /> Ver solo pendientes
                </button>
            )}
        </section>
    );
}
