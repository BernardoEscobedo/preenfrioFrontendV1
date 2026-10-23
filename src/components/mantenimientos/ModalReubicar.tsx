import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Container, Truck, Warehouse } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as temporalesService from "../../services/temporales.service";
import * as lineasService from "../../services/lineasFleteras.service";
import * as cajasService from "../../services/cajasRefrigeradas.service";
import type { CajaRefrigerada } from "../../types/cajaRefrigerada";
import type { LineaFletera } from "../../types/lineaFletera";
import type { CajaTemporal, DestinoCamara, RespuestaReubicar } from "../../types/temporal";

// ============================================================================
// SACAR LA FRUTA DE UNA CÁMARA · operativo+
// ============================================================================
// Saca TODA la fruta (dentro y en cola) de una cámara fuera de servicio, o
// reingresa la de una caja temporal. Destinos:
//
//   Caja nueva     se abre una caja de línea fletera como cámara temporal
//   Caja abierta   una caja temporal que ya está recibiendo fruta
//   Otra cámara    un preenfrío o conservación operando, con espacio
//
// La fruta no sale del inventario: la caja es una cámara más. Desde ahí se
// despacha o se reingresa cuando la cámara vuelva a operar.
// ============================================================================

type Modo = "nueva" | "caja" | "camara";

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const CAPACIDAD_SUGERIDA = 26;

interface Props {
    origen: { id_camara: number; nombre_camara: string; tarimas_dentro: number; cajas_dentro: number; tarimas_en_cola: number; es_caja?: boolean };
    onGuardado: (r: RespuestaReubicar) => void;
    onCerrar: () => void;
}

export default function ModalReubicar({ origen, onGuardado, onCerrar }: Props) {
    const reingreso = Boolean(origen.es_caja);
    const [modo, setModo] = useState<Modo>(reingreso ? "camara" : "nueva");
    const [destinos, setDestinos] = useState<DestinoCamara[]>([]);
    const [cajasAbiertas, setCajasAbiertas] = useState<CajaTemporal[]>([]);
    const [lineas, setLineas] = useState<LineaFletera[]>([]);
    const [cajasCat, setCajasCat] = useState<CajaRefrigerada[]>([]);
    const [cargando, setCargando] = useState(true);

    const [idDestino, setIdDestino] = useState("");
    const [idLinea, setIdLinea] = useState("");
    const [idCaja, setIdCaja] = useState("");
    const [capacidad, setCapacidad] = useState(String(CAPACIDAD_SUGERIDA));
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        let vivo = true;
        Promise.all([
            temporalesService.getDestinos(origen.id_camara),
            temporalesService.getCajas(),
            reingreso ? Promise.resolve([]) : lineasService.getLineas(1),
            reingreso ? Promise.resolve([]) : cajasService.getCajas(1)
        ])
            .then(([d, c, l, k]) => {
                if (!vivo) return;
                setDestinos(d);
                setCajasAbiertas(c.filter((x) => x.id_camara !== origen.id_camara));
                setLineas([...l].sort((a, b) => a.razon_social.localeCompare(b.razon_social, "es")));
                setCajasCat(k);
            })
            .catch((e) => vivo && setError(mensajeError(e)))
            .finally(() => vivo && setCargando(false));
        return () => {
            vivo = false;
        };
    }, [origen.id_camara, reingreso]);

    const camarasOperando = destinos.filter((d) => Number(d.tipo_camara) !== 3);
    const ocupadas = useMemo(() => new Set(cajasAbiertas.map((c) => c.placas_caja)), [cajasAbiertas]);
    const cajasDeLinea = cajasCat.filter(
        (c) => (c.id_linea_fletera === null || String(c.id_linea_fletera) === idLinea) && !ocupadas.has(c.placas)
    );

    const espacioElegido =
        modo === "camara"
            ? num(camarasOperando.find((d) => String(d.id_camara) === idDestino)?.espacio)
            : modo === "caja"
                ? num(cajasAbiertas.find((c) => String(c.id_camara) === idDestino)?.espacio)
                : Number(capacidad) || 0;
    const noCabe = (modo === "nueva" || idDestino) && origen.tarimas_dentro > espacioElegido;

    const guardar = async () => {
        setError("");
        let destino;
        if (modo === "nueva") {
            const cap = Number(capacidad);
            if (!idLinea) return setError("Elige la línea fletera.");
            if (!idCaja) return setError("Elige la caja refrigerada.");
            if (!Number.isInteger(cap) || cap < 1 || cap > 40) return setError("La capacidad de la caja es de 1 a 40 tarimas.");
            destino = { nueva: { id_linea_fletera: Number(idLinea), id_caja_refrigerada: Number(idCaja), capacidad: cap } };
        } else {
            if (!idDestino) return setError(modo === "caja" ? "Elige la caja." : "Elige la cámara.");
            destino = { id_camara: Number(idDestino) };
        }
        if (noCabe) return setError(`No caben ${origen.tarimas_dentro} tarimas: elige otro destino o una caja más grande.`);

        setEnviando(true);
        try {
            onGuardado(await temporalesService.reubicar(origen.id_camara, destino));
        } catch (e) {
            setError(mensajeError(e));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={reingreso ? `Reingresar fruta de ${origen.nombre_camara}` : `Sacar la fruta de ${origen.nombre_camara}`}
            subtitulo={`${origen.tarimas_dentro} tarima(s) · ${origen.cajas_dentro} cajas dentro${origen.tarimas_en_cola ? ` · ${origen.tarimas_en_cola} en cola` : ""}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        {reingreso ? "Cancelar" : "Después"}
                    </button>
                    <button type="button" className="boton boton--primario" onClick={guardar} disabled={enviando || cargando}>
                        {enviando ? <span className="spinner spinner--chico" /> : "Mover toda la fruta"}
                    </button>
                </>
            }
        >
            {!reingreso && (
                <div className="alerta alerta--aviso">
                    <AlertTriangle size={16} className="icono-en-linea" /> La cámara está fuera de servicio: hay que sacar su fruta. El mantenimiento no
                    se podrá finalizar mientras tenga fruta dentro. También puedes despacharla desde Despachos.
                </div>
            )}

            {error && <div className="alerta alerta--error">{error}</div>}

            <div className="segmentado reubicar__modos" role="radiogroup">
                {!reingreso && (
                    <button type="button" className={modo === "nueva" ? "activo" : ""} onClick={() => { setModo("nueva"); setIdDestino(""); }}>
                        <Truck size={16} /> Caja nueva
                    </button>
                )}
                <button type="button" className={modo === "caja" ? "activo" : ""} onClick={() => { setModo("caja"); setIdDestino(""); }}>
                    <Container size={16} /> Caja abierta {cajasAbiertas.length > 0 && <span>{cajasAbiertas.length}</span>}
                </button>
                <button type="button" className={modo === "camara" ? "activo" : ""} onClick={() => { setModo("camara"); setIdDestino(""); }}>
                    <Warehouse size={16} /> Otra cámara
                </button>
            </div>

            {cargando ? (
                <div className="spinner" />
            ) : (
                <div className="formulario">
                    {modo === "nueva" && (
                        <>
                            <label className="campo campo--completo">
                                <span>Línea fletera</span>
                                <select value={idLinea} onChange={(e) => { setIdLinea(e.target.value); setIdCaja(""); }} disabled={enviando}>
                                    <option value="">Selecciona…</option>
                                    {lineas.map((l) => (
                                        <option key={l.id_linea_fletera} value={l.id_linea_fletera}>
                                            {l.razon_social}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="campo">
                                <span>Caja refrigerada</span>
                                <select value={idCaja} onChange={(e) => setIdCaja(e.target.value)} disabled={enviando || !idLinea}>
                                    <option value="">{idLinea ? "Selecciona…" : "Elige primero la línea"}</option>
                                    {cajasDeLinea.map((c) => (
                                        <option key={c.id_caja_refrigerada} value={c.id_caja_refrigerada}>
                                            {c.placas} · Eco {c.numero_economico}
                                            {c.largo_pies ? ` · ${c.largo_pies}'` : ""}
                                        </option>
                                    ))}
                                </select>
                                {idLinea && cajasDeLinea.length === 0 && (
                                    <small className="campo__ayuda">Esta línea no tiene cajas disponibles. Dala de alta en Catálogos › Cajas refrigeradas.</small>
                                )}
                            </label>
                            <label className="campo">
                                <span>Capacidad (tarimas)</span>
                                <input type="number" min={1} max={40} value={capacidad} onChange={(e) => setCapacidad(e.target.value)} disabled={enviando} />
                            </label>
                        </>
                    )}

                    {modo === "caja" &&
                        (cajasAbiertas.length === 0 ? (
                            <p className="pieza__vacio">No hay cajas abiertas.</p>
                        ) : (
                            <label className="campo campo--completo">
                                <span>Caja temporal</span>
                                <select value={idDestino} onChange={(e) => setIdDestino(e.target.value)} disabled={enviando}>
                                    <option value="">Selecciona…</option>
                                    {cajasAbiertas.map((c) => (
                                        <option key={c.id_camara} value={c.id_camara}>
                                            {c.nombre_camara} · {c.razon_social} · {Math.max(num(c.espacio), 0)} libres de {c.capacidad_max_tarimas}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ))}

                    {modo === "camara" &&
                        (camarasOperando.length === 0 ? (
                            <p className="pieza__vacio">No hay cámaras operando con acceso.</p>
                        ) : (
                            <label className="campo campo--completo">
                                <span>Cámara destino</span>
                                <select value={idDestino} onChange={(e) => setIdDestino(e.target.value)} disabled={enviando}>
                                    <option value="">Selecciona…</option>
                                    {camarasOperando.map((d) => (
                                        <option key={d.id_camara} value={d.id_camara}>
                                            {d.nombre_camara} · {Number(d.tipo_camara) === 1 ? "Preenfrío" : "Conservación"} · {Math.max(num(d.espacio), 0)} libres
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ))}
                </div>
            )}

            {noCabe && (
                <small className="campo__mensaje">
                    No caben {origen.tarimas_dentro} tarimas ({espacioElegido} espacios). Usa otro destino o despacha una parte primero.
                </small>
            )}
            {origen.tarimas_en_cola > 0 && (
                <p className="formulario__nota">La fruta en cola también pasa al destino; entra lo que quepa y el resto sigue en espera.</p>
            )}
        </Modal>
    );
}
