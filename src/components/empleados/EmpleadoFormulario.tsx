import { useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as empleadosService from "../../services/empleados.service";
import type { Empleado, EmpleadoForm } from "../../types/empleado";

// ============================================================================
// FORMULARIO DE EMPLEADO (alta y edición)
// ============================================================================
// empleado = null → alta · empleado con datos → edición.
//
// Los límites son los de las columnas de la BD. Se validan aquí para avisar
// antes de enviar; el backend vuelve a validar de todos modos.
//
// Turno y zona son texto libre, pero sugieren los valores que ya existen
// (datalist) para que no terminen "MATUTINO", "Matutino" y "matutino" como
// tres turnos distintos.
// ============================================================================

type Campo = keyof EmpleadoForm;

const CAMPOS: { campo: Campo; etiqueta: string; max: number; placeholder: string }[] = [
    { campo: "nombre", etiqueta: "Nombre(s)", max: 60, placeholder: "Ej. Juan Carlos" },
    { campo: "apellidos", etiqueta: "Apellidos", max: 80, placeholder: "Ej. Pérez López" },
    { campo: "turno", etiqueta: "Turno", max: 60, placeholder: "Ej. MATUTINO" },
    { campo: "zona", etiqueta: "Zona", max: 60, placeholder: "Ej. HUEHUETAN" }
];

interface Props {
    empleado: Empleado | null;
    turnos: string[];
    zonas: string[];
    onGuardado: (mensaje: string) => void;
    onCerrar: () => void;
}

export default function EmpleadoFormulario({ empleado, turnos, zonas, onGuardado, onCerrar }: Props) {
    const esEdicion = empleado !== null;

    const [form, setForm] = useState<EmpleadoForm>({
        nombre: empleado?.nombre ?? "",
        apellidos: empleado?.apellidos ?? "",
        turno: empleado?.turno ?? "",
        zona: empleado?.zona ?? ""
    });
    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const cambiar = (campo: Campo, valor: string) => {
        setForm((f) => ({ ...f, [campo]: valor }));
        if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    };

    const validar = (): boolean => {
        const nuevos: Partial<Record<Campo, string>> = {};

        for (const { campo, etiqueta, max } of CAMPOS) {
            const valor = form[campo].trim();
            if (!valor) nuevos[campo] = `${etiqueta} es obligatorio`;
            else if (valor.length > max) nuevos[campo] = `Máximo ${max} caracteres`;
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
            if (esEdicion) {
                await empleadosService.actualizarEmpleado(empleado.id_empleado, form);
                onGuardado("Empleado actualizado correctamente");
            } else {
                await empleadosService.crearEmpleado(form);
                onGuardado("Empleado registrado correctamente");
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    const sugerencias: Partial<Record<Campo, string[]>> = { turno: turnos, zona: zonas };

    return (
        <Modal
            titulo={esEdicion ? "Editar empleado" : "Nuevo empleado"}
            subtitulo={
                esEdicion
                    ? `${empleado.nombre} ${empleado.apellidos}`
                    : "Captura los datos del nuevo integrante del personal"
            }
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-empleado" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Registrar"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-empleado" className="formulario" onSubmit={guardar} noValidate>
                {CAMPOS.map(({ campo, etiqueta, max, placeholder }, i) => {
                    const lista = sugerencias[campo];
                    return (
                        <label key={campo} className={`campo ${errores[campo] ? "campo--error" : ""}`}>
                            <span>
                                {etiqueta} <em className="campo__requerido">*</em>
                            </span>
                            <input
                                type="text"
                                value={form[campo]}
                                onChange={(e) => cambiar(campo, e.target.value)}
                                maxLength={max}
                                placeholder={placeholder}
                                list={lista ? `sugerencias-${campo}` : undefined}
                                autoFocus={i === 0}
                                disabled={enviando}
                                autoComplete="off"
                            />
                            {lista && (
                                <datalist id={`sugerencias-${campo}`}>
                                    {lista.map((v) => (
                                        <option key={v} value={v} />
                                    ))}
                                </datalist>
                            )}
                            {errores[campo] && <small className="campo__mensaje">{errores[campo]}</small>}
                        </label>
                    );
                })}
            </form>

            {esEdicion && empleado.tiene_usuario && (
                <p className="formulario__nota">
                    Tiene la cuenta <strong>{empleado.usuario}</strong>. El nombre que cambies aquí es el que
                    se mostrará en el sistema al iniciar sesión.
                </p>
            )}
        </Modal>
    );
}
