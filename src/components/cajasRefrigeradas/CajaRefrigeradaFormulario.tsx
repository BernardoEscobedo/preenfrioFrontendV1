import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as cajasService from "../../services/cajasRefrigeradas.service";
import { normalizarPlaca } from "../../services/tractocamiones.service";
import type { CajaRefrigerada } from "../../types/cajaRefrigerada";
import type { LineaFletera } from "../../types/lineaFletera";

// ============================================================================
// FORMULARIO DE CAJA REFRIGERADA (alta y edición)
// ============================================================================
// Reglas (las mismas del backend):
//   · línea fletera: OPCIONAL
//   · placas: obligatorias, hasta 10 sin guiones ni espacios, ÚNICAS
//   · número económico: obligatorio, hasta 10
//   · largo en pies: opcional, entero mayor a 0 (48, 53…)
//
// La caja es la pieza que se inspecciona, pero su inspección NO se captura
// aquí: es de cada despacho.
// ============================================================================

const LARGOS_COMUNES = [40, 48, 53];

type Campo = "placas" | "numero_economico" | "largo_pies";

interface Props {
    caja: CajaRefrigerada | null;
    existentes: CajaRefrigerada[];
    lineas: LineaFletera[];
    lineaInicial?: number | null;
    onGuardado: (mensaje: string, aviso?: string | null) => void;
    onCerrar: () => void;
}

export default function CajaRefrigeradaFormulario({
    caja,
    existentes,
    lineas,
    lineaInicial,
    onGuardado,
    onCerrar
}: Props) {
    const esEdicion = caja !== null;

    const [idLinea, setIdLinea] = useState<string>(String(caja?.id_linea_fletera ?? lineaInicial ?? ""));
    const [placas, setPlacas] = useState(caja?.placas ?? "");
    const [economico, setEconomico] = useState(caja?.numero_economico ?? "");
    const [largo, setLargo] = useState(caja?.largo_pies ? String(caja.largo_pies) : "");

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const opcionesLinea = useMemo(
        () =>
            lineas
                .filter((l) => Number(l.estado) === 1 || l.id_linea_fletera === caja?.id_linea_fletera)
                .sort((a, b) => a.razon_social.localeCompare(b.razon_social, "es")),
        [lineas, caja]
    );

    const placasLimpias = normalizarPlaca(placas);
    const economicoLimpio = economico.trim().toUpperCase();
    const lineaNum = idLinea === "" ? null : Number(idLinea);

    const cambiaLinea = esEdicion && (caja.id_linea_fletera ?? null) !== lineaNum;
    const enUso = Number(caja?.transportes_activos ?? 0) > 0;

    const limpiarError = (c: Campo) => {
        if (errores[c]) setErrores((e) => ({ ...e, [c]: undefined }));
    };

    const validar = (): boolean => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (!placasLimpias) nuevos.placas = "Escribe las placas";
        else if (placasLimpias.length > 10) nuevos.placas = "Máximo 10 caracteres sin guiones";
        else {
            const repetida = existentes.find(
                (c) =>
                    c.id_caja_refrigerada !== caja?.id_caja_refrigerada &&
                    normalizarPlaca(c.placas) === placasLimpias
            );
            if (repetida)
                nuevos.placas =
                    Number(repetida.estado) === 1
                        ? "Esas placas ya están registradas"
                        : "Esas placas ya existen (dadas de baja): reactiva la caja";
        }

        if (!economicoLimpio) nuevos.numero_economico = "Escribe el número económico";
        else if (economicoLimpio.length > 10) nuevos.numero_economico = "Máximo 10 caracteres";

        if (largo.trim() !== "") {
            const n = Number(largo);
            if (!Number.isInteger(n) || n <= 0) nuevos.largo_pies = "Entero mayor a 0 (ej. 48 o 53)";
        }

        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    const guardar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorGeneral("");
        if (!validar()) return;

        setEnviando(true);
        try {
            const datos = {
                id_linea_fletera: lineaNum,
                placas,
                numero_economico: economico,
                largo_pies: largo.trim() === "" ? null : Number(largo)
            };
            if (esEdicion) {
                const r = await cajasService.actualizarCaja(caja.id_caja_refrigerada, datos);
                onGuardado("Caja refrigerada actualizada correctamente", r?.aviso);
            } else {
                const r = await cajasService.crearCaja(datos);
                onGuardado("Caja refrigerada registrada correctamente", r?.aviso);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={esEdicion ? "Editar caja refrigerada" : "Nueva caja refrigerada"}
            subtitulo={esEdicion ? `Placas ${caja.placas}` : "El remolque donde viaja la fruta"}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-caja" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Registrar"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-caja" className="formulario" onSubmit={guardar} noValidate>
                <label className="campo campo--completo">
                    <span>
                        Línea fletera <small>(opcional)</small>
                    </span>
                    <select value={idLinea} onChange={(e) => setIdLinea(e.target.value)} disabled={enviando}>
                        <option value="">Independiente (sin línea)</option>
                        {opcionesLinea.map((l) => (
                            <option key={l.id_linea_fletera} value={l.id_linea_fletera}>
                                {l.razon_social}
                                {Number(l.estado) !== 1 ? " (dada de baja)" : ""}
                            </option>
                        ))}
                    </select>
                </label>

                <label className={`campo ${errores.placas ? "campo--error" : ""}`}>
                    <span>
                        Placas <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={placas}
                        onChange={(e) => {
                            setPlacas(e.target.value.toUpperCase());
                            limpiarError("placas");
                        }}
                        maxLength={14}
                        placeholder="Ej. 8UJ4521"
                        className="mono"
                        autoFocus
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.placas ? (
                        <small className="campo__mensaje">{errores.placas}</small>
                    ) : (
                        <small className="campo__ayuda">
                            Se guarda como <strong className="mono">{placasLimpias || "—"}</strong>
                        </small>
                    )}
                </label>

                <label className={`campo ${errores.numero_economico ? "campo--error" : ""}`}>
                    <span>
                        Número económico <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={economico}
                        onChange={(e) => {
                            setEconomico(e.target.value.toUpperCase());
                            limpiarError("numero_economico");
                        }}
                        maxLength={10}
                        placeholder="Ej. C-118"
                        className="mono"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.numero_economico && <small className="campo__mensaje">{errores.numero_economico}</small>}
                </label>

                <label className={`campo ${errores.largo_pies ? "campo--error" : ""}`}>
                    <span>
                        Largo en pies <small>(opcional)</small>
                    </span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={largo}
                        onChange={(e) => {
                            setLargo(e.target.value);
                            limpiarError("largo_pies");
                        }}
                        list="largos-comunes"
                        placeholder="Ej. 53"
                        disabled={enviando}
                    />
                    <datalist id="largos-comunes">
                        {LARGOS_COMUNES.map((l) => (
                            <option key={l} value={l} />
                        ))}
                    </datalist>
                    {errores.largo_pies && <small className="campo__mensaje">{errores.largo_pies}</small>}
                </label>
            </form>

            {cambiaLinea && enUso && (
                <p className="modal__advertencia">
                    Esta caja ya forma parte de {caja.transportes_activos} transporte(s) activo(s). El sistema no
                    permite cambiarle la línea fletera.
                </p>
            )}
        </Modal>
    );
}
