import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Snowflake, X } from "lucide-react";
import ModalConfirmar from "../ui/ModalConfirmar";
import { mensajeError } from "../../api/axios";
import * as produccionService from "../../services/produccion.service";
import { fechaCorta, normalizar } from "../../utils/formato";
import type { TipoAviso } from "../../hooks/useAvisos";
import type { CamaraPreenfrio, ProduccionSinCamara } from "../../types/produccion";

// ============================================================================
// ASIGNAR PREENFRÍO · coordinador+
// ============================================================================
// Producción sin cámara. Se seleccionan líneas y se mandan a un preenfrío;
// lo que no se asigna no pasa por preenfrío (CEDA o McAllen directo, por
// ejemplo). Una vez asignada, la ven los supervisores de esa cámara.
//
// Filtro por fecha de empaque: el coordinador trabaja la producción del día.
// La capacidad se muestra para decidir, no bloquea: lo que no quepa en el
// ciclo esperará en la cola de esa cámara al recibirse.
// ============================================================================

const num = (v: number | string | null | undefined) => Number(v ?? 0);

interface Props {
    semana: number | null;
    mostrar: (tipo: TipoAviso, texto: string) => void;
    onAsignado: () => void;
}

export default function AsignarPreenfrio({ semana, mostrar, onAsignado }: Props) {
    const [lineas, setLineas] = useState<ProduccionSinCamara[]>([]);
    const [camaras, setCamaras] = useState<CamaraPreenfrio[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [fecha, setFecha] = useState("");
    const [buscar, setBuscar] = useState("");
    const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
    const [destino, setDestino] = useState("");
    const [confirmando, setConfirmando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const [p, c] = await Promise.all([
                produccionService.getSinCamara({ semana, fecha_empaque: fecha || undefined }),
                produccionService.getCamaras()
            ]);
            setLineas(p);
            setCamaras(c);
            setSeleccion(new Set());
        } catch (e) {
            setError(mensajeError(e));
        } finally {
            setCargando(false);
        }
    }, [semana, fecha]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const visibles = useMemo(() => {
        const t = normalizar(buscar.trim());
        if (!t) return lineas;
        return lineas.filter((p) =>
            normalizar(
                `${p.codigo_lote ?? ""} ${p.codigo_productor} ${p.nombre_finca} ${p.acronimo_cc} ${p.cliente} ${p.cedis} ${p.codigo_sku}`
            ).includes(t)
        );
    }, [lineas, buscar]);

    const elegidas = lineas.filter((p) => seleccion.has(p.id_produccion));
    const tarimas = elegidas.reduce((s, p) => s + num(p.estiba_pallets), 0);
    const cajas = elegidas.reduce((s, p) => s + num(p.cajas_procesadas), 0);
    const camara = camaras.find((c) => String(c.id_camara) === destino);
    const excede = Boolean(camara && tarimas > camara.capacidad_max_tarimas);

    const todasVisibles = visibles.length > 0 && visibles.every((p) => seleccion.has(p.id_produccion));
    const alternarTodas = () =>
        setSeleccion((s) => {
            const n = new Set(s);
            visibles.forEach((p) => (todasVisibles ? n.delete(p.id_produccion) : n.add(p.id_produccion)));
            return n;
        });
    const alternar = (id: number) =>
        setSeleccion((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    const asignar = async () => {
        const r = await produccionService.asignarCamara([...seleccion], Number(destino));
        setConfirmando(false);
        mostrar("exito", r.mensaje);
        (r.avisos ?? []).forEach((a) => mostrar("info", a));
        setDestino("");
        cargar();
        onAsignado();
    };

    return (
        <>
            <section className="asignacion__camaras">
                {camaras.map((c) => (
                    <div key={c.id_camara} className={`mini-kpi ${c.en_mantenimiento ? "mini-kpi--gris" : ""}`}>
                        <Snowflake size={22} />
                        <div>
                            <strong>
                                {num(c.tarimas_ocupadas)}/{c.capacidad_max_tarimas}
                            </strong>
                            <span>
                                {c.nombre_camara}
                                {c.en_mantenimiento
                                    ? " · mantenimiento"
                                    : num(c.tarimas_en_espera)
                                        ? ` · ${num(c.tarimas_en_espera)} en cola`
                                        : ""}
                            </span>
                        </div>
                    </div>
                ))}
            </section>

            <section className="panel">
                <div className="crud__barra">
                    <label className="produccion__semana">
                        Empaque
                        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                    </label>
                    <input
                        className="selector"
                        type="search"
                        value={buscar}
                        onChange={(e) => setBuscar(e.target.value)}
                        placeholder="Buscar lote, finca, destino o SKU…"
                    />
                    <select
                        className="selector"
                        value={destino}
                        onChange={(e) => setDestino(e.target.value)}
                        aria-label="Preenfrío destino"
                    >
                        <option value="">Asignar a…</option>
                        {camaras.map((c) => (
                            <option key={c.id_camara} value={c.id_camara} disabled={c.en_mantenimiento}>
                                {c.nombre_camara} ({c.capacidad_max_tarimas} tar/ciclo)
                                {c.en_mantenimiento ? " · en mantenimiento" : ""}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="boton boton--primario boton--auto"
                        disabled={seleccion.size === 0 || !destino}
                        onClick={() => setConfirmando(true)}
                    >
                        Asignar {seleccion.size || ""} línea(s)
                    </button>
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

                {(fecha || seleccion.size > 0) && (
                    <div className="filtros-activos">
                        {fecha && <span className="chip chip--azul">Empaque {fechaCorta(fecha)}</span>}
                        {seleccion.size > 0 && (
                            <span className="chip chip--azul">
                                {seleccion.size} línea(s) · {cajas} cajas · {tarimas} tarimas
                            </span>
                        )}
                        {excede && camara && (
                            <span className="chip chip--ambar">
                                {camara.nombre_camara} recibe {camara.capacidad_max_tarimas} por ciclo: el resto irá a cola
                            </span>
                        )}
                        {fecha && (
                            <button type="button" className="enlace enlace--verde" onClick={() => setFecha("")}>
                                <X size={14} /> Quitar fecha
                            </button>
                        )}
                    </div>
                )}

                <p className="importacion__nota">
                    Lo que no se asigne a una cámara no pasa por preenfrío.
                </p>

                {error && <div className="alerta alerta--error">{error}</div>}

                {cargando && lineas.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando producción sin preenfrío…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <Snowflake size={40} />
                        <p>{buscar ? "Nada coincide con la búsqueda." : "No hay producción sin preenfrío asignado."}</p>
                    </div>
                ) : (
                    <div className="tabla-contenedor">
                        <table className="tabla tabla--crud">
                            <thead>
                                <tr>
                                    <th>
                                        <input
                                            type="checkbox"
                                            checked={todasVisibles}
                                            onChange={alternarTodas}
                                            aria-label="Seleccionar todas"
                                        />
                                    </th>
                                    <th>Lote</th>
                                    <th>Finca</th>
                                    <th>Empaque / Entrega</th>
                                    <th>Destino</th>
                                    <th>SKU</th>
                                    <th>Cajas / Tarimas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((p) => (
                                    <tr
                                        key={p.id_produccion}
                                        onClick={() => alternar(p.id_produccion)}
                                        className={seleccion.has(p.id_produccion) ? "asignacion__fila--elegida" : ""}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={seleccion.has(p.id_produccion)}
                                                onChange={() => alternar(p.id_produccion)}
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label={`Seleccionar ${p.codigo_lote ?? p.id_produccion}`}
                                            />
                                        </td>
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
                                                <small>
                                                    {p.fecha_entrega ? `Entrega ${fechaCorta(p.fecha_entrega)}` : "Sin entrega"}
                                                </small>
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {confirmando && camara && (
                <ModalConfirmar
                    titulo={`Asignar a ${camara.nombre_camara}`}
                    etiquetaConfirmar="Asignar"
                    tono="primario"
                    descripcion={
                        <>
                            <p>
                                {seleccion.size} línea(s): <strong>{cajas} cajas</strong> y{" "}
                                <strong>{tarimas} tarimas</strong>.
                            </p>
                            {excede && (
                                <p className="modal__advertencia">
                                    {camara.nombre_camara} recibe {camara.capacidad_max_tarimas} tarimas por ciclo: lo
                                    demás esperará en su cola al recibirse.
                                </p>
                            )}
                        </>
                    }
                    onConfirmar={asignar}
                    onCerrar={() => setConfirmando(false)}
                />
            )}
        </>
    );
}
