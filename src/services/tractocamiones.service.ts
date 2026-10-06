import api from "../api/axios";
import type { Tractocamion, TractocamionForm } from "../types/tractocamion";

// ============================================================================
// TRACTOCAMIONES · endpoints (ver = operativo+ · escribir = coordinador+)
// ============================================================================
//   GET    /tractocamiones                 listado (?estado ?id_linea_fletera ?buscar)
//   POST   /tractocamiones                 alta
//   PUT    /tractocamiones/:id             edición (conserva el estado)
//   DELETE /tractocamiones/:id             baja LÓGICA
//   PATCH  /tractocamiones/:id/reactivar   reactivar
// ============================================================================

interface RespuestaMensaje {
    mensaje?: string;
    aviso?: string | null;
}

/** Igual que el backend: solo letras y números, en mayúsculas. */
export const normalizarPlaca = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, "");

const normalizar = (d: TractocamionForm): TractocamionForm => ({
    id_linea_fletera: d.id_linea_fletera,
    placas: normalizarPlaca(d.placas),
    numero_economico: d.numero_economico.trim().toUpperCase()
});

export const getTractocamiones = async (estado?: 0 | 1): Promise<Tractocamion[]> => {
    const { data } = await api.get<Tractocamion[]>("/tractocamiones", {
        params: estado === undefined ? undefined : { estado }
    });
    return Array.isArray(data) ? data : [];
};

export const crearTractocamion = async (datos: TractocamionForm) => {
    const { data } = await api.post<RespuestaMensaje>("/tractocamiones", normalizar(datos));
    return data;
};

export const actualizarTractocamion = async (id: number, datos: TractocamionForm) => {
    const { data } = await api.put<RespuestaMensaje>(`/tractocamiones/${id}`, normalizar(datos));
    return data;
};

export const darDeBaja = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/tractocamiones/${id}`);
    return data;
};

export const reactivar = async (id: number) => {
    const { data } = await api.patch<RespuestaMensaje>(`/tractocamiones/${id}/reactivar`);
    return data;
};
