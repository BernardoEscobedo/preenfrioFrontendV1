import api from "../api/axios";
import type { Productor, ProductorForm } from "../types/productor";

// ============================================================================
// PRODUCTORES · endpoints (coordinador+)
// ============================================================================
//   GET    /productores                listado (?estado ?buscar)
//   POST   /productores                alta
//   PUT    /productores/:id            edición
//   DELETE /productores/:id            baja LÓGICA (estado = 0)
//   PATCH  /productores/:id/reactivar  reactivar
//
// La baja no borra: fincas y producción siguen apuntando al productor.
// ============================================================================

interface RespuestaMensaje {
    mensaje?: string;
    aviso?: string | null;
}

const normalizar = (d: ProductorForm): ProductorForm => ({
    codigo_productor: d.codigo_productor.trim().toUpperCase().replace(/\s+/g, ""),
    nombre: d.nombre.trim().replace(/\s+/g, " ").toUpperCase()
});

export const getProductores = async (): Promise<Productor[]> => {
    const { data } = await api.get<Productor[] | { productores: Productor[] }>("/productores");
    return Array.isArray(data) ? data : data.productores ?? [];
};

export const crearProductor = async (datos: ProductorForm) => {
    const { data } = await api.post<RespuestaMensaje>("/productores", normalizar(datos));
    return data;
};

export const actualizarProductor = async (id: number, datos: ProductorForm) => {
    const { data } = await api.put<RespuestaMensaje>(`/productores/${id}`, normalizar(datos));
    return data;
};

export const darDeBaja = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/productores/${id}`);
    return data;
};

export const reactivar = async (id: number) => {
    const { data } = await api.patch<RespuestaMensaje>(`/productores/${id}/reactivar`);
    return data;
};
