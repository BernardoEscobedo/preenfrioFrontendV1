import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as fincasService from "../../services/fincas.service";
import { ZONAS } from "../../types/finca";
import type { Finca } from "../../types/finca";
import type { Productor } from "../../types/productor";

// ============================================================================
// FORMULARIO DE FINCA (alta y edición)
// ============================================================================
// Muestra en vivo cómo quedará el inicio del código de lote:
//
//   zona + 2 últimos del productor + código de finca (3 dígitos)
//   Ej. Colima · productor 12 · finca 15  →  B12015-…
//
// Reglas:
//   · código: 1 a 3 letras o números, único DENTRO del mismo productor
//   · solo se ofrecen productores activos (más el actual al editar)
//   · al editar, avisa si cambia zona, código o productor: afecta lotes
//     nuevos, los ya planeados conservan el suyo
// ============================================================================

const PATRON_CODIGO = /^[A-Z0-9]{1,3}$/;

type Campo = "codigo_finca" | "nombre" | "org_inv_nombre" | "zona" | "id_productor";

interface Props {
    finca: Finca | null;
    existentes: Finca[];
    productores: Productor[];
    productorInicial?: number;
    onGuardado: (mensaje: string, aviso?: string | null) => void;
    onCerrar: () => void;
}

export default function FincaFormulario({
    finca,
    existentes,
    productores,
    productorInicial,
    onGuardado,
    onCerrar
}: Props) {
    const esEdicion = finca !== null;

    const [idProductor, setIdProductor] = useState(
        finca ? String(finca.id_productor) : productorInicial ? String(productorInicial) : ""
    );
    const [codigo, setCodigo] = useState(finca?.codigo_finca ?? "");
    const [nombre, setNombre] = useState(finca?.nombre ?? "");
    const [orgInv, setOrgInv] = useState(finca?.org_inv_nombre ?? "");
    const [zona, setZona] = useState(finca ? Number(finca.zona) : 0);

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const limpiarError = (c: Campo) => {
        if (errores[c]) setErrores((e) => ({ ...e, [c]: undefined }));
    };

    // Activos + el actual (aunque esté de baja), ordenados por código
    const opcionesProductor = useMemo(
        () =>
            productores
                .filter((p) => Number(p.estado) === 1 || p.id_productor === finca?.id_productor)
                .sort((a, b) => a.codigo_productor.localeCompare(b.codigo_productor, "es", { numeric: true })),
        [productores, finca]
    );

    const productor = productores.find((p) => String(p.id_productor) === idProductor);
    const codigoLimpio = codigo.trim().toUpperCase().replace(/\s+/g, "");

    // Organizaciones de inventario ya usadas, para no escribirlas distinto
    const organizaciones = useMemo(
        () => [...new Set(existentes.map((f) => f.org_inv_nombre.trim()).filter(Boolean))].sort(),
        [existentes]
    );

    // ---- Vista previa del lote ----
    const previa = useMemo(() => {
        const letra = ZONAS[zona]?.letra ?? "?";
        const prod = productor ? productor.codigo_productor.toUpperCase().slice(-2).padStart(2, "0") : "??";
        const fin = codigoLimpio ? codigoLimpio.slice(-3).padStart(3, "0") : "???";
        return `${letra}${prod}${fin}`;
    }, [zona, productor, codigoLimpio]);

    const cambiaLote =
        esEdicion &&
        (Number(finca.zona) !== zona ||
            finca.codigo_finca.toUpperCase() !== codigoLimpio ||
            String(finca.id_productor) !== idProductor);

    // ---- Validación ----
    const validar = (): boolean => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (!idProductor) nuevos.id_productor = "Elige el productor dueño de la finca";

        if (!codigoLimpio) nuevos.codigo_finca = "Escribe el código de la finca";
        else if (!PATRON_CODIGO.test(codigoLimpio)) nuevos.codigo_finca = "De 1 a 3 letras o números";
        else if (
            idProductor &&
            existentes.some(
                (f) =>
                    f.id_finca !== finca?.id_finca &&
                    String(f.id_productor) === idProductor &&
                    f.codigo_finca.toUpperCase() === codigoLimpio
            )
        )
            nuevos.codigo_finca = "Este productor ya tiene una finca con ese código";

        if (!nombre.trim()) nuevos.nombre = "Escribe el nombre de la finca";
        else if (nombre.trim().length > 70) nuevos.nombre = "Máximo 70 caracteres";

        if (!orgInv.trim()) nuevos.org_inv_nombre = "Escribe la organización de inventario";
        else if (orgInv.trim().length > 70) nuevos.org_inv_nombre = "Máximo 70 caracteres";

        if (!ZONAS[zona]) nuevos.zona = "Elige la zona";

        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    // ---- Guardar ----
    const guardar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorGeneral("");
        if (!validar()) return;

        const datos = {
            codigo_finca: codigo,
            nombre,
            org_inv_nombre: orgInv,
            zona,
            id_productor: Number(idProductor)
        };

        setEnviando(true);

        try {
            if (esEdicion) {
                const r = await fincasService.actualizarFinca(finca.id_finca, datos);
                onGuardado("Finca actualizada correctamente", r?.aviso);
            } else {
                const r = await fincasService.crearFinca(datos);
                onGuardado("Finca registrada correctamente", r?.aviso);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={esEdicion ? "Editar finca" : "Nueva finca"}
            subtitulo={esEdicion ? finca.nombre : "Registra una finca que surte fruta"}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-finca" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Registrar"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <div className="lote-previa">
                <span>Inicio del código de lote</span>
                <strong className="mono">
                    <em className={zona ? "" : "lote-previa__falta"}>{previa[0]}</em>
                    <em className={productor ? "" : "lote-previa__falta"}>{previa.slice(1, 3)}</em>
                    <em className={codigoLimpio ? "" : "lote-previa__falta"}>{previa.slice(3)}</em>
                    <small>-SS DDMM-T</small>
                </strong>
                <small>Zona · Productor · Finca</small>
            </div>

            <form id="form-finca" className="formulario" onSubmit={guardar} noValidate>
                {/* Productor */}
                <label className={`campo campo--completo ${errores.id_productor ? "campo--error" : ""}`}>
                    <span>
                        Productor <em className="campo__requerido">*</em>
                    </span>
                    <select
                        value={idProductor}
                        onChange={(e) => {
                            setIdProductor(e.target.value);
                            limpiarError("id_productor");
                            limpiarError("codigo_finca");
                        }}
                        disabled={enviando}
                        autoFocus={!esEdicion && !productorInicial}
                    >
                        <option value="">
                            {opcionesProductor.length === 0 ? "No hay productores activos" : "Selecciona un productor"}
                        </option>
                        {opcionesProductor.map((p) => (
                            <option key={p.id_productor} value={p.id_productor}>
                                {p.codigo_productor} · {p.nombre}
                                {Number(p.estado) !== 1 ? " (dado de baja)" : ""}
                            </option>
                        ))}
                    </select>
                    {errores.id_productor && <small className="campo__mensaje">{errores.id_productor}</small>}
                    {opcionesProductor.length === 0 && (
                        <small className="campo__ayuda">Da de alta al productor en Catálogos → Productores.</small>
                    )}
                </label>

                {/* Zona */}
                <fieldset className={`campo campo--completo zonas ${errores.zona ? "campo--error" : ""}`}>
                    <legend>
                        Zona <em className="campo__requerido">*</em>
                    </legend>
                    <div className="zonas__lista">
                        {Object.entries(ZONAS).map(([valor, z]) => (
                            <label key={valor} className={`zona-opcion ${zona === Number(valor) ? "zona-opcion--activa" : ""}`}>
                                <input
                                    type="radio"
                                    name="zona"
                                    checked={zona === Number(valor)}
                                    onChange={() => {
                                        setZona(Number(valor));
                                        limpiarError("zona");
                                    }}
                                    disabled={enviando}
                                />
                                <span className="zona-opcion__letra mono">{z.letra}</span>
                                <span>{z.nombre}</span>
                            </label>
                        ))}
                    </div>
                    {errores.zona && <small className="campo__mensaje">{errores.zona}</small>}
                </fieldset>

                {/* Código */}
                <label className={`campo ${errores.codigo_finca ? "campo--error" : ""}`}>
                    <span>
                        Código de finca <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={codigo}
                        onChange={(e) => {
                            setCodigo(e.target.value.toUpperCase().replace(/\s+/g, ""));
                            limpiarError("codigo_finca");
                        }}
                        maxLength={3}
                        placeholder="Ej. 015"
                        className="mono"
                        disabled={enviando}
                        autoComplete="off"
                        autoFocus={!esEdicion && Boolean(productorInicial)}
                    />
                    {errores.codigo_finca ? (
                        <small className="campo__mensaje">{errores.codigo_finca}</small>
                    ) : (
                        <small className="campo__ayuda">Se completa con ceros: 15 → 015.</small>
                    )}
                </label>

                {/* Nombre */}
                <label className={`campo ${errores.nombre ? "campo--error" : ""}`}>
                    <span>
                        Nombre de la finca <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={nombre}
                        onChange={(e) => {
                            setNombre(e.target.value);
                            limpiarError("nombre");
                        }}
                        maxLength={70}
                        placeholder="Ej. EL ROSARIO"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.nombre && <small className="campo__mensaje">{errores.nombre}</small>}
                </label>

                {/* Organización de inventario */}
                <label className={`campo campo--completo ${errores.org_inv_nombre ? "campo--error" : ""}`}>
                    <span>
                        Organización de inventario <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={orgInv}
                        onChange={(e) => {
                            setOrgInv(e.target.value);
                            limpiarError("org_inv_nombre");
                        }}
                        maxLength={70}
                        placeholder="Como aparece en el sistema de inventario"
                        list="sugerencias-orginv"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    <datalist id="sugerencias-orginv">
                        {organizaciones.map((o) => (
                            <option key={o} value={o} />
                        ))}
                    </datalist>
                    {errores.org_inv_nombre && <small className="campo__mensaje">{errores.org_inv_nombre}</small>}
                </label>
            </form>

            {productor && Number(productor.estado) !== 1 && (
                <p className="modal__advertencia">
                    El productor <strong>{productor.nombre}</strong> está dado de baja. El sistema no aceptará la
                    finca hasta que lo reactives o elijas otro.
                </p>
            )}

            {cambiaLote && (
                <p className="modal__advertencia">
                    Cambiaste zona, código o productor: el inicio del lote pasa de{" "}
                    <strong className="mono">
                        {ZONAS[Number(finca.zona)]?.letra}
                        {(finca.codigo_productor ?? "").slice(-2).padStart(2, "0")}
                        {finca.codigo_finca.slice(-3).padStart(3, "0")}
                    </strong>{" "}
                    a <strong className="mono">{previa}</strong>. Solo afecta los lotes nuevos.
                </p>
            )}
        </Modal>
    );
}
