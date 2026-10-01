import { useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as productoresService from "../../services/productores.service";
import type { Productor } from "../../types/productor";

// ============================================================================
// FORMULARIO DE PRODUCTOR (alta y edición)
// ============================================================================
// CÓDIGO
//   Hasta 4 caracteres, sin espacios. Los 2 ÚLTIMOS van al código de lote
//   (posiciones 2 y 3: B[12]015-...). Por eso:
//     · se avisa si dos productores comparten esos 2 últimos caracteres:
//       sus lotes se verían iguales en esa parte
//     · al editar se advierte que cambiarlo solo afecta lotes futuros
//
// NOMBRE se guarda en mayúsculas, como el resto de catálogos.
// ============================================================================

const PATRON_CODIGO = /^[A-Z0-9]{1,4}$/;

interface Props {
    productor: Productor | null;
    existentes: Productor[];
    onGuardado: (mensaje: string, aviso?: string | null) => void;
    onCerrar: () => void;
}

export default function ProductorFormulario({ productor, existentes, onGuardado, onCerrar }: Props) {
    const esEdicion = productor !== null;

    const [codigo, setCodigo] = useState(productor?.codigo_productor ?? "");
    const [nombre, setNombre] = useState(productor?.nombre ?? "");
    const [errores, setErrores] = useState<{ codigo?: string; nombre?: string }>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const codigoLimpio = codigo.trim().toUpperCase().replace(/\s+/g, "");
    const parteLote = codigoLimpio.slice(-2).padStart(2, "0");

    // Otro productor cuyos 2 últimos caracteres coinciden
    const choqueLote = codigoLimpio
        ? existentes.find(
              (p) =>
                  p.id_productor !== productor?.id_productor &&
                  p.codigo_productor.toUpperCase() !== codigoLimpio &&
                  p.codigo_productor.toUpperCase().slice(-2).padStart(2, "0") === parteLote
          )
        : undefined;

    const cambiaCodigo = esEdicion && codigoLimpio !== productor.codigo_productor.toUpperCase();

    const validar = (): boolean => {
        const nuevos: { codigo?: string; nombre?: string } = {};
        const n = nombre.trim();

        if (!codigoLimpio) nuevos.codigo = "Escribe el código del productor";
        else if (!PATRON_CODIGO.test(codigoLimpio)) nuevos.codigo = "De 1 a 4 letras o números, sin espacios ni símbolos";
        else if (
            existentes.some(
                (p) => p.id_productor !== productor?.id_productor && p.codigo_productor.toUpperCase() === codigoLimpio
            )
        )
            nuevos.codigo = "Ya existe un productor con ese código";

        if (!n) nuevos.nombre = "Escribe el nombre del productor";
        else if (n.length > 100) nuevos.nombre = "Máximo 100 caracteres";

        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    const guardar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorGeneral("");
        if (!validar()) return;

        setEnviando(true);

        try {
            const datos = { codigo_productor: codigo, nombre };
            if (esEdicion) {
                const r = await productoresService.actualizarProductor(productor.id_productor, datos);
                onGuardado("Productor actualizado correctamente", r?.aviso);
            } else {
                const r = await productoresService.crearProductor(datos);
                onGuardado("Productor registrado correctamente", r?.aviso);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={esEdicion ? "Editar productor" : "Nuevo productor"}
            subtitulo={esEdicion ? productor.nombre : "Registra al productor dueño de las fincas"}
            onCerrar={onCerrar}
            bloqueado={enviando}
            ancho="chico"
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-productor" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Registrar"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-productor" className="formulario formulario--una" onSubmit={guardar} noValidate>
                <label className={`campo ${errores.codigo ? "campo--error" : ""}`}>
                    <span>
                        Código <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={codigo}
                        onChange={(e) => {
                            setCodigo(e.target.value.toUpperCase().replace(/\s+/g, ""));
                            setErrores((x) => ({ ...x, codigo: undefined }));
                        }}
                        maxLength={4}
                        placeholder="Ej. 12"
                        autoFocus
                        disabled={enviando}
                        autoComplete="off"
                        className="mono"
                    />
                    {errores.codigo ? (
                        <small className="campo__mensaje">{errores.codigo}</small>
                    ) : codigoLimpio ? (
                        <small className="campo__ayuda">
                            En el código de lote aparecerá como <strong className="mono">X{parteLote}FFF-…</strong>
                        </small>
                    ) : (
                        <small className="campo__ayuda">Los 2 últimos caracteres forman parte del código de lote.</small>
                    )}
                </label>

                <label className={`campo ${errores.nombre ? "campo--error" : ""}`}>
                    <span>
                        Nombre <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={nombre}
                        onChange={(e) => {
                            setNombre(e.target.value);
                            setErrores((x) => ({ ...x, nombre: undefined }));
                        }}
                        maxLength={100}
                        placeholder="Ej. AGRICOLA LOS MANGOS SPR"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.nombre && <small className="campo__mensaje">{errores.nombre}</small>}
                </label>
            </form>

            {choqueLote && !errores.codigo && (
                <p className="modal__advertencia">
                    <strong>{choqueLote.nombre}</strong> (código {choqueLote.codigo_productor}) termina igual: en el
                    código de lote los dos productores se verán como <strong className="mono">{parteLote}</strong>.
                </p>
            )}

            {cambiaCodigo && (
                <p className="modal__advertencia">
                    Cambiar el código solo afecta los lotes que se generen de aquí en adelante. Los lotes ya
                    planeados conservan el código anterior.
                </p>
            )}
        </Modal>
    );
}
