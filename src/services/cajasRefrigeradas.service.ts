import api from "../api/axios";
import type { CajaRefrigerada, CajaRefrigeradaForm } from "../types/cajaRefrigerada";
import { normalizarPlaca } from "./tractocamiones.service";

// ============================================================================
// CAJAS REFRIGERADAS · endpoints (ver = operativo+ · escribir = coordinador+)
// ============================================================================
//   GET    /cajas-refrigeradas                 listado (?estado ?id_linea_fletera ?buscar)
//   POST   /cajas-refrigeradas                 alta
//   PUT    /cajas-refrigeradas/:id             edición (conserva el estado)
//   DELETE /cajas-refrigeradas/:id             baja LÓGICA
//   PATCH  /cajas-refrigeradas/:id/reactivar   reactivar
// ============================================================================

interface RespuestaMensaje {
    mensaje?: string;
    aviso?: string | null;
}

const normalizar = (d: CajaRefrigeradaForm): CajaRefrigeradaForm => ({
    id_linea_fletera: d.id_linea_fletera,
    placas: normalizarPlaca(d.placas),
    numero_economico: d.numero_economico.trim().toUpperCase(),
    largo_pies: d.largo_pies
});

export const getCajas = async (estado?: 0 | 1): Promise<CajaRefrigerada[]> => {
    const { data } = await api.get<CajaRefrigerada[]>("/cajas-refrigeradas", {
        params: estado === undefined ? undefined : { estado }
    });
    return Array.isArray(data) ? data : [];
};

export const crearCaja = async (datos: CajaRefrigeradaForm) => {
    const { data } = await api.post<RespuestaMensaje>("/cajas-refrigeradas", normalizar(datos));
    return data;
};

export const actualizarCaja = async (id: number, datos: CajaRefrigeradaForm) => {
    const { data } = await api.put<RespuestaMensaje>(`/cajas-refrigeradas/${id}`, normalizar(datos));
    return data;
};

export const darDeBaja = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/cajas-refrigeradas/${id}`);
    return data;
};

export const reactivar = async (id: number) => {
    const { data } = await api.patch<RespuestaMensaje>(`/cajas-refrigeradas/${id}/reactivar`);
    return data;
};
