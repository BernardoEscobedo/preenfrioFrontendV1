import { useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as lineasService from "../../services/lineasFleteras.service";
import type { LineaFletera } from "../../types/lineaFletera";

// ============================================================================
// FORMULARIO DE LÍNEA FLETERA (alta y edición)
// ============================================================================
// Reglas (las mismas del backend):
//   · razón social: obligatoria, hasta 100 caracteres, en mayúsculas
//   · RFC: obligatorio, formato mexicano (12 moral / 13 física), ÚNICO
//     comparado sin espacios ni guiones
//   · teléfono de contacto: exactamente 10 dígitos
//
// ⚠️ EDITAR CAMBIA EL HISTÓRICO
//   Los despachos leen la razón social EN VIVO de este catálogo. Corregirla
//   aquí también cambia lo que muestran los despachos ya cerrados; el
//   backend avisa cuántos se ven afectados.
// ============================================================================

const PATRON_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

const limpiarRfc = (t: string) => t.toUpperCase().replace(/[^A-ZÑ&0-9]/g, "");
const soloDigitos = (t: string) => t.replace(/\D/g, "");

type Campo = "razon_social" | "rfc" | "telefono_contacto";

interface Props {
    linea: LineaFletera | null;
    existentes: LineaFletera[];
    onGuardado: (mensaje: string, aviso?: string | null) => void;
    onCerrar: () => void;
}

export default function LineaFleteraFormulario({ linea, existentes, onGuardado, onCerrar }: Props) {
    const esEdicion = linea !== null;

    const [razonSocial, setRazonSocial] = useState(linea?.razon_social ?? "");
    const [rfc, setRfc] = useState(linea?.rfc ?? "");
    const [telefono, setTelefono] = useState(linea?.telefono_contacto ?? "");

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const razonLimpia = razonSocial.trim().replace(/\s+/g, " ").toUpperCase();
    const rfcLimpio = limpiarRfc(rfc);
    const telefonoLimpio = soloDigitos(telefono);

    const limpiarError = (c: Campo) => {
        if (errores[c]) setErrores((e) => ({ ...e, [c]: undefined }));
    };

    // ---- Validación ----
    const validar = (): boolean => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (!razonLimpia) nuevos.razon_social = "Escribe la razón social";
        else if (razonLimpia.length > 100) nuevos.razon_social = "Máximo 100 caracteres";

        if (!rfcLimpio) nuevos.rfc = "Escribe el RFC";
        else if (!PATRON_RFC.test(rfcLimpio))
            nuevos.rfc = "Formato no válido: 12 caracteres (moral) o 13 (física)";
        else {
            const repetido = existentes.find(
                (l) => l.id_linea_fletera !== linea?.id_linea_fletera && limpiarRfc(l.rfc) === rfcLimpio
            );
            if (repetido)
                nuevos.rfc =
                    Number(repetido.estado) === 1
                        ? `Ya lo usa ${repetido.razon_social}`
                        : `Ya lo usa ${repetido.razon_social} (dada de baja): reactívala en vez de crear otra`;
        }

        if (!telefonoLimpio) nuevos.telefono_contacto = "Escribe el teléfono de contacto";
        else if (telefonoLimpio.length !== 10) nuevos.telefono_contacto = "Debe tener exactamente 10 dígitos";

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
            const datos = { razon_social: razonSocial, rfc, telefono_contacto: telefono };
            if (esEdicion) {
                const r = await lineasService.actualizarLinea(linea.id_linea_fletera, datos);
                onGuardado("Línea fletera actualizada correctamente", r?.aviso);
            } else {
                const r = await lineasService.crearLinea(datos);
                onGuardado("Línea fletera registrada correctamente", r?.aviso);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    const cambiaVisible =
        esEdicion && (linea.razon_social.toUpperCase() !== razonLimpia || limpiarRfc(linea.rfc) !== rfcLimpio);

    return (
        <Modal
            titulo={esEdicion ? "Editar línea fletera" : "Nueva línea fletera"}
            subtitulo={esEdicion ? linea.razon_social : "La empresa transportista que presta el servicio"}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-linea" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Registrar"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-linea" className="formulario" onSubmit={guardar} noValidate>
                <label className={`campo campo--completo ${errores.razon_social ? "campo--error" : ""}`}>
                    <span>
                        Razón social <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={razonSocial}
                        onChange={(e) => {
                            setRazonSocial(e.target.value);
                            limpiarError("razon_social");
                        }}
                        maxLength={100}
                        placeholder="Ej. TRANSPORTES DEL SURESTE SA DE CV"
                        autoFocus
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.razon_social && <small className="campo__mensaje">{errores.razon_social}</small>}
                </label>

                <label className={`campo ${errores.rfc ? "campo--error" : ""}`}>
                    <span>
                        RFC <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={rfc}
                        onChange={(e) => {
                            setRfc(e.target.value.toUpperCase());
                            limpiarError("rfc");
                        }}
                        maxLength={16}
                        placeholder="Ej. TSU010203AB1"
                        className="mono"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.rfc ? (
                        <small className="campo__mensaje">{errores.rfc}</small>
                    ) : (
                        <small className="campo__ayuda">Se guarda sin espacios ni guiones.</small>
                    )}
                </label>

                <label className={`campo ${errores.telefono_contacto ? "campo--error" : ""}`}>
                    <span>
                        Teléfono de contacto <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="tel"
                        inputMode="numeric"
                        value={telefono}
                        onChange={(e) => {
                            setTelefono(e.target.value);
                            limpiarError("telefono_contacto");
                        }}
                        maxLength={14}
                        placeholder="Ej. 9621234567"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.telefono_contacto ? (
                        <small className="campo__mensaje">{errores.telefono_contacto}</small>
                    ) : (
                        <small className="campo__ayuda">{telefonoLimpio.length}/10 dígitos</small>
                    )}
                </label>
            </form>

            {cambiaVisible && (
                <p className="modal__advertencia">
                    Los despachos leen estos datos en vivo: la corrección también se verá en los despachos ya
                    registrados con esta línea.
                </p>
            )}
        </Modal>
    );
}
