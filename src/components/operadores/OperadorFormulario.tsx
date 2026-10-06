import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as operadoresService from "../../services/operadores.service";
import type { Operador } from "../../types/operador";
import type { LineaFletera } from "../../types/lineaFletera";

// ============================================================================
// FORMULARIO DE OPERADOR (alta y edición)
// ============================================================================
// Reglas (las mismas del backend):
//   · línea fletera: OPCIONAL (puede ser independiente)
//   · nombre: obligatorio, hasta 100 caracteres, en mayúsculas
//   · celular: exactamente 10 dígitos, ÚNICO
//
// ⚠️ Si el operador ya forma parte de algún transporte, el backend no deja
// cambiarle la línea: ese servicio quedaría con un operador de otra empresa.
// ============================================================================

const soloDigitos = (t: string) => t.replace(/\D/g, "");

type Campo = "nombre" | "celular";

interface Props {
    operador: Operador | null;
    existentes: Operador[];
    lineas: LineaFletera[];
    lineaInicial?: number | null;
    onGuardado: (mensaje: string, aviso?: string | null) => void;
    onCerrar: () => void;
}

export default function OperadorFormulario({
    operador,
    existentes,
    lineas,
    lineaInicial,
    onGuardado,
    onCerrar
}: Props) {
    const esEdicion = operador !== null;

    const [idLinea, setIdLinea] = useState<string>(
        String(operador?.id_linea_fletera ?? lineaInicial ?? "")
    );
    const [nombre, setNombre] = useState(operador?.nombre ?? "");
    const [celular, setCelular] = useState(operador?.celular ?? "");

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    // Activas, más la actual aunque esté de baja (para no perderla al editar)
    const opcionesLinea = useMemo(
        () =>
            lineas
                .filter((l) => Number(l.estado) === 1 || l.id_linea_fletera === operador?.id_linea_fletera)
                .sort((a, b) => a.razon_social.localeCompare(b.razon_social, "es")),
        [lineas, operador]
    );

    const nombreLimpio = nombre.trim().replace(/\s+/g, " ").toUpperCase();
    const celularLimpio = soloDigitos(celular);
    const lineaNum = idLinea === "" ? null : Number(idLinea);

    const cambiaLinea = esEdicion && (operador.id_linea_fletera ?? null) !== lineaNum;
    const enUso = Number(operador?.transportes_activos ?? 0) > 0;

    const limpiarError = (c: Campo) => {
        if (errores[c]) setErrores((e) => ({ ...e, [c]: undefined }));
    };

    const validar = (): boolean => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (!nombreLimpio) nuevos.nombre = "Escribe el nombre del operador";
        else if (nombreLimpio.length > 100) nuevos.nombre = "Máximo 100 caracteres";

        if (!celularLimpio) nuevos.celular = "Escribe el celular: con él se le localiza";
        else if (celularLimpio.length !== 10) nuevos.celular = "Debe tener exactamente 10 dígitos";
        else {
            const repetido = existentes.find(
                (o) => o.id_operador !== operador?.id_operador && soloDigitos(o.celular) === celularLimpio
            );
            if (repetido)
                nuevos.celular =
                    Number(repetido.estado) === 1
                        ? `Ya pertenece a ${repetido.nombre}`
                        : `Pertenece a ${repetido.nombre} (dado de baja): reactívalo en vez de crear otro`;
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
            const datos = { id_linea_fletera: lineaNum, nombre, celular };
            if (esEdicion) {
                const r = await operadoresService.actualizarOperador(operador.id_operador, datos);
                onGuardado("Operador actualizado correctamente", r?.aviso);
            } else {
                const r = await operadoresService.crearOperador(datos);
                onGuardado("Operador registrado correctamente", r?.aviso);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={esEdicion ? "Editar operador" : "Nuevo operador"}
            subtitulo={esEdicion ? operador.nombre : "Quien maneja la unidad"}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-operador" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Registrar"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-operador" className="formulario" onSubmit={guardar} noValidate>
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

                <label className={`campo campo--completo ${errores.nombre ? "campo--error" : ""}`}>
                    <span>
                        Nombre completo <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={nombre}
                        onChange={(e) => {
                            setNombre(e.target.value);
                            limpiarError("nombre");
                        }}
                        maxLength={100}
                        placeholder="Ej. JUAN PÉREZ LÓPEZ"
                        autoFocus
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.nombre && <small className="campo__mensaje">{errores.nombre}</small>}
                </label>

                <label className={`campo ${errores.celular ? "campo--error" : ""}`}>
                    <span>
                        Celular <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="tel"
                        inputMode="numeric"
                        value={celular}
                        onChange={(e) => {
                            setCelular(e.target.value);
                            limpiarError("celular");
                        }}
                        maxLength={14}
                        placeholder="Ej. 9621234567"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.celular ? (
                        <small className="campo__mensaje">{errores.celular}</small>
                    ) : (
                        <small className="campo__ayuda">{celularLimpio.length}/10 dígitos</small>
                    )}
                </label>
            </form>

            {cambiaLinea && enUso && (
                <p className="modal__advertencia">
                    Este operador ya forma parte de {operador.transportes_activos} transporte(s) activo(s). El
                    sistema no permite cambiarle la línea: crea un servicio nuevo con la línea correcta.
                </p>
            )}
        </Modal>
    );
}
