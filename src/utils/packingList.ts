import type { DatosPacking, LotePacking } from "../services/packing.service";

// ============================================================================
// PACKING LIST · documento imprimible tamaño CARTA (Guardar como PDF)
// ============================================================================
// Identidad Frutas Chanitos: ROJO predominante y AMARILLO secundario.
//
// Contenido:
//   · Encabezado con logo y folio
//   · Indicadores: tarimas, cajas, temperatura de salida, inocuidad
//   · Despacho y Transporte
//   · Desglose por SKU (tarimas, cajas, lotes y % de la carga)
//   · Resumen por lote
//   · Observaciones y firmas
//
// Se arma como HTML en una ventana nueva y se abre el diálogo de impresión.
// El logo se convierte a data URL antes de escribirse, así aparece aunque
// la ventana sea about:blank; la impresión espera a que cargue.
// ============================================================================

const ROJO = "#C8102E";
const ROJO_OSCURO = "#8E0B20";
const ROJO_CLARO = "#FDECEE";
const AMARILLO = "#FFC20E";
const AMARILLO_CLARO = "#FFF8E1";

const esc = (v: unknown) =>
    String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const n = (v: unknown) => Number(v ?? 0);

const fecha = (v: unknown) => {
    const s = String(v ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—";
    const [a, m, d] = s.split("-");
    return `${d}/${m}/${a}`;
};

const hora = (v: unknown) => (v ? String(v).slice(0, 5) : "—");
const temp = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : `${n(v).toFixed(1)} °C`);
const finca = (l: LotePacking) => [l.codigo_productor, l.codigo_finca, l.nombre_finca].filter(Boolean).join(" ");

/** Convierte la ruta del logo a data URL (o null si no carga). */
export const logoComoDataUrl = async (ruta: string): Promise<string | null> => {
    try {
        const url = new URL(ruta, window.location.origin).href;
        const r = await fetch(url);
        if (!r.ok) return null;
        const blob = await r.blob();
        return await new Promise((ok) => {
            const lector = new FileReader();
            lector.onload = () => ok(String(lector.result));
            lector.onerror = () => ok(null);
            lector.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
};

interface FilaSku {
    sku: string;
    descripcion: string;
    lotes: Set<string>;
    empaques: Set<string>;
    tarimas: number;
    cajas: number;
}

/** Agrupa el resumen por lote en un desglose por SKU. */
const desglosePorSku = (lotes: LotePacking[]): FilaSku[] => {
    const m = new Map<string, FilaSku>();
    for (const l of lotes) {
        const k = l.codigo_sku ?? "—";
        const f = m.get(k) ?? { sku: k, descripcion: l.calidad_sku ?? "", lotes: new Set(), empaques: new Set(), tarimas: 0, cajas: 0 };
        if (l.codigo_lote) f.lotes.add(l.codigo_lote);
        if (l.fecha_empaque) f.empaques.add(fecha(l.fecha_empaque));
        f.tarimas += n(l.tarimas);
        f.cajas += n(l.cajas);
        m.set(k, f);
    }
    return [...m.values()].sort((a, b) => b.cajas - a.cajas);
};

export const htmlPackingList = ({ despacho: d, tarimas, lotes }: DatosPacking, logo: string | null) => {
    const full = n(d.tipo_unidad) === 2;
    const totalCajas = lotes.reduce((s, l) => s + n(l.cajas), 0);
    const totalTarimas = tarimas.length || lotes.reduce((s, l) => s + n(l.tarimas), 0);
    const aprobada = n(d.inocuidad) === 1;
    const inocuidad = aprobada ? "Aprobada" : d.inocuidad === null ? "Pendiente" : "Rechazada";
    const temps = tarimas.map((t) => t.temperatura).filter((t) => t !== null && t !== undefined).map(n);
    const tempProm = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
    const skus = desglosePorSku(lotes);

    const filasSku = skus.length
        ? skus
              .map((f, i) => {
                  const pct = totalCajas ? Math.round((f.cajas / totalCajas) * 100) : 0;
                  return `
            <tr class="${i % 2 ? "par" : ""}">
                <td class="c num">${i + 1}</td>
                <td><span class="sku">${esc(f.sku)}</span></td>
                <td class="desc">${esc(f.descripcion)}</td>
                <td class="c">${f.lotes.size}</td>
                <td class="c">${[...f.empaques].join(", ") || "—"}</td>
                <td class="r b">${f.tarimas}</td>
                <td class="r b">${f.cajas.toLocaleString("es-MX")}</td>
                <td class="pct"><div class="barra"><i style="width:${pct}%"></i></div><span>${pct}%</span></td>
            </tr>`;
              })
              .join("")
        : `<tr><td colspan="8" class="c vacio">Sin fruta registrada en este despacho.</td></tr>`;

    const filasLotes = lotes
        .map(
            (l, i) => `
            <tr class="${i % 2 ? "par" : ""}">
                <td class="mono b">${esc(l.codigo_sku)}</td>
                <td class="desc">${esc(l.calidad_sku)}</td>
                <td class="mono">${esc(l.codigo_lote)}</td>
                <td>${esc(finca(l))}</td>
                <td class="c">${fecha(l.fecha_empaque)}</td>
                <td class="r b">${n(l.tarimas)}</td>
                <td class="r b">${n(l.cajas)}</td>
            </tr>`
        )
        .join("");

    const dato = (etiqueta: string, valor: string, clase = "") =>
        `<div class="dato ${clase}"><small>${etiqueta}</small><span>${valor}</span></div>`;

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Packing list ${esc(d.folio_despacho)} · Frutas Chanitos</title>
<style>
    @page { size: letter portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html { background: #ececec; }
    body { margin: 0; font: 9.5px/1.35 "Segoe UI", Arial, Helvetica, sans-serif; color: #1d1d1d; }
    .hoja { width: 8.5in; min-height: 11in; margin: 16px auto; padding: 10mm; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,.18); }
    @media print {
        html { background: #fff; }
        .hoja { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    }

    /* ---- Franjas ---- */
    .franja { height: 7px; display: flex; border-radius: 4px; overflow: hidden; }
    .franja i { flex: 3; background: ${ROJO}; } .franja i.a { flex: 1; background: ${AMARILLO}; }

    /* ---- Encabezado ---- */
    .cabeza { display: flex; align-items: center; gap: 14px; padding: 10px 0 8px; }
    .logo { width: 78px; height: 78px; object-fit: contain; }
    .logo-texto { width: 78px; height: 78px; border-radius: 50%; background: ${ROJO}; color: ${AMARILLO}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; text-align: center; }
    .empresa { flex: 1; }
    .empresa .nombre { font-size: 24px; font-weight: 900; color: ${ROJO}; letter-spacing: .02em; line-height: 1; }
    .empresa .nombre b { color: ${ROJO_OSCURO}; }
    .empresa .area { font-size: 10px; color: #555; margin-top: 3px; }
    .empresa h1 { margin: 6px 0 0; display: inline-block; background: ${AMARILLO}; color: ${ROJO_OSCURO}; font-size: 14px; letter-spacing: .14em; text-transform: uppercase; padding: 3px 14px; border-radius: 999px; }
    .folio { text-align: center; background: ${ROJO}; color: #fff; border-radius: 12px; padding: 8px 16px; min-width: 120px; box-shadow: 0 4px 0 ${AMARILLO}; }
    .folio small { display: block; font-size: 8.5px; letter-spacing: .18em; text-transform: uppercase; opacity: .9; }
    .folio strong { display: block; font-size: 26px; line-height: 1.05; }
    .folio .estado { display: inline-block; margin-top: 3px; background: ${AMARILLO}; color: ${ROJO_OSCURO}; font-weight: 700; font-size: 8.5px; padding: 1px 8px; border-radius: 999px; text-transform: uppercase; }

    /* ---- Indicadores ---- */
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 4px; }
    .kpi { border-radius: 10px; padding: 7px 12px; color: #fff; background: ${ROJO}; }
    .kpi small { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: .1em; opacity: .9; }
    .kpi strong { font-size: 19px; line-height: 1.1; }
    .kpi.oscuro { background: ${ROJO_OSCURO}; }
    .kpi.amarillo { background: ${AMARILLO}; color: ${ROJO_OSCURO}; }
    .kpi.ok { background: ${aprobada ? AMARILLO : ROJO_OSCURO}; color: ${aprobada ? ROJO_OSCURO : "#fff"}; }

    /* ---- Tarjetas ---- */
    .tarjetas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    .tarjeta { border: 1.5px solid #f0d6da; border-radius: 10px; overflow: hidden; }
    .tarjeta h2 { margin: 0; padding: 5px 10px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #fff; background: ${ROJO}; border-bottom: 3px solid ${AMARILLO}; }
    .tarjeta.oscura h2 { background: ${ROJO_OSCURO}; }
    .rejilla { display: grid; grid-template-columns: 1fr 1fr; gap: 0 10px; padding: 6px 10px 8px; }
    .dato { padding: 3px 0; border-bottom: 1px dashed #ebe0e1; }
    .dato small { display: block; font-size: 7.5px; text-transform: uppercase; letter-spacing: .06em; color: #8a7a7c; }
    .dato span { font-weight: 600; font-size: 10px; }
    .dato.completo { grid-column: 1 / -1; }

    /* ---- Secciones y tablas ---- */
    .seccion { display: flex; align-items: center; gap: 8px; margin: 14px 0 6px; }
    .seccion h2 { margin: 0; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: ${ROJO}; }
    .seccion .linea { flex: 1; height: 3px; background: linear-gradient(90deg, ${ROJO} 0 75%, ${AMARILLO} 75%); border-radius: 3px; }
    .seccion .pill { background: ${AMARILLO}; color: ${ROJO_OSCURO}; font-weight: 800; font-size: 9px; padding: 2px 10px; border-radius: 999px; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1.5px solid #f0d6da; border-radius: 10px; overflow: hidden; }
    th { background: ${ROJO}; color: #fff; font-size: 8px; text-transform: uppercase; letter-spacing: .06em; padding: 5px 6px; text-align: left; }
    td { padding: 5px 6px; border-bottom: 1px solid #f6e9eb; vertical-align: middle; }
    tr.par td { background: ${AMARILLO_CLARO}; }
    .num { font-weight: 800; color: ${ROJO}; }
    .sku { display: inline-block; background: ${ROJO_CLARO}; color: ${ROJO_OSCURO}; font-family: Consolas, "Courier New", monospace; font-weight: 800; font-size: 9px; padding: 2px 7px; border-radius: 6px; }
    .desc { font-size: 8.5px; }
    .r { text-align: right; } .c { text-align: center; } .b { font-weight: 700; }
    .mono { font-family: Consolas, "Courier New", monospace; font-size: 8.5px; }
    .vacio { color: #888; padding: 10px; }
    .pct { width: 90px; white-space: nowrap; }
    .barra { display: inline-block; vertical-align: middle; width: 52px; height: 7px; background: #f3dfe2; border-radius: 999px; overflow: hidden; margin-right: 5px; }
    .barra i { display: block; height: 100%; background: linear-gradient(90deg, ${ROJO}, ${AMARILLO}); }
    .pct span { font-weight: 700; color: ${ROJO_OSCURO}; }
    tfoot td { background: ${ROJO_OSCURO}; color: #fff; font-weight: 800; font-size: 10px; border: 0; }
    tfoot .total { color: ${AMARILLO}; font-size: 12px; }

    .obs { margin-top: 10px; padding: 7px 10px; border-left: 5px solid ${AMARILLO}; background: ${AMARILLO_CLARO}; border-radius: 0 8px 8px 0; }
    .obs b { color: ${ROJO}; }

    /* ---- Firmas ---- */
    .firmas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin-top: 34px; }
    .firma { text-align: center; }
    .firma .raya { border-top: 2px solid ${ROJO}; margin-bottom: 4px; }
    .firma strong { display: block; font-size: 9.5px; color: ${ROJO_OSCURO}; }
    .firma small { color: #777; }

    .pie { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #777; }
    tr, .tarjeta, .firmas { page-break-inside: avoid; }
</style>
</head>
<body>
<div class="hoja">
    <div class="franja"><i></i><i class="a"></i></div>

    <div class="cabeza">
        ${logo ? `<img class="logo" src="${logo}" alt="Frutas Chanitos">` : `<div class="logo-texto">FRUTAS<br>CHANITOS</div>`}
        <div class="empresa">
            <div class="nombre">FRUTAS <b>CHANITOS</b></div>
            <div class="area">Dirección de Logística · Preenfrío y conservación</div>
            <h1>Packing list</h1>
        </div>
        <div class="folio">
            <small>Folio</small>
            <strong>${esc(d.folio_despacho)}</strong>
            <span class="estado">${esc(d.estado_texto ?? "")}</span>
        </div>
    </div>

    <div class="franja"><i class="a"></i><i></i></div>

    <div class="kpis">
        <div class="kpi"><small>Tarimas</small><strong>${totalTarimas}</strong></div>
        <div class="kpi oscuro"><small>Cajas</small><strong>${totalCajas.toLocaleString("es-MX")}</strong></div>
        <div class="kpi amarillo"><small>Temp. salida</small><strong>${temp(d.temperatura_salida ?? tempProm)}</strong></div>
        <div class="kpi ok"><small>Inocuidad</small><strong>${inocuidad}</strong></div>
    </div>

    <div class="tarjetas">
        <div class="tarjeta">
            <h2>Despacho</h2>
            <div class="rejilla">
                ${dato("Cliente", esc(d.cliente))}
                ${dato("CEDIS", esc(d.cedis))}
                ${dato("Fecha de despacho", fecha(d.fecha_despacho))}
                ${dato("Hora de salida", hora(d.hora_salida))}
                ${dato("Cita", esc(d.cita ?? "—"))}
                ${dato("Fecha de cita", fecha(d.fecha_cita))}
                ${dato("Orden de venta", esc(d.orden_venta ?? "—"), "completo")}
            </div>
        </div>
        <div class="tarjeta oscura">
            <h2>Transporte</h2>
            <div class="rejilla">
                ${dato("Línea fletera", esc(d.razon_social ?? "—"), "completo")}
                ${dato("Operador", esc(d.nombre_operador ?? "—"))}
                ${dato("Celular", esc(d.celular ?? "—"))}
                ${dato("Tracto", `${esc(d.placas_tracto ?? "—")}${d.no_economico_tracto ? ` · Eco ${esc(d.no_economico_tracto)}` : ""}`)}
                ${dato("Unidad", full ? "Full · 2 cajas" : "Sencillo")}
                ${dato(full ? "Caja 1" : "Caja", `${esc(d.placas_caja ?? "—")}${d.no_economico_caja ? ` · Eco ${esc(d.no_economico_caja)}` : ""}`)}
                ${full ? dato("Caja 2", `${esc(d.placas_caja_2 ?? "—")}${d.no_economico_caja_2 ? ` · Eco ${esc(d.no_economico_caja_2)}` : ""}`) : ""}
            </div>
        </div>
    </div>

    <div class="seccion"><h2>Desglose por SKU</h2><span class="linea"></span><span class="pill">${skus.length} SKU · ${totalTarimas} tarimas · ${totalCajas} cajas</span></div>
    <table>
        <thead>
            <tr><th class="c">#</th><th>SKU</th><th>Descripción</th><th class="c">Lotes</th><th class="c">Empaque</th><th class="r">Tarimas</th><th class="r">Cajas</th><th>% carga</th></tr>
        </thead>
        <tbody>${filasSku}</tbody>
        <tfoot><tr><td colspan="5">TOTAL</td><td class="r total">${totalTarimas}</td><td class="r total">${totalCajas.toLocaleString("es-MX")}</td><td></td></tr></tfoot>
    </table>

    <div class="seccion"><h2>Resumen por lote</h2><span class="linea"></span></div>
    <table>
        <thead><tr><th>SKU</th><th>Descripción</th><th>Lote</th><th>Finca</th><th class="c">Empaque</th><th class="r">Tarimas</th><th class="r">Cajas</th></tr></thead>
        <tbody>${filasLotes}</tbody>
        <tfoot><tr><td colspan="5">TOTAL</td><td class="r total">${totalTarimas}</td><td class="r total">${totalCajas.toLocaleString("es-MX")}</td></tr></tfoot>
    </table>

    ${d.observaciones ? `<div class="obs"><b>Observaciones:</b> ${esc(d.observaciones)}</div>` : ""}

    <div class="firmas">
        <div class="firma"><div class="raya"></div><strong>Entregó</strong><small>Preenfrío · nombre y firma</small></div>
        <div class="firma"><div class="raya"></div><strong>${esc(d.nombre_operador ?? "Operador")}</strong><small>Operador · firma</small></div>
        <div class="firma"><div class="raya"></div><strong>Recibió</strong><small>${esc(d.cedis ?? "CEDIS")} · nombre y firma</small></div>
    </div>

    <div class="pie">
        <span>Generado el ${new Date().toLocaleString("es-MX")} · Una tarima mixta se cuenta en el SKU que más cajas lleva.</span>
        <span><b style="color:${ROJO}">Frutas Chanitos</b></span>
    </div>
    <div class="franja" style="margin-top:8px"><i></i><i class="a"></i></div>
</div>
</body>
</html>`;
};

/** Escribe el packing list en la ventana y lanza la impresión cuando cargue el logo. */
export const imprimirPackingList = (ventana: Window, datos: DatosPacking, logo: string | null) => {
    ventana.document.open();
    ventana.document.write(htmlPackingList(datos, logo));
    ventana.document.close();
    ventana.focus();

    const img = ventana.document.querySelector("img.logo") as HTMLImageElement | null;
    const imprimir = () => setTimeout(() => ventana.print(), 250);
    if (img && !img.complete) {
        img.onload = imprimir;
        img.onerror = imprimir;
    } else imprimir();
};
