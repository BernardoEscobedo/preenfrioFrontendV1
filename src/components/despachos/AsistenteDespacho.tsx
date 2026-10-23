import { useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    Container,
    ShieldAlert,
    ShieldCheck,
    Store,
    Truck,
    UserRound
} from "lucide-react";
import Modal from "../ui/Modal";
import SelectorPieza from "./SelectorPieza";
import { mensajeError } from "../../api/axios";
import * as despachoService from "../../services/despachoCompleto.service";
import * as lineasService from "../../services/lineasFleteras.service";
import * as operadoresService from "../../services/operadores.service";
import * as tractosService from "../../services/tractocamiones.service";
import { normalizarPlaca } from "../../services/tractocamiones.service";
import * as cajasService from "../../services/cajasRefrigeradas.service";
import { fechaCorta, hoyISO, normalizar } from "../../utils/formato";
import type { LineaFletera } from "../../types/lineaFletera";
import type { Operador } from "../../types/operador";
import type { Tractocamion } from "../../types/tractocamion";
import type { CajaRefrigerada } from "../../types/cajaRefrigerada";
import type {
    ClienteDisponible,
    DespachoCompletoPayload,
    NuevaCaja,
    Pieza,
    RespuestaDespachoCompleto,
    StockProceso
} from "../../types/despachoNuevo";

// ============================================================================
// ASISTENTE DE DESPACHO · operativo+
// ============================================================================
// Así se despacha en el andén:
//
//   1 Destino     cliente/CEDIS al que va el camión
//   2 Fruta       procesos del stock y cuánto sale de cada uno
//   3 Línea       línea fletera registrada
//   4 Operador    de esa línea (o independiente) · alta ahí mismo
//   5 Unidad      tracto + sencillo (1 caja) o full (2 cajas) · altas
//   6 Confirmar   inspección de cada caja y datos de salida
//
// Al confirmar se guarda TODO y el despacho queda CERRADO (el camión salió).
// Si una caja no pasa la inspección, no se carga: no se puede confirmar.
// Nada se guarda en la BD hasta el último paso.
// ============================================================================

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const digitos = (t: string) => t.replace(/\D/g, "");

const horaActual = () => {
    const h = new Date();
    return `${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}`;
};

const PASOS = ["Destino", "Fruta", "Línea", "Operador", "Unidad", "Confirmar"] as const;

const CRITICIDAD: Record<number, string> = { 1: "chip--rojo", 2: "chip--ambar", 3: "chip--azul", 4: "chip--gris" };

/** Estado de una pieza: elegida de la lista o capturada nueva */
interface EstadoPieza<N> {
    nuevo: boolean;
    id: string;
    datos: N;
}

interface CapturaCaja {
    placas: string;
    numero_economico: string;
    largo_pies: string;
}

interface Inspeccion {
    resultado: 1 | 0 | null;
    observaciones: string;
}

const cajaVacia = (): EstadoPieza<CapturaCaja> => ({
    nuevo: false,
    id: "",
    datos: { placas: "", numero_economico: "", largo_pies: "" }
});

interface Props {
    onGuardado: (r: RespuestaDespachoCompleto) => void;
    onCerrar: () => void;
}

export default function AsistenteDespacho({ onGuardado, onCerrar }: Props) {
    const [paso, setPaso] = useState(0);
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    // ---- Catálogos ----
    const [clientes, setClientes] = useState<ClienteDisponible[]>([]);
    const [lineas, setLineas] = useState<LineaFletera[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [tractos, setTractos] = useState<Tractocamion[]>([]);
    const [cajasCat, setCajasCat] = useState<CajaRefrigerada[]>([]);
    const [cargando, setCargando] = useState(true);

    // ---- 1 Destino ----
    const [idCc, setIdCc] = useState<number | null>(null);
    const [buscarCliente, setBuscarCliente] = useState("");

    // ---- 2 Fruta ----
    const [stock, setStock] = useState<StockProceso[]>([]);
    const [todos, setTodos] = useState(false);
    const [cargandoStock, setCargandoStock] = useState(false);
    const [seleccion, setSeleccion] = useState<Record<number, { tarimas: string; cajas: string }>>({});
    const [confirmaReasignacion, setConfirmaReasignacion] = useState(false);

    // ---- 3 a 5 Transporte ----
    const [idLinea, setIdLinea] = useState("");
    const [operador, setOperador] = useState<EstadoPieza<{ nombre: string; celular: string }>>({
        nuevo: false,
        id: "",
        datos: { nombre: "", celular: "" }
    });
    const [tracto, setTracto] = useState<EstadoPieza<{ placas: string; numero_economico: string }>>({
        nuevo: false,
        id: "",
        datos: { placas: "", numero_economico: "" }
    });
    const [tipoUnidad, setTipoUnidad] = useState<1 | 2>(1);
    const [cajas, setCajas] = useState<EstadoPieza<CapturaCaja>[]>([cajaVacia(), cajaVacia()]);

    // ---- 6 Confirmar ----
    const [inspeccion, setInspeccion] = useState<Inspeccion[]>([
        { resultado: null, observaciones: "" },
        { resultado: null, observaciones: "" }
    ]);
    const [fecha, setFecha] = useState(hoyISO());
    const [hora, setHora] = useState(horaActual());
    const [cita, setCita] = useState("");
    const [fechaCita, setFechaCita] = useState("");
    const [ordenVenta, setOrdenVenta] = useState("");
    const [temperatura, setTemperatura] = useState("");
    const [observaciones, setObservaciones] = useState("");

    // ---- Carga inicial ----
    useEffect(() => {
        let vivo = true;
        Promise.all([
            despachoService.getClientesDisponibles(),
            lineasService.getLineas(1),
            operadoresService.getOperadores(1),
            tractosService.getTractocamiones(1),
            cajasService.getCajas(1)
        ])
            .then(([cl, li, op, tr, cj]) => {
                if (!vivo) return;
                setClientes(cl);
                setLineas(li.sort((a, b) => a.razon_social.localeCompare(b.razon_social, "es")));
                setOperadores(op);
                setTractos(tr);
                setCajasCat(cj);
            })
            .catch((e) => vivo && setError(mensajeError(e)))
            .finally(() => vivo && setCargando(false));
        return () => {
            vivo = false;
        };
    }, []);

    // ---- Stock del destino ----
    useEffect(() => {
        if (idCc === null) return;
        let vivo = true;
        setCargandoStock(true);
        despachoService
            .getInventario(idCc, todos)
            .then((s) => vivo && setStock(s))
            .catch((e) => vivo && setError(mensajeError(e)))
            .finally(() => vivo && setCargandoStock(false));
        return () => {
            vivo = false;
        };
    }, [idCc, todos]);

    // ---- Derivados ----
    const destino = clientes.find((c) => c.id_cc === idCc) ?? null;
    const lineaNum = idLinea ? Number(idLinea) : null;
    const compatible = (l: number | null) => l === null || l === lineaNum;

    const clientesVisibles = useMemo(() => {
        const t = normalizar(buscarCliente.trim());
        return t ? clientes.filter((c) => normalizar(`${c.cliente} ${c.cedis} ${c.acronimo_cc}`).includes(t)) : clientes;
    }, [clientes, buscarCliente]);

    const elegidos = stock.filter((s) => seleccion[s.id_ocupacion]);
    const totalTar = elegidos.reduce((s, p) => s + num(seleccion[p.id_ocupacion].tarimas), 0);
    const totalCaj = elegidos.reduce((s, p) => s + num(seleccion[p.id_ocupacion].cajas), 0);
    const hayOtroCliente = elegidos.some((p) => p.es_de_otro_cliente);

    const opcionesOperador = operadores
        .filter((o) => compatible(o.id_linea_fletera))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        .map((o) => ({ id: o.id_operador, texto: o.nombre, detalle: o.celular + (o.id_linea_fletera === null ? " · independiente" : "") }));

    const opcionesTracto = tractos
        .filter((t) => compatible(t.id_linea_fletera))
        .sort((a, b) => a.placas.localeCompare(b.placas, "es"))
        .map((t) => ({ id: t.id_tractocamion, texto: t.placas, detalle: `Eco ${t.numero_economico}` }));

    const opcionesCaja = (indice: number) =>
        cajasCat
            .filter((c) => compatible(c.id_linea_fletera))
            .filter((c) => indice === 0 || String(c.id_caja_refrigerada) !== cajas[0].id || cajas[0].nuevo)
            .sort((a, b) => a.placas.localeCompare(b.placas, "es"))
            .map((c) => ({
                id: c.id_caja_refrigerada,
                texto: c.placas,
                detalle: `Eco ${c.numero_economico}${c.largo_pies ? ` · ${c.largo_pies}'` : ""}`
            }));

    // Al cambiar de línea se sueltan las piezas que eran de otra
    const cambiarLinea = (v: string) => {
        setIdLinea(v);
        const nueva = v ? Number(v) : null;
        const ok = (l: number | null) => l === null || l === nueva;
        const op = operadores.find((o) => String(o.id_operador) === operador.id);
        if (op && !ok(op.id_linea_fletera)) setOperador((s) => ({ ...s, id: "" }));
        const tr = tractos.find((t) => String(t.id_tractocamion) === tracto.id);
        if (tr && !ok(tr.id_linea_fletera)) setTracto((s) => ({ ...s, id: "" }));
        setCajas((cs) =>
            cs.map((c) => {
                const k = cajasCat.find((x) => String(x.id_caja_refrigerada) === c.id);
                return k && !ok(k.id_linea_fletera) ? { ...c, id: "" } : c;
            })
        );
    };

    const alternarProceso = (p: StockProceso) =>
        setSeleccion((s) => {
            const n = { ...s };
            if (n[p.id_ocupacion]) delete n[p.id_ocupacion];
            else n[p.id_ocupacion] = { tarimas: String(num(p.tarimas_disponibles)), cajas: String(num(p.cajas_disponibles)) };
            return n;
        });

    const cambiarCantidad = (p: StockProceso, campo: "tarimas" | "cajas", v: string) =>
        setSeleccion((s) => {
            const actual = s[p.id_ocupacion];
            const nuevo = { ...actual, [campo]: v };
            // Cajas en proporción a las tarimas mientras no se toquen a mano
            if (campo === "tarimas") {
                const t = Number(v);
                const maxT = num(p.tarimas_disponibles);
                const maxC = num(p.cajas_disponibles);
                if (v !== "" && !isNaN(t)) nuevo.cajas = String(t >= maxT ? maxC : maxT > 0 ? Math.round((maxC / maxT) * t) : 0);
            }
            return { ...s, [p.id_ocupacion]: nuevo };
        });

    // ---- Validación por paso ----
    const errorPaso = (p: number): string | null => {
        if (p === 0) return idCc === null ? "Elige el destino del despacho." : null;

        if (p === 1) {
            if (elegidos.length === 0) return "Elige al menos un proceso.";
            for (const e of elegidos) {
                const s = seleccion[e.id_ocupacion];
                const t = Number(s.tarimas || 0);
                const c = Number(s.cajas || 0);
                const lote = e.codigo_lote ?? `#${e.id_ocupacion}`;
                if (!Number.isInteger(t) || t < 0 || !Number.isInteger(c) || c < 0) return `${lote}: cantidades inválidas.`;
                if (t === 0 && c === 0) return `${lote}: indica cuánto sale.`;
                if (t > num(e.tarimas_disponibles)) return `${lote}: solo hay ${num(e.tarimas_disponibles)} tarimas.`;
                if (c > num(e.cajas_disponibles)) return `${lote}: solo hay ${num(e.cajas_disponibles)} cajas.`;
                if (t > 0 && c > 0 && t > c) return `${lote}: ${t} tarimas con ${c} cajas no es posible.`;
            }
            if (hayOtroCliente && !confirmaReasignacion) return "Confirma la reasignación de la fruta de otro cliente.";
            return null;
        }

        if (p === 2) return idLinea ? null : "Elige la línea fletera.";

        if (p === 3) {
            if (!operador.nuevo) return operador.id ? null : "Elige el operador o dalo de alta.";
            const nombre = operador.datos.nombre.trim();
            const cel = digitos(operador.datos.celular);
            if (!nombre) return "Escribe el nombre del operador.";
            if (cel.length !== 10) return "El celular debe tener 10 dígitos.";
            const dup = operadores.find((o) => digitos(o.celular) === cel);
            if (dup) return `Ese celular ya es de ${dup.nombre}: elígelo de la lista.`;
            return null;
        }

        if (p === 4) {
            if (!tracto.nuevo && !tracto.id) return "Elige el tractocamión o dalo de alta.";
            if (tracto.nuevo) {
                const pl = normalizarPlaca(tracto.datos.placas);
                if (!pl || pl.length > 10) return "Placas del tracto: obligatorias, máximo 10 sin guiones.";
                if (!tracto.datos.numero_economico.trim()) return "Escribe el número económico del tracto.";
                if (tractos.some((t) => normalizarPlaca(t.placas) === pl)) return "Esas placas ya están registradas: elige el tracto de la lista.";
            }
            const usadas: string[] = [];
            for (let i = 0; i < tipoUnidad; i++) {
                const c = cajas[i];
                if (!c.nuevo && !c.id) return `Elige la caja ${i + 1} o dala de alta.`;
                if (c.nuevo) {
                    const pl = normalizarPlaca(c.datos.placas);
                    if (!pl || pl.length > 10) return `Placas de la caja ${i + 1}: obligatorias, máximo 10 sin guiones.`;
                    if (!c.datos.numero_economico.trim()) return `Escribe el número económico de la caja ${i + 1}.`;
                    if (cajasCat.some((k) => normalizarPlaca(k.placas) === pl))
                        return `Las placas de la caja ${i + 1} ya están registradas: elígela de la lista.`;
                    if (c.datos.largo_pies && (!Number.isInteger(Number(c.datos.largo_pies)) || Number(c.datos.largo_pies) <= 0))
                        return `El largo de la caja ${i + 1} debe ser un entero.`;
                    usadas.push(`n:${pl}`);
                } else usadas.push(`i:${c.id}`);
            }
            if (new Set(usadas).size !== usadas.length) return "Las dos cajas deben ser distintas.";
            return null;
        }

        // Confirmar
        for (let i = 0; i < tipoUnidad; i++) {
            if (inspeccion[i].resultado === null) return `Registra la inspección de la caja ${i + 1}.`;
            if (inspeccion[i].resultado === 0) return `La caja ${i + 1} no pasó la inspección: no se carga. Cambia la unidad.`;
        }
        if (!fecha) return "Indica la fecha de despacho.";
        if (fecha > hoyISO()) return "La fecha de despacho no puede ser futura.";
        if (!hora) return "Indica la hora de salida.";
        if (fechaCita && fechaCita < fecha) return "La fecha de cita no puede ser anterior a la de despacho.";
        if (temperatura.trim() !== "") {
            const t = Number(temperatura);
            if (isNaN(t) || t < -5 || t > 45) return "La temperatura debe estar entre -5 y 45 °C.";
        }
        return null;
    };

    const siguiente = () => {
        const e = errorPaso(paso);
        if (e) return setError(e);
        setError("");
        setPaso((p) => Math.min(p + 1, PASOS.length - 1));
    };

    const anterior = () => {
        setError("");
        setPaso((p) => Math.max(p - 1, 0));
    };

    // ---- Confirmar ----
    const piezaCaja = (c: EstadoPieza<CapturaCaja>): Pieza<NuevaCaja> =>
        c.nuevo
            ? {
                  nuevo: {
                      placas: normalizarPlaca(c.datos.placas),
                      numero_economico: c.datos.numero_economico.trim().toUpperCase(),
                      largo_pies: c.datos.largo_pies ? Number(c.datos.largo_pies) : null
                  }
              }
            : { id: Number(c.id) };

    const confirmar = async () => {
        for (let p = 0; p < PASOS.length; p++) {
            const e = errorPaso(p);
            if (e) {
                setPaso(p);
                return setError(e);
            }
        }
        setError("");
        setEnviando(true);

        const payload: DespachoCompletoPayload = {
            id_cc: idCc as number,
            fecha_despacho: fecha,
            hora_salida: hora,
            orden_venta: ordenVenta.trim() || null,
            cita: cita.trim() || null,
            fecha_cita: fechaCita || null,
            temperatura_salida: temperatura.trim() === "" ? null : Number(temperatura),
            observaciones: observaciones.trim() || null,
            confirmar_reasignacion: hayOtroCliente && confirmaReasignacion,
            lineas: elegidos.map((e) => ({
                id_ocupacion_origen: e.id_ocupacion,
                cantidad_tarimas: Number(seleccion[e.id_ocupacion].tarimas || 0),
                cantidad_cajas: Number(seleccion[e.id_ocupacion].cajas || 0)
            })),
            transporte: {
                id_linea_fletera: Number(idLinea),
                operador: operador.nuevo
                    ? { nuevo: { nombre: operador.datos.nombre.trim().toUpperCase(), celular: digitos(operador.datos.celular) } }
                    : { id: Number(operador.id) },
                tractocamion: tracto.nuevo
                    ? {
                          nuevo: {
                              placas: normalizarPlaca(tracto.datos.placas),
                              numero_economico: tracto.datos.numero_economico.trim().toUpperCase()
                          }
                      }
                    : { id: Number(tracto.id) },
                tipo_unidad: tipoUnidad,
                cajas: cajas.slice(0, tipoUnidad).map(piezaCaja)
            },
            inspeccion: inspeccion.slice(0, tipoUnidad).map((i) => ({
                inocuidad: 1 as const,
                observaciones: i.observaciones.trim() || null
            }))
        };

        try {
            onGuardado(await despachoService.confirmarDespacho(payload));
        } catch (e) {
            setError(mensajeError(e));
            setEnviando(false);
        }
    };

    // ---- Textos del resumen ----
    const lineaSel = lineas.find((l) => String(l.id_linea_fletera) === idLinea);
    const textoOperador = operador.nuevo
        ? `${operador.datos.nombre.toUpperCase()} (nuevo)`
        : operadores.find((o) => String(o.id_operador) === operador.id)?.nombre ?? "—";
    const textoTracto = tracto.nuevo
        ? `${normalizarPlaca(tracto.datos.placas)} (nuevo)`
        : tractos.find((t) => String(t.id_tractocamion) === tracto.id)?.placas ?? "—";
    const textoCaja = (i: number) => {
        const c = cajas[i];
        return c.nuevo
            ? `${normalizarPlaca(c.datos.placas)} (nueva)`
            : cajasCat.find((k) => String(k.id_caja_refrigerada) === c.id)?.placas ?? "—";
    };

    const ponerCaja = (i: number, cambios: Partial<EstadoPieza<CapturaCaja>>) =>
        setCajas((cs) => cs.map((c, k) => (k === i ? { ...c, ...cambios } : c)));
    const ponerDatosCaja = (i: number, campo: keyof CapturaCaja, v: string) =>
        setCajas((cs) => cs.map((c, k) => (k === i ? { ...c, datos: { ...c.datos, [campo]: v } } : c)));
    const ponerInspeccion = (i: number, cambios: Partial<Inspeccion>) =>
        setInspeccion((is) => is.map((x, k) => (k === i ? { ...x, ...cambios } : x)));

    const ultimo = paso === PASOS.length - 1;

    // ---- Vista ----
    return (
        <Modal
            titulo="Nuevo despacho"
            subtitulo={destino ? `${destino.cliente} · ${destino.cedis}` : "Se confirma cuando la unidad sale"}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    {paso > 0 ? (
                        <button type="button" className="boton boton--claro" onClick={anterior} disabled={enviando}>
                            <ArrowLeft size={16} /> Atrás
                        </button>
                    ) : (
                        <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                            Cancelar
                        </button>
                    )}
                    {ultimo ? (
                        <button type="button" className="boton boton--primario" onClick={confirmar} disabled={enviando}>
                            {enviando ? <span className="spinner spinner--chico" /> : <><Check size={16} /> Confirmar despacho</>}
                        </button>
                    ) : (
                        <button type="button" className="boton boton--primario" onClick={siguiente} disabled={enviando || cargando}>
                            Siguiente <ArrowRight size={16} />
                        </button>
                    )}
                </>
            }
        >
            {/* ---- Pasos ---- */}
            <ol className="asistente__pasos">
                {PASOS.map((p, i) => (
                    <li
                        key={p}
                        className={`asistente__paso ${i === paso ? "asistente__paso--actual" : ""} ${i < paso ? "asistente__paso--hecho" : ""}`}
                    >
                        <span>{i < paso ? <Check size={12} /> : i + 1}</span>
                        {p}
                    </li>
                ))}
            </ol>

            {error && <div className="alerta alerta--error">{error}</div>}

            {cargando ? (
                <div className="crud__vacio">
                    <div className="spinner" />
                    <p>Cargando stock y catálogos…</p>
                </div>
            ) : (
                <>
                    {/* ======== 1 DESTINO ======== */}
                    {paso === 0 && (
                        <div className="asistente__cuerpo">
                            <input
                                className="asistente__buscar"
                                type="search"
                                value={buscarCliente}
                                onChange={(e) => setBuscarCliente(e.target.value)}
                                placeholder="Buscar cliente o CEDIS…"
                                autoFocus
                            />
                            {clientesVisibles.length === 0 ? (
                                <p className="pieza__vacio">No hay fruta en stock para despachar.</p>
                            ) : (
                                <div className="asistente__tarjetas">
                                    {clientesVisibles.map((c) => (
                                        <button
                                            key={c.id_cc}
                                            type="button"
                                            className={`asistente__tarjeta ${c.id_cc === idCc ? "asistente__tarjeta--activa" : ""}`}
                                            onClick={() => {
                                                if (c.id_cc !== idCc) {
                                                    setIdCc(c.id_cc);
                                                    setSeleccion({});
                                                    setTodos(false);
                                                    setConfirmaReasignacion(false);
                                                }
                                            }}
                                        >
                                            <Store size={18} />
                                            <div>
                                                <strong>
                                                    {c.cliente} · {c.cedis}
                                                </strong>
                                                <small>
                                                    {num(c.procesos)} proceso(s) · {num(c.tarimas_disponibles)} tar ·{" "}
                                                    {num(c.cajas_disponibles).toLocaleString("es-MX")} cj
                                                    {c.fecha_entrega_proxima ? ` · cita ${fechaCorta(c.fecha_entrega_proxima)}` : ""}
                                                </small>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======== 2 FRUTA ======== */}
                    {paso === 1 && (
                        <div className="asistente__cuerpo">
                            <div className="asistente__barra">
                                <label className="interruptor">
                                    <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
                                    Incluir fruta de otros clientes
                                </label>
                                <span className="chip chip--azul">
                                    {elegidos.length} proceso(s) · {totalTar} tar · {totalCaj} cj
                                </span>
                            </div>

                            {cargandoStock ? (
                                <div className="crud__vacio">
                                    <div className="spinner" />
                                </div>
                            ) : stock.length === 0 ? (
                                <p className="pieza__vacio">No hay stock para este destino en tus cámaras.</p>
                            ) : (
                                <div className="asistente__stock">
                                    {stock.map((p) => {
                                        const s = seleccion[p.id_ocupacion];
                                        return (
                                            <div
                                                key={p.id_ocupacion}
                                                className={`stock ${s ? "stock--activo" : ""} ${p.es_de_otro_cliente ? "stock--otro" : ""}`}
                                            >
                                                <label className="stock__elegir">
                                                    <input type="checkbox" checked={Boolean(s)} onChange={() => alternarProceso(p)} />
                                                    <div>
                                                        <strong>
                                                            {p.codigo_productor} {p.codigo_finca} {p.nombre_finca}
                                                        </strong>
                                                        <small>
                                                            <span className="mono">{p.codigo_lote ?? "—"}</span> · {p.codigo_sku}{" "}
                                                            {p.calidad_sku}
                                                        </small>
                                                        <small>
                                                            {p.nombre_camara} · empaque {p.fecha_empaque ? fechaCorta(p.fecha_empaque) : "—"}
                                                            {p.es_de_otro_cliente ? ` · planeada para ${p.acronimo_cc ?? p.cliente}` : ""}
                                                        </small>
                                                    </div>
                                                </label>
                                                <div className="stock__lado">
                                                    <span className={`chip ${CRITICIDAD[p.nivel_criticidad] ?? "chip--gris"}`}>
                                                        {p.criticidad_texto}
                                                    </span>
                                                    <span>
                                                        {num(p.tarimas_disponibles)} tar · {num(p.cajas_disponibles)} cj
                                                    </span>
                                                </div>
                                                {s && (
                                                    <div className="stock__cantidades">
                                                        <label className="campo">
                                                            <span>Tarimas que salen</span>
                                                            <input
                                                                type="number"
                                                                inputMode="numeric"
                                                                min={0}
                                                                max={num(p.tarimas_disponibles)}
                                                                value={s.tarimas}
                                                                onChange={(e) => cambiarCantidad(p, "tarimas", e.target.value)}
                                                            />
                                                        </label>
                                                        <label className="campo">
                                                            <span>Cajas que salen</span>
                                                            <input
                                                                type="number"
                                                                inputMode="numeric"
                                                                min={0}
                                                                max={num(p.cajas_disponibles)}
                                                                value={s.cajas}
                                                                onChange={(e) => cambiarCantidad(p, "cajas", e.target.value)}
                                                            />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {hayOtroCliente && (
                                <div className="alerta alerta--aviso">
                                    <AlertTriangle size={16} className="icono-en-linea" /> Elegiste fruta planeada para otro
                                    cliente.
                                    <label className="interruptor asistente__confirma">
                                        <input
                                            type="checkbox"
                                            checked={confirmaReasignacion}
                                            onChange={(e) => setConfirmaReasignacion(e.target.checked)}
                                        />
                                        Confirmo la reasignación a {destino?.acronimo_cc}
                                    </label>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======== 3 LÍNEA ======== */}
                    {paso === 2 && (
                        <div className="asistente__cuerpo">
                            {lineas.length === 0 ? (
                                <p className="pieza__vacio">No hay líneas fleteras activas. Regístrala en Catálogos › Líneas fleteras.</p>
                            ) : (
                                <div className="asistente__tarjetas">
                                    {lineas.map((l) => (
                                        <button
                                            key={l.id_linea_fletera}
                                            type="button"
                                            className={`asistente__tarjeta ${String(l.id_linea_fletera) === idLinea ? "asistente__tarjeta--activa" : ""}`}
                                            onClick={() => cambiarLinea(String(l.id_linea_fletera))}
                                        >
                                            <Truck size={18} />
                                            <div>
                                                <strong>{l.razon_social}</strong>
                                                <small>
                                                    {l.rfc} · {l.telefono_contacto}
                                                </small>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======== 4 OPERADOR ======== */}
                    {paso === 3 && (
                        <div className="asistente__cuerpo">
                            <SelectorPieza
                                titulo={`Operador · ${lineaSel?.razon_social ?? ""}`}
                                nuevo={operador.nuevo}
                                idElegido={operador.id}
                                opciones={opcionesOperador}
                                vacio="Esta línea no tiene operadores registrados."
                                textoNuevo="Nuevo operador"
                                onElegir={(id) => setOperador((s) => ({ ...s, id }))}
                                onModoNuevo={(nuevo) => setOperador((s) => ({ ...s, nuevo }))}
                            >
                                <label className="campo campo--completo">
                                    <span>Nombre completo</span>
                                    <input
                                        type="text"
                                        maxLength={100}
                                        value={operador.datos.nombre}
                                        onChange={(e) => setOperador((s) => ({ ...s, datos: { ...s.datos, nombre: e.target.value } }))}
                                        placeholder="Ej. JUAN PÉREZ LÓPEZ"
                                        autoFocus
                                    />
                                </label>
                                <label className="campo">
                                    <span>Celular (10 dígitos)</span>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        maxLength={14}
                                        value={operador.datos.celular}
                                        onChange={(e) => setOperador((s) => ({ ...s, datos: { ...s.datos, celular: e.target.value } }))}
                                    />
                                </label>
                            </SelectorPieza>
                        </div>
                    )}

                    {/* ======== 5 UNIDAD ======== */}
                    {paso === 4 && (
                        <div className="asistente__cuerpo">
                            <SelectorPieza
                                titulo="Tractocamión"
                                nuevo={tracto.nuevo}
                                idElegido={tracto.id}
                                opciones={opcionesTracto}
                                vacio="Esta línea no tiene tractos registrados."
                                textoNuevo="Nuevo tracto"
                                onElegir={(id) => setTracto((s) => ({ ...s, id }))}
                                onModoNuevo={(nuevo) => setTracto((s) => ({ ...s, nuevo }))}
                            >
                                <label className="campo">
                                    <span>Placas</span>
                                    <input
                                        type="text"
                                        className="mono"
                                        maxLength={14}
                                        value={tracto.datos.placas}
                                        onChange={(e) =>
                                            setTracto((s) => ({ ...s, datos: { ...s.datos, placas: e.target.value.toUpperCase() } }))
                                        }
                                        autoFocus
                                    />
                                </label>
                                <label className="campo">
                                    <span>Número económico</span>
                                    <input
                                        type="text"
                                        className="mono"
                                        maxLength={10}
                                        value={tracto.datos.numero_economico}
                                        onChange={(e) =>
                                            setTracto((s) => ({
                                                ...s,
                                                datos: { ...s.datos, numero_economico: e.target.value.toUpperCase() }
                                            }))
                                        }
                                    />
                                </label>
                            </SelectorPieza>

                            <div className="segmentado asistente__unidad" role="radiogroup" aria-label="Tipo de unidad">
                                {([1, 2] as const).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        role="radio"
                                        aria-checked={tipoUnidad === t}
                                        className={tipoUnidad === t ? "activo" : ""}
                                        onClick={() => setTipoUnidad(t)}
                                    >
                                        <Container size={16} /> {t === 1 ? "Sencillo · 1 caja" : "Full · 2 cajas"}
                                    </button>
                                ))}
                            </div>

                            {Array.from({ length: tipoUnidad }, (_, i) => (
                                <SelectorPieza
                                    key={i}
                                    titulo={tipoUnidad === 2 ? `Caja refrigerada ${i + 1}` : "Caja refrigerada"}
                                    nuevo={cajas[i].nuevo}
                                    idElegido={cajas[i].id}
                                    opciones={opcionesCaja(i)}
                                    vacio="Esta línea no tiene cajas registradas."
                                    textoNuevo="Nueva caja"
                                    onElegir={(id) => ponerCaja(i, { id })}
                                    onModoNuevo={(nuevo) => ponerCaja(i, { nuevo })}
                                >
                                    <label className="campo">
                                        <span>Placas</span>
                                        <input
                                            type="text"
                                            className="mono"
                                            maxLength={14}
                                            value={cajas[i].datos.placas}
                                            onChange={(e) => ponerDatosCaja(i, "placas", e.target.value.toUpperCase())}
                                        />
                                    </label>
                                    <label className="campo">
                                        <span>Número económico</span>
                                        <input
                                            type="text"
                                            className="mono"
                                            maxLength={10}
                                            value={cajas[i].datos.numero_economico}
                                            onChange={(e) => ponerDatosCaja(i, "numero_economico", e.target.value.toUpperCase())}
                                        />
                                    </label>
                                    <label className="campo">
                                        <span>
                                            Largo (pies) <small>(opcional)</small>
                                        </span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={cajas[i].datos.largo_pies}
                                            onChange={(e) => ponerDatosCaja(i, "largo_pies", e.target.value)}
                                            placeholder="53"
                                        />
                                    </label>
                                </SelectorPieza>
                            ))}
                        </div>
                    )}

                    {/* ======== 6 CONFIRMAR ======== */}
                    {paso === 5 && (
                        <div className="asistente__cuerpo">
                            <div className="asistente__resumen">
                                <div>
                                    <small>Destino</small>
                                    <strong>
                                        {destino?.cliente} · {destino?.cedis}
                                    </strong>
                                </div>
                                <div>
                                    <small>Carga</small>
                                    <strong>
                                        {elegidos.length} proceso(s) · {totalTar} tar · {totalCaj} cj
                                    </strong>
                                </div>
                                <div>
                                    <small>Línea</small>
                                    <strong>{lineaSel?.razon_social}</strong>
                                </div>
                                <div>
                                    <small>
                                        <UserRound size={11} className="icono-en-linea" /> Operador
                                    </small>
                                    <strong>{textoOperador}</strong>
                                </div>
                                <div>
                                    <small>Tracto</small>
                                    <strong className="mono">{textoTracto}</strong>
                                </div>
                                <div>
                                    <small>Unidad</small>
                                    <strong>{tipoUnidad === 2 ? "Full" : "Sencillo"}</strong>
                                </div>
                            </div>

                            <h3 className="asistente__subtitulo">Inspección de inocuidad</h3>
                            <p className="pieza__vacio">Limpieza, olores, plagas y que la caja no esté dañada.</p>
                            {Array.from({ length: tipoUnidad }, (_, i) => {
                                const ins = inspeccion[i];
                                return (
                                    <div key={i} className={`inspeccion ${ins.resultado === 0 ? "inspeccion--rechazada" : ""}`}>
                                        <strong>
                                            Caja {tipoUnidad === 2 ? i + 1 : ""} <span className="mono">{textoCaja(i)}</span>
                                        </strong>
                                        <div className="segmentado">
                                            <button
                                                type="button"
                                                className={ins.resultado === 1 ? "activo" : ""}
                                                onClick={() => ponerInspeccion(i, { resultado: 1 })}
                                            >
                                                <ShieldCheck size={16} /> Aprobada
                                            </button>
                                            <button
                                                type="button"
                                                className={ins.resultado === 0 ? "activo" : ""}
                                                onClick={() => ponerInspeccion(i, { resultado: 0 })}
                                            >
                                                <ShieldAlert size={16} /> Rechazada
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            maxLength={500}
                                            value={ins.observaciones}
                                            onChange={(e) => ponerInspeccion(i, { observaciones: e.target.value })}
                                            placeholder="Observaciones (opcional)"
                                        />
                                        {ins.resultado === 0 && (
                                            <small className="campo__mensaje">
                                                Una caja rechazada no se carga. Regresa al paso Unidad y cambia la caja.
                                            </small>
                                        )}
                                    </div>
                                );
                            })}

                            <h3 className="asistente__subtitulo">Datos de salida</h3>
                            <div className="formulario">
                                <label className="campo">
                                    <span>Fecha de despacho</span>
                                    <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
                                </label>
                                <label className="campo">
                                    <span>Hora de salida</span>
                                    <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                                </label>
                                <label className="campo">
                                    <span>Cita</span>
                                    <input
                                        type="text"
                                        className="mono"
                                        maxLength={50}
                                        value={cita}
                                        onChange={(e) => setCita(e.target.value.toUpperCase())}
                                    />
                                </label>
                                <label className="campo">
                                    <span>Fecha de cita</span>
                                    <input type="date" value={fechaCita} min={fecha} onChange={(e) => setFechaCita(e.target.value)} />
                                </label>
                                <label className="campo">
                                    <span>Orden de venta</span>
                                    <input
                                        type="text"
                                        className="mono"
                                        maxLength={50}
                                        value={ordenVenta}
                                        onChange={(e) => setOrdenVenta(e.target.value.toUpperCase())}
                                    />
                                </label>
                                <label className="campo">
                                    <span>Temperatura de salida (°C)</span>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.1"
                                        value={temperatura}
                                        onChange={(e) => setTemperatura(e.target.value)}
                                    />
                                </label>
                                <label className="campo campo--completo">
                                    <span>Observaciones</span>
                                    <input
                                        type="text"
                                        maxLength={250}
                                        value={observaciones}
                                        onChange={(e) => setObservaciones(e.target.value)}
                                    />
                                </label>
                            </div>

                            <p className="asistente__aviso">
                                <CheckCircle2 size={16} className="icono-en-linea" /> Al confirmar, la fruta se descuenta de las
                                cámaras y el despacho queda <strong>cerrado</strong>.
                            </p>
                        </div>
                    )}
                </>
            )}
        </Modal>
    );
}
