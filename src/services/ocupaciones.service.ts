import api from "../api/axios";
import type {
    FilaCola,
    FilaInventario,
    RespuestaIngreso,
    RespuestaPrioridad,
    TableroCamaras
} from "../types/ocupacion";

// ============================================================================
// COLA DE CÁMARA · endpoints (ya existentes en el backend)
// ============================================================================
//   GET   /ocupaciones/tablero?tipo_camara=1&solo_operativas=1   capacidad por cámara
//   GET   /ocupaciones/cola?id_camara=1                          fruta en espera, ordenada
//   GET   /ocupaciones/inventario?id_camara=1                    fruta dentro
//   POST  /ocupaciones/:id/promover   { tarimas, fecha?, hora? } ingreso (operativo+)
//   PATCH /ocupaciones/:id/prioridad  { prioridad, motivo }      (supervisor+)
// ============================================================================

export const getTablero = async () => {
    const { data } = await api.get<TableroCamaras>("/ocupaciones/tablero", {
        params: { tipo_camara: 1, solo_operativas: 1 }
    });
    return data;
};

export const getCola = async (id_camara: number) => {
    const { data } = await api.get<FilaCola[]>("/ocupaciones/cola", { params: { id_camara } });
    return Array.isArray(data) ? data : [];
};

export const getInventario = async (id_camara: number) => {
    const { data } = await api.get<FilaInventario[]>("/ocupaciones/inventario", { params: { id_camara } });
    return Array.isArray(data) ? data : [];
};

export const ingresar = async (id_ocupacion: number, tarimas: number, fecha?: string, hora?: string) => {
    const { data } = await api.post<RespuestaIngreso>(`/ocupaciones/${id_ocupacion}/promover`, {
        tarimas,
        fecha: fecha || undefined,
        hora: hora || undefined
    });
    return data;
};

export const setPrioridad = async (id_ocupacion: number, prioridad: number, motivo: string | null) => {
    const { data } = await api.patch<RespuestaPrioridad>(`/ocupaciones/${id_ocupacion}/prioridad`, {
        prioridad,
        motivo
    });
    return data;
};
