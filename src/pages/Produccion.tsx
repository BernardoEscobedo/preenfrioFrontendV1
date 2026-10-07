import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, FileSpreadsheet, RefreshCw, Search, Snowflake, Truck } from "lucide-react";
import EncabezadoPagina from "../components/layout/EncabezadoPagina";
import ImportarProduccion from "../components/produccion/ImportarProduccion";
import AsignarPreenfrio from "../components/produccion/AsignarPreenfrio";
import Avisos from "../components/ui/Avisos";
import { useAvisos } from "../hooks/useAvisos";
import { useAuth } from "../context/AuthContext";
import { ROLES, tieneRol } from "../config/permissions";
import { mensajeError } from "../api/axios";
import * as produccionService from "../services/produccion.service";
import { semanaActual } from "../utils/excelProduccion";
import { fechaCorta, normalizar } from "../utils/formato";
import type { Produccion as FilaProduccion } from "../types/produccion";
import "../styles/crud.css";
import "../styles/usuarios.css";
import "../styles/fincas.css";
import "../styles/produccion.css";

// ============================================================================
// PRODUCCIÓN · plan semanal
// ============================================================================
//   Plan               operativo+   lo que se va a recibir
//   Importar Excel     coordinador+ carga la producción del día (sin cámara)
//   Asignar preenfrío  coordinador+ decide la cámara de cada línea
//
// Un supervisor solo ve el plan de SUS cámaras (lo recorta el backend), así
// que lo que todavía no tiene preenfrío no le aparece.
// ============================================================================

type Pestana = "plan" | "importar" | "asignar";

const CHIP_ESTADO: Record<number, string> = { 0: "chip--rojo", 1: "chip--gris", 2: "chip--ambar", 3: "chip--verde" };

export default function Produccion() {
    const { usuario } = useAuth();
    const { avisos, mostrar, quitar } = useAvisos();
    const esCoordinador = tieneRol(usuario, ROLES.COORDINADOR);

    const [pestana, setPestana] = useState<Pestana>("plan");
    const [semana, setSemana] = useState<number | null>(semanaActual());
    const [plan, setPlan] = useState<FilaProduccion[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [buscar, setBuscar] = useState("");

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setPlan(await produccionService.getProduccion(semana));
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargando(false);
        }
    }, [semana]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const activas = plan.filter((p) => Number(p.estado) !== 0);
    const totales = {
        lineas: activas.length,
        cajas: activas.reduce((s, p) => s + Number(p.cajas_procesadas ?? 0), 0),
        tarimas: activas.reduce((s, p) => s + Number(p.estiba_pallets ?? 0), 0),
        sinCamara: activas.filter((p) => p.id_camara === null).length
    };

    const visibles = useMemo(() => {
        const t = normalizar(buscar.trim());
        if (!t) return plan;
        return plan.filter((p) =>
            normalizar(
                `${p.codigo_lote ?? ""} ${p.codigo_productor} ${p.nombre_finca} ${p.acronimo_cc} ${p.cliente} ${p.codigo_sku} ${p.nombre_camara ?? ""}`
            ).includes(t)
        );
    }, [plan, buscar]);

    return (
        <div className="crud">
            <EncabezadoPagina titulo="Producción" subtitulo="Plan semanal de fruta empacada">
                <label className="produccion__semana">
                    Semana
                    <input
                        type="number"
                        min={1}
                        max={53}
                        value={semana ?? ""}
                        onChange={(e) => setSemana(e.target.value ? Number(e.target.value) : null)}
                    />
                </label>
            </EncabezadoPagina>

            <div className="segmentado produccion__pestanas" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={pestana === "plan"}
                    className={pestana === "plan" ? "activo" : ""}
                    onClick={() => setPestana("plan")}
                >
                    <ClipboardList size={16} /> Plan
                </button>
                {esCoordinador && (
                    <>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={pestana === "importar"}
                            className={pestana === "importar" ? "activo" : ""}
                            onClick={() => setPestana("importar")}
                        >
                            <FileSpreadsheet size={16} /> Importar Excel
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={pestana === "asignar"}
                            className={pestana === "asignar" ? "activo" : ""}
                            onClick={() => setPestana("asignar")}
                        >
                            <Snowflake size={16} /> Asignar preenfrío
                        </button>
                    </>
                )}
            </div>

            {pestana === "importar" && esCoordinador && (
                <ImportarProduccion
                    mostrar={mostrar}
                    onImportado={() => {
                        cargar();
                        setPestana("asignar");
                    }}
                />
            )}

            {pestana === "asignar" && esCoordinador && (
                <AsignarPreenfrio semana={semana} mostrar={mostrar} onAsignado={cargar} />
            )}

            {pestana === "plan" && (
                <>
                    <section className="crud__resumen crud__resumen--cuatro">
                        <div className="mini-kpi">
                            <ClipboardList size={22} />
                            <div>
                                <strong>{totales.lineas}</strong>
                                <span>Líneas activas</span>
                            </div>
                        </div>
                        <div className="mini-kpi">
                            <Truck size={22} />
                            <div>
                                <strong>{totales.tarimas}</strong>
                                <span>Tarimas</span>
                            </div>
                        </div>
                        <div className="mini-kpi">
                            <FileSpreadsheet size={22} />
                            <div>
                                <strong>{totales.cajas.toLocaleString("es-MX")}</strong>
                                <span>Cajas</span>
                            </div>
                        </div>
                        <div className="mini-kpi mini-kpi--ambar">
                            <Snowflake size={22} />
                            <div>
                                <strong>{totales.sinCamara}</strong>
                                <span>Sin preenfrío</span>
                            </div>
                        </div>
                    </section>

                    <section className="panel">
                        <div className="crud__barra">
                            <label className="buscador">
                                <Search size={18} />
                                <input
                                    type="search"
                                    value={buscar}
                                    onChange={(e) => setBuscar(e.target.value)}
                                    placeholder="Buscar lote, finca, destino, SKU o cámara…"
                                />
                            </label>
                            <button
                                type="button"
                                className="boton-icono boton-icono--borde"
                                onClick={cargar}
                                disabled={cargando}
                                title="Actualizar"
                                aria-label="Actualizar"
                            >
                                <RefreshCw size={18} className={cargando ? "girando" : ""} />
                            </button>
                        </div>

                        {error && <div className="alerta alerta--error">{error}</div>}

                        {cargando && plan.length === 0 ? (
                            <div className="crud__vacio">
                                <div className="spinner" />
                                <p>Cargando producción…</p>
                            </div>
                        ) : visibles.length === 0 && !error ? (
                            <div className="crud__vacio">
                                <ClipboardList size={40} />
                                <p>
                                    {buscar
                                        ? "Nada coincide con la búsqueda."
                                        : `No hay producción${semana ? ` en la semana ${semana}` : ""}.`}
                                </p>
                                {esCoordinador && !buscar && (
                                    <button
                                        type="button"
                                        className="boton boton--primario boton--auto"
                                        onClick={() => setPestana("importar")}
                                    >
                                        <FileSpreadsheet size={18} /> Importar Excel
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="tabla-contenedor">
                                <table className="tabla tabla--crud">
                                    <thead>
                                        <tr>
                                            <th>Lote</th>
                                            <th>Finca</th>
                                            <th>Empaque / Entrega</th>
                                            <th>Destino</th>
                                            <th>SKU</th>
                                            <th>Cajas / Tarimas</th>
                                            <th>Preenfrío</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibles.map((p) => (
                                            <tr key={p.id_produccion} className={Number(p.estado) === 0 ? "fila--baja" : ""}>
                                                <td data-etiqueta="Lote">
                                                    <span className="lote-chip mono">{p.codigo_lote ?? "—"}</span>
                                                </td>
                                                <td data-etiqueta="Finca">
                                                    <div className="celda-doble">
                                                        <span>
                                                            {p.codigo_productor} {p.codigo_finca} {p.nombre_finca}
                                                        </span>
                                                        <small>{p.nombre_productor}</small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Fechas">
                                                    <div className="celda-doble">
                                                        <span>{fechaCorta(p.fecha_empaque)}</span>
                                                        <small>{p.fecha_entrega ? `Entrega ${fechaCorta(p.fecha_entrega)}` : ""}</small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Destino">
                                                    <div className="celda-doble">
                                                        <span>{p.acronimo_cc}</span>
                                                        <small>
                                                            {p.cliente} · {p.cedis}
                                                        </small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="SKU">
                                                    <div className="celda-doble">
                                                        <span className="mono">{p.codigo_sku}</span>
                                                        <small>{p.calidad_sku}</small>
                                                    </div>
                                                </td>
                                                <td data-etiqueta="Cantidades">
                                                    {p.cajas_procesadas} cj · {p.estiba_pallets} tar
                                                </td>
                                                <td data-etiqueta="Preenfrío">
                                                    {p.nombre_camara ? (
                                                        <span className="chip chip--azul">{p.nombre_camara}</span>
                                                    ) : (
                                                        <span className="chip chip--ambar">Sin preenfrío</span>
                                                    )}
                                                </td>
                                                <td data-etiqueta="Estado">
                                                    <span className={`chip ${CHIP_ESTADO[Number(p.estado)] ?? "chip--gris"}`}>
                                                        {p.estado_texto}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
