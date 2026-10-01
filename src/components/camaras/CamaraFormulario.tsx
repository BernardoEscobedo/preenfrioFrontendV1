import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Snowflake, Warehouse } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import { claveSitio, etiquetaSitio } from "../../utils/sitios";
import * as camarasService from "../../services/camaras.service";
import { CAJAS_POR_TARIMA, TIPO_CAMARA } from "../../types/camara";
import type { Camara, CamaraForm, OcupacionCamara } from "../../types/camara";

// ============================================================================
// FORMULARIO DE CÁMARA (alta y edición)
// ============================================================================
// La capacidad es el tope que respetan los triggers de recepción y cola:
// capturarla mal manda fruta a la cola de más o deja sobrellenar la cámara.
//
// EL NOMBRE IMPORTA
//   El dashboard y la zona de trabajo agrupan por el sitio que viene en el
//   nombre: "PREENFRIO NELLY" y "CONSERVACION NELLY" quedan en Nelly. Por
//   eso el formulario muestra en qué grupo caerá y sugiere el formato.
//
// Reglas (las mismas del backend):
//   · tarimas  entero > 0
//   · cajas    entero ≥ 0; si no es 0, al menos una por tarima
//   · bloques  entero ≥ 0
//   · al editar, la capacidad no puede quedar por debajo de lo que ya hay
//     dentro
// ============================================================================

const PREFIJO = { 1: "PREENFRIO", 2: "CONSERVACION" } as const;

type Campo = keyof CamaraForm;

interface Props {
    camara: Camara | null;
    existentes: Camara[];
    ocupacion?: OcupacionCamara;
    onGuardado: (mensaje: string) => void;
    onCerrar: () => void;
}

export default function CamaraFormulario({ camara, existentes, ocupacion, onGuardado, onCerrar }: Props) {
    const esEdicion = camara !== null;

    const [nombre, setNombre] = useState(camara?.nombre_camara ?? "");
    const [tipo, setTipo] = useState<number>(camara ? Number(camara.tipo_camara) : 1);
    const [ubicacion, setUbicacion] = useState(camara?.ubicacion ?? "");
    const [tarimas, setTarimas] = useState(camara ? String(camara.capacidad_max_tarimas) : "");
    const [cajas, setCajas] = useState(camara ? String(camara.capacidad_max_cajas) : "");
    const [bloques, setBloques] = useState(camara ? String(camara.capacidad_max_bloques) : "0");

    const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const ubicaciones = useMemo(
        () => [...new Set(existentes.map((c) => c.ubicacion.trim()).filter(Boolean))].sort(),
        [existentes]
    );

    // ---- Agrupación y sugerencia de nombre ----
    const nombreLimpio = nombre.trim().replace(/\s+/g, " ").toUpperCase();
    const grupo = nombreLimpio ? etiquetaSitio(claveSitio(nombreLimpio, ubicacion)) : "";

    const sitioDelNombre = claveSitio(nombreLimpio, "").trim();
    const empiezaBien = nombreLimpio.startsWith(PREFIJO[tipo as 1 | 2]);
    const sugerencia =
        nombreLimpio && !empiezaBien && sitioDelNombre ? `${PREFIJO[tipo as 1 | 2]} ${sitioDelNombre}` : "";

    // Compañera de la misma planta (para mostrar con quién se agrupa)
    const companeras = useMemo(() => {
        if (!nombreLimpio) return [];
        const clave = claveSitio(nombreLimpio, ubicacion);
        return existentes.filter(
            (c) => c.id_camara !== camara?.id_camara && claveSitio(c.nombre_camara, c.ubicacion) === clave
        );
    }, [nombreLimpio, ubicacion, existentes, camara]);

    const limpiarError = (campo: Campo) => {
        if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    };

    const entero = (v: string) => (v.trim() === "" ? NaN : Number(v));

    // ---- Validación ----
    const validar = (): boolean => {
        const nuevos: Partial<Record<Campo, string>> = {};

        if (!nombreLimpio) nuevos.nombre_camara = "Escribe el nombre de la cámara";
        else if (nombreLimpio.length > 60) nuevos.nombre_camara = "Máximo 60 caracteres";
        else if (
            existentes.some(
                (c) => c.id_camara !== camara?.id_camara && c.nombre_camara.trim().toUpperCase() === nombreLimpio
            )
        )
            nuevos.nombre_camara = "Ya existe una cámara con ese nombre";

        const ubi = ubicacion.trim();
        if (!ubi) nuevos.ubicacion = "Escribe la ubicación";
        else if (ubi.length > 60) nuevos.ubicacion = "Máximo 60 caracteres";

        const t = entero(tarimas);
        const c = entero(cajas);
        const b = entero(bloques);

        if (!Number.isInteger(t) || t <= 0) nuevos.capacidad_max_tarimas = "Debe ser un entero mayor a 0";
        else if (ocupacion && t < ocupacion.tarimas_ocupadas)
            nuevos.capacidad_max_tarimas = `Tiene ${ocupacion.tarimas_ocupadas} tarima(s) dentro: no puede ser menor`;

        if (!Number.isInteger(c) || c < 0) nuevos.capacidad_max_cajas = "Debe ser un entero (0 o más)";
        else if (c > 0 && Number.isInteger(t) && c < t)
            nuevos.capacidad_max_cajas = `No alcanza ni para una caja por tarima (~${CAJAS_POR_TARIMA} por tarima)`;

        if (!Number.isInteger(b) || b < 0) nuevos.capacidad_max_bloques = "Debe ser un entero (0 o más)";

        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    // ---- Guardar ----
    const guardar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorGeneral("");
        if (!validar()) return;

        const datos: CamaraForm = {
            nombre_camara: nombre,
            tipo_camara: tipo,
            ubicacion,
            capacidad_max_tarimas: Number(tarimas),
            capacidad_max_cajas: Number(cajas),
            capacidad_max_bloques: Number(bloques)
        };

        setEnviando(true);

        try {
            if (esEdicion) {
                await camarasService.actualizarCamara(camara.id_camara, datos);
                onGuardado("Cámara actualizada correctamente");
            } else {
                await camarasService.crearCamara(datos);
                onGuardado("Cámara registrada correctamente");
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    const tarimasNum = entero(tarimas);

    return (
        <Modal
            titulo={esEdicion ? "Editar cámara" : "Nueva cámara"}
            subtitulo={esEdicion ? camara.nombre_camara : "Registra una cámara de preenfrío o de conservación"}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-camara" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Registrar"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-camara" className="formulario" onSubmit={guardar} noValidate>
                {/* Tipo */}
                <fieldset className="campo campo--completo tipos">
                    <legend>
                        Tipo de cámara <em className="campo__requerido">*</em>
                    </legend>
                    <div className="tipos__lista">
                        {[1, 2].map((t) => {
                            const Icono = t === 1 ? Snowflake : Warehouse;
                            return (
                                <label key={t} className={`tipo-opcion ${tipo === t ? "tipo-opcion--activa" : ""}`}>
                                    <input
                                        type="radio"
                                        name="tipo"
                                        checked={tipo === t}
                                        onChange={() => setTipo(t)}
                                        disabled={enviando}
                                    />
                                    <Icono size={22} />
                                    <span>
                                        <strong>{TIPO_CAMARA[t]}</strong>
                                        <small>
                                            {t === 1
                                                ? "Recibe la fruta del campo y la enfría"
                                                : "Guarda la fruta ya enfriada hasta el despacho"}
                                        </small>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                {/* Nombre */}
                <label className={`campo campo--completo ${errores.nombre_camara ? "campo--error" : ""}`}>
                    <span>
                        Nombre <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={nombre}
                        onChange={(e) => {
                            setNombre(e.target.value);
                            limpiarError("nombre_camara");
                        }}
                        maxLength={60}
                        placeholder={`Ej. ${PREFIJO[tipo as 1 | 2]} NELLY`}
                        autoFocus
                        disabled={enviando}
                        autoComplete="off"
                    />
                    {errores.nombre_camara ? (
                        <small className="campo__mensaje">{errores.nombre_camara}</small>
                    ) : grupo ? (
                        <small className="campo__ayuda">
                            Se agrupará en <strong>{grupo}</strong>
                            {companeras.length > 0 && <> junto con {companeras.map((c) => c.nombre_camara).join(", ")}</>}
                            .
                        </small>
                    ) : (
                        <small className="campo__ayuda">
                            Usa el formato {PREFIJO[tipo as 1 | 2]} + sitio para que se agrupe con su preenfrío.
                        </small>
                    )}
                    {sugerencia && (
                        <button
                            type="button"
                            className="sugerencia"
                            onClick={() => setNombre(sugerencia)}
                            disabled={enviando}
                        >
                            Usar «{sugerencia}»
                        </button>
                    )}
                </label>

                {/* Ubicación */}
                <label className={`campo campo--completo ${errores.ubicacion ? "campo--error" : ""}`}>
                    <span>
                        Ubicación <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={ubicacion}
                        onChange={(e) => {
                            setUbicacion(e.target.value);
                            limpiarError("ubicacion");
                        }}
                        maxLength={60}
                        placeholder="Ej. HUEHUETAN, CHIAPAS"
                        list="sugerencias-ubicacion"
                        disabled={enviando}
                        autoComplete="off"
                    />
                    <datalist id="sugerencias-ubicacion">
                        {ubicaciones.map((u) => (
                            <option key={u} value={u} />
                        ))}
                    </datalist>
                    {errores.ubicacion && <small className="campo__mensaje">{errores.ubicacion}</small>}
                </label>

                {/* Capacidades */}
                <label className={`campo ${errores.capacidad_max_tarimas ? "campo--error" : ""}`}>
                    <span>
                        Capacidad en tarimas <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={tarimas}
                        onChange={(e) => {
                            setTarimas(e.target.value);
                            limpiarError("capacidad_max_tarimas");
                        }}
                        disabled={enviando}
                    />
                    {errores.capacidad_max_tarimas ? (
                        <small className="campo__mensaje">{errores.capacidad_max_tarimas}</small>
                    ) : (
                        <small className="campo__ayuda">Es el tope real: lo que exceda se va a la cola.</small>
                    )}
                </label>

                <label className={`campo ${errores.capacidad_max_cajas ? "campo--error" : ""}`}>
                    <span>
                        Capacidad en cajas <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={cajas}
                        onChange={(e) => {
                            setCajas(e.target.value);
                            limpiarError("capacidad_max_cajas");
                        }}
                        disabled={enviando}
                    />
                    {errores.capacidad_max_cajas ? (
                        <small className="campo__mensaje">{errores.capacidad_max_cajas}</small>
                    ) : (
                        <small className="campo__ayuda">
                            0 = no se controla por cajas.
                            {Number.isInteger(tarimasNum) && tarimasNum > 0 && (
                                <>
                                    {" "}
                                    <button
                                        type="button"
                                        className="enlace enlace--verde"
                                        onClick={() => {
                                            setCajas(String(tarimasNum * CAJAS_POR_TARIMA));
                                            limpiarError("capacidad_max_cajas");
                                        }}
                                        disabled={enviando}
                                    >
                                        Calcular {tarimasNum} × {CAJAS_POR_TARIMA} = {tarimasNum * CAJAS_POR_TARIMA}
                                    </button>
                                </>
                            )}
                        </small>
                    )}
                </label>

                <label className={`campo ${errores.capacidad_max_bloques ? "campo--error" : ""}`}>
                    <span>
                        Capacidad en bloques <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={bloques}
                        onChange={(e) => {
                            setBloques(e.target.value);
                            limpiarError("capacidad_max_bloques");
                        }}
                        disabled={enviando}
                    />
                    {errores.capacidad_max_bloques && (
                        <small className="campo__mensaje">{errores.capacidad_max_bloques}</small>
                    )}
                </label>
            </form>

            {esEdicion && ocupacion && (ocupacion.tarimas_ocupadas > 0 || ocupacion.procesos_en_espera > 0) && (
                <p className="formulario__nota">
                    Ahora tiene <strong>{ocupacion.tarimas_ocupadas}</strong> tarima(s) dentro
                    {ocupacion.procesos_en_espera > 0 && (
                        <>
                            {" "}y <strong>{ocupacion.tarimas_en_espera}</strong> en cola
                        </>
                    )}
                    . Cambiar la capacidad afecta en el momento cuánto puede entrar.
                </p>
            )}
        </Modal>
    );
}
