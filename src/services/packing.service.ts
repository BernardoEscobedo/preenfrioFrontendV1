import api from "../api/axios";

// ============================================================================
// PACKING LIST · GET /packing/:id_despacho
// ============================================================================

type Num = number | string;

export interface LotePacking {
    codigo_lote: string | null;
    codigo_sku: string | null;
    calidad_sku: string | null;
    codigo_productor: string | null;
    codigo_finca: string | null;
    nombre_finca: string | null;
    fecha_empaque: string | null;
    cajas: Num;
    tarimas?: Num;
}

export interface TarimaPacking {
    id_tarima: number;
    posicion: number;
    codigo_bloque: string;
    nombre_camara: string;
    temperatura: Num | null;
    cajas: Num;
    lotes: LotePacking[];
}

export interface DatosPacking {
    despacho: Record<string, string | number | null>;
    tarimas: TarimaPacking[];
    lotes: LotePacking[];
}

export const getPacking = async (id_despacho: number) => {
    const { data } = await api.get<DatosPacking>(`/packing/${id_despacho}`);
    return data;
};
