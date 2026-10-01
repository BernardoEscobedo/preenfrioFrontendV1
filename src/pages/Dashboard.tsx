import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    AlertTriangle,
    ArrowRight,
    RefreshCw,
    Snowflake,
    Thermometer,
    Truck,
    Wifi,
    WifiOff,
    Wrench
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../config/permissions";
import { useDashboard, useReloj } from "../hooks/useDashboard";
import EncabezadoPagina from "../components/layout/EncabezadoPagina";
import KpiCard from "../components/dashboard/KpiCard";
import CamaraCard, { estadoCamara } from "../components/dashboard/CamaraCard";
import { num } from "../types/dashboard";
import type { CamaraTablero, DatosDashboard } from "../types/dashboard";
import "../styles/dashboard.css";

// ============================================================================
// DASHBOARD PRINCIPAL
// ============================================================================
// Responde una sola pregunta al abrirlo: ¿qué necesita mi atención ahora?
//
//   ① KPIs              lo urgente en números
//   ② Estado de cámaras semáforo por cámara
//   ③ Tres paneles      por recibir · atención inmediata · despachos
//
// Todo llega ya filtrado por alcance desde el backend. El selector de
// PREENFRÍO (solo coordinador y admin) filtra además en el navegador:
// al elegir "Nelly" se ven su preenfrío y su conservación.
// ============================================================================

const ZONA = "America/Mexico_City";
const TODOS = "TODOS";
const MAX_FILAS = 6;

// ----------------------------------------------------------------------------
// Utilidades de presentación
// ----------------------------------------------------------------------------

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "doña nelly" → "Doña Nelly" */
const tipoTitulo = (t: string) =>
    t.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

const fechaLarga = (d: Date) =>
    capitalizar(
        new Intl.DateTimeFormat("es-MX", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: ZONA
        }).format(d)
    );

const horaCorta = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: ZONA
    }).format(d);

const saludo = (d: Date) => {
    const h = Number(
        new Intl.DateTimeFormat("es-MX", { hour: "numeric", hourCycle: "h23", timeZone: ZONA }).format(d)
    );
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
};

const haceCuanto = (desde: Date | null, ahora: Date) => {
    if (!desde) return "sin datos";
    const s = Math.max(0, Math.round((ahora.getTime() - desde.getTime()) / 1000));
    if (s < 60) return "hace un momento";
    const m = Math.round(s / 60);
    return m === 1 ? "hace 1 min" : `hace ${m} min`;
};

/** "2026-09-29T06:00:00.000Z" → "29/09/2026" (el DATE de pg llega con hora) */
const fechaCorta = (valor: string | null) => {
    if (!valor) return "—";
    const [a, m, d] = String(valor).slice(0, 10).split("-");
    return d && m && a ? `${d}/${m}/${a}` : "—";
};

// ----------------------------------------------------------------------------
// Agrupación por PREENFRÍO
// ----------------------------------------------------------------------------
// Las cámaras se agrupan por el SITIO que viene en su nombre:
//
//   "PREENFRIO NELLY"        → NELLY
//   "CONSERVACION NELLY"     → NELLY
//   "PREENFRÍO FORTALEZA"    → FORTALEZA
//   "Conservación Fortaleza" → FORTALEZA
//
// Se quita la palabra del tipo (preenfrío / conservación / conserva) sin
// importar mayúsculas, acentos ni guiones. Así, cuando den de alta un
// preenfrío nuevo con el mismo formato, aparece solo en el selector.
//
// Si una cámara se llama distinto (por ejemplo "CAMARA 3"), se agrupa por su
// ubicación para que nunca quede fuera del selector.
// ----------------------------------------------------------------------------

// Acepta el tipo con o sin acento. Se trabaja sobre el nombre original para
// no perder la Ñ ("DOÑA NELLY" se queda como DOÑA, no como DONA).
const PREFIJO_TIPO =
    /^\s*(pre\s*-?\s*enfr[ií]amiento|pre\s*-?\s*enfr[ií]o|conservaci[oó]n|conserva)(?=[\s\-_:]|$)[\s\-_:]*/i;

/** Clave del sitio de una cámara: "NELLY", "FORTALEZA"... */
const claveSitio = (c: CamaraTablero): string => {
    const limpio = c.nombre_camara.replace(PREFIJO_TIPO, "").trim();
    return (limpio || c.ubicacion).toUpperCase();
};

interface Sitio {
    clave: string;
    etiqueta: string;
}

const sitiosDisponibles = (camaras: CamaraTablero[]): Sitio[] => {
    const mapa = new Map<string, string>();

    for (const c of camaras) {
        const clave = claveSitio(c);
        if (!mapa.has(clave)) mapa.set(clave, tipoTitulo(clave));
    }

    return [...mapa.entries()]
        .map(([clave, etiqueta]) => ({ clave, etiqueta }))
        .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
};

// ----------------------------------------------------------------------------
// Filtro y cálculo de indicadores
// ----------------------------------------------------------------------------

interface ItemAtencion {
    clave: string;
    tono: "rojo" | "ambar" | "gris";
    icono: LucideIcon;
    titulo: string;
    detalle: string;
    etiqueta: string;
    to: string;
}

const ETIQUETA_CRITICIDAD = {
    CITA_VENCIDA: "CITA VENCIDA",
    SALE_HOY: "SALE HOY",
    FRUTA_VIEJA: "FRUTA VIEJA"
} as const;

const ORDEN_ESTADO = { saturada: 0, mantenimiento: 1, alta: 2, normal: 3 } as const;

const calcularVista = (datos: DatosDashboard | null, sitio: string) => {
    if (!datos) return null;

    const camaras =
        sitio === TODOS ? datos.camaras : datos.camaras.filter((c) => claveSitio(c) === sitio);

    const ids = new Set(camaras.map((c) => c.id_camara));
    const delSitio = (id: number | null) => (sitio === TODOS ? true : id !== null && ids.has(id));

    const criticas = datos.criticas.filter((c) => delSitio(c.id_camara));
    const esperadas = datos.esperadas.filter((e) => delSitio(e.id_camara));
    const mantenimientos = datos.mantenimientos.filter((m) => delSitio(m.id_camara));

    // ---- KPIs ----
    // La ocupación solo cuenta cámaras operativas: una en mantenimiento no
    // tiene capacidad disponible y distorsionaría el promedio.
    const operativas = camaras.filter((c) => !c.en_mantenimiento);
    const ocupadas = operativas.reduce((s, c) => s + num(c.tarimas_ocupadas), 0);
    const capacidad = operativas.reduce((s, c) => s + num(c.capacidad_max_tarimas), 0);
    const ocupacion = capacidad > 0 ? Math.round((ocupadas / capacidad) * 100) : 0;

    const tarimasPorRecibir = esperadas.reduce((s, e) => s + num(e.tarimas_pendientes), 0);

    // Pulpeos no tiene cámara directa: se muestra completo
    const pulpeosPendientes = datos.pulpeos?.resumen.total ?? 0;

    // ---- Atención inmediata: lo grave primero ----
    const atencion: ItemAtencion[] = [
        ...criticas.map<ItemAtencion>((c) => ({
            clave: `c-${c.id_ocupacion}`,
            tono: "rojo",
            icono: AlertTriangle,
            titulo: c.codigo_lote ? `Lote ${c.codigo_lote}` : "Lote sin código",
            detalle: `${c.nombre_camara} · ${c.motivo_criticidad}`,
            etiqueta: ETIQUETA_CRITICIDAD[c.tipo_criticidad],
            to: `/cola?camara=${c.id_camara}`
        })),
        ...(datos.pulpeos?.fuera_de_objetivo ?? []).map<ItemAtencion>((b) => ({
            clave: `pf-${b.id_bloque}`,
            tono: "ambar",
            icono: Thermometer,
            titulo: `Bloque ${b.codigo_bloque}`,
            detalle: `Última lectura ${num(b.temperatura_promedio)} °C, objetivo ${num(b.temperatura_objetivo)} °C`,
            etiqueta: "FUERA DE OBJETIVO",
            to: "/pulpeos"
        })),
        ...(datos.pulpeos?.sin_pulpeo ?? []).map<ItemAtencion>((b) => ({
            clave: `ps-${b.id_bloque}`,
            tono: "ambar",
            icono: Thermometer,
            titulo: `Bloque ${b.codigo_bloque}`,
            detalle: `Armado hace ${Math.round(num(b.horas_desde_armado))} h, nunca se ha medido`,
            etiqueta: "SIN PULPEO",
            to: "/pulpeos"
        })),
        ...mantenimientos.map<ItemAtencion>((m) => ({
            clave: `m-${m.id_mantenimiento}`,
            tono: "gris",
            icono: Wrench,
            titulo: m.nombre_camara,
            detalle: `${m.motivo} · desde ${fechaCorta(m.fecha_inicio)}`,
            etiqueta: "EN MANTENIMIENTO",
            to: "/mantenimientos"
        }))
    ];

    // ---- Orden de las tarjetas ----
    // Con "Todos": agrupadas por sitio (Fortaleza preenfrío, Fortaleza
    //              conserva, Nelly preenfrío, Nelly conserva...), y dentro
    //              de cada sitio el preenfrío primero.
    // Con un sitio: lo urgente primero.
    const camarasOrdenadas = [...camaras].sort((a, b) =>
        sitio === TODOS
            ? claveSitio(a).localeCompare(claveSitio(b), "es") || a.tipo_camara - b.tipo_camara
            : num(b.procesos_criticos_en_cola) - num(a.procesos_criticos_en_cola) ||
              ORDEN_ESTADO[estadoCamara(a)] - ORDEN_ESTADO[estadoCamara(b)] ||
              a.tipo_camara - b.tipo_camara
    );

    return {
        camaras: camarasOrdenadas,
        criticas,
        esperadas,
        mantenimientos,
        atencion,
        ocupacion,
        ocupadas,
        capacidad,
        tarimasPorRecibir,
        pulpeosPendientes
    };
};

// ----------------------------------------------------------------------------
// Página
// ----------------------------------------------------------------------------

const CLAVE_SITIO = "preenfrio_dashboard_sitio";

export default function Dashboard() {
    const { usuario } = useAuth();
    const { datos, cargando, refrescando, actualizado, fallas, sinConexion, refrescar } = useDashboard();
    const ahora = useReloj();

    // El preenfrío elegido se recuerda: al volver al dashboard sigue en Nelly
    const [sitio, setSitio] = useState<string>(() => localStorage.getItem(CLAVE_SITIO) ?? TODOS);

    const verSelector = usuario !== null && usuario.id_role <= ROLES.COORDINADOR;

    const sitios = useMemo(() => sitiosDisponibles(datos?.camaras ?? []), [datos]);

    // Si el sitio guardado ya no existe (se dio de baja), se regresa a Todos
    useEffect(() => {
        if (datos && sitio !== TODOS && !sitios.some((s) => s.clave === sitio)) {
            setSitio(TODOS);
        }
    }, [datos, sitio, sitios]);

    const cambiarSitio = (valor: string) => {
        setSitio(valor);
        localStorage.setItem(CLAVE_SITIO, valor);
    };

    // Supervisores y operativos no ven el selector: el backend ya les manda
    // solo sus cámaras, así que siempre se calcula con "Todos".
    const sitioActivo = verSelector ? sitio : TODOS;

    const vista = useMemo(() => calcularVista(datos, sitioActivo), [datos, sitioActivo]);

    const etiquetaSitio = sitios.find((s) => s.clave === sitioActivo)?.etiqueta;
    const nombre = usuario?.nombre_empleado || usuario?.usuario || "";
    const despachos = datos?.despachos ?? [];

    return (
        <div className="dash">
            <EncabezadoPagina
                titulo={`${saludo(ahora)}, ${capitalizar(nombre.toLowerCase())}`}
                subtitulo={`${fechaLarga(ahora)} · ${horaCorta(ahora)}`}
            >
                <span className={`estado-red ${sinConexion ? "estado-red--caida" : ""}`}>
                    {sinConexion ? <WifiOff size={16} /> : <Wifi size={16} />}
                    {sinConexion ? "Sin conexión" : "En línea"}
                </span>

                <button
                    type="button"
                    className="boton-encabezado"
                    onClick={() => refrescar()}
                    disabled={refrescando}
                    title="Actualizar ahora"
                >
                    <RefreshCw size={16} className={refrescando ? "girando" : ""} />
                    <span>Actualizado {haceCuanto(actualizado, ahora)}</span>
                </button>

                {verSelector && sitios.length > 1 && (
                    <select
                        className="selector-encabezado"
                        value={sitioActivo}
                        onChange={(e) => cambiarSitio(e.target.value)}
                        aria-label="Preenfrío"
                    >
                        <option value={TODOS}>Todos los preenfríos</option>
                        {sitios.map((s) => (
                            <option key={s.clave} value={s.clave}>
                                {s.etiqueta}
                            </option>
                        ))}
                    </select>
                )}
            </EncabezadoPagina>

            {sinConexion && (
                <div className="alerta alerta--error">
                    No hay conexión con el servidor.{" "}
                    {datos ? "Estás viendo los últimos datos que se cargaron." : "Revisa la red."}
                </div>
            )}

            {!sinConexion && fallas.length > 0 && (
                <div className="alerta alerta--aviso">
                    No se pudo cargar: {fallas.join(", ")}. El resto del tablero está al día.
                </div>
            )}

            {cargando && !vista && (
                <div className="dash__cargando">
                    <div className="spinner" />
                    <p>Cargando la operación…</p>
                </div>
            )}

            {vista && (
                <>
                    {/* ① KPIs */}
                    <section className="dash__kpis">
                        <KpiCard
                            icono={AlertTriangle}
                            tono="rojo"
                            alerta={vista.criticas.length > 0}
                            titulo="Fruta crítica en cola"
                            valor={vista.criticas.length}
                            detalle={
                                vista.criticas.length > 0
                                    ? "Lotes en riesgo de incumplir su cita"
                                    : "Nada urgente esperando"
                            }
                            to="/cola"
                        />
                        <KpiCard
                            icono={Truck}
                            tono="azul"
                            titulo="Por recibir"
                            valor={vista.tarimasPorRecibir}
                            detalle={`Tarimas pendientes en ${vista.esperadas.length} proceso(s)`}
                            to="/recepciones"
                        />
                        <KpiCard
                            icono={Snowflake}
                            tono="verde"
                            titulo="Ocupación de cámaras"
                            valor={`${vista.ocupacion}%`}
                            barra={vista.ocupacion}
                            detalle={`${vista.ocupadas} / ${vista.capacidad} tarimas`}
                            to="/cola"
                        />
                        <KpiCard
                            icono={Thermometer}
                            tono="ambar"
                            alerta={vista.pulpeosPendientes > 0}
                            titulo="Pulpeos pendientes"
                            valor={vista.pulpeosPendientes}
                            detalle="Sin medir, sin lectura reciente o fuera de objetivo"
                            to="/pulpeos"
                        />
                    </section>

                    {/* ② Cámaras */}
                    <section className="panel">
                        <div className="panel__cabeza">
                            <h2>
                                Estado de cámaras
                                {etiquetaSitio ? ` · ${etiquetaSitio}` : ""}
                            </h2>
                            <ul className="leyenda">
                                <li><span className="punto punto--normal" />Normal</li>
                                <li><span className="punto punto--alta" />Alta ocupación</li>
                                <li><span className="punto punto--saturada" />Saturada</li>
                                <li><span className="punto punto--mantenimiento" />Mantenimiento</li>
                            </ul>
                        </div>

                        {vista.camaras.length === 0 ? (
                            <p className="panel__vacio">
                                No tienes cámaras asignadas. Pide al administrador tu zona de trabajo.
                            </p>
                        ) : (
                            <div className="dash__camaras">
                                {vista.camaras.map((c) => (
                                    <CamaraCard
                                        key={c.id_camara}
                                        camara={c}
                                        mantenimiento={vista.mantenimientos.find(
                                            (m) => m.id_camara === c.id_camara
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* ③ Paneles inferiores */}
                    <section className="dash__paneles">
                        {/* Por recibir */}
                        <article className="panel">
                            <div className="panel__cabeza">
                                <h2>Fruta por recibir</h2>
                                <Link to="/recepciones" className="panel__enlace">
                                    Ver todas <ArrowRight size={16} />
                                </Link>
                            </div>

                            {vista.esperadas.length === 0 ? (
                                <p className="panel__vacio">No hay fruta pendiente de llegar.</p>
                            ) : (
                                <div className="tabla-contenedor">
                                    <table className="tabla">
                                        <thead>
                                            <tr>
                                                <th>Lote</th>
                                                <th>Finca</th>
                                                <th>SKU</th>
                                                <th className="num">Tarimas</th>
                                                <th>Cámara</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vista.esperadas.slice(0, MAX_FILAS).map((e) => (
                                                <tr key={e.id_produccion}>
                                                    <td className="mono">{e.codigo_lote ?? "—"}</td>
                                                    <td>
                                                        {e.nombre_finca}
                                                        <small>{e.nombre_productor}</small>
                                                    </td>
                                                    <td>{e.codigo_sku}</td>
                                                    <td className="num">{num(e.tarimas_pendientes)}</td>
                                                    <td>
                                                        {e.nombre_camara ?? (
                                                            <span className="chip chip--gris">CEDA directo</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </article>

                        {/* Atención inmediata */}
                        <article className="panel">
                            <div className="panel__cabeza">
                                <h2>Atención inmediata</h2>
                                {vista.atencion.length > MAX_FILAS && (
                                    <span className="panel__contador">
                                        +{vista.atencion.length - MAX_FILAS} más
                                    </span>
                                )}
                            </div>

                            {vista.atencion.length === 0 ? (
                                <p className="panel__vacio panel__vacio--ok">
                                    ✓ Todo en orden. Nada requiere atención ahora.
                                </p>
                            ) : (
                                <ul className="atencion">
                                    {vista.atencion.slice(0, MAX_FILAS).map((a) => {
                                        const Icono = a.icono;
                                        return (
                                            <li key={a.clave}>
                                                <Link to={a.to} className={`atencion__item atencion__item--${a.tono}`}>
                                                    <span className="atencion__icono">
                                                        <Icono size={18} />
                                                    </span>
                                                    <span className="atencion__texto">
                                                        <strong>{a.titulo}</strong>
                                                        <small>{a.detalle}</small>
                                                    </span>
                                                    <span className={`chip chip--${a.tono}`}>{a.etiqueta}</span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </article>

                        {/* Despachos en borrador */}
                        <article className="panel">
                            <div className="panel__cabeza">
                                <h2>Despachos en proceso</h2>
                                <Link to="/despachos" className="panel__enlace">
                                    Ver todos <ArrowRight size={16} />
                                </Link>
                            </div>

                            {despachos.length === 0 ? (
                                <p className="panel__vacio">No hay despachos en borrador.</p>
                            ) : (
                                <div className="tabla-contenedor">
                                    <table className="tabla">
                                        <thead>
                                            <tr>
                                                <th>Folio</th>
                                                <th>Cliente / CEDIS</th>
                                                <th className="num">Tarimas</th>
                                                <th>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {despachos.slice(0, MAX_FILAS).map((d) => (
                                                <tr key={d.id_despacho}>
                                                    <td className="mono">{d.folio_despacho}</td>
                                                    <td>
                                                        {d.cliente}
                                                        <small>{d.cedis}</small>
                                                    </td>
                                                    <td className="num">{num(d.cantidad_tarimas)}</td>
                                                    <td>
                                                        <span className="chip chip--azul">
                                                            {num(d.lineas) === 0 ? "Sin picking" : "Borrador"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </article>
                    </section>
                </>
            )}
        </div>
    );
}
