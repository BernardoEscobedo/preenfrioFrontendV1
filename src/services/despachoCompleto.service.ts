import api from "../api/axios";
import type {
    ClienteDisponible,
    DespachoCompletoPayload,
    RespuestaDespachoCompleto,
    TarimasDisponibles
} from "../types/despachoNuevo";

// ============================================================================
// DESPACHO EN UN PASO · endpoints
// ============================================================================
//   GET  /despachos/clientes-disponibles     destinos con fruta en stock
//   GET  /despachos/tarimas?id_cc&todos      bloques con sus tarimas
//   POST /despachos/completo                 registra y CIERRA (operativo+)
// ============================================================================

export const getClientesDisponibles = async () => {
    const { data } = await api.get<ClienteDisponible[]>("/despachos/clientes-disponibles");
    return Array.isArray(data) ? data : [];
};

export const getTarimas = async (id_cc: number, todos: boolean) => {
    const { data } = await api.get<TarimasDisponibles>("/despachos/tarimas", {
        params: todos ? { id_cc, todos: 1 } : { id_cc }
    });
    return { bloques: data?.bloques ?? [], sin_bloque: data?.sin_bloque ?? { lotes: 0, cajas: 0 } };
};

export const confirmarDespacho = async (payload: DespachoCompletoPayload) => {
    const { data } = await api.post<RespuestaDespachoCompleto>("/despachos/completo", payload);
    return data;
};
