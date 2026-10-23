import api from "../api/axios";
import type {
    FrutaDentro,
    Mantenimiento,
    NuevoMantenimiento,
    RespuestaMantenimiento,
    TableroMantenimientos
} from "../types/mantenimiento";

// ============================================================================
// MANTENIMIENTOS · endpoints
// ============================================================================
//   GET    /mantenimientos/tablero                  cámaras y su situación
//   GET    /mantenimientos/camara/:id/fruta         lotes dentro
//   GET    /mantenimientos?id_camara&tipo&estado&fecha_desde&fecha_hasta
//   POST   /mantenimientos                          registrar (operativo+)
//   PATCH  /mantenimientos/:id/iniciar              iniciar ya un preventivo
//   PATCH  /mantenimientos/:id/finalizar            { fecha?, hora?, comentario? }
//   DELETE /mantenimientos/:id                      cancelar programado (coordinador+)
// ============================================================================

export const getTablero = async () => {
    const { data } = await api.get<TableroMantenimientos>("/mantenimientos/tablero");
    return data;
};

export const getFrutaDentro = async (id_camara: number) => {
    const { data } = await api.get<FrutaDentro[]>(`/mantenimientos/camara/${id_camara}/fruta`);
    return Array.isArray(data) ? data : [];
};

export interface FiltrosHistorial {
    id_camara?: number | null;
    tipo?: number | null;
    estado?: number | null;
    fecha_desde?: string;
    fecha_hasta?: string;
}

export const getHistorial = async (f: FiltrosHistorial) => {
    const params: Record<string, string | number> = {};
    if (f.id_camara) params.id_camara = f.id_camara;
    if (f.tipo) params.tipo = f.tipo;
    if (f.estado) params.estado = f.estado;
    if (f.fecha_desde) params.fecha_desde = f.fecha_desde;
    if (f.fecha_hasta) params.fecha_hasta = f.fecha_hasta;
    const { data } = await api.get<Mantenimiento[]>("/mantenimientos", { params });
    return Array.isArray(data) ? data : [];
};

export const registrar = async (datos: NuevoMantenimiento) => {
    const { data } = await api.post<RespuestaMantenimiento>("/mantenimientos", datos);
    return data;
};

export const iniciar = async (id: number) => {
    const { data } = await api.patch<RespuestaMantenimiento>(`/mantenimientos/${id}/iniciar`, {});
    return data;
};

export const finalizar = async (id: number, datos: { fecha: string; hora: string; comentario: string | null }) => {
    const { data } = await api.patch<RespuestaMantenimiento>(`/mantenimientos/${id}/finalizar`, datos);
    return data;
};

export const cancelar = async (id: number, comentario: string) => {
    const { data } = await api.delete<RespuestaMantenimiento>(`/mantenimientos/${id}`, { data: { comentario } });
    return data;
};
