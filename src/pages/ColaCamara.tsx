import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowUpToLine,
    Boxes,
    CalendarClock,
    ChevronsUp,
    Clock,
    ListOrdered,
    LogIn,
    RefreshCw,
    Snowflake,
    Undo2,
    Wrench
} from "lucide-react";
import EncabezadoPagina from "../components/layout/EncabezadoPagina";
import ChipCriticidad from "../components/cola/ChipCriticidad";
import ModalIngresar from "../components/cola/ModalIngresar";
import ModalPrioridad from "../components/cola/ModalPrioridad";
import Avisos from "../components/ui/Avisos";
import { useAvisos } from "../hooks/useAvisos";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../config/permissions";
import { mensajeError } from "../api/axios";
import * as ocupacionesService from "../services/ocupaciones.service";
import { fechaCorta } from "../utils/formato";
import type { CamaraTablero, FilaCola, FilaInventario, RespuestaIngreso, RespuestaPrioridad } from "../types/ocupacion";
import "../styles/crud.css";
import "../styles/usuarios.css";
import "../styles/fincas.css";
import "../styles/cola.css";

// ============================================================================
// COLA DE CÁMARA · preenfríos
// ============================================================================
// Se elige la cámara arriba (tarjetas con ocupación y cola). Dos apartados:
//
//   Cola de la cámara   lo que está DENTRO y lo que espera EN COLA, en el
//                       orden en que debe entrar. El supervisor ajusta
//                       prioridades.
//   Ingreso a cámara    lo que sigue por entrar con el espacio disponible;
//                       el operativo confirma cuando físicamente la mete.
//
// LA COLA SE FORMA SOLA al recepcionar: lo que no cabe en la cámara queda en
// espera (trg_sync_ocupacion_recepcion).
//
// ORDEN (lo calcula la BD en vw_cola_espera)
//   1º prioridad manual           el supervisor la adelanta, con motivo
//   2º criticidad                 cita encima o fruta de 5+ días de empacada
//   3º fecha de empaque           la fruta más vieja primero
//   4º llegada                    desempate
//
// Así una fruta recién empacada con la cita corta pasa delante de otra más
// vieja con cita holgada, pero entre dos del mismo nivel entra la más vieja.
// ============================================================================

type Pestana = "cola" | "ingreso";

const num = (v: number | string | null | undefined) => Number(v ?? 0);

/** Filas que van antes y son más críticas que la indicada */
const masCriticasAntes = (cola: FilaCola[], fila: FilaCola) =>
    cola.filter((c) => num(c.posicion) < num(fila.posicion) && c.nivel_criticidad < fila.nivel_criticidad);

export default function ColaCamara() {
    const { usuario } = useAuth();
    const { avisos, mostrar, quitar } = useAvisos();
    const puedePriorizar = tieneRol(usuario, ROLES.SUPERVISOR);

    const [pestana, setPestana] = useState<Pestana>("cola");
    const [camaras, setCamaras] = useState<CamaraTablero[]>([]);
    const [idCamara, setIdCamara] = useState<number | null>(null);
    const [cola, setCola] = useState<FilaCola[]>([]);
    const [dentro, setDentro] = useState<FilaInventario[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [ingresando, setIngresando] = useState<FilaCola | null>(null);
    const [priorizando, setPriorizando] = useState<{ fila: FilaCola; modo: "frente" | "editar" | "quitar" } | null>(null);

    // ---- Carga ----
    const cargarTablero = useCallback(async () => {
        const t = await ocupacionesService.getTablero();
        setCamaras(t.camaras);
        setIdCamara((actual) =>
            actual !== null && t.camaras.some((c) => c.id_camara === actual) ? actual : t.camaras[0]?.id_camara ?? null
        );
    }, []);

    const cargarCamara = useCallback(async (id: number) => {
        const [c, d] = await Promise.all([ocupacionesService.getCola(id), ocupacionesService.getInventario(id)]);
        setCola(c.sort((a, b) => num(a.posicion) - num(b.posicion)));
        setDentro(d);
    }, []);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            await cargarTablero();
        } catch (e) {
            setError(mensajeError(e));
            setCargando(false);
        }
    }, [cargarTablero]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    useEffect(() => {
        if (idCamara === null) {
            setCargando(false);
            return;
        }
        let vivo = true;
        setCargando(true);
        cargarCamara(idCamara)
            .catch((e) => vivo && setError(mensajeError(e)))
            .finally(() => vivo && setCargando(false));
        return () => {
            vivo = false;
        };
    }, [idCamara, cargarCamara]);

    const refrescar = async () => {
        try {
            await cargarTablero();
            if (idCamara !== null) await cargarCamara(idCamara);
        } catch (e) {
            setError(mensajeError(e));
        }
    };

    // ---- Derivados ----
    const camara = camaras.find((c) => c.id_camara === idCamara) ?? null;
    const espacio = camara && !camara.en_mantenimiento ? Math.max(num(camara.tarimas_disponibles_operativas), 0) : 0;
    const prioridadMaxima = cola.reduce((m, f) => Math.max(m, f.prioridad), 0);

    // Lo que alcanza a entrar con el espacio actual, en orden
    const siguenPorEntrar = useMemo(() => {
        let resta = espacio;
        return cola.map((f) => {
            const entra = Math.min(num(f.tarimas_en_espera), Math.max(resta, 0));
            resta -= entra;
            return { fila: f, entra };
        });
    }, [cola, espacio]);

    const totalDentro = dentro.reduce((s, f) => s + num(f.tarimas_disponibles), 0);

    // ---- Acciones ----
    const alIngresar = (r: RespuestaIngreso) => {
        setIngresando(null);
        mostrar("exito", r.mensaje.replace(/^OK:\s*/, "Ingresaron "));
        r.avisos?.forEach((a) => mostrar("info", a));
        refrescar();
    };

    const alPriorizar = (r: RespuestaPrioridad) => {
        setPriorizando(null);
        mostrar("exito", r.mensaje);
        r.avisos?.forEach((a) => mostrar("info", a));
        setCola([...r.cola].sort((a, b) => num(a.posicion) - num(b.posicion)));
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Cola de cámara" subtitulo="Lo que está dentro y lo que espera entrar">
                <button
                    type="button"
                    className="boton-icono boton-icono--borde"
                    onClick={refrescar}
                    disabled={cargando}
                    title="Actualizar"
                    aria-label="Actualizar"
                >
                    <RefreshCw size={18} className={cargando ? "girando" : ""} />
                </button>
            </EncabezadoPagina>

            {error && <div className="alerta alerta--error">{error}</div>}

            {/* ---- Selector de cámara ---- */}
            <section className="cola__camaras">
                {camaras.map((c) => {
                    const pct = Math.min(num(c.porcentaje_ocupacion), 100);
                    const criticas = num(c.procesos_criticos_en_cola);
                    return (
                        <button
                            key={c.id_camara}
                            type="button"
                            className={`cola__camara ${c.id_camara === idCamara ? "cola__camara--activa" : ""}`}
                            onClick={() => setIdCamara(c.id_camara)}
                        >
                            <div className="cola__camara-cabeza">
                                <Snowflake size={18} />
                                <strong>{c.nombre_camara}</strong>
                                {c.en_mantenimiento && (
                                    <span className="chip chip--gris">
                                        <Wrench size={12} /> Mantenimiento
                                    </span>
                                )}
                            </div>
                            <div className="cola__barra" aria-hidden="true">
                                <span style={{ width: `${pct}%` }} className={pct >= 100 ? "llena" : ""} />
                            </div>
                            <div className="cola__camara-datos">
                                <span>
                                    <strong>{num(c.tarimas_ocupadas)}</strong>/{c.capacidad_max_tarimas} dentro
                                </span>
                                <span>
                                    <strong>{num(c.tarimas_en_espera)}</strong> en cola
                                </span>
                                {criticas > 0 && (
                                    <span className="cola__critico">
                                        <AlertTriangle size={12} /> {criticas} crítico(s)
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </section>

            {camaras.length === 0 && !cargando && !error && (
                <div className="crud__vacio">
                    <Snowflake size={40} />
                    <p>No tienes preenfríos asignados.</p>
                </div>
            )}

            {camara && (
                <>
                    <div className="segmentado cola__pestanas" role="tablist">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={pestana === "cola"}
                            className={pestana === "cola" ? "activo" : ""}
                            onClick={() => setPestana("cola")}
                        >
                            <ListOrdered size={16} /> Cola de la cámara
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={pestana === "ingreso"}
                            className={pestana === "ingreso" ? "activo" : ""}
                            onClick={() => setPestana("ingreso")}
                        >
                            <LogIn size={16} /> Ingreso a cámara {cola.length > 0 && <span>{cola.length}</span>}
                        </button>
                    </div>

                    {/* ================= COLA DE LA CÁMARA ================= */}
                    {pestana === "cola" && (
                        <>
                            <section className="panel">
                                <div className="panel__titulo">
                                    <h2>
                                        <Snowflake size={20} /> Dentro de {camara.nombre_camara}
                                    </h2>
                                    <span className="chip chip--azul">
                                        {totalDentro}/{camara.capacidad_max_tarimas} tarimas
                                    </span>
                                </div>
                                {dentro.length === 0 ? (
                                    <p className="cola__vacio">La cámara está vacía.</p>
                                ) : (
                                    <div className="tabla-contenedor">
                                        <table className="tabla tabla--crud">
                                            <thead>
                                                <tr>
                                                    <th>Finca de origen</th>
                                                    <th>Lote / SKU</th>
                                                    <th>Empaque</th>
                                                    <th>Cita</th>
                                                    <th>Tarimas</th>
                                                    <th>Desde</th>
                                                    <th>Criticidad</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dentro.map((f) => (
                                                    <tr key={f.id_ocupacion}>
                                                        <td data-etiqueta="Finca">
                                                            <div className="celda-doble">
                                                                <strong>
                                                                    {f.codigo_productor} {f.codigo_finca} {f.nombre_finca}
                                                                </strong>
                                                                <small>{f.nombre_productor}</small>
                                                            </div>
                                                        </td>
                                                        <td data-etiqueta="Lote">
                                                            <div className="celda-doble">
                                                                <span className="lote-chip mono">{f.codigo_lote ?? "—"}</span>
                                                                <small>
                                                                    {f.codigo_sku} · {f.acronimo_cc}
                                                                </small>
                                                            </div>
                                                        </td>
                                                        <td data-etiqueta="Empaque">
                                                            {f.fecha_empaque ? fechaCorta(f.fecha_empaque) : "—"}
                                                        </td>
                                                        <td data-etiqueta="Cita">
                                                            {f.fecha_entrega ? fechaCorta(f.fecha_entrega) : "Sin cita"}
                                                        </td>
                                                        <td data-etiqueta="Tarimas">
                                                            {num(f.tarimas_disponibles)} tar · {num(f.cajas_disponibles)} cj
                                                        </td>
                                                        <td data-etiqueta="Desde">
                                                            {fechaCorta(f.fecha_ingreso)} {String(f.hora_ingreso ?? "").slice(0, 5)}
                                                        </td>
                                                        <td data-etiqueta="Criticidad">
                                                            <ChipCriticidad nivel={f.nivel_criticidad} texto={f.criticidad_texto} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>

                            <section className="panel">
                                <div className="panel__titulo">
                                    <h2>
                                        <Clock size={20} /> En cola · {num(camara.tarimas_en_espera)} tarimas
                                    </h2>
                                    <small className="cola__orden">
                                        Orden: prioridad manual → crítica (cita encima o 5+ días) → más vieja → llegada
                                    </small>
                                </div>
                                {cola.length === 0 ? (
                                    <p className="cola__vacio">No hay fruta esperando.</p>
                                ) : (
                                    <div className="tabla-contenedor">
                                        <table className="tabla tabla--crud">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Finca de origen</th>
                                                    <th>Lote / SKU</th>
                                                    <th>Empaque</th>
                                                    <th>Cita</th>
                                                    <th>Espera</th>
                                                    <th>Criticidad</th>
                                                    {puedePriorizar && <th className="acciones">Prioridad</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {cola.map((f) => (
                                                    <tr key={f.id_ocupacion} className={f.prioridad > 0 ? "cola__fila--priorizada" : ""}>
                                                        <td data-etiqueta="#">
                                                            <span className="cola__posicion">{num(f.posicion)}</span>
                                                        </td>
                                                        <td data-etiqueta="Finca">
                                                            <div className="celda-doble">
                                                                <strong>
                                                                    {f.codigo_finca} {f.nombre_finca}
                                                                </strong>
                                                                <small>{f.nombre_productor}</small>
                                                            </div>
                                                        </td>
                                                        <td data-etiqueta="Lote">
                                                            <div className="celda-doble">
                                                                <span className="lote-chip mono">{f.codigo_lote ?? "—"}</span>
                                                                <small>
                                                                    {f.codigo_sku} · {f.acronimo_cc}
                                                                </small>
                                                            </div>
                                                        </td>
                                                        <td data-etiqueta="Empaque">
                                                            <div className="celda-doble">
                                                                <span>{f.fecha_empaque ? fechaCorta(f.fecha_empaque) : "—"}</span>
                                                                {f.dias_desde_empaque !== null && <small>{f.dias_desde_empaque} día(s)</small>}
                                                            </div>
                                                        </td>
                                                        <td data-etiqueta="Cita">
                                                            <div className="celda-doble">
                                                                <span>{f.fecha_entrega ? fechaCorta(f.fecha_entrega) : "Sin cita"}</span>
                                                                {f.holgura_dias !== null && (
                                                                    <small>
                                                                        <CalendarClock size={11} className="icono-en-linea" /> {f.holgura_dias} d de margen
                                                                    </small>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td data-etiqueta="Espera">
                                                            <div className="celda-doble">
                                                                <span>
                                                                    {num(f.tarimas_en_espera)} tar · {num(f.cajas_en_espera)} cj
                                                                </span>
                                                                <small>
                                                                    Llegó {fechaCorta(f.fecha_llegada)} {String(f.hora_llegada ?? "").slice(0, 5)}
                                                                </small>
                                                            </div>
                                                        </td>
                                                        <td data-etiqueta="Criticidad">
                                                            <div className="estados">
                                                                <ChipCriticidad nivel={f.nivel_criticidad} texto={f.criticidad_texto} />
                                                                <small>{f.motivo_criticidad}</small>
                                                                {f.prioridad > 0 && (
                                                                    <small className="cola__manual">
                                                                        <ChevronsUp size={12} /> Prioridad {f.prioridad}
                                                                        {f.motivo_prioridad ? ` · ${f.motivo_prioridad}` : ""}
                                                                    </small>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {puedePriorizar && (
                                                            <td className="acciones">
                                                                <button
                                                                    type="button"
                                                                    className="boton-icono"
                                                                    onClick={() => setPriorizando({ fila: f, modo: "frente" })}
                                                                    disabled={num(f.posicion) === 1}
                                                                    title="Mandar al frente"
                                                                    aria-label={`Mandar al frente ${f.codigo_lote ?? ""}`}
                                                                >
                                                                    <ArrowUpToLine size={18} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="boton-icono"
                                                                    onClick={() => setPriorizando({ fila: f, modo: "editar" })}
                                                                    title="Asignar prioridad"
                                                                    aria-label={`Asignar prioridad ${f.codigo_lote ?? ""}`}
                                                                >
                                                                    <ChevronsUp size={18} />
                                                                </button>
                                                                {f.prioridad > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        className="boton-icono"
                                                                        onClick={() => setPriorizando({ fila: f, modo: "quitar" })}
                                                                        title="Regresar al orden automático"
                                                                        aria-label={`Quitar prioridad ${f.codigo_lote ?? ""}`}
                                                                    >
                                                                        <Undo2 size={18} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {/* ================= INGRESO A CÁMARA ================= */}
                    {pestana === "ingreso" && (
                        <section className="panel">
                            <div className={`cola__espacio ${espacio === 0 ? "cola__espacio--lleno" : ""}`}>
                                <Boxes size={26} />
                                <div>
                                    <strong>
                                        {camara.en_mantenimiento
                                            ? "Cámara en mantenimiento: no se puede ingresar"
                                            : espacio === 0
                                                ? "Cámara llena: no hay espacio"
                                                : `Hay espacio para ${espacio} tarima(s)`}
                                    </strong>
                                    <small>
                                        {num(camara.tarimas_ocupadas)}/{camara.capacidad_max_tarimas} tarimas dentro ·{" "}
                                        {num(camara.tarimas_en_espera)} en cola
                                    </small>
                                </div>
                            </div>

                            {cola.length === 0 ? (
                                <p className="cola__vacio">No hay fruta en cola para esta cámara.</p>
                            ) : (
                                <div className="tabla-contenedor">
                                    <table className="tabla tabla--crud">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Finca de origen</th>
                                                <th>Lote / SKU</th>
                                                <th>Criticidad</th>
                                                <th>En espera</th>
                                                <th>Alcanza a entrar</th>
                                                <th className="acciones">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {siguenPorEntrar.map(({ fila: f, entra }) => (
                                                <tr key={f.id_ocupacion} className={entra > 0 ? "cola__fila--entra" : ""}>
                                                    <td data-etiqueta="#">
                                                        <span className="cola__posicion">{num(f.posicion)}</span>
                                                    </td>
                                                    <td data-etiqueta="Finca">
                                                        <div className="celda-doble">
                                                            <strong>
                                                                {f.codigo_finca} {f.nombre_finca}
                                                            </strong>
                                                            <small>
                                                                Empaque {f.fecha_empaque ? fechaCorta(f.fecha_empaque) : "—"}
                                                                {f.fecha_entrega ? ` · Cita ${fechaCorta(f.fecha_entrega)}` : ""}
                                                            </small>
                                                        </div>
                                                    </td>
                                                    <td data-etiqueta="Lote">
                                                        <div className="celda-doble">
                                                            <span className="lote-chip mono">{f.codigo_lote ?? "—"}</span>
                                                            <small>
                                                                {f.codigo_sku} · {f.acronimo_cc}
                                                            </small>
                                                        </div>
                                                    </td>
                                                    <td data-etiqueta="Criticidad">
                                                        <ChipCriticidad nivel={f.nivel_criticidad} texto={f.criticidad_texto} />
                                                    </td>
                                                    <td data-etiqueta="En espera">{num(f.tarimas_en_espera)} tar</td>
                                                    <td data-etiqueta="Alcanza">
                                                        {entra > 0 ? (
                                                            <span className="chip chip--verde">{entra} tar</span>
                                                        ) : (
                                                            <small>—</small>
                                                        )}
                                                    </td>
                                                    <td className="acciones">
                                                        <button
                                                            type="button"
                                                            className={`boton boton--auto boton--chico ${entra > 0 ? "boton--primario" : "boton--claro"}`}
                                                            onClick={() => setIngresando(f)}
                                                            disabled={espacio === 0}
                                                            aria-label={`Ingresar ${f.codigo_lote ?? ""}`}
                                                        >
                                                            <LogIn size={16} /> Ingresar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    )}
                </>
            )}

            {ingresando && camara && (
                <ModalIngresar
                    fila={ingresando}
                    nombreCamara={camara.nombre_camara}
                    espacio={espacio}
                    saltadas={masCriticasAntes(cola, ingresando)}
                    onGuardado={alIngresar}
                    onCerrar={() => setIngresando(null)}
                />
            )}

            {priorizando && (
                <ModalPrioridad
                    fila={priorizando.fila}
                    modo={priorizando.modo}
                    prioridadMaxima={prioridadMaxima}
                    onGuardado={alPriorizar}
                    onCerrar={() => setPriorizando(null)}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
