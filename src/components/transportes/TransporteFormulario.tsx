import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Truck } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as transportesService from "../../services/transportes.service";
import type { Transporte } from "../../types/transporte";
import type { LineaFletera } from "../../types/lineaFletera";
import type { Operador } from "../../types/operador";
import type { Tractocamion } from "../../types/tractocamion";
import type { CajaRefrigerada } from "../../types/cajaRefrigerada";

// ============================================================================
// FORMULARIO DE TRANSPORTE (servicio) · alta y edición
// ============================================================================
// Un servicio se ARMA eligiendo una pieza de cada catálogo:
//     línea fletera + operador + tractocamión + caja refrigerada
//
// Reglas (las mismas del backend):
//   · las cuatro son obligatorias y deben estar activas
//   · operador, tracto y caja no pueden ser de OTRA línea; los
//     independientes (sin línea) sí se pueden combinar con cualquiera
//   · la combinación completa no se repite
//   · si el servicio ya tiene despachos, NO se puede cambiar su combinación:
//     se crea otro servicio y se asigna al borrador
//
// Al cambiar de línea, se limpian las piezas que pertenecían a otra.
// ============================================================================

type Campo = "linea" | "operador" | "tracto" | "caja" | "combinacion";

interface Props {
    transporte: Transporte | null;
    existentes: Transporte[];
    lineas: LineaFletera[];
    operadores: Operador[];
    tractos: Tractocamion[];
    cajas: CajaRefrigerada[];
    onGuardado: (mensaje: string, aviso?: string | null) => void;
    onCerrar: () => void;
}

/** ¿La pieza puede ir con esa línea? (suya o independiente) */
const compatible = (piezaLinea: number | null, linea: number | null) =>
    linea !== null && (piezaLinea === null || piezaLinea === linea);

const aTexto = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export default function TransporteFormulario({
    transporte,
    existentes,
    lineas,
    operadores,
    tractos,
    cajas,
    onGuardado,
    onCerrar
}: Props) {
    const esEdicion = transporte !== null;
    const totalDespachos = Number(transporte?.total_despachos ?? 0);
    const bloqueado = esEdicion && totalDespachos > 0;

    const [idLinea, setIdLinea] = useState(aTexto(transporte?.id_linea_fletera));
    const [idOperador, setIdOperador] = useState(aTexto(transporte?.id_operador));
    const [idTracto, setIdTracto] = useState(aTexto(transporte?.id_tractocamion));
    const [idCaja, setIdCaja] = useState(aTexto(transporte?.id_caja_refrigerada));

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const lineaNum = idLinea === "" ? null : Number(idLinea);

    // ---- Opciones: activas y compatibles con la línea elegida ----
    const opcionesLinea = useMemo(
        () =>
            lineas
                .filter((l) => Number(l.estado) === 1)
                .sort((a, b) => a.razon_social.localeCompare(b.razon_social, "es")),
        [lineas]
    );

    const opcionesOperador = useMemo(
        () =>
            operadores
                .filter((o) => Number(o.estado) === 1 && compatible(o.id_linea_fletera, lineaNum))
                .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
        [operadores, lineaNum]
    );

    const opcionesTracto = useMemo(
        () =>
            tractos
                .filter((t) => Number(t.estado) === 1 && compatible(t.id_linea_fletera, lineaNum))
                .sort((a, b) => a.placas.localeCompare(b.placas, "es")),
        [tractos, lineaNum]
    );

    const opcionesCaja = useMemo(
        () =>
            cajas
                .filter((c) => Number(c.estado) === 1 && compatible(c.id_linea_fletera, lineaNum))
                .sort((a, b) => a.placas.localeCompare(b.placas, "es")),
        [cajas, lineaNum]
    );

    const limpiarError = (c: Campo) => {
        if (errores[c] || errores.combinacion)
            setErrores((e) => ({ ...e, [c]: undefined, combinacion: undefined }));
    };

    // Al cambiar de línea se sueltan las piezas que eran de otra
    const cambiarLinea = (valor: string) => {
        setIdLinea(valor);
        limpiarError("linea");
        const nueva = valor === "" ? null : Number(valor);
        const op = operadores.find((o) => String(o.id_operador) === idOperador);
        const tr = tractos.find((t) => String(t.id_tractocamion) === idTracto);
        const cj = cajas.find((c) => String(c.id_caja_refrigerada) === idCaja);
        if (op && !compatible(op.id_linea_fletera, nueva)) setIdOperador("");
        if (tr && !compatible(tr.id_linea_fletera, nueva)) setIdTracto("");
        if (cj && !compatible(cj.id_linea_fletera, nueva)) setIdCaja("");
    };

    // ---- Vista previa del servicio ----
    const linea = lineas.find((l) => String(l.id_linea_fletera) === idLinea);
    const operador = operadores.find((o) => String(o.id_operador) === idOperador);
    const tracto = tractos.find((t) => String(t.id_tractocamion) === idTracto);
    const caja = cajas.find((c) => String(c.id_caja_refrigerada) === idCaja);

    // ---- Validación ----
    const validar = (): boolean => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (!idLinea) nuevos.linea = "Elige la línea fletera";
        if (!idOperador) nuevos.operador = "Elige el operador";
        if (!idTracto) nuevos.tracto = "Elige el tractocamión";
        if (!idCaja) nuevos.caja = "Elige la caja refrigerada";

        if (Object.keys(nuevos).length === 0) {
            const repetido = existentes.find(
                (t) =>
                    t.id_transporte !== transporte?.id_transporte &&
                    String(t.id_linea_fletera) === idLinea &&
                    String(t.id_operador) === idOperador &&
                    String(t.id_tractocamion) === idTracto &&
                    String(t.id_caja_refrigerada) === idCaja
            );
            if (repetido)
                nuevos.combinacion =
                    Number(repetido.estado) === 1
                        ? `Ese servicio ya existe (transporte #${repetido.id_transporte}). Úsalo en el despacho.`
                        : `Ese servicio ya existe pero está dado de baja (transporte #${repetido.id_transporte}). Reactívalo.`;
        }

        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    // ---- Guardar ----
    const guardar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorGeneral("");
        if (bloqueado || !validar()) return;

        setEnviando(true);
        try {
            const datos = {
                id_linea_fletera: Number(idLinea),
                id_operador: Number(idOperador),
                id_tractocamion: Number(idTracto),
                id_caja_refrigerada: Number(idCaja)
            };
            if (esEdicion) {
                const r = await transportesService.actualizarTransporte(transporte.id_transporte, datos);
                onGuardado("Transporte actualizado correctamente", r?.aviso);
            } else {
                const r = await transportesService.crearTransporte(datos);
                onGuardado("Transporte registrado correctamente", r?.aviso);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    const sinLinea = lineaNum === null;

    return (
        <Modal
            titulo={esEdicion ? `Editar transporte #${transporte.id_transporte}` : "Nuevo transporte"}
            subtitulo={
                esEdicion
                    ? transportesService.describirTransporte(transporte)
                    : "Arma el servicio con una pieza de cada catálogo"
            }
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        {bloqueado ? "Cerrar" : "Cancelar"}
                    </button>
                    {!bloqueado && (
                        <button
                            type="submit"
                            form="form-transporte"
                            className="boton boton--primario"
                            disabled={enviando}
                        >
                            {enviando ? (
                                <span className="spinner spinner--chico" />
                            ) : esEdicion ? (
                                "Guardar cambios"
                            ) : (
                                "Registrar"
                            )}
                        </button>
                    )}
                </>
            }
        >
            {bloqueado && (
                <p className="modal__advertencia">
                    Este servicio ya tiene {totalDespachos} despacho(s): no se puede cambiar su línea, operador,
                    tracto ni caja, porque la inspección de esos despachos quedaría ligada a otra unidad. Si cambió
                    alguna pieza, registra un <strong>transporte nuevo</strong> y asígnalo al borrador.
                </p>
            )}

            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}
            {errores.combinacion && <div className="alerta alerta--error">{errores.combinacion}</div>}

            <form id="form-transporte" className="formulario" onSubmit={guardar} noValidate>
                <label className={`campo campo--completo ${errores.linea ? "campo--error" : ""}`}>
                    <span>
                        Línea fletera <em className="campo__requerido">*</em>
                    </span>
                    <select
                        value={idLinea}
                        onChange={(e) => cambiarLinea(e.target.value)}
                        disabled={enviando || bloqueado}
                        autoFocus={!bloqueado}
                    >
                        <option value="">Selecciona…</option>
                        {opcionesLinea.map((l) => (
                            <option key={l.id_linea_fletera} value={l.id_linea_fletera}>
                                {l.razon_social}
                            </option>
                        ))}
                    </select>
                    {errores.linea && <small className="campo__mensaje">{errores.linea}</small>}
                </label>

                <label className={`campo campo--completo ${errores.operador ? "campo--error" : ""}`}>
                    <span>
                        Operador <em className="campo__requerido">*</em>
                    </span>
                    <select
                        value={idOperador}
                        onChange={(e) => {
                            setIdOperador(e.target.value);
                            limpiarError("operador");
                        }}
                        disabled={enviando || bloqueado || sinLinea}
                    >
                        <option value="">{sinLinea ? "Primero elige la línea" : "Selecciona…"}</option>
                        {opcionesOperador.map((o) => (
                            <option key={o.id_operador} value={o.id_operador}>
                                {o.nombre} · {o.celular}
                                {o.id_linea_fletera === null ? " (independiente)" : ""}
                            </option>
                        ))}
                    </select>
                    {errores.operador ? (
                        <small className="campo__mensaje">{errores.operador}</small>
                    ) : (
                        !sinLinea &&
                        opcionesOperador.length === 0 && (
                            <small className="campo__ayuda">
                                No hay operadores activos de esta línea ni independientes.
                            </small>
                        )
                    )}
                </label>

                <label className={`campo ${errores.tracto ? "campo--error" : ""}`}>
                    <span>
                        Tractocamión <em className="campo__requerido">*</em>
                    </span>
                    <select
                        value={idTracto}
                        onChange={(e) => {
                            setIdTracto(e.target.value);
                            limpiarError("tracto");
                        }}
                        disabled={enviando || bloqueado || sinLinea}
                    >
                        <option value="">{sinLinea ? "Primero elige la línea" : "Selecciona…"}</option>
                        {opcionesTracto.map((t) => (
                            <option key={t.id_tractocamion} value={t.id_tractocamion}>
                                {t.placas} · {t.numero_economico}
                                {t.id_linea_fletera === null ? " (indep.)" : ""}
                            </option>
                        ))}
                    </select>
                    {errores.tracto && <small className="campo__mensaje">{errores.tracto}</small>}
                </label>

                <label className={`campo ${errores.caja ? "campo--error" : ""}`}>
                    <span>
                        Caja refrigerada <em className="campo__requerido">*</em>
                    </span>
                    <select
                        value={idCaja}
                        onChange={(e) => {
                            setIdCaja(e.target.value);
                            limpiarError("caja");
                        }}
                        disabled={enviando || bloqueado || sinLinea}
                    >
                        <option value="">{sinLinea ? "Primero elige la línea" : "Selecciona…"}</option>
                        {opcionesCaja.map((c) => (
                            <option key={c.id_caja_refrigerada} value={c.id_caja_refrigerada}>
                                {c.placas} · {c.numero_economico}
                                {c.largo_pies ? ` · ${c.largo_pies}'` : ""}
                                {c.id_linea_fletera === null ? " (indep.)" : ""}
                            </option>
                        ))}
                    </select>
                    {errores.caja && <small className="campo__mensaje">{errores.caja}</small>}
                </label>
            </form>

            {linea && operador && tracto && caja && !bloqueado && (
                <div className="servicio-previa">
                    <Truck size={26} />
                    <div>
                        <strong>{linea.razon_social}</strong>
                        <small>
                            {operador.nombre} · Tracto <span className="mono">{tracto.placas}</span> · Caja{" "}
                            <span className="mono">{caja.placas}</span>
                        </small>
                    </div>
                </div>
            )}

            {!bloqueado && (
                <p className="formulario__nota">
                    ¿Falta una pieza? Regístrala primero en su catálogo (Líneas fleteras, Operadores,
                    Tractocamiones o Cajas refrigeradas).
                </p>
            )}
        </Modal>
    );
}
