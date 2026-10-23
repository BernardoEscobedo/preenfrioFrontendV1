import api from "../api/axios";
import type {
    ClienteDisponible,
    DespachoCompletoPayload,
    RespuestaDespachoCompleto,
    StockProceso
} from "../types/despachoNuevo";

// ============================================================================
// DESPACHO EN UN PASO · endpoints
// ============================================================================
//   GET  /despachos/clientes-disponibles     destinos con fruta en stock
//   GET  /despachos/inventario?id_cc&todos   stock para ese destino
//   POST /despachos/completo                 registra y CIERRA (operativo+)
// ============================================================================

export const getClientesDisponibles = async () => {
    const { data } = await api.get<ClienteDisponible[]>("/despachos/clientes-disponibles");
    return Array.isArray(data) ? data : [];
};

export const getInventario = async (id_cc: number, todos: boolean) => {
    const { data } = await api.get<StockProceso[]>("/despachos/inventario", {
        params: todos ? { id_cc, todos: 1 } : { id_cc }
    });
    return Array.isArray(data) ? data : [];
};

export const confirmarDespacho = async (payload: DespachoCompletoPayload) => {
    const { data } = await api.post<RespuestaDespachoCompleto>("/despachos/completo", payload);
    return data;
};
