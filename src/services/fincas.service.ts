import api from "../api/axios";
import type { Finca, FincaForm } from "../types/finca";

// ============================================================================
// FINCAS · endpoints (coordinador+)
// ============================================================================
//   GET    /fincas                listado (?id_productor ?zona ?estado ?buscar)
//   POST   /fincas                alta
//   PUT    /fincas/:id            edición
//   DELETE /fincas/:id            baja LÓGICA (estado = 0)
//   PATCH  /fincas/:id/reactivar  reactivar
//
// El backend valida que el productor exista y esté activo, y que el código
// no se repita dentro del mismo productor.
// ============================================================================

interface RespuestaMensaje {
    mensaje?: string;
    aviso?: string | null;
}

const limpiar = (t: string) => t.trim().replace(/\s+/g, " ").toUpperCase();

const normalizar = (d: FincaForm): FincaForm => ({
    codigo_finca: d.codigo_finca.trim().toUpperCase().replace(/\s+/g, ""),
    nombre: limpiar(d.nombre),
    org_inv_nombre: limpiar(d.org_inv_nombre),
    zona: Number(d.zona),
    id_productor: Number(d.id_productor)
});

export const getFincas = async (): Promise<Finca[]> => {
    const { data } = await api.get<Finca[] | { fincas: Finca[] }>("/fincas");
    return Array.isArray(data) ? data : data.fincas ?? [];
};

export const crearFinca = async (datos: FincaForm) => {
    const { data } = await api.post<RespuestaMensaje>("/fincas", normalizar(datos));
    return data;
};

export const actualizarFinca = async (id: number, datos: FincaForm) => {
    const { data } = await api.put<RespuestaMensaje>(`/fincas/${id}`, normalizar(datos));
    return data;
};

export const darDeBaja = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/fincas/${id}`);
    return data;
};

export const reactivar = async (id: number) => {
    const { data } = await api.patch<RespuestaMensaje>(`/fincas/${id}/reactivar`);
    return data;
};
