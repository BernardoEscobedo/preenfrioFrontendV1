import api from "../api/axios";
import type { Transporte, TransporteForm } from "../types/transporte";

// ============================================================================
// TRANSPORTES · endpoints (ver = operativo+ · escribir = coordinador+)
// ============================================================================
//   GET    /transportes                 listado
//            ?estado=1      solo activos
//            ?completos=1   solo servicios con sus 4 catálogos activos
//                           (dropdown del despacho)
//   POST   /transportes                 alta con los 4 IDs
//   PUT    /transportes/:id             edición (conserva el estado)
//   DELETE /transportes/:id             baja LÓGICA
//   PATCH  /transportes/:id/reactivar   reactivar
//
// ⚠️ Ya NO existe PATCH /transportes/:id/inocuidad: la inspección se
// registra en cada despacho.
// ============================================================================

interface RespuestaMensaje {
    mensaje?: string;
    aviso?: string | null;
}

interface FiltrosTransporte {
    estado?: 0 | 1;
    completos?: boolean;
}

export const getTransportes = async (filtros: FiltrosTransporte = {}): Promise<Transporte[]> => {
    const params: Record<string, string | number> = {};
    if (filtros.estado !== undefined) params.estado = filtros.estado;
    if (filtros.completos) params.completos = 1;

    const { data } = await api.get<Transporte[]>("/transportes", { params });
    return Array.isArray(data) ? data : [];
};

export const crearTransporte = async (datos: TransporteForm) => {
    const { data } = await api.post<RespuestaMensaje>("/transportes", datos);
    return data;
};

export const actualizarTransporte = async (id: number, datos: TransporteForm) => {
    const { data } = await api.put<RespuestaMensaje>(`/transportes/${id}`, datos);
    return data;
};

export const darDeBaja = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/transportes/${id}`);
    return data;
};

export const reactivar = async (id: number) => {
    const { data } = await api.patch<RespuestaMensaje>(`/transportes/${id}/reactivar`);
    return data;
};

/** "LÍNEA · OPERADOR · TRACTO / CAJA" para dropdowns y encabezados. */
export const describirTransporte = (t: Transporte) =>
    [
        t.razon_social,
        t.nombre_operador,
        [t.placas_tracto, t.placas_caja].filter(Boolean).join(" / ")
    ]
        .filter(Boolean)
        .join(" · ");
