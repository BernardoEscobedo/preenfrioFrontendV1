import api from "../api/axios";
import type { Operador, OperadorForm } from "../types/operador";

// ============================================================================
// OPERADORES · endpoints (ver = operativo+ · escribir = coordinador+)
// ============================================================================
//   GET    /operadores                 listado (?estado ?id_linea_fletera ?buscar)
//   POST   /operadores                 alta
//   PUT    /operadores/:id             edición (conserva el estado)
//   DELETE /operadores/:id             baja LÓGICA
//   PATCH  /operadores/:id/reactivar   reactivar
// ============================================================================

interface RespuestaMensaje {
    mensaje?: string;
    aviso?: string | null;
}

const normalizar = (d: OperadorForm): OperadorForm => ({
    id_linea_fletera: d.id_linea_fletera,
    nombre: d.nombre.trim().replace(/\s+/g, " ").toUpperCase(),
    celular: d.celular.replace(/\D/g, "")
});

export const getOperadores = async (estado?: 0 | 1): Promise<Operador[]> => {
    const { data } = await api.get<Operador[]>("/operadores", {
        params: estado === undefined ? undefined : { estado }
    });
    return Array.isArray(data) ? data : [];
};

export const crearOperador = async (datos: OperadorForm) => {
    const { data } = await api.post<RespuestaMensaje>("/operadores", normalizar(datos));
    return data;
};

export const actualizarOperador = async (id: number, datos: OperadorForm) => {
    const { data } = await api.put<RespuestaMensaje>(`/operadores/${id}`, normalizar(datos));
    return data;
};

export const darDeBaja = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/operadores/${id}`);
    return data;
};

export const reactivar = async (id: number) => {
    const { data } = await api.patch<RespuestaMensaje>(`/operadores/${id}/reactivar`);
    return data;
};
