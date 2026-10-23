import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, Layers, Plus, RefreshCw, Snowflake, Thermometer, Warehouse } from "lucide-react";
import EncabezadoPagina from "../components/layout/EncabezadoPagina";
import ModalArmarBloque from "../components/bloques/ModalArmarBloque";
import ModalTarima from "../components/bloques/ModalTarima";
import Avisos from "../components/ui/Avisos";
import { useAvisos } from "../hooks/useAvisos";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../config/permissions";
import { mensajeError } from "../api/axios";
import * as tarimasService from "../services/tarimas.service";
import { fechaHora } from "../utils/formato";
import type { BloqueTarimas, CamaraBloques, RespuestaBloques, Tarima } from "../types/tarima";
import "../styles/crud.css";
import "../styles/usuarios.css";
import "../styles/fincas.css";
import "../styles/despachoAsistente.css";
import "../styles/bloques.css";

// ============================================================================
// BLOQUES Y PULPEOS
// ============================================================================
// Se elige la cámara (preenfrío o conservación). Cada bloque se ve como una
// rejilla de 10 o 12 posiciones; cada tarima muestra su color de pulpeo,
// su última temperatura y sus horas dentro.
//
//   Verde   pulpeada hace menos de 1 h
//   Ámbar   ya le toca (1 h a 1 h 15)
//   Rojo    pulpeo vencido
//   Gris    conservación (sin frecuencia fija)
//   ⚠ 5 h  lleva 5 h o más en preenfrío
//
// El traslado del bloque a conservación (completo o parcial) se hace en
// Movimientos. Las posiciones que ya pasaron a otra cámara se muestran
// como "En <cámara>".
//
// Se refresca cada minuto: el color cambia solo conforme pasa el tiempo.
// ============================================================================

const REFRESCO_MS = 60_000;
const num = (v: number | string | null | undefined) => Number(v ?? 0);

export default function BloquesPulpeos() {
    const { usuario } = useAuth();
    const { avisos, mostrar, quitar } = useAvisos();
    const esSupervisor = tieneRol(usuario, ROLES.SUPERVISOR);

    const [camaras, setCamaras] = useState<CamaraBloques[]>([]);
    const [idCamara, setIdCamara] = useState<number | null>(null);
    const [datos, setDatos] = useState<RespuestaBloques | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [armando, setArmando] = useState<{ bloque: BloqueTarimas | null } | null>(null);
    const [tarima, setTarima] = useState<{ tarima: Tarima; codigo: string } | null>(null);

    useEffect(() => {
        tarimasService
            .getCamaras()
            .then((c) => {
                setCamaras(c);
                setIdCamara((a) => a ?? c[0]?.id_camara ?? null);
            })
            .catch((e) => setError(mensajeError(e)));
    }, []);

    const cargar = useCallback(async () => {
        if (idCamara === null) return setCargando(false);
        setCargando(true);
        try {
            setDatos(await tarimasService.getBloques(idCamara));
            setError("");
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargando(false);
        }
    }, [idCamara]);

    useEffect(() => {
        cargar();
        const t = setInterval(cargar, REFRESCO_MS);
        return () => clearInterval(t);
    }, [cargar]);

    const camara = camaras.find((c) => c.id_camara === idCamara) ?? null;
    const preenfrio = Number(camara?.tipo_camara) === 1;

    const terminar = (mensaje: string) => {
        setArmando(null);
        setTarima(null);
        mostrar("exito", mensaje);
        cargar();
    };

    return (
        <div className="crud">
            <EncabezadoPagina titulo="Bloques y pulpeos" subtitulo="Temperatura de pulpa por tarima">
                {camara && (
                    <button type="button" className="boton-encabezado boton-encabezado--primario" onClick={() => setArmando({ bloque: null })}>
                        <Plus size={18} />
                        <span>Armar bloque</span>
                    </button>
                )}
                <button type="button" className="boton-icono boton-icono--borde" onClick={cargar} disabled={cargando} title="Actualizar" aria-label="Actualizar">
                    <RefreshCw size={18} className={cargando ? "girando" : ""} />
                </button>
            </EncabezadoPagina>

            <div className="segmentado bloques__camaras" role="tablist">
                {camaras.map((c) => (
                    <button
                        key={c.id_camara}
                        type="button"
                        role="tab"
                        aria-selected={c.id_camara === idCamara}
                        className={c.id_camara === idCamara ? "activo" : ""}
                        onClick={() => setIdCamara(c.id_camara)}
                    >
                        {Number(c.tipo_camara) === 1 ? <Snowflake size={16} /> : <Warehouse size={16} />} {c.nombre_camara}
                    </button>
                ))}
            </div>

            {error && <div className="alerta alerta--error">{error}</div>}

            {datos && (
                <section className="crud__resumen crud__resumen--cuatro">
                    <div className="mini-kpi">
                        <Layers size={22} />
                        <div>
                            <strong>{datos.resumen.bloques}</strong>
                            <span>Bloques · {datos.resumen.tarimas} tarimas</span>
                        </div>
                    </div>
                    <div className="mini-kpi mini-kpi--ambar">
                        <Thermometer size={22} />
                        <div>
                            <strong>{datos.resumen.por_pulpear}</strong>
                            <span>Por pulpear</span>
                        </div>
                    </div>
                    <div className="mini-kpi" style={{ color: "var(--rojo)" }}>
                        <Clock size={22} />
                        <div>
                            <strong>{datos.resumen.vencidas}</strong>
                            <span>Pulpeo vencido</span>
                        </div>
                    </div>
                    <div className="mini-kpi" style={{ color: "var(--rojo)" }}>
                        <AlertTriangle size={22} />
                        <div>
                            <strong>{datos.resumen.alerta_5h}</strong>
                            <span>Más de 5 h en preenfrío</span>
                        </div>
                    </div>
                </section>
            )}

            {preenfrio && (
                <div className="bloques__leyenda">
                    <span className="leyenda leyenda--al_dia">Al día</span>
                    <span className="leyenda leyenda--toca">Toca pulpear</span>
                    <span className="leyenda leyenda--vencido">Vencido</span>
                    <span className="leyenda leyenda--primero">Recién ingresó</span>
                </div>
            )}

            {cargando && !datos ? (
                <div className="crud__vacio">
                    <div className="spinner" />
                    <p>Cargando bloques…</p>
                </div>
            ) : datos && datos.bloques.length === 0 ? (
                <div className="crud__vacio">
                    <Layers size={40} />
                    <p>No hay bloques en {camara?.nombre_camara}.</p>
                    {camara && (
                        <button type="button" className="boton boton--primario boton--auto" onClick={() => setArmando({ bloque: null })}>
                            <Plus size={18} /> Armar bloque
                        </button>
                    )}
                </div>
            ) : (
                <div className="bloques">
                    {datos?.bloques.map((b) => {
                        const porPosicion = new Map(b.tarimas.map((t) => [t.posicion, t]));
                        const fuera = new Map(b.posiciones_fuera.map((f) => [f.posicion, f.nombre_camara]));
                        const libres = b.posiciones - b.tarimas.length - b.posiciones_fuera.length;
                        return (
                            <section key={b.id_bloque} className="panel bloque">
                                <div className="panel__titulo">
                                    <h2>
                                        <Layers size={20} /> <span className="mono">{b.codigo_bloque}</span>
                                    </h2>
                                    <small>
                                        {b.tarimas.length}/{b.posiciones} tarimas aquí · armado {fechaHora(b.fecha_hora_armado)}
                                    </small>
                                    {libres > 0 && (
                                        <div className="bloque__acciones">
                                            <button type="button" className="boton boton--claro boton--auto boton--chico" onClick={() => setArmando({ bloque: b })}>
                                                <Plus size={14} /> Completar
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className={`bloque__rejilla bloque__rejilla--${b.posiciones}`}>
                                    {Array.from({ length: b.posiciones }, (_, i) => i + 1).map((pos) => {
                                        const t = porPosicion.get(pos);
                                        if (!t) {
                                            const enOtra = fuera.get(pos);
                                            return (
                                                <div key={pos} className="posicion posicion--vacia">
                                                    <strong>{pos}</strong>
                                                    <small>{enOtra ? `En ${enOtra}` : "Libre"}</small>
                                                </div>
                                            );
                                        }
                                        const skus = [...new Set(t.lotes.map((l) => l.codigo_sku))].join(", ");
                                        return (
                                            <button
                                                key={pos}
                                                type="button"
                                                className={`posicion posicion--${t.estado_pulpeo} ${t.alerta_5h ? "posicion--5h" : ""}`}
                                                onClick={() => setTarima({ tarima: t, codigo: b.codigo_bloque })}
                                                title={t.lotes.map((l) => `${l.codigo_lote} ${l.codigo_sku} ${l.cantidad_cajas} cj`).join("\n")}
                                            >
                                                <strong>{pos}</strong>
                                                <span className="posicion__temp">
                                                    {t.ultima_temperatura === null ? "—" : `${num(t.ultima_temperatura)}°`}
                                                </span>
                                                <small>
                                                    {t.minutos_desde_pulpeo === null ? "sin pulpeo" : `hace ${num(t.minutos_desde_pulpeo)} min`}
                                                </small>
                                                <small className="posicion__sku">{skus}</small>
                                                <small className="posicion__horas">
                                                    {t.alerta_5h && <AlertTriangle size={11} />} {num(t.horas_en_camara)} h
                                                </small>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            {armando && camara && (
                <ModalArmarBloque camara={camara} bloque={armando.bloque} onGuardado={terminar} onCerrar={() => setArmando(null)} />
            )}

            {tarima && (
                <ModalTarima
                    tarima={tarima.tarima}
                    codigoBloque={tarima.codigo}
                    puedeRetirar={esSupervisor}
                    onCambio={terminar}
                    onCerrar={() => setTarima(null)}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
