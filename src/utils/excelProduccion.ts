import * as XLSX from "xlsx";
import type { FilaExcel } from "../types/produccion";

// ============================================================================
// PLANTILLA DE PRODUCCIÓN (Excel) · lectura y descarga
// ============================================================================
// Columnas esperadas (en cualquier orden, sin importar mayúsculas, acentos
// ni guiones bajos):
//   Semana · Region · Finca · Productor · fecha_empaque · transito ·
//   fecha_entrega · CEDIS · Cliente · SKU · Cajas Procesadas ·
//   Estiba_Pallets · comentarios · Lote
//
// LECTURA: solo se lee el archivo. Las reglas viven en el backend, que
// decide qué fila es ✅ ⚠️ o ❌.
//   · Fechas: se leen como número de serie de Excel y se convierten en UTC;
//     leerlas como Date del navegador puede recorrer un día.
//   · Celdas con error (#N/A, #REF!): llegan vacías.
//   · Se ignoran las hojas "Instrucciones" y "Ejemplo" de la plantilla
//     descargable: si el usuario deja el ejemplo, NO se importa.
//
// DESCARGA: descargarPlantillaProduccion() arma el archivo en el navegador.
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

/** Hojas de la plantilla que nunca se importan. */
const HOJAS_IGNORADAS = ["instrucciones", "ejemplo"];

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

/** 'AAAA-MM-DD' → número de serie de Excel (sistema 1900), sin zona horaria. */
const fechaASerial = (iso: string) => {
    const [a, m, d] = iso.split("-").map(Number);
    return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
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

// ----------------------------------------------------------------------------
// LECTURA
// ----------------------------------------------------------------------------
export const leerPlantillaProduccion = async (archivo: File): Promise<LecturaExcel> => {
    const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
    const sistema1904 = Boolean(libro.Workbook?.WBProps?.date1904);
    let hojaVacia: string | null = null;

    for (const nombreHoja of libro.SheetNames) {
        if (HOJAS_IGNORADAS.some((h) => normalizarEncabezado(nombreHoja).startsWith(h))) continue;

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

            // Hoja con encabezado pero sin datos: se sigue buscando en las demás
            if (filas.length === 0) {
                hojaVacia ??= nombreHoja;
                break;
            }
            return { hoja: nombreHoja, filas };
        }
    }

    if (hojaVacia) throw new Error(`La hoja "${hojaVacia}" no tiene filas de producción: llénala debajo del encabezado`);
    throw new Error('No se encontró el encabezado de la plantilla (columnas "Finca" y "SKU")');
};

// ----------------------------------------------------------------------------
// DESCARGA DE LA PLANTILLA
// ----------------------------------------------------------------------------
// Tres hojas:
//   Produccion     encabezados vacíos: AQUÍ se captura (es la que se importa)
//   Ejemplo        filas llenas con los casos típicos (no se importa)
//   Instrucciones  qué va en cada columna (no se importa)

const ENCABEZADOS = [
    "Semana", "Region", "Finca", "Productor", "fecha_empaque", "transito",
    "fecha_entrega", "CEDIS", "Cliente", "SKU", "Cajas Procesadas",
    "Estiba_Pallets", "comentarios", "Lote"
];

const ANCHOS = [8, 10, 26, 24, 14, 9, 14, 12, 18, 12, 16, 15, 22, 18];

const FORMATO_FECHA = "dd/mm/yyyy";

// Ejemplos tomados del formato real (semana 41, empaque 06/10/2026)
const EJEMPLOS: (string | number)[][] = [
    [41, "Chiapas", "A01 004 La Ceiba", "A01 La Santanera", "2026-10-06", 4, "2026-10-10", "Chalco", "WM", "CPR01102", 240, 5, "23 convencional", "A01004-410610-1"],
    [41, "Chiapas", "A01 004 La Ceiba", "A01 La Santanera", "2026-10-06", 1, "2026-10-07", "CEDA", "CEDA Piso", "CPR01101", 1, "Granel", "CEDA", "A01004-410610-1"],
    [41, "Chiapas", "A01 001 Marbella", "A01 La Santanera", "2026-10-06", 7, "2026-10-13", "Japon", "Mar", "CPR03119", 270, 5, "", "A01001-410610-1"],
    [41, "Colima", "B12 015 San Rafael", "B12 Ramon Larios", "2026-10-06", 3, "2026-10-09", "CLN", "WM", "CRG07128", 96, 2, "", "B12015-410610-1"]
];

const INSTRUCCIONES: string[][] = [
    ["PLANTILLA DE PRODUCCIÓN · PREENFRÍO"],
    [""],
    ["Captura en la hoja \"Produccion\", debajo del encabezado. Las hojas \"Ejemplo\" e \"Instrucciones\" no se importan."],
    ["Una fila por cada combinación de finca + SKU + destino. Las filas repetidas sí se cargan: son producción."],
    [""],
    ["Columna", "Obligatoria", "Qué va", "Ejemplo"],
    ["Semana", "Sí", "Semana ISO del empaque (1 a 53)", "41"],
    ["Region", "No", "Chiapas, Colima o Tabasco. Si va vacía se toma de la finca", "Chiapas"],
    ["Finca", "Sí", "Código de productor + código de finca + nombre", "A01 004 La Ceiba"],
    ["Productor", "Sí", "Código + nombre. Debe ser el mismo productor de la finca", "A01 La Santanera"],
    ["fecha_empaque", "Sí", "Fecha en formato de Excel (dd/mm/aaaa)", "06/10/2026"],
    ["transito", "No", "Días de tránsito al destino (0 a 30)", "4"],
    ["fecha_entrega", "No", "Si va vacía se calcula: empaque + tránsito", "10/10/2026"],
    ["CEDIS", "Sí", "Como lo manejan en planeación. La primera vez se elige su destino del catálogo", "Chalco"],
    ["Cliente", "Sí", "Como lo manejan en planeación", "WM"],
    ["SKU", "Sí", "Código del catálogo de SKU", "CPR01102"],
    ["Cajas Procesadas", "Sí", "Número entero de cajas", "240"],
    ["Estiba_Pallets", "No", "Tarimas. \"Granel\" o vacío = 0. Con decimales se redondea hacia arriba", "5"],
    ["comentarios", "No", "Texto libre, máximo 250 caracteres", "23 convencional"],
    ["Lote", "No", "Si lo traen se compara con el que sugiere el sistema; tú eliges cuál se guarda", "A01004-410610-1"],
    [""],
    ["Al importar verás cada fila como Lista, Revisar, Error o Ya importada. Los errores se corrigen en pantalla."],
    ["El preenfrío NO se captura aquí: lo asigna el coordinador después de importar."]
];

/** Convierte las columnas de fecha de un renglón a celdas fecha de Excel. */
const aplicarFechas = (hoja: XLSX.WorkSheet, filaExcel: number, fila: (string | number)[]) => {
    for (const col of [4, 6]) {
        const v = fila[col];
        if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
        hoja[XLSX.utils.encode_cell({ r: filaExcel, c: col })] = { t: "n", v: fechaASerial(v), z: FORMATO_FECHA };
    }
};

export const descargarPlantillaProduccion = () => {
    const libro = XLSX.utils.book_new();
    const anchos = ANCHOS.map((wch) => ({ wch }));

    // ---- Produccion (vacía) ----
    const produccion = XLSX.utils.aoa_to_sheet([ENCABEZADOS]);
    produccion["!cols"] = anchos;
    produccion["!autofilter"] = { ref: `A1:N1` };
    XLSX.utils.book_append_sheet(libro, produccion, "Produccion");

    // ---- Ejemplo ----
    const ejemplo = XLSX.utils.aoa_to_sheet([ENCABEZADOS, ...EJEMPLOS]);
    EJEMPLOS.forEach((fila, i) => aplicarFechas(ejemplo, i + 1, fila));
    ejemplo["!cols"] = anchos;
    XLSX.utils.book_append_sheet(libro, ejemplo, "Ejemplo");

    // ---- Instrucciones ----
    const instrucciones = XLSX.utils.aoa_to_sheet(INSTRUCCIONES);
    instrucciones["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 78 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(libro, instrucciones, "Instrucciones");

    XLSX.writeFile(libro, "Plantilla_Produccion_Preenfrio.xlsx", { compression: true });
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
