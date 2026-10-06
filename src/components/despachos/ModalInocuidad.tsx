import { useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as despachosService from "../../services/despachos.service";
import { fechaHora } from "../../utils/formato";
import { estadoInocuidad } from "./ChipInocuidad";
import type { Despacho } from "../../types/despacho";

// ============================================================================
// INSPECCIÓN DE INOCUIDAD DEL DESPACHO · supervisor+
// ============================================================================
// Se revisa la caja en el andén ANTES de cargar: limpieza, olores, plagas y
// estado de la unidad.
//
//   · Solo en borrador. Un despacho cerrado ya salió con su inspección.
//   · El usuario lo toma el backend de la sesión y la fecha la pone la BD.
//   · Se puede volver a inspeccionar (por ejemplo, después de lavar una
//     caja rechazada): la nueva revisión reemplaza a la anterior.
//
// En un RECHAZO se pide anotar qué se encontró: es lo que se le reclama a
// la línea fletera. (Regla de esta pantalla; el backend no la exige.)
// ============================================================================

const MAXIMO = 500;

interface Props {
    despacho: Despacho;
    onGuardado: (mensaje: string) => void;
    onCerrar: () => void;
}

export default function ModalInocuidad({ despacho, onGuardado, onCerrar }: Props) {
    const [resultado, setResultado] = useState<0 | 1 | null>(null);
    const [observaciones, setObservaciones] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const anterior = estadoInocuidad(despacho.inocuidad);
    const yaInspeccionado = despacho.inocuidad !== null && despacho.inocuidad !== undefined;

    const guardar = async () => {
        if (resultado === null) {
            setError("Elige el resultado de la inspección.");
            return;
        }
        if (resultado === 0 && observaciones.trim().length < 5) {
            setError("Anota qué se encontró en la caja: es lo que se le reclama a la línea fletera.");
            return;
        }

        setError("");
        setEnviando(true);
        try {
            const r = await despachosService.registrarInocuidad(despacho.id_despacho, resultado, observaciones);
            onGuardado(r?.mensaje ?? "Inspección registrada");
        } catch (err) {
            setError(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo="Inspección de inocuidad"
            subtitulo={`Despacho ${despacho.folio_despacho} · Caja ${despacho.placas_caja ?? "—"}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            ancho="chico"
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={`boton ${resultado === 0 ? "boton--peligro" : "boton--primario"}`}
                        onClick={guardar}
                        disabled={enviando || resultado === null}
                    >
                        {enviando ? (
                            <span className="spinner spinner--chico" />
                        ) : resultado === 0 ? (
                            "Registrar rechazo"
                        ) : (
                            "Registrar aprobación"
                        )}
                    </button>
                </>
            }
        >
            {yaInspeccionado && (
                <p className="modal__advertencia">
                    Ya tiene una inspección <strong>{anterior.texto.toLowerCase()}</strong>
                    {despacho.inocuidad_fecha ? ` (${fechaHora(despacho.inocuidad_fecha)})` : ""}. La nueva
                    revisión la reemplaza.
                </p>
            )}

            <div className="opciones-inspeccion" role="radiogroup" aria-label="Resultado">
                <button
                    type="button"
                    role="radio"
                    aria-checked={resultado === 1}
                    className={`opcion-inspeccion opcion-inspeccion--aprobar ${resultado === 1 ? "opcion-inspeccion--activa" : ""}`}
                    onClick={() => {
                        setResultado(1);
                        setError("");
                    }}
                    disabled={enviando}
                >
                    <ShieldCheck size={30} />
                    Aprobada
                    <small>Limpia y en condiciones</small>
                </button>
                <button
                    type="button"
                    role="radio"
                    aria-checked={resultado === 0}
                    className={`opcion-inspeccion opcion-inspeccion--rechazar ${resultado === 0 ? "opcion-inspeccion--activa" : ""}`}
                    onClick={() => {
                        setResultado(0);
                        setError("");
                    }}
                    disabled={enviando}
                >
                    <ShieldAlert size={30} />
                    Rechazada
                    <small>No debe cargar fruta</small>
                </button>
            </div>

            {error && <div className="alerta alerta--error">{error}</div>}

            <label className="campo">
                <span>
                    Observaciones{" "}
                    {resultado === 0 ? <em className="campo__requerido">*</em> : <small>(opcional)</small>}
                </span>
                <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    maxLength={MAXIMO}
                    rows={3}
                    placeholder={
                        resultado === 0
                            ? "Ej. Residuos de carga anterior y olor a combustible"
                            : "Ej. Caja limpia, termo funcionando a 12 °C"
                    }
                    disabled={enviando}
                />
                <small className="campo__contador">
                    {observaciones.length}/{MAXIMO}
                </small>
            </label>
        </Modal>
    );
}
