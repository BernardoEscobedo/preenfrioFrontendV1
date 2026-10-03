import api from "../api/axios";
import type { Cedis, CedisForm } from "../types/cedis";

// ============================================================================
// CLIENTES / CEDIS · endpoints (coordinador+)
// ============================================================================
//   GET    /cedis                 listado (?estado ?buscar)
//   POST   /cedis                 alta
//   PUT    /cedis/:id             edición
//   DELETE /cedis/:id             baja LÓGICA (estado = 0)
//   PATCH  /cedis/:id/reactivar   reactivar
//
// La baja no borra: producción y despachos siguen apuntando al destino.
// ============================================================================

interface RespuestaMensaje {
    mensaje?: string;
    aviso?: string | null;
}

const limpiar = (t: string) => t.trim().replace(/\s+/g, " ").toUpperCase();

const normalizar = (d: CedisForm): CedisForm => ({
    cliente: limpiar(d.cliente),
    cedis: limpiar(d.cedis),
    // Sin espacios: es la llave del Excel y se compara exacto
    acronimo: d.acronimo.trim().toUpperCase().replace(/\s+/g, "")
});

export const getCedis = async (): Promise<Cedis[]> => {
    const { data } = await api.get<Cedis[] | { cedis: Cedis[] }>("/cedis");
    return Array.isArray(data) ? data : data.cedis ?? [];
};

export const crearCedis = async (datos: CedisForm) => {
    const { data } = await api.post<RespuestaMensaje>("/cedis", normalizar(datos));
    return data;
};

export const actualizarCedis = async (id: number, datos: CedisForm) => {
    const { data } = await api.put<RespuestaMensaje>(`/cedis/${id}`, normalizar(datos));
    return data;
};

export const darDeBaja = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/cedis/${id}`);
    return data;
};

export const reactivar = async (id: number) => {
    const { data } = await api.patch<RespuestaMensaje>(`/cedis/${id}/reactivar`);
    return data;
};
