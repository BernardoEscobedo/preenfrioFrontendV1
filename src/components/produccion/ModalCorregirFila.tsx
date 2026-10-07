import { useMemo, useState } from "react";
import Modal from "../ui/Modal";
import { normalizar } from "../../utils/formato";
import type { CatalogosCorreccion, FilaExcel, ResultadoFila } from "../../types/produccion";

// ============================================================================
// CORREGIR UNA FILA DEL EXCEL
// ============================================================================
// Se edita la fila TAL COMO VIENE del Excel; al aplicar, la vista previa se
// vuelve a evaluar completa en el backend, que decide si quedó ✅.
//
//   · Finca   → combo del catálogo. Escribe también el productor, así la
//               pareja finca ↔ productor siempre cuadra.
//   · SKU     → combo del catálogo.
//   · Destino → se elige para la PAREJA "CEDIS / Cliente" del Excel: aplica
//               a todas las filas iguales y se recuerda para otras semanas.
//
// Un productor o una finca que no existen en el catálogo no se inventan
// aquí: hay que darlos de alta primero en su catálogo.
// ============================================================================

interface Props {
    entrada: FilaExcel;
    resultado: ResultadoFila;
    catalogos: CatalogosCorreccion;
    destinoActual: number | null;
    onGuardar: (fila: FilaExcel, destino: { clave: string; id_cc: number } | null) => void;
    onCerrar: () => void;
}

const texto = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export default function ModalCorregirFila({
    entrada,
    resultado,
    catalogos,
    destinoActual,
    onGuardar,
    onCerrar
}: Props) {
    const [fila, setFila] = useState<FilaExcel>({ ...entrada });
    const [buscarFinca, setBuscarFinca] = useState("");
    const [idFinca, setIdFinca] = useState(resultado.datos.id_finca ? String(resultado.datos.id_finca) : "");
    const [idSku, setIdSku] = useState(resultado.datos.id_sku ? String(resultado.datos.id_sku) : "");
    const [idCc, setIdCc] = useState(destinoActual ? String(destinoActual) : "");

    const poner = (campo: keyof FilaExcel, valor: string) =>
        setFila((f) => ({ ...f, [campo]: valor === "" ? null : valor }));

    const codigos = new Set<string>(resultado.mensajes.map((m) => m.codigo));
    const conError = (...c: string[]) => c.some((x) => codigos.has(x));

    const fincasVisibles = useMemo(() => {
        const t = normalizar(buscarFinca.trim());
        return catalogos.fincas
            .filter(
                (f) =>
                    !t ||
                    String(f.id_finca) === idFinca ||
                    normalizar(`${f.codigo_productor} ${f.codigo_finca} ${f.nombre} ${f.nombre_productor}`).includes(t)
            )
            .slice(0, 300);
    }, [catalogos.fincas, buscarFinca, idFinca]);

    const guardar = () => {
        const final = { ...fila };

        const finca = catalogos.fincas.find((f) => String(f.id_finca) === idFinca);
        if (finca && String(finca.id_finca) !== String(resultado.datos.id_finca ?? "")) {
            final.finca = `${finca.codigo_productor} ${finca.codigo_finca} ${finca.nombre}`;
            final.productor = `${finca.codigo_productor} ${finca.nombre_productor}`;
        }

        const sku = catalogos.skus.find((s) => String(s.id_sku) === idSku);
        if (sku && String(sku.id_sku) !== String(resultado.datos.id_sku ?? "")) final.sku = sku.codigo_sku;

        const destino =
            resultado.destino.clave && idCc && Number(idCc) !== destinoActual
                ? { clave: resultado.destino.clave, id_cc: Number(idCc) }
                : null;

        onGuardar(final, destino);
    };

    return (
        <Modal
            titulo={`Corregir fila ${entrada.fila}`}
            subtitulo={texto(entrada.finca) || "Fila del Excel"}
            onCerrar={onCerrar}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar}>
                        Cancelar
                    </button>
                    <button type="button" className="boton boton--primario" onClick={guardar}>
                        Aplicar y revalidar
                    </button>
                </>
            }
        >
            {resultado.mensajes.length > 0 && (
                <ul className="importacion__mensajes">
                    {resultado.mensajes.map((m, i) => (
                        <li key={i} className={`importacion__mensaje importacion__mensaje--${m.nivel}`}>
                            {m.texto}
                        </li>
                    ))}
                </ul>
            )}

            <div className="formulario">
                <label className={`campo campo--completo ${conError("finca", "productor") ? "campo--error" : ""}`}>
                    <span>Finca (del catálogo)</span>
                    <input
                        type="search"
                        value={buscarFinca}
                        onChange={(e) => setBuscarFinca(e.target.value)}
                        placeholder="Buscar por productor, código o nombre…"
                    />
                    <select value={idFinca} onChange={(e) => setIdFinca(e.target.value)}>
                        <option value="">
                            — Excel: {texto(entrada.finca) || "vacío"} / {texto(entrada.productor) || "vacío"} —
                        </option>
                        {fincasVisibles.map((f) => (
                            <option key={f.id_finca} value={f.id_finca}>
                                {f.codigo_productor} {f.codigo_finca} {f.nombre} · {f.nombre_productor}
                            </option>
                        ))}
                    </select>
                    <small className="campo__ayuda">
                        ¿No aparece? Primero dala de alta en Catálogos › Fincas o Productores.
                    </small>
                </label>

                <label className={`campo campo--completo ${conError("sku") ? "campo--error" : ""}`}>
                    <span>SKU</span>
                    <select value={idSku} onChange={(e) => setIdSku(e.target.value)}>
                        <option value="">— Excel: {texto(entrada.sku) || "vacío"} —</option>
                        {catalogos.skus.map((s) => (
                            <option key={s.id_sku} value={s.id_sku}>
                                {s.codigo_sku} · {s.calidad} (turno {s.turno})
                            </option>
                        ))}
                    </select>
                </label>

                <label className={`campo campo--completo ${conError("destino") ? "campo--error" : ""}`}>
                    <span>
                        Destino para "{resultado.destino.cedis_excel} / {resultado.destino.cliente_excel}"
                    </span>
                    <select value={idCc} onChange={(e) => setIdCc(e.target.value)} disabled={!resultado.destino.clave}>
                        <option value="">Selecciona…</option>
                        {catalogos.cedis.map((c) => (
                            <option key={c.id_cc} value={c.id_cc}>
                                {c.acronimo} · {c.cliente} · {c.cedis}
                            </option>
                        ))}
                    </select>
                    <small className="campo__ayuda">
                        Aplica a todas las filas con ese CEDIS y Cliente, y se recordará al guardar.
                    </small>
                </label>

                <label className={`campo ${conError("semana") ? "campo--error" : ""}`}>
                    <span>Semana</span>
                    <input
                        type="number"
                        min={1}
                        max={53}
                        value={texto(fila.semana)}
                        onChange={(e) => poner("semana", e.target.value)}
                    />
                </label>

                <label className={`campo ${conError("fechas", "semana") ? "campo--error" : ""}`}>
                    <span>Fecha de empaque</span>
                    <input
                        type="date"
                        value={texto(fila.fecha_empaque).slice(0, 10)}
                        onChange={(e) => poner("fecha_empaque", e.target.value)}
                    />
                </label>

                <label className={`campo ${conError("fechas") ? "campo--error" : ""}`}>
                    <span>Tránsito (días)</span>
                    <input
                        type="number"
                        min={0}
                        max={30}
                        value={texto(fila.transito)}
                        onChange={(e) => poner("transito", e.target.value)}
                    />
                </label>

                <label className={`campo ${conError("fechas") ? "campo--error" : ""}`}>
                    <span>Fecha de entrega</span>
                    <input
                        type="date"
                        value={texto(fila.fecha_entrega).slice(0, 10)}
                        onChange={(e) => poner("fecha_entrega", e.target.value)}
                    />
                </label>

                <label className={`campo ${conError("cantidades") ? "campo--error" : ""}`}>
                    <span>Cajas procesadas</span>
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={texto(fila.cajas)}
                        onChange={(e) => poner("cajas", e.target.value)}
                    />
                </label>

                <label className={`campo ${conError("cantidades") ? "campo--error" : ""}`}>
                    <span>Estiba (tarimas)</span>
                    <input
                        type="text"
                        value={texto(fila.estiba)}
                        onChange={(e) => poner("estiba", e.target.value)}
                        placeholder="Número o Granel"
                    />
                </label>

                <label className="campo campo--completo">
                    <span>Comentarios</span>
                    <input
                        type="text"
                        maxLength={250}
                        value={texto(fila.comentarios)}
                        onChange={(e) => poner("comentarios", e.target.value)}
                    />
                </label>
            </div>
        </Modal>
    );
}
