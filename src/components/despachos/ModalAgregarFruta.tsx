import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Search } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as despachosService from "../../services/despachos.service";
import { fechaCorta, normalizar } from "../../utils/formato";
import type { Despacho, FrutaDisponible } from "../../types/despacho";

// ============================================================================
// AGREGAR FRUTA AL DESPACHO (picking) · operativo+
// ============================================================================
// Lista la fruta DENTRO de las cámaras del alcance del usuario, ordenada por
// criticidad y FEFO (lo que está más cerca de incumplir aparece primero).
//
//   · Por defecto solo fruta planeada para el cliente del despacho.
//   · "Incluir otros clientes" muestra el resto, marcado: reasignar es
//     legítimo, pero el cierre pedirá confirmarlo.
//
// Al guardar, la BD genera el movimiento y descuenta la cámara: esta
// pantalla NO toca el inventario directamente.
//
// Reglas (las mismas del backend):
//   · no más tarimas ni cajas de las que hay en ese lote
//   · al menos una tarima o una caja
//   · tarimas ≤ cajas y cajas ≤ tarimas × 60
//   · temperatura entre -5 y 45 °C
// ============================================================================

interface Props {
    despacho: Despacho;
    onGuardado: (mensaje: string, avisos?: string[]) => void;
    onCerrar: () => void;
}

const num = (v: number | string | null | undefined) => Number(v ?? 0);

export default function ModalAgregarFruta({ despacho, onGuardado, onCerrar }: Props) {
    const [inventario, setInventario] = useState<FrutaDisponible[]>([]);
    const [cargando, setCargando] = useState(true);
    const [todos, setTodos] = useState(false);
    const [busqueda, setBusqueda] = useState("");

    const [seleccion, setSeleccion] = useState<FrutaDisponible | null>(null);
    const [tarimas, setTarimas] = useState("");
    const [cajas, setCajas] = useState("");
    const [cajasManual, setCajasManual] = useState(false);
    const [temperatura, setTemperatura] = useState("");
    const [observaciones, setObservaciones] = useState("");

    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setInventario(await despachosService.getDisponible(despacho.id_despacho, todos));
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setCargando(false);
        }
    }, [despacho.id_despacho, todos]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());
        if (!texto) return inventario;
        return inventario.filter((f) =>
            normalizar(
                [f.codigo_lote, f.nombre_camara, f.cliente, f.cedis, f.acronimo_cc].filter(Boolean).join(" ")
            ).includes(texto)
        );
    }, [inventario, busqueda]);

    // Cajas proporcionales a las tarimas, mientras no las escriban a mano
    const proporcionCajas = (f: FrutaDisponible, t: number) => {
        const td = num(f.tarimas_disponibles);
        const cd = num(f.cajas_disponibles);
        if (td <= 0 || t <= 0) return 0;
        if (t >= td) return cd;
        return Math.round((cd / td) * t);
    };

    const elegir = (f: FrutaDisponible) => {
        setSeleccion(f);
        setTarimas("");
        setCajas("");
        setCajasManual(false);
        setError("");
    };

    const cambiarTarimas = (valor: string) => {
        setTarimas(valor);
        if (seleccion && !cajasManual) {
            const t = Number(valor);
            setCajas(valor === "" || isNaN(t) ? "" : String(proporcionCajas(seleccion, t)));
        }
    };

    const llevarTodo = () => {
        if (!seleccion) return;
        setTarimas(String(num(seleccion.tarimas_disponibles)));
        setCajas(String(num(seleccion.cajas_disponibles)));
        setCajasManual(false);
    };

    // ---- Validación ----
    const validar = (): string | null => {
        if (!seleccion) return "Elige de qué lote sale la fruta.";
        const t = tarimas === "" ? 0 : Number(tarimas);
        const c = cajas === "" ? 0 : Number(cajas);

        if (!Number.isInteger(t) || t < 0) return "Las tarimas deben ser un entero mayor o igual a 0.";
        if (!Number.isInteger(c) || c < 0) return "Las cajas deben ser un entero mayor o igual a 0.";
        if (t === 0 && c === 0) return "Indica al menos una tarima o una caja.";
        if (t > num(seleccion.tarimas_disponibles))
            return `Solo hay ${num(seleccion.tarimas_disponibles)} tarimas de este lote.`;
        if (c > num(seleccion.cajas_disponibles))
            return `Solo hay ${num(seleccion.cajas_disponibles)} cajas de este lote.`;
        if (t > 0 && c > 0 && t > c) return `${t} tarimas con solo ${c} cajas no es posible.`;
        if (t > 0 && c > 0 && c > t * 60) return `${c} cajas no caben en ${t} tarimas.`;

        if (temperatura.trim() !== "") {
            const temp = Number(temperatura);
            if (isNaN(temp) || temp < -5 || temp > 45) return "La temperatura debe estar entre -5 y 45 °C.";
        }
        return null;
    };

    const guardar = async () => {
        const problema = validar();
        if (problema) {
            setError(problema);
            return;
        }
        if (!seleccion) return;

        setError("");
        setEnviando(true);
        try {
            const r = await despachosService.agregarLinea(despacho.id_despacho, {
                id_ocupacion_origen: seleccion.id_ocupacion,
                cantidad_tarimas: tarimas === "" ? 0 : Number(tarimas),
                cantidad_cajas: cajas === "" ? 0 : Number(cajas),
                temperatura,
                observaciones
            });
            onGuardado(r?.mensaje ?? "Fruta agregada al despacho", r?.avisos);
        } catch (err) {
            setError(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo="Agregar fruta"
            subtitulo={`Despacho ${despacho.folio_despacho} · ${despacho.cliente} · ${despacho.cedis}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="boton boton--primario"
                        onClick={guardar}
                        disabled={enviando || !seleccion}
                    >
                        {enviando ? <span className="spinner spinner--chico" /> : "Subir al camión"}
                    </button>
                </>
            }
        >
            <div className="crud__barra" style={{ marginBottom: 0 }}>
                <label className="buscador">
                    <Search size={18} />
                    <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar lote, cámara o cliente…"
                    />
                </label>
                <label className="interruptor">
                    <input
                        type="checkbox"
                        checked={todos}
                        onChange={(e) => {
                            setTodos(e.target.checked);
                            setSeleccion(null);
                        }}
                        disabled={enviando}
                    />
                    Incluir otros clientes
                </label>
            </div>

            {cargando ? (
                <div className="crud__vacio">
                    <div className="spinner" />
                    <p>Buscando fruta disponible…</p>
                </div>
            ) : visibles.length === 0 ? (
                <div className="crud__vacio">
                    <Boxes size={36} />
                    <p>
                        {busqueda
                            ? "Ningún lote coincide con la búsqueda."
                            : todos
                                ? "No hay fruta dentro de tus cámaras."
                                : "No hay fruta planeada para este cliente en tus cámaras. Activa “Incluir otros clientes” si se va a reasignar."}
                    </p>
                </div>
            ) : (
                <div className="fruta-lista" role="listbox" aria-label="Fruta disponible">
                    {visibles.map((f) => {
                        const activa = seleccion?.id_ocupacion === f.id_ocupacion;
                        return (
                            <button
                                key={f.id_ocupacion}
                                type="button"
                                role="option"
                                aria-selected={activa}
                                className={`fruta-opcion ${activa ? "fruta-opcion--activa" : ""} ${f.es_de_otro_cliente ? "fruta-opcion--otro" : ""}`}
                                onClick={() => elegir(f)}
                                disabled={enviando}
                            >
                                <span className="fruta-opcion__lote">
                                    <span className="lote-chip mono">{f.codigo_lote ?? `Ocupación ${f.id_ocupacion}`}</span>
                                    {f.es_de_otro_cliente && (
                                        <span className="chip chip--ambar">
                                            <AlertTriangle size={12} className="icono-en-linea" /> {f.acronimo_cc ?? f.cliente ?? "Otro cliente"}
                                        </span>
                                    )}
                                </span>
                                <span className="fruta-opcion__cantidad">
                                    {num(f.tarimas_disponibles)} tar · {num(f.cajas_disponibles)} cj
                                </span>
                                <small>
                                    {f.nombre_camara ?? `Cámara ${f.id_camara}`}
                                    {f.fecha_empaque ? ` · Empaque ${fechaCorta(f.fecha_empaque)}` : ""}
                                </small>
                                <small style={{ textAlign: "right" }}>
                                    {f.fecha_entrega ? `Entrega ${fechaCorta(f.fecha_entrega)}` : ""}
                                    {f.nivel_criticidad !== null && f.nivel_criticidad !== undefined
                                        ? ` · Crit. ${f.nivel_criticidad}`
                                        : ""}
                                </small>
                            </button>
                        );
                    })}
                </div>
            )}

            {seleccion && (
                <div className="formulario">
                    <label className="campo">
                        <span>
                            Tarimas <small>(máx. {num(seleccion.tarimas_disponibles)})</small>
                        </span>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={num(seleccion.tarimas_disponibles)}
                            step={1}
                            value={tarimas}
                            onChange={(e) => cambiarTarimas(e.target.value)}
                            disabled={enviando}
                            autoFocus
                        />
                        <button type="button" className="enlace enlace--verde" onClick={llevarTodo} disabled={enviando}>
                            Llevar todo el lote
                        </button>
                    </label>

                    <label className="campo">
                        <span>
                            Cajas <small>(máx. {num(seleccion.cajas_disponibles)})</small>
                        </span>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={num(seleccion.cajas_disponibles)}
                            step={1}
                            value={cajas}
                            onChange={(e) => {
                                setCajas(e.target.value);
                                setCajasManual(true);
                            }}
                            disabled={enviando}
                        />
                        {!cajasManual && tarimas !== "" && (
                            <small className="campo__ayuda">Calculado en proporción al lote; ajústalo si cambia.</small>
                        )}
                    </label>

                    <label className="campo">
                        <span>
                            Temperatura (°C) <small>(opcional)</small>
                        </span>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            value={temperatura}
                            onChange={(e) => setTemperatura(e.target.value)}
                            disabled={enviando}
                        />
                    </label>

                    <label className="campo">
                        <span>
                            Observaciones <small>(opcional)</small>
                        </span>
                        <input
                            type="text"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            maxLength={250}
                            disabled={enviando}
                        />
                    </label>
                </div>
            )}

            {seleccion?.es_de_otro_cliente && (
                <p className="modal__advertencia">
                    Este lote estaba planeado para <strong>{seleccion.cliente ?? "otro cliente"}</strong>
                    {seleccion.cedis ? ` · ${seleccion.cedis}` : ""}. Se puede subir, pero al cerrar el despacho
                    tendrás que confirmar la reasignación.
                </p>
            )}

            {error && <div className="alerta alerta--error">{error}</div>}
        </Modal>
    );
}
