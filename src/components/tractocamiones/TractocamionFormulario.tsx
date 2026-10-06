import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as tractosService from "../../services/tractocamiones.service";
import { normalizarPlaca } from "../../services/tractocamiones.service";
import type { Tractocamion } from "../../types/tractocamion";
import type { LineaFletera } from "../../types/lineaFletera";

// ============================================================================
// FORMULARIO DE TRACTOCAMIÓN (alta y edición)
// ============================================================================
// Reglas (las mismas del backend):
//   · línea fletera: OPCIONAL (unidad independiente)
//   · placas: obligatorias, hasta 10 caracteres SIN guiones ni espacios,
//     ÚNICAS (en el andén se capturan de mil formas)
//   · número económico: obligatorio, hasta 10 caracteres
// ============================================================================

type Campo = "placas" | "numero_economico";

interface Props {
    tracto: Tractocamion | null;
    existentes: Tractocamion[];
    lineas: LineaFletera[];
    lineaInicial?: number | null;
    onGuardado: (mensaje: string, aviso?: string | null) => void;
    onCerrar: () => void;
}

export default function TractocamionFormulario({
    tracto,
    existentes,
    lineas,
    lineaInicial,
    onGuardado,
    onCerrar
}: Props) {
    const esEdicion = tracto !== null;

    const [idLinea, setIdLinea] = useState<string>(String(tracto?.id_linea_fletera ?? lineaInicial ?? ""));
    const [placas, setPlacas] = useState(tracto?.placas ?? "");
    const [economico, setEconomico] = useState(tracto?.numero_economico ?? "");

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const opcionesLinea = useMemo(
        () =>
            lineas
                .filter((l) => Number(l.estado) === 1 || l.id_linea_fletera === tracto?.id_linea_fletera)
                .sort((a, b) => a.razon_social.localeCompare(b.razon_social, "es")),
        [lineas, tracto]
    );

    const placasLimpias = normalizarPlaca(placas);
    const economicoLimpio = economico.trim().toUpperCase();
    const lineaNum = idLinea === "" ? null : Number(idLinea);

    const cambiaLinea = esEdicion && (tracto.id_linea_fletera ?? null) !== lineaNum;
    const enUso = Number(tracto?.transportes_activos ?? 0) > 0;

    const limpiarError = (c: Campo) => {
        if (errores[c]) setErrores((e) => ({ ...e, [c]: undefined }));
    };

    const validar = (): boolean => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (!placasLimpias) nuevos.placas = "Escribe las placas";
        else if (placasLimpias.length > 10) nuevos.placas = "Máximo 10 caracteres sin guiones";
        else {
            const repetido = existentes.find(
                (t) => t.id_tractocamion !== tracto?.id_tractocamion && normalizarPlaca(t.placas) === placasLimpias
            );
            if (repetido)
                nuevos.placas =
                    Number(repetido.estado) === 1
                        ? "Esas placas ya están registradas"
                        : "Esas placas ya existen (dadas de baja): reactiva el tractocamión";
        }

        if (!economicoLimpio) nuevos.numero_economico = "Escribe el número económico";
        else if (economicoLimpio.length > 10) nuevos.numero_economico = "Máximo 10 caracteres";

        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    const guardar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorGeneral("");
        if (!validar()) return;

        setEnviando(true);
        try {
            const datos = { id_linea_fletera: lineaNum, placas, numero_economico: economico };
            if (esEdicion) {
                const r = await tractosService.actualizarTractocamion(tracto.id_tractocamion, datos);
                onGuardado("Tractocamión actualizado correctamente", r?.aviso);
            } else {
                const r = await tractosService.crearTractocamion(datos);
                onGuardado("Tractocamión registrado correctamente", r?.aviso);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={esEdicion ? "Editar tractocamión" : "Nuevo tractocamión"}
            subtitulo={esEdicion ? `Placas ${tracto.placas}` : "La unidad motriz que jala la caja"}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-tracto" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Registrar"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-tracto" className="formulario" onSubmit={guardar} noValidate>
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
                        placeholder="Ej. 15AN7H"
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
                        placeholder="Ej. T-042"
                        className="mono"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.numero_economico && <small className="campo__mensaje">{errores.numero_economico}</small>}
                </label>
            </form>

            {cambiaLinea && enUso && (
                <p className="modal__advertencia">
                    Este tractocamión ya forma parte de {tracto.transportes_activos} transporte(s) activo(s). El
                    sistema no permite cambiarle la línea fletera.
                </p>
            )}
        </Modal>
    );
}
