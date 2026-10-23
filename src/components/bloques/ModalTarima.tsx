import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Image, Thermometer, Trash2 } from "lucide-react";
import Modal from "../ui/Modal";
import ModalConfirmar from "../ui/ModalConfirmar";
import { mensajeError } from "../../api/axios";
import * as tarimasService from "../../services/tarimas.service";
import { comprimirFoto, subirASharePoint } from "../../utils/subirFoto";
import { fechaCorta, fechaHora } from "../../utils/formato";
import type { PulpeoHistorial, Tarima } from "../../types/tarima";

// ============================================================================
// TARIMA · registrar pulpeo (foto obligatoria) e historial
// ============================================================================
// Registrar: temperatura + foto del termómetro. La foto se comprime, se
// sube directo a SharePoint y el pulpeo se guarda junto con ella. Si la
// carga falla, el pulpeo NO se guarda.
// ============================================================================

const num = (v: number | string | null | undefined) => Number(v ?? 0);

const ESTADO_TEXTO: Record<string, string> = {
    al_dia: "Al día",
    toca: "Toca pulpear",
    vencido: "Pulpeo vencido",
    primero: "Primer pulpeo pendiente",
    libre: "Conservación"
};

interface Props {
    tarima: Tarima;
    codigoBloque: string;
    puedeRetirar: boolean;
    onCambio: (mensaje: string) => void;
    onCerrar: () => void;
}

export default function ModalTarima({ tarima, codigoBloque, puedeRetirar, onCambio, onCerrar }: Props) {
    const entradaFoto = useRef<HTMLInputElement | null>(null);

    const [historial, setHistorial] = useState<PulpeoHistorial[]>([]);
    const [cargando, setCargando] = useState(true);
    const [temperatura, setTemperatura] = useState("");
    const [observaciones, setObservaciones] = useState("");
    const [foto, setFoto] = useState<File | null>(null);
    const [vista, setVista] = useState<string | null>(null);
    const [paso, setPaso] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [retirando, setRetirando] = useState(false);
    const [fotos, setFotos] = useState<Record<number, string>>({});

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            setHistorial(await tarimasService.getHistorial(tarima.id_tarima));
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargando(false);
        }
    }, [tarima.id_tarima]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    useEffect(() => () => {
        if (vista) URL.revokeObjectURL(vista);
    }, [vista]);

    const elegirFoto = async (f: File | undefined) => {
        if (!f) return;
        if (!f.type.startsWith("image/")) return setError("El archivo debe ser una foto.");
        setError("");
        const comprimida = await comprimirFoto(f);
        setFoto(comprimida);
        setVista(URL.createObjectURL(comprimida));
    };

    const verFoto = async (id: number) => {
        if (fotos[id]) return window.open(fotos[id], "_blank", "noopener");
        try {
            const url = await tarimasService.urlFoto(id);
            setFotos((f) => ({ ...f, [id]: url }));
            window.open(url, "_blank", "noopener");
        } catch (e) {
            setError(mensajeError(e));
        }
    };

    const registrar = async () => {
        const t = Number(temperatura);
        if (temperatura.trim() === "" || isNaN(t) || t < -2 || t > 40) return setError("Captura la temperatura de la pulpa (-2 a 40 °C).");
        if (!foto) return setError("Toma la foto del termómetro: es obligatoria.");

        setError("");
        setEnviando(true);
        try {
            setPaso("Preparando carga…");
            const sesion = await tarimasService.sesionPulpeo(tarima.id_tarima, {
                temperatura: Math.round(t * 10) / 10,
                fecha_hora: null,
                observaciones: observaciones.trim() || null,
                foto: { mime_type: foto.type, tamano_bytes: foto.size, nombre_original: foto.name }
            });
            setPaso("Subiendo foto…");
            const itemId = await subirASharePoint(sesion.upload_url, foto);
            setPaso("Guardando pulpeo…");
            const r = await tarimasService.confirmarPulpeo(sesion.token_carga, itemId);
            onCambio(r.mensaje);
        } catch (e) {
            setError(e instanceof Error && !("response" in e) ? e.message : mensajeError(e));
            setEnviando(false);
            setPaso("");
        }
    };

    const retirar = async () => {
        const r = await tarimasService.retirarTarima(tarima.id_tarima);
        onCambio(r.mensaje);
    };

    const preenfrio = Number(tarima.tipo_camara) === 1;

    return (
        <Modal
            titulo={`Tarima ${tarima.posicion} · ${codigoBloque}`}
            subtitulo={`${tarima.nombre_camara} · ${ESTADO_TEXTO[tarima.estado_pulpeo] ?? ""}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    {puedeRetirar && (
                        <button type="button" className="boton boton--claro" onClick={() => setRetirando(true)} disabled={enviando}>
                            <Trash2 size={16} /> Retirar tarima
                        </button>
                    )}
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cerrar
                    </button>
                    <button type="button" className="boton boton--primario" onClick={registrar} disabled={enviando}>
                        {enviando ? <><span className="spinner spinner--chico" /> {paso}</> : <><Thermometer size={16} /> Registrar pulpeo</>}
                    </button>
                </>
            }
        >
            <div className="tarima__resumen">
                <div>
                    <small>{preenfrio ? "En preenfrío" : "En cámara"}</small>
                    <strong className={tarima.alerta_5h ? "tarima__alerta" : ""}>
                        {num(tarima.horas_en_camara)} h{tarima.alerta_5h ? " · más de 5 h" : ""}
                    </strong>
                </div>
                <div>
                    <small>Último pulpeo</small>
                    <strong>
                        {tarima.ultima_temperatura === null ? "—" : `${num(tarima.ultima_temperatura)} °C`}
                        {tarima.minutos_desde_pulpeo !== null ? ` · hace ${num(tarima.minutos_desde_pulpeo)} min` : ""}
                    </strong>
                </div>
                <div>
                    <small>Pulpeos</small>
                    <strong>{tarima.pulpeos}</strong>
                </div>
            </div>

            <ul className="tarima__lotes">
                {tarima.lotes.map((l) => (
                    <li key={l.id_produccion}>
                        <span className="lote-chip mono">{l.codigo_lote}</span>
                        <span>
                            {l.codigo_sku} · {l.calidad_sku}
                        </span>
                        <small>
                            {l.codigo_productor} {l.codigo_finca} {l.nombre_finca} · {l.acronimo_cc} · empaque {fechaCorta(l.fecha_empaque)} ·{" "}
                            {l.cantidad_cajas} cj
                        </small>
                    </li>
                ))}
            </ul>

            {tarima.alerta_5h && (
                <div className="alerta alerta--aviso">
                    <AlertTriangle size={16} className="icono-en-linea" /> Esta tarima lleva más de 5 horas en preenfrío.
                </div>
            )}

            {error && <div className="alerta alerta--error">{error}</div>}

            <h3 className="asistente__subtitulo">Nuevo pulpeo</h3>
            <div className="formulario">
                <label className="campo">
                    <span>Temperatura de pulpa (°C)</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={temperatura}
                        onChange={(e) => setTemperatura(e.target.value)}
                        disabled={enviando}
                        autoFocus
                    />
                </label>
                <label className="campo">
                    <span>
                        Observaciones <small>(opcional)</small>
                    </span>
                    <input type="text" maxLength={250} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} disabled={enviando} />
                </label>
                <div className="campo campo--completo">
                    <span>Foto del termómetro (obligatoria)</span>
                    <div className="tarima__foto">
                        <button type="button" className="boton boton--claro boton--auto" onClick={() => entradaFoto.current?.click()} disabled={enviando}>
                            <Camera size={16} /> {foto ? "Cambiar foto" : "Tomar foto"}
                        </button>
                        {vista && <img src={vista} alt="Vista previa del pulpeo" />}
                    </div>
                    <input
                        ref={entradaFoto}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={(e) => {
                            elegirFoto(e.target.files?.[0]);
                            e.target.value = "";
                        }}
                    />
                </div>
            </div>

            <h3 className="asistente__subtitulo">Historial</h3>
            {cargando ? (
                <div className="spinner" />
            ) : historial.length === 0 ? (
                <p className="pieza__vacio">Sin pulpeos todavía.</p>
            ) : (
                <ul className="tarima__historial">
                    {historial.map((p) => (
                        <li key={p.id_pulpeo}>
                            <strong>{num(p.temperatura_promedio)} °C</strong>
                            <span>
                                #{p.numero_pulpeo} · {fechaHora(p.fecha_hora)} · {p.nombre_camara ?? ""}
                            </span>
                            <small>
                                {[p.nombre_empleado, p.apellidos_empleado].filter(Boolean).join(" ") || p.usuario || "—"}
                                {p.observaciones ? ` · ${p.observaciones}` : ""}
                            </small>
                            {p.evidencias.map((id) => (
                                <button key={id} type="button" className="enlace enlace--verde" onClick={() => verFoto(id)}>
                                    <Image size={14} /> Ver foto
                                </button>
                            ))}
                        </li>
                    ))}
                </ul>
            )}

            {retirando && (
                <ModalConfirmar
                    titulo={`Retirar tarima ${tarima.posicion}`}
                    etiquetaConfirmar="Retirar"
                    descripcion={<p>La tarima sale del bloque (por ejemplo, ya se despachó). Sus pulpeos se conservan.</p>}
                    onConfirmar={retirar}
                    onCerrar={() => setRetirando(false)}
                />
            )}
        </Modal>
    );
}
