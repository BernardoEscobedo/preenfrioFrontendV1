import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as skuService from "../../services/sku.service";
import { CALIDADES_BASE, TURNOS, cajasPorTarima } from "../../types/sku";
import type { Sku } from "../../types/sku";

// ============================================================================
// FORMULARIO DE SKU (alta y edición)
// ============================================================================
// Reglas (las mismas del backend):
//   · código: hasta 10 caracteres, letras, números, guion y guion bajo, sin
//     espacios ("CPL 0813A" se guarda como "CPL0813A")
//   · calidad: hasta 70 caracteres, en mayúsculas
//   · turno: del 1 al 5 (último carácter del código de lote)
//   · el duplicado es código + calidad: el mismo empaque en PRIMERA y en
//     SEGUNDA son dos SKU válidos
// ============================================================================

const PATRON_CODIGO = /^[A-Z0-9_-]{1,10}$/;

interface Props {
    sku: Sku | null;
    existentes: Sku[];
    onGuardado: (mensaje: string, aviso?: string | null) => void;
    onCerrar: () => void;
}

export default function SkuFormulario({ sku, existentes, onGuardado, onCerrar }: Props) {
    const esEdicion = sku !== null;

    const [codigo, setCodigo] = useState(sku?.codigo_sku ?? "");
    const [calidad, setCalidad] = useState(sku?.calidad ?? "");
    const [turno, setTurno] = useState<number>(sku ? Number(sku.turno) : 1);

    const [errores, setErrores] = useState<{ codigo?: string; calidad?: string }>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const codigoLimpio = codigo.trim().toUpperCase().replace(/\s+/g, "");
    const calidadLimpia = calidad.trim().toUpperCase().replace(/\s+/g, " ");
    const cajas = cajasPorTarima(codigoLimpio);

    const calidades = useMemo(
        () => [...new Set([...CALIDADES_BASE, ...existentes.map((s) => s.calidad.trim().toUpperCase())])].sort(),
        [existentes]
    );

    const cambiaTurno = esEdicion && Number(sku.turno) !== turno;
    const conProducciones = esEdicion && Number(sku.total_producciones ?? 0) > 0;

    const validar = (): boolean => {
        const nuevos: { codigo?: string; calidad?: string } = {};

        if (!codigoLimpio) nuevos.codigo = "Escribe el código del SKU";
        else if (!PATRON_CODIGO.test(codigoLimpio))
            nuevos.codigo = "Hasta 10 letras, números, guion o guion bajo";

        if (!calidadLimpia) nuevos.calidad = "Escribe la calidad";
        else if (calidadLimpia.length > 70) nuevos.calidad = "Máximo 70 caracteres";

        if (
            !nuevos.codigo &&
            !nuevos.calidad &&
            existentes.some(
                (s) =>
                    s.id_sku !== sku?.id_sku &&
                    s.codigo_sku.toUpperCase() === codigoLimpio &&
                    s.calidad.trim().toUpperCase() === calidadLimpia
            )
        )
            nuevos.codigo = `Ya existe ${codigoLimpio} en calidad ${calidadLimpia}`;

        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    const guardar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorGeneral("");
        if (!validar()) return;

        setEnviando(true);

        try {
            const datos = { codigo_sku: codigo, calidad, turno };
            if (esEdicion) {
                const r = await skuService.actualizarSku(sku.id_sku, datos);
                onGuardado("SKU actualizado correctamente", r?.aviso);
            } else {
                const r = await skuService.crearSku(datos);
                onGuardado("SKU registrado correctamente", r?.aviso);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={esEdicion ? "Editar SKU" : "Nuevo SKU"}
            subtitulo={esEdicion ? `${sku.codigo_sku} · ${sku.calidad}` : "Registra un empaque de producto terminado"}
            onCerrar={onCerrar}
            bloqueado={enviando}
            ancho="chico"
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-sku" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Registrar"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-sku" className="formulario formulario--una" onSubmit={guardar} noValidate>
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
                        maxLength={10}
                        placeholder="Ej. CPL0813A"
                        className="mono"
                        autoFocus
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.codigo ? (
                        <small className="campo__mensaje">{errores.codigo}</small>
                    ) : (
                        codigoLimpio && (
                            <small className="campo__ayuda">
                                Se estimarán <strong>{cajas} cajas por tarima</strong>
                                {cajas === 42 ? " (familia CPL0813)" : ""}.
                            </small>
                        )
                    )}
                </label>

                <label className={`campo ${errores.calidad ? "campo--error" : ""}`}>
                    <span>
                        Calidad <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={calidad}
                        onChange={(e) => {
                            setCalidad(e.target.value);
                            setErrores((x) => ({ ...x, calidad: undefined }));
                        }}
                        maxLength={70}
                        placeholder="Ej. PRIMERA"
                        list="sugerencias-calidad"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    <datalist id="sugerencias-calidad">
                        {calidades.map((c) => (
                            <option key={c} value={c} />
                        ))}
                    </datalist>
                    {errores.calidad && <small className="campo__mensaje">{errores.calidad}</small>}
                </label>

                <fieldset className="campo zonas">
                    <legend>
                        Turno <em className="campo__requerido">*</em>
                    </legend>
                    <div className="zonas__lista" style={{ gridTemplateColumns: `repeat(${TURNOS.length}, 1fr)` }}>
                        {TURNOS.map((t) => (
                            <label
                                key={t}
                                className={`zona-opcion ${turno === t ? "zona-opcion--activa" : ""}`}
                                style={{ justifyContent: "center", padding: "10px 6px" }}
                                title={`Turno ${t}`}
                            >
                                <input
                                    type="radio"
                                    name="turno"
                                    checked={turno === t}
                                    onChange={() => setTurno(t)}
                                    disabled={enviando}
                                />
                                <span className="zona-opcion__letra mono">{t}</span>
                            </label>
                        ))}
                    </div>
                    <small className="campo__ayuda">
                        Turno {turno} · es el último carácter del lote: B12015-392209-
                        <strong className="mono">{turno}</strong>
                    </small>
                </fieldset>
            </form>

            {cambiaTurno && (
                <p className="modal__advertencia">
                    Cambiar el turno afecta el último carácter de los lotes nuevos con este SKU
                    {conProducciones &&
                        `. Ya tiene ${Number(sku.total_producciones)} producción(es): esos lotes conservan el turno anterior`}
                    .
                </p>
            )}
        </Modal>
    );
}
