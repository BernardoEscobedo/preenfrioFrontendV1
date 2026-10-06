import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as despachosService from "../../services/despachos.service";
import * as transportesService from "../../services/transportes.service";
import * as cedisService from "../../services/cedis.service";
import { hoyISO, horaCorta, soloFecha } from "../../utils/formato";
import type { Despacho, DespachoForm } from "../../types/despacho";
import type { Transporte } from "../../types/transporte";
import type { Cedis } from "../../types/cedis";

// ============================================================================
// FORMULARIO DEL DESPACHO (encabezado)
// ============================================================================
// Tres modos:
//   · alta        nace en BORRADOR con la inspección PENDIENTE
//   · edicion     borrador. Si cambia el transporte, la BD BORRA la
//                 inspección: la caja revisada ya no es la que va a cargar
//   · correccion  despacho CERRADO. Exige motivo (mín. 10) y queda en la
//                 auditoría. El transporte NO se puede cambiar.
//
// Reglas (las mismas del backend):
//   · transporte y cliente/CEDIS obligatorios
//   · fecha de despacho obligatoria, hasta 30 días a futuro
//   · la fecha de cita no puede ser anterior a la del despacho
//   · temperatura de salida entre -5 y 45 °C
//   · orden de venta y cita hasta 50; observaciones hasta 250
//
// Solo se ofrecen transportes con sus 4 catálogos activos (?completos=1).
// ============================================================================

export type ModoDespacho = "alta" | "edicion" | "correccion";

type Campo =
    | "id_transporte"
    | "id_cc"
    | "fecha_despacho"
    | "hora_salida"
    | "fecha_cita"
    | "temperatura_salida"
    | "orden_venta"
    | "cita"
    | "observaciones"
    | "motivo";

interface Props {
    modo: ModoDespacho;
    despacho: Despacho | null;
    onGuardado: (mensaje: string, avisos?: string[], idDespacho?: number) => void;
    onCerrar: () => void;
}

const sumarDias = (iso: string, dias: number) => {
    const [a, m, d] = iso.split("-").map(Number);
    const f = new Date(a, m - 1, d + dias);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
};

export default function DespachoFormulario({ modo, despacho, onGuardado, onCerrar }: Props) {
    const esCorreccion = modo === "correccion";

    const [form, setForm] = useState<DespachoForm>({
        id_transporte: despacho?.id_transporte ?? 0,
        id_cc: despacho?.id_cc ?? 0,
        fecha_despacho: soloFecha(despacho?.fecha_despacho) || hoyISO(),
        hora_salida: horaCorta(despacho?.hora_salida),
        orden_venta: despacho?.orden_venta ?? "",
        cita: despacho?.cita ?? "",
        fecha_cita: soloFecha(despacho?.fecha_cita),
        temperatura_salida:
            despacho?.temperatura_salida === null || despacho?.temperatura_salida === undefined
                ? ""
                : String(despacho.temperatura_salida),
        observaciones: despacho?.observaciones ?? ""
    });
    const [motivo, setMotivo] = useState("");

    const [transportes, setTransportes] = useState<Transporte[]>([]);
    const [destinos, setDestinos] = useState<Cedis[]>([]);
    const [cargandoListas, setCargandoListas] = useState(true);

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        let vivo = true;
        Promise.all([transportesService.getTransportes({ estado: 1, completos: true }), cedisService.getCedis()])
            .then(([ts, cs]) => {
                if (!vivo) return;
                setTransportes(ts);
                setDestinos(cs);
            })
            .catch((err) => vivo && setErrorGeneral(mensajeError(err)))
            .finally(() => vivo && setCargandoListas(false));
        return () => {
            vivo = false;
        };
    }, []);

    // El transporte actual se conserva en la lista aunque ya no esté
    // disponible (dado de baja o con una pieza inactiva)
    const opcionesTransporte = useMemo(() => {
        const lista = [...transportes].sort((a, b) =>
            transportesService.describirTransporte(a).localeCompare(transportesService.describirTransporte(b), "es")
        );
        if (despacho && !lista.some((t) => t.id_transporte === despacho.id_transporte)) {
            return { lista, actualFuera: true };
        }
        return { lista, actualFuera: false };
    }, [transportes, despacho]);

    const opcionesDestino = useMemo(
        () =>
            destinos
                .filter((d) => Number(d.estado) === 1 || d.id_cc === despacho?.id_cc)
                .sort((a, b) => `${a.cliente} ${a.cedis}`.localeCompare(`${b.cliente} ${b.cedis}`, "es")),
        [destinos, despacho]
    );

    const cambiaTransporte =
        modo === "edicion" && despacho !== null && Number(form.id_transporte) !== despacho.id_transporte;
    const borraInspeccion = cambiaTransporte && despacho?.inocuidad !== null;

    const poner = <K extends keyof DespachoForm>(campo: K, valor: DespachoForm[K]) => {
        setForm((f) => ({ ...f, [campo]: valor }));
        if (errores[campo as Campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    };

    // ---- Validación ----
    const validar = (): boolean => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (!form.id_transporte) nuevos.id_transporte = "Elige el transporte";
        if (!form.id_cc) nuevos.id_cc = "Elige el cliente / CEDIS";

        if (!form.fecha_despacho) nuevos.fecha_despacho = "Indica la fecha del despacho";
        else if (form.fecha_despacho > sumarDias(hoyISO(), 30))
            nuevos.fecha_despacho = "Está a más de 30 días: revisa el año";

        if (form.fecha_cita && form.fecha_despacho && form.fecha_cita < form.fecha_despacho)
            nuevos.fecha_cita = "No puede ser anterior a la fecha de despacho";

        if (form.temperatura_salida.trim() !== "") {
            const t = Number(form.temperatura_salida);
            if (isNaN(t)) nuevos.temperatura_salida = "Debe ser numérica";
            else if (t < -5 || t > 45) nuevos.temperatura_salida = "Fuera de rango (-5 a 45 °C)";
        }

        if (form.orden_venta.length > 50) nuevos.orden_venta = "Máximo 50 caracteres";
        if (form.cita.length > 50) nuevos.cita = "Máximo 50 caracteres";
        if (form.observaciones.length > 250) nuevos.observaciones = "Máximo 250 caracteres";

        if (esCorreccion) {
            const m = motivo.trim();
            if (!m) nuevos.motivo = "Escribe el motivo: queda en la auditoría";
            else if (m.length < 10) nuevos.motivo = "Explica la corrección: al menos 10 caracteres";
        }

        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    // ---- Guardar ----
    const guardar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorGeneral("");
        if (!validar()) return;

        setEnviando(true);
        try {
            if (modo === "alta") {
                const r = await despachosService.crearDespacho(form);
                onGuardado(r?.mensaje ?? "Despacho creado en borrador", r?.avisos, r?.despacho?.id_despacho);
            } else if (modo === "edicion" && despacho) {
                const r = await despachosService.actualizarDespacho(despacho.id_despacho, form);
                onGuardado(r?.mensaje ?? "Despacho actualizado", r?.avisos);
            } else if (despacho) {
                const r = await despachosService.corregirDespacho(despacho.id_despacho, form, motivo.trim());
                onGuardado(r?.mensaje ?? "Corrección registrada", r?.avisos);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    const titulo =
        modo === "alta"
            ? "Nuevo despacho"
            : modo === "edicion"
                ? `Editar despacho ${despacho?.folio_despacho}`
                : `Corregir despacho ${despacho?.folio_despacho}`;

    const subtitulo =
        modo === "alta"
            ? "Se crea en borrador; el folio lo asigna el sistema"
            : modo === "edicion"
                ? `${despacho?.cliente} · ${despacho?.cedis}`
                : "El despacho ya salió: la corrección queda registrada en la auditoría";

    return (
        <Modal
            titulo={titulo}
            subtitulo={subtitulo}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="form-despacho"
                        className="boton boton--primario"
                        disabled={enviando || cargandoListas}
                    >
                        {enviando ? (
                            <span className="spinner spinner--chico" />
                        ) : modo === "alta" ? (
                            "Crear borrador"
                        ) : modo === "edicion" ? (
                            "Guardar cambios"
                        ) : (
                            "Registrar corrección"
                        )}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            {cargandoListas ? (
                <div className="crud__vacio">
                    <div className="spinner" />
                    <p>Cargando transportes y destinos…</p>
                </div>
            ) : (
                <form id="form-despacho" className="formulario" onSubmit={guardar} noValidate>
                    <label className={`campo campo--completo ${errores.id_transporte ? "campo--error" : ""}`}>
                        <span>
                            Transporte <em className="campo__requerido">*</em>
                        </span>
                        <select
                            value={form.id_transporte || ""}
                            onChange={(e) => poner("id_transporte", Number(e.target.value))}
                            disabled={enviando || esCorreccion}
                            autoFocus={modo === "alta"}
                        >
                            <option value="">Selecciona…</option>
                            {opcionesTransporte.actualFuera && despacho && (
                                <option value={despacho.id_transporte}>
                                    {[despacho.razon_social, despacho.nombre_operador, despacho.placas_caja]
                                        .filter(Boolean)
                                        .join(" · ") || `Transporte #${despacho.id_transporte}`}{" "}
                                    (actual, ya no disponible)
                                </option>
                            )}
                            {opcionesTransporte.lista.map((t) => (
                                <option key={t.id_transporte} value={t.id_transporte}>
                                    {transportesService.describirTransporte(t)}
                                </option>
                            ))}
                        </select>
                        {errores.id_transporte ? (
                            <small className="campo__mensaje">{errores.id_transporte}</small>
                        ) : esCorreccion ? (
                            <small className="campo__ayuda">
                                No se puede cambiar en un despacho cerrado: reábrelo (admin).
                            </small>
                        ) : (
                            opcionesTransporte.lista.length === 0 && (
                                <small className="campo__ayuda">
                                    No hay transportes listos. Regístralo en Catálogos › Transportes.
                                </small>
                            )
                        )}
                    </label>

                    <label className={`campo campo--completo ${errores.id_cc ? "campo--error" : ""}`}>
                        <span>
                            Cliente / CEDIS <em className="campo__requerido">*</em>
                        </span>
                        <select
                            value={form.id_cc || ""}
                            onChange={(e) => poner("id_cc", Number(e.target.value))}
                            disabled={enviando}
                        >
                            <option value="">Selecciona…</option>
                            {opcionesDestino.map((d) => (
                                <option key={d.id_cc} value={d.id_cc}>
                                    {d.cliente} · {d.cedis} ({d.acronimo})
                                    {Number(d.estado) !== 1 ? " · dado de baja" : ""}
                                </option>
                            ))}
                        </select>
                        {errores.id_cc && <small className="campo__mensaje">{errores.id_cc}</small>}
                    </label>

                    <label className={`campo ${errores.fecha_despacho ? "campo--error" : ""}`}>
                        <span>
                            Fecha de despacho <em className="campo__requerido">*</em>
                        </span>
                        <input
                            type="date"
                            value={form.fecha_despacho}
                            onChange={(e) => poner("fecha_despacho", e.target.value)}
                            disabled={enviando}
                        />
                        {errores.fecha_despacho && <small className="campo__mensaje">{errores.fecha_despacho}</small>}
                    </label>

                    <label className={`campo ${errores.hora_salida ? "campo--error" : ""}`}>
                        <span>
                            Hora de salida <small>(opcional)</small>
                        </span>
                        <input
                            type="time"
                            value={form.hora_salida}
                            onChange={(e) => poner("hora_salida", e.target.value)}
                            disabled={enviando}
                        />
                    </label>

                    <label className={`campo ${errores.cita ? "campo--error" : ""}`}>
                        <span>Cita</span>
                        <input
                            type="text"
                            value={form.cita}
                            onChange={(e) => poner("cita", e.target.value.toUpperCase())}
                            maxLength={50}
                            placeholder="Ej. A12345"
                            className="mono"
                            disabled={enviando}
                            autoComplete="off"
                        />
                        {errores.cita && <small className="campo__mensaje">{errores.cita}</small>}
                    </label>

                    <label className={`campo ${errores.fecha_cita ? "campo--error" : ""}`}>
                        <span>Fecha de cita</span>
                        <input
                            type="date"
                            value={form.fecha_cita}
                            onChange={(e) => poner("fecha_cita", e.target.value)}
                            min={form.fecha_despacho || undefined}
                            disabled={enviando}
                        />
                        {errores.fecha_cita && <small className="campo__mensaje">{errores.fecha_cita}</small>}
                    </label>

                    <label className={`campo ${errores.orden_venta ? "campo--error" : ""}`}>
                        <span>Orden de venta</span>
                        <input
                            type="text"
                            value={form.orden_venta}
                            onChange={(e) => poner("orden_venta", e.target.value.toUpperCase())}
                            maxLength={50}
                            className="mono"
                            disabled={enviando}
                            autoComplete="off"
                        />
                        {errores.orden_venta && <small className="campo__mensaje">{errores.orden_venta}</small>}
                    </label>

                    <label className={`campo ${errores.temperatura_salida ? "campo--error" : ""}`}>
                        <span>Temperatura de salida (°C)</span>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min={-5}
                            max={45}
                            value={form.temperatura_salida}
                            onChange={(e) => poner("temperatura_salida", e.target.value)}
                            placeholder="Ej. 13.5"
                            disabled={enviando}
                        />
                        {errores.temperatura_salida && (
                            <small className="campo__mensaje">{errores.temperatura_salida}</small>
                        )}
                    </label>

                    <label className={`campo campo--completo ${errores.observaciones ? "campo--error" : ""}`}>
                        <span>Observaciones</span>
                        <textarea
                            value={form.observaciones}
                            onChange={(e) => poner("observaciones", e.target.value)}
                            maxLength={250}
                            rows={2}
                            disabled={enviando}
                        />
                        <small className="campo__contador">{form.observaciones.length}/250</small>
                    </label>

                    {esCorreccion && (
                        <label className={`campo campo--completo ${errores.motivo ? "campo--error" : ""}`}>
                            <span>
                                Motivo de la corrección <em className="campo__requerido">*</em>
                            </span>
                            <textarea
                                value={motivo}
                                onChange={(e) => {
                                    setMotivo(e.target.value);
                                    if (errores.motivo) setErrores((x) => ({ ...x, motivo: undefined }));
                                }}
                                maxLength={250}
                                rows={3}
                                placeholder="Ej. El CEDIS reprogramó la cita para el día siguiente"
                                disabled={enviando}
                            />
                            {errores.motivo ? (
                                <small className="campo__mensaje">{errores.motivo}</small>
                            ) : (
                                <small className="campo__contador">{motivo.length}/250</small>
                            )}
                        </label>
                    )}
                </form>
            )}

            {borraInspeccion && (
                <p className="modal__advertencia">
                    Al cambiar el transporte se <strong>borra la inspección de inocuidad</strong> registrada: la
                    caja que se revisó ya no es la que va a cargar. Habrá que volver a inspeccionar antes de
                    cerrar.
                </p>
            )}
        </Modal>
    );
}
