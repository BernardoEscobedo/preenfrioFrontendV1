import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as cedisService from "../../services/cedis.service";
import type { Cedis } from "../../types/cedis";

// ============================================================================
// FORMULARIO DE CLIENTE / CEDIS (alta y edición)
// ============================================================================
// Reglas (las mismas del backend):
//   · cliente y cedis: obligatorios, hasta 80 caracteres, en mayúsculas
//   · acrónimo: obligatorio, hasta 50, sin espacios, ÚNICO
//   · la pareja cliente + cedis tampoco debe repetirse
//
// EL ACRÓNIMO ES LA LLAVE DEL EXCEL
//   La planeación semanal trae el acrónimo, no el id. Por eso:
//     · al dar de alta se sugiere uno (iniciales del cliente + cedis)
//     · al editar se advierte que cambiarlo rompe el cruce con el Excel
// ============================================================================

const PATRON_ACRONIMO = /^[A-Z0-9_.\-/]{1,50}$/;

const sinAcentos = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** "WALMART" + "CEDIS GUADALAJARA" → "WALMART-GDL" no se puede adivinar;
 *  se arma algo razonable: cliente compacto + iniciales del cedis. */
const sugerirAcronimo = (cliente: string, cedis: string) => {
    const c = sinAcentos(cliente).toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim();
    const d = sinAcentos(cedis)
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, "")
        .replace(/\bCEDIS\b|\bCEDI\b|\bCD\b/g, "")
        .trim();

    if (!c || !d) return "";

    const parteCliente = c.split(/\s+/)[0].slice(0, 8);
    const palabras = d.split(/\s+/).filter(Boolean);
    const parteCedis =
        palabras.length === 1 ? palabras[0].slice(0, 3) : palabras.map((p) => p[0]).join("").slice(0, 4);

    return `${parteCliente}-${parteCedis}`;
};

type Campo = "cliente" | "cedis" | "acronimo";

interface Props {
    destino: Cedis | null;
    existentes: Cedis[];
    clienteInicial?: string;
    onGuardado: (mensaje: string, aviso?: string | null) => void;
    onCerrar: () => void;
}

export default function CedisFormulario({ destino, existentes, clienteInicial, onGuardado, onCerrar }: Props) {
    const esEdicion = destino !== null;

    const [cliente, setCliente] = useState(destino?.cliente ?? clienteInicial ?? "");
    const [cedis, setCedis] = useState(destino?.cedis ?? "");
    const [acronimo, setAcronimo] = useState(destino?.acronimo ?? "");
    // Mientras no lo toquen a mano, el acrónimo se va sugiriendo solo
    const [acronimoManual, setAcronimoManual] = useState(esEdicion);

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const clientes = useMemo(
        () => [...new Set(existentes.map((c) => c.cliente.trim().toUpperCase()))].sort(),
        [existentes]
    );

    const clienteLimpio = cliente.trim().replace(/\s+/g, " ").toUpperCase();
    const cedisLimpio = cedis.trim().replace(/\s+/g, " ").toUpperCase();
    const acronimoLimpio = acronimo.trim().toUpperCase().replace(/\s+/g, "");

    // Otros CEDIS del mismo cliente: ayuda a escribir el nombre igual
    const hermanos = existentes.filter(
        (c) => c.id_cc !== destino?.id_cc && c.cliente.trim().toUpperCase() === clienteLimpio
    );

    const cambiaAcronimo = esEdicion && destino.acronimo.toUpperCase() !== acronimoLimpio;

    const limpiarError = (c: Campo) => {
        if (errores[c]) setErrores((e) => ({ ...e, [c]: undefined }));
    };

    const actualizarSugerencia = (nuevoCliente: string, nuevoCedis: string) => {
        if (!acronimoManual) setAcronimo(sugerirAcronimo(nuevoCliente, nuevoCedis));
    };

    // ---- Validación ----
    const validar = (): boolean => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (!clienteLimpio) nuevos.cliente = "Escribe el nombre del cliente";
        else if (clienteLimpio.length > 80) nuevos.cliente = "Máximo 80 caracteres";

        if (!cedisLimpio) nuevos.cedis = "Escribe el CEDIS";
        else if (cedisLimpio.length > 80) nuevos.cedis = "Máximo 80 caracteres";
        else if (
            existentes.some(
                (c) =>
                    c.id_cc !== destino?.id_cc &&
                    c.cliente.trim().toUpperCase() === clienteLimpio &&
                    c.cedis.trim().toUpperCase() === cedisLimpio
            )
        )
            nuevos.cedis = `${clienteLimpio} ya tiene registrado el CEDIS ${cedisLimpio}`;

        if (!acronimoLimpio) nuevos.acronimo = "Escribe el acrónimo";
        else if (!PATRON_ACRONIMO.test(acronimoLimpio))
            nuevos.acronimo = "Hasta 50 letras, números, guion, punto, diagonal o guion bajo";
        else {
            const repetido = existentes.find(
                (c) => c.id_cc !== destino?.id_cc && c.acronimo.toUpperCase() === acronimoLimpio
            );
            if (repetido) nuevos.acronimo = `Ya lo usa ${repetido.cliente} · ${repetido.cedis}`;
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
            const datos = { cliente, cedis, acronimo };
            if (esEdicion) {
                const r = await cedisService.actualizarCedis(destino.id_cc, datos);
                onGuardado("Destino actualizado correctamente", r?.aviso);
            } else {
                const r = await cedisService.crearCedis(datos);
                onGuardado("Destino registrado correctamente", r?.aviso);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={esEdicion ? "Editar destino" : "Nuevo destino"}
            subtitulo={
                esEdicion ? `${destino.cliente} · ${destino.cedis}` : "Registra un cliente en un CEDIS de entrega"
            }
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-cedis" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Registrar"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-cedis" className="formulario" onSubmit={guardar} noValidate>
                <label className={`campo campo--completo ${errores.cliente ? "campo--error" : ""}`}>
                    <span>
                        Cliente <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={cliente}
                        onChange={(e) => {
                            setCliente(e.target.value);
                            limpiarError("cliente");
                            actualizarSugerencia(e.target.value, cedis);
                        }}
                        maxLength={80}
                        placeholder="Ej. WALMART"
                        list="sugerencias-cliente"
                        autoFocus={!clienteInicial}
                        disabled={enviando}
                        autoComplete="off"
                    />
                    <datalist id="sugerencias-cliente">
                        {clientes.map((c) => (
                            <option key={c} value={c} />
                        ))}
                    </datalist>
                    {errores.cliente ? (
                        <small className="campo__mensaje">{errores.cliente}</small>
                    ) : hermanos.length > 0 ? (
                        <small className="campo__ayuda">
                            Ya tiene {hermanos.length} CEDIS: {hermanos.map((h) => h.cedis).join(", ")}
                        </small>
                    ) : (
                        <small className="campo__ayuda">Elige uno existente para no duplicar el cliente.</small>
                    )}
                </label>

                <label className={`campo ${errores.cedis ? "campo--error" : ""}`}>
                    <span>
                        CEDIS <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={cedis}
                        onChange={(e) => {
                            setCedis(e.target.value);
                            limpiarError("cedis");
                            actualizarSugerencia(cliente, e.target.value);
                        }}
                        maxLength={80}
                        placeholder="Ej. CEDIS GUADALAJARA"
                        autoFocus={Boolean(clienteInicial)}
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.cedis && <small className="campo__mensaje">{errores.cedis}</small>}
                </label>

                <label className={`campo ${errores.acronimo ? "campo--error" : ""}`}>
                    <span>
                        Acrónimo <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={acronimo}
                        onChange={(e) => {
                            setAcronimo(e.target.value.toUpperCase().replace(/\s+/g, ""));
                            setAcronimoManual(true);
                            limpiarError("acronimo");
                        }}
                        maxLength={50}
                        placeholder="Ej. WALMART-GDL"
                        className="mono"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.acronimo ? (
                        <small className="campo__mensaje">{errores.acronimo}</small>
                    ) : (
                        <small className="campo__ayuda">
                            {acronimoManual
                                ? "Debe ser igual al que usa el Excel de planeación."
                                : "Sugerido. Ajústalo si en el Excel se escribe distinto."}
                        </small>
                    )}
                </label>
            </form>

            {cambiaAcronimo && (
                <p className="modal__advertencia">
                    El acrónimo es la llave del Excel de planeación. Si lo cambias de{" "}
                    <strong className="mono">{destino.acronimo}</strong> a{" "}
                    <strong className="mono">{acronimoLimpio}</strong>, las hojas que todavía usen el anterior
                    dejarán de encontrar este destino al importarse.
                </p>
            )}
        </Modal>
    );
}
