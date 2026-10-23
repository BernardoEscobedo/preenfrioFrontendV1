import api from "../api/axios";
import type {
    CamaraStock,
    Movimiento,
    NuevoTraslado,
    RespuestaReversa,
    RespuestaTraslado,
    Trasladable
} from "../types/movimiento";

// ============================================================================
// MOVIMIENTOS · endpoints (ya existen en el backend)
// ============================================================================
//   GET  /ocupaciones/tablero?tipo_camara=1|2     stock por cámara
//   GET  /movimientos/trasladables?id_camara=     fruta dentro de preenfríos
//   GET  /movimientos?fecha_desde&fecha_hasta&tipo_movimiento&buscar
//   POST /movimientos                             traslado (supervisor+)
//   POST /movimientos/:id/revertir { motivo }     reversa (supervisor+)
// ============================================================================

/** Stock de preenfríos y conservaciones en una sola lista */
export const getStock = async (): Promise<CamaraStock[]> => {
    const [pre, con] = await Promise.all([
        api.get<{ camaras: CamaraStock[] }>("/ocupaciones/tablero", { params: { tipo_camara: 1 } }),
        api.get<{ camaras: CamaraStock[] }>("/ocupaciones/tablero", { params: { tipo_camara: 2 } })
    ]);
    return [...(pre.data?.camaras ?? []), ...(con.data?.camaras ?? [])];
};

export const getTrasladables = async (id_camara?: number | null) => {
    const { data } = await api.get<Trasladable[]>("/movimientos/trasladables", {
        params: id_camara ? { id_camara } : undefined
    });
    return Array.isArray(data) ? data : [];
};

export interface FiltrosBitacora {
    fecha_desde?: string;
    fecha_hasta?: string;
    tipo_movimiento?: 1 | 2 | 3 | null;
    buscar?: string;
}

export const getMovimientos = async (f: FiltrosBitacora) => {
    const params: Record<string, string | number> = {};
    if (f.fecha_desde) params.fecha_desde = f.fecha_desde;
    if (f.fecha_hasta) params.fecha_hasta = f.fecha_hasta;
    if (f.tipo_movimiento) params.tipo_movimiento = f.tipo_movimiento;
    if (f.buscar) params.buscar = f.buscar;
    const { data } = await api.get<Movimiento[]>("/movimientos", { params });
    return Array.isArray(data) ? data : [];
};

export const trasladar = async (datos: NuevoTraslado) => {
    const { data } = await api.post<RespuestaTraslado>("/movimientos", { ...datos, tipo_movimiento: 2 });
    return data;
};

export const revertir = async (id_movimiento: number, motivo: string) => {
    const { data } = await api.post<RespuestaReversa>(`/movimientos/${id_movimiento}/revertir`, { motivo });
    return data;
};
