import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Pencil, RefreshCw, Upload, X, XCircle } from "lucide-react";
import ModalConfirmar from "../ui/ModalConfirmar";
import ModalCorregirFila from "./ModalCorregirFila";
import { mensajeError } from "../../api/axios";
import * as produccionService from "../../services/produccion.service";
import { leerPlantillaProduccion } from "../../utils/excelProduccion";
import { fechaCorta } from "../../utils/formato";
import type { TipoAviso } from "../../hooks/useAvisos";
import type { CatalogosCorreccion, EstadoFila, FilaExcel, VistaPrevia } from "../../types/produccion";

// ============================================================================
// IMPORTAR PRODUCCIÓN DESDE EXCEL · coordinador+
// ============================================================================
// 1. Se elige el archivo; se lee en el navegador (no se sube el archivo).
// 2. El backend evalúa cada fila: ✅ lista · ⚠️ aviso · ❌ error · ya importada.
// 3. Se eligen los destinos sin equivalencia, se corrigen errores en el
//    modal y se decide el lote cuando el Excel y el sistema no coinciden.
//    Cada cambio vuelve a evaluar todo en el backend.
// 4. Guardar: entran ✅ y ⚠️, SIN cámara. Las filas con error se quedan fuera.
// ============================================================================

type Filtro = "todas" | EstadoFila;

const CHIP: Record<EstadoFila, { clase: string; texto: string }> = {
    ok: { clase: "chip--verde", texto: "Lista" },
    aviso: { clase: "chip--ambar", texto: "Revisar" },
    error: { clase: "chip--rojo", texto: "Error" },
    omitida: { clase: "chip--gris", texto: "Ya importada" }
};

const KPIS = [
    { estado: "ok", Icono: CheckCircle2, etiqueta: "Listas", clase: "" },
    { estado: "aviso", Icono: AlertTriangle, etiqueta: "Con aviso", clase: "mini-kpi--ambar" },
    { estado: "error", Icono: XCircle, etiqueta: "Con error", clase: "mini-kpi--rojo" },
    { estado: "omitida", Icono: RefreshCw, etiqueta: "Ya importadas", clase: "mini-kpi--gris" }
] as const;

interface Props {
    mostrar: (tipo: TipoAviso, texto: string) => void;
    onImportado: () => void;
}

export default function ImportarProduccion({ mostrar, onImportado }: Props) {
    const entradaArchivo = useRef<HTMLInputElement | null>(null);

    const [archivo, setArchivo] = useState("");
    const [filas, setFilas] = useState<FilaExcel[]>([]);
    const [destinos, setDestinos] = useState<Record<string, number>>({});
    const [vista, setVista] = useState<VistaPrevia | null>(null);
    const [catalogos, setCatalogos] = useState<CatalogosCorreccion | null>(null);

    const [leyendo, setLeyendo] = useState(false);
    const [evaluando, setEvaluando] = useState(false);
    const [error, setError] = useState("");
    const [filtro, setFiltro] = useState<Filtro>("todas");
    const [corrigiendo, setCorrigiendo] = useState<number | null>(null);
    const [confirmando, setConfirmando] = useState(false);

    useEffect(() => {
        produccionService.getCatalogos().then(setCatalogos).catch((e) => setError(mensajeError(e)));
    }, []);

    // ---- Evaluación en el backend ----
    const evaluar = useCallback(async (f: FilaExcel[], d: Record<string, number>) => {
        setEvaluando(true);
        setError("");
        try {
            setVista(await produccionService.vistaPrevia(f, d));
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setEvaluando(false);
        }
    }, []);

    const actualizar = (f: FilaExcel[], d: Record<string, number> = destinos) => {
        setFilas(f);
        setDestinos(d);
        evaluar(f, d);
    };

    // ---- Archivo ----
    const elegirArchivo = async (file: File | undefined) => {
        if (!file) return;
        setLeyendo(true);
        setError("");
        setVista(null);
        try {
            const lectura = await leerPlantillaProduccion(file);
            setArchivo(file.name);
            setFiltro("todas");
            actualizar(lectura.filas, {});
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo leer el archivo");
        } finally {
            setLeyendo(false);
            if (entradaArchivo.current) entradaArchivo.current.value = "";
        }
    };

    const limpiar = () => {
        setArchivo("");
        setFilas([]);
        setDestinos({});
        setVista(null);
        setError("");
    };

    // ---- Lote ----
    const elegirLote = (indice: number, usar: "sugerido" | "excel") =>
        actualizar(filas.map((f, i) => (i === indice ? { ...f, usar_lote: usar } : f)));

    const loteParaTodas = (usar: "sugerido" | "excel") => actualizar(filas.map((f) => ({ ...f, usar_lote: usar })));

    const hayLotesDistintos = vista?.filas.some(
        (r) => r.lote.excel_valido && r.lote.sugerido && r.lote.excel !== r.lote.sugerido
    );

    // ---- Derivados ----
    const visibles = useMemo(() => {
        if (!vista) return [];
        return vista.filas.map((r, i) => ({ r, i })).filter(({ r }) => filtro === "todas" || r.estado === filtro);
    }, [vista, filtro]);

    const aGuardar = vista ? vista.resumen.ok + vista.resumen.aviso : 0;

    // ---- Confirmar ----
    const guardar = async () => {
        try {
            const r = await produccionService.confirmar(filas, destinos, archivo, aGuardar);
            setConfirmando(false);
            mostrar("exito", r.mensaje);
            if (r.equivalencias_guardadas > 0)
                mostrar("info", `Se recordaron ${r.equivalencias_guardadas} destino(s) para las próximas cargas.`);
            if (r.con_error > 0) mostrar("info", `${r.con_error} fila(s) con error no se guardaron.`);
            limpiar();
            onImportado();
        } catch (e) {
            const nueva = produccionService.vistaPreviaEnError(e);
            if (nueva) {
                setConfirmando(false);
                setVista(nueva);
            }
            throw e;
        }
    };

    // ---- Sin archivo ----
    if (!vista && !evaluando) {
        return (
            <section className="panel">
                <div
                    className="importacion__zona"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        elegirArchivo(e.dataTransfer?.files?.[0]);
                    }}
                >
                    <FileSpreadsheet size={44} />
                    <strong>Arrastra aquí la plantilla de producción</strong>
                    <span>o</span>
                    <button
                        type="button"
                        className="boton boton--primario boton--auto"
                        onClick={() => entradaArchivo.current?.click()}
                        disabled={leyendo}
                    >
                        {leyendo ? (
                            <span className="spinner spinner--chico" />
                        ) : (
                            <>
                                <Upload size={18} /> Elegir Excel
                            </>
                        )}
                    </button>
                    <small>
                        Columnas: Semana, Region, Finca, Productor, fecha_empaque, transito, fecha_entrega, CEDIS,
                        Cliente, SKU, Cajas Procesadas, Estiba_Pallets, comentarios, Lote.
                    </small>
                    <input
                        ref={entradaArchivo}
                        type="file"
                        accept=".xlsx,.xls,.xlsm"
                        hidden
                        onChange={(e) => elegirArchivo(e.target.files?.[0])}
                    />
                </div>
                {error && <div className="alerta alerta--error">{error}</div>}
            </section>
        );
    }

    const actual = corrigiendo !== null && vista ? vista.filas[corrigiendo] : null;

    // ---- Vista previa ----
    return (
        <>
            <section className="crud__resumen crud__resumen--cuatro">
                {KPIS.map(({ estado, Icono, etiqueta, clase }) => (
                    <button
                        key={estado}
                        type="button"
                        className={`mini-kpi mini-kpi--boton ${clase} ${filtro === estado ? "mini-kpi--seleccionado" : ""}`}
                        onClick={() => setFiltro((f) => (f === estado ? "todas" : estado))}
                    >
                        <Icono size={22} />
                        <div>
                            <strong>{vista?.resumen[estado] ?? 0}</strong>
                            <span>{etiqueta}</span>
                        </div>
                    </button>
                ))}
            </section>

            {vista && vista.destinos_pendientes.length > 0 && catalogos && (
                <section className="panel">
                    <div className="panel__titulo">
                        <h2>Destinos sin equivalencia</h2>
                    </div>
                    <p className="importacion__nota">
                        Elige una vez a qué destino del catálogo corresponde cada pareja. Se aplica a todas sus filas y
                        se recuerda al guardar.
                    </p>
                    <div className="importacion__destinos">
                        {vista.destinos_pendientes.map((d) => (
                            <label key={d.clave} className="campo">
                                <span>
                                    {d.cedis_excel} / {d.cliente_excel} <small>({d.filas} fila(s))</small>
                                </span>
                                <select
                                    value={destinos[d.clave] ?? ""}
                                    disabled={evaluando}
                                    onChange={(e) => actualizar(filas, { ...destinos, [d.clave]: Number(e.target.value) })}
                                >
                                    <option value="">Selecciona…</option>
                                    {catalogos.cedis.map((c) => (
                                        <option key={c.id_cc} value={c.id_cc}>
                                            {c.acronimo} · {c.cliente} · {c.cedis}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ))}
                    </div>
                </section>
            )}

            <section className="panel">
                <div className="crud__barra">
                    <div className="importacion__archivo">
                        <FileSpreadsheet size={20} />
                        <strong>{archivo}</strong>
                        <small>
                            {vista?.resumen.total ?? 0} filas · {aGuardar} por guardar ({vista?.resumen.cajas ?? 0}{" "}
                            cajas, {vista?.resumen.tarimas ?? 0} tarimas)
                        </small>
                    </div>

                    {hayLotesDistintos && (
                        <div className="segmentado">
                            <button type="button" onClick={() => loteParaTodas("sugerido")} disabled={evaluando}>
                                Lote sugerido en todas
                            </button>
                            <button type="button" onClick={() => loteParaTodas("excel")} disabled={evaluando}>
                                Lote del Excel en todas
                            </button>
                        </div>
                    )}

                    <button
                        type="button"
                        className="boton-icono boton-icono--borde"
                        onClick={() => evaluar(filas, destinos)}
                        disabled={evaluando}
                        title="Revalidar"
                        aria-label="Revalidar"
                    >
                        <RefreshCw size={18} className={evaluando ? "girando" : ""} />
                    </button>
                    <button type="button" className="boton boton--claro boton--auto" onClick={limpiar} disabled={evaluando}>
                        <X size={16} /> Otro archivo
                    </button>
                    <button
                        type="button"
                        className="boton boton--primario boton--auto"
                        onClick={() => setConfirmando(true)}
                        disabled={evaluando || aGuardar === 0}
                    >
                        Guardar {aGuardar} fila(s)
                    </button>
                </div>

                {filtro !== "todas" && (
                    <div className="filtros-activos">
                        <span className="chip chip--azul">{CHIP[filtro].texto}</span>
                        <button type="button" className="enlace enlace--verde" onClick={() => setFiltro("todas")}>
                            <X size={14} /> Ver todas
                        </button>
                    </div>
                )}

                {error && <div className="alerta alerta--error">{error}</div>}

                {evaluando && !vista ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Revisando el archivo…</p>
                    </div>
                ) : (
                    <div className={`tabla-contenedor ${evaluando ? "importacion--cargando" : ""}`}>
                        <table className="tabla tabla--crud importacion__tabla">
                            <thead>
                                <tr>
                                    <th>Fila</th>
                                    <th>Estado</th>
                                    <th>Finca</th>
                                    <th>Empaque / Entrega</th>
                                    <th>Destino</th>
                                    <th>SKU</th>
                                    <th>Cajas / Tarimas</th>
                                    <th>Lote</th>
                                    <th>Observaciones</th>
                                    <th className="acciones">Corregir</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map(({ r, i }) => {
                                    const entrada = filas[i];
                                    const distintos =
                                        r.lote.excel_valido && r.lote.sugerido && r.lote.excel !== r.lote.sugerido;
                                    return (
                                        <tr key={`${r.fila}-${i}`} className={`importacion__fila--${r.estado}`}>
                                            <td data-etiqueta="Fila" className="mono">
                                                {r.fila}
                                            </td>
                                            <td data-etiqueta="Estado">
                                                <span className={`chip ${CHIP[r.estado].clase}`}>{CHIP[r.estado].texto}</span>
                                            </td>
                                            <td data-etiqueta="Finca">
                                                <div className="celda-doble">
                                                    <span>{r.datos.finca ?? String(entrada?.finca ?? "—")}</span>
                                                    <small>{r.datos.productor ?? String(entrada?.productor ?? "")}</small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Fechas">
                                                <div className="celda-doble">
                                                    <span>
                                                        {r.datos.fecha_empaque
                                                            ? fechaCorta(r.datos.fecha_empaque)
                                                            : String(entrada?.fecha_empaque ?? "—")}
                                                    </span>
                                                    <small>
                                                        {r.datos.fecha_entrega ? `Entrega ${fechaCorta(r.datos.fecha_entrega)}` : ""}
                                                        {r.datos.semana ? ` · S${r.datos.semana}` : ""}
                                                    </small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Destino">
                                                <div className="celda-doble">
                                                    <span>{r.datos.acronimo_cc ?? "—"}</span>
                                                    <small>
                                                        {r.destino.cedis_excel} / {r.destino.cliente_excel}
                                                    </small>
                                                </div>
                                            </td>
                                            <td data-etiqueta="SKU">
                                                <div className="celda-doble">
                                                    <span className="mono">{r.datos.codigo_sku ?? String(entrada?.sku ?? "—")}</span>
                                                    {r.datos.calidad && <small>{r.datos.calidad}</small>}
                                                </div>
                                            </td>
                                            <td data-etiqueta="Cantidades">
                                                {r.datos.cajas ?? "—"} cj · {r.datos.tarimas ?? "—"} tar
                                            </td>
                                            <td data-etiqueta="Lote">
                                                {distintos && r.estado !== "omitida" ? (
                                                    <select
                                                        className="importacion__lote"
                                                        value={r.lote.usar}
                                                        disabled={evaluando}
                                                        onChange={(e) => elegirLote(i, e.target.value as "sugerido" | "excel")}
                                                    >
                                                        <option value="sugerido">Sugerido: {r.lote.sugerido}</option>
                                                        <option value="excel">Excel: {r.lote.excel}</option>
                                                    </select>
                                                ) : (
                                                    <span className="lote-chip mono">
                                                        {r.datos.codigo_lote ?? r.lote.excel ?? "—"}
                                                    </span>
                                                )}
                                            </td>
                                            <td data-etiqueta="Observaciones">
                                                {r.mensajes.length === 0 ? (
                                                    <small>—</small>
                                                ) : (
                                                    <ul className="importacion__mensajes">
                                                        {r.mensajes.map((m, k) => (
                                                            <li
                                                                key={k}
                                                                className={`importacion__mensaje importacion__mensaje--${m.nivel}`}
                                                            >
                                                                {m.texto}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </td>
                                            <td className="acciones">
                                                {(r.estado === "error" || r.estado === "aviso") && (
                                                    <button
                                                        type="button"
                                                        className="boton-icono"
                                                        onClick={() => setCorrigiendo(i)}
                                                        disabled={evaluando || !catalogos}
                                                        title="Corregir fila"
                                                        aria-label={`Corregir fila ${r.fila}`}
                                                    >
                                                        <Pencil size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {actual && corrigiendo !== null && catalogos && (
                <ModalCorregirFila
                    entrada={filas[corrigiendo]}
                    resultado={actual}
                    catalogos={catalogos}
                    destinoActual={actual.destino.id_cc}
                    onCerrar={() => setCorrigiendo(null)}
                    onGuardar={(fila, destino) => {
                        const nuevas = filas.map((f, i) => (i === corrigiendo ? fila : f));
                        const nuevosDestinos = destino ? { ...destinos, [destino.clave]: destino.id_cc } : destinos;
                        setCorrigiendo(null);
                        actualizar(nuevas, nuevosDestinos);
                    }}
                />
            )}

            {confirmando && vista && (
                <ModalConfirmar
                    titulo={`Guardar ${aGuardar} línea(s) de producción`}
                    etiquetaConfirmar="Guardar"
                    tono="primario"
                    descripcion={
                        <>
                            <p>
                                Se guardan <strong>{vista.resumen.ok} lista(s)</strong> y{" "}
                                <strong>{vista.resumen.aviso} con aviso</strong>: {vista.resumen.cajas} cajas y{" "}
                                {vista.resumen.tarimas} tarimas, sin preenfrío asignado.
                            </p>
                            {vista.resumen.error > 0 && (
                                <p className="modal__advertencia">
                                    {vista.resumen.error} fila(s) con error <strong>no se guardarán</strong>. Si deben
                                    entrar, corrígelas antes.
                                </p>
                            )}
                            {vista.resumen.omitida > 0 && (
                                <p>{vista.resumen.omitida} fila(s) ya estaban importadas y se omiten.</p>
                            )}
                        </>
                    }
                    onConfirmar={guardar}
                    onCerrar={() => setConfirmando(false)}
                />
            )}
        </>
    );
}
