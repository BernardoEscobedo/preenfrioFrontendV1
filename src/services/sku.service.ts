import api from "../api/axios";
import type { Sku, SkuForm } from "../types/sku";

// ============================================================================
// SKU · endpoints
// ============================================================================
//   GET    /sku                     listado (?estado ?turno ?calidad ?buscar)
//   POST   /sku                     alta                  coordinador+
//   PUT    /sku/:id                 edición               coordinador+
//   DELETE /sku/:id                 baja LÓGICA           coordinador+
//   PATCH  /sku/:id/reactivar       reactivar             coordinador+
//   DELETE /sku/:id/eliminar        borrado FÍSICO        solo admin
//
// El borrado físico solo prospera si ninguna producción usa el SKU (altas
// por error). Para descontinuar un empaque, la vía es la baja lógica.
// ============================================================================

interface RespuestaMensaje {
    mensaje?: string;
    aviso?: string | null;
}

const normalizar = (d: SkuForm): SkuForm => ({
    codigo_sku: d.codigo_sku.trim().toUpperCase().replace(/\s+/g, ""),
    calidad: d.calidad.trim().toUpperCase().replace(/\s+/g, " "),
    turno: Number(d.turno)
});

export const getSkus = async (): Promise<Sku[]> => {
    const { data } = await api.get<Sku[] | { skus: Sku[] }>("/sku");
    return Array.isArray(data) ? data : data.skus ?? [];
};

export const crearSku = async (datos: SkuForm) => {
    const { data } = await api.post<RespuestaMensaje>("/sku", normalizar(datos));
    return data;
};

export const actualizarSku = async (id: number, datos: SkuForm) => {
    const { data } = await api.put<RespuestaMensaje>(`/sku/${id}`, normalizar(datos));
    return data;
};

export const darDeBaja = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/sku/${id}`);
    return data;
};

export const reactivar = async (id: number) => {
    const { data } = await api.patch<RespuestaMensaje>(`/sku/${id}/reactivar`);
    return data;
};

export const eliminar = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/sku/${id}/eliminar`);
    return data;
};
