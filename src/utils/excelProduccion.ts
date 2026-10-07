import * as XLSX from "xlsx";
import type { FilaExcel } from "../types/produccion";

// ============================================================================
// LECTURA DE LA PLANTILLA DE PRODUCCIÓN (Excel)
// ============================================================================
// Columnas esperadas (en cualquier orden, sin importar mayúsculas, acentos
// ni guiones bajos):
//   Semana · Region · Finca · Productor · fecha_empaque · transito ·
//   fecha_entrega · CEDIS · Cliente · SKU · Cajas Procesadas ·
//   Estiba_Pallets · comentarios · Lote
//
// Solo se LEE el archivo. Las reglas viven en el backend, que decide qué
// fila es ✅ ⚠️ o ❌.
//
// FECHAS: se leen como número de serie de Excel y se convierten en UTC.
// Leerlas como Date del navegador puede recorrer un día según la zona.
// CELDAS CON ERROR (#N/A, #REF!): llegan vacías.
// ============================================================================

type CampoExcel = Exclude<keyof FilaExcel, "fila" | "usar_lote">;

const COLUMNAS: Record<string, CampoExcel> = {
    semana: "semana",
    region: "region",
    finca: "finca",
    productor: "productor",
    fechaempaque: "fecha_empaque",
    transito: "transito",
    fechaentrega: "fecha_entrega",
    cedis: "cedis",
    cliente: "cliente",
    sku: "sku",
    cajasprocesadas: "cajas",
    cajas: "cajas",
    estibapallets: "estiba",
    estiba: "estiba",
    comentarios: "comentarios",
    lote: "lote"
};

const OBLIGATORIAS: CampoExcel[] = [
    "semana", "finca", "productor", "fecha_empaque", "cedis", "cliente", "sku", "cajas"
];

const normalizarEncabezado = (t: unknown) =>
    String(t ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

const serialAFecha = (serial: number, sistema1904: boolean) => {
    const base = Date.UTC(1899, 11, 30) + (sistema1904 ? 1462 : 0) * 86400000;
    return new Date(base + Math.round(serial) * 86400000).toISOString().slice(0, 10);
};

/** dd/mm/aaaa, dd-mm-aa o AAAA-MM-DD → AAAA-MM-DD. Si no, el texto tal cual. */
const textoAFecha = (t: string) => {
    const s = t.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (!m) return s;
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${anio}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

const valorCelda = (celda: XLSX.CellObject | undefined): string | number | null => {
    if (!celda || celda.t === "e" || celda.t === "z") return null;
    if (celda.t === "n" && typeof celda.v === "number") return celda.v;
    if (celda.t === "d" && celda.v instanceof Date) return celda.v.toISOString().slice(0, 10);
    if (celda.t === "b") return celda.v ? 1 : 0;
    const texto = String(celda.v ?? celda.w ?? "").trim();
    return texto === "" ? null : texto;
};

export interface LecturaExcel {
    hoja: string;
    filas: FilaExcel[];
}

export const leerPlantillaProduccion = async (archivo: File): Promise<LecturaExcel> => {
    const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
    const sistema1904 = Boolean(libro.Workbook?.WBProps?.date1904);

    for (const nombreHoja of libro.SheetNames) {
        const hoja = libro.Sheets[nombreHoja];
        if (!hoja?.["!ref"]) continue;
        const rango = XLSX.utils.decode_range(hoja["!ref"]);

        // Encabezado: la primera fila (de las 10 primeras) que traiga Finca y SKU
        for (let r = rango.s.r; r <= Math.min(rango.e.r, rango.s.r + 9); r++) {
            const mapa = new Map<number, CampoExcel>();
            for (let c = rango.s.c; c <= rango.e.c; c++) {
                const campo = COLUMNAS[normalizarEncabezado(valorCelda(hoja[XLSX.utils.encode_cell({ r, c })]))];
                if (campo && ![...mapa.values()].includes(campo)) mapa.set(c, campo);
            }
            const presentes = new Set(mapa.values());
            if (!presentes.has("finca") || !presentes.has("sku")) continue;

            const faltan = OBLIGATORIAS.filter((k) => !presentes.has(k));
            if (faltan.length) {
                throw new Error(`A la hoja "${nombreHoja}" le faltan columnas: ${faltan.join(", ")}`);
            }

            const filas: FilaExcel[] = [];
            for (let fr = r + 1; fr <= rango.e.r; fr++) {
                const fila: FilaExcel = {
                    fila: fr + 1,
                    semana: null, region: null, finca: null, productor: null,
                    fecha_empaque: null, transito: null, fecha_entrega: null,
                    cedis: null, cliente: null, sku: null, cajas: null,
                    estiba: null, comentarios: null, lote: null,
                    usar_lote: "sugerido"
                };
                let vacia = true;
                for (const [c, campo] of mapa) {
                    let v = valorCelda(hoja[XLSX.utils.encode_cell({ r: fr, c })]);
                    if (v === null) continue;
                    vacia = false;
                    if (campo === "fecha_empaque" || campo === "fecha_entrega") {
                        v = typeof v === "number" ? serialAFecha(v, sistema1904) : textoAFecha(String(v));
                    }
                    fila[campo] = v;
                }
                if (!vacia) filas.push(fila);
            }

            if (filas.length === 0) throw new Error(`La hoja "${nombreHoja}" no tiene filas de producción`);
            return { hoja: nombreHoja, filas };
        }
    }

    throw new Error('No se encontró el encabezado de la plantilla (columnas "Finca" y "SKU")');
};

/** Semana ISO de hoy, para el filtro por defecto. */
export const semanaActual = () => {
    const h = new Date();
    const d = new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()));
    const dia = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dia + 3);
    const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    return (
        1 +
        Math.round(
            ((d.getTime() - primerJueves.getTime()) / 86400000 - 3 + ((primerJueves.getUTCDay() + 6) % 7)) / 7
        )
    );
};
