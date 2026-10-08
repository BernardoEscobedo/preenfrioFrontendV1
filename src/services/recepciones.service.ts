import api from "../api/axios";
import type {
    AlertaRecepcion,
    LineaEsperada,
    RecepcionLotePayload,
    RespuestaLote,
    ResumenAlertas
} from "../types/recepcion";

// ============================================================================
// RECEPCIONES · endpoints
// ============================================================================
//   GET   /recepciones/esperadas            ?todas=1 ?semana ?id_camara
//   POST  /recepciones/lote                 recibir un camión (operativo+)
//   GET   /recepciones/alertas              ?estado=1|2 (coordinador+)
//   GET   /recepciones/alertas/resumen      contador (coordinador+)
//   PATCH /recepciones/alertas/:id/atender  { comentario }
//   PATCH /recepciones/cierres/:id/reabrir  { motivo }
// ============================================================================

export const getEsperadas = async (filtros: { todas?: boolean; semana?: number | null } = {}) => {
    const params: Record<string, string | number> = {};
    if (filtros.todas) params.todas = 1;
    if (filtros.semana) params.semana = filtros.semana;
    const { data } = await api.get<LineaEsperada[]>("/recepciones/esperadas", { params });
    return Array.isArray(data) ? data : [];
};

export const recibirLote = async (payload: RecepcionLotePayload) => {
    const { data } = await api.post<RespuestaLote>("/recepciones/lote", payload);
    return data;
};

export const getAlertas = async (estado: 1 | 2 | null) => {
    const { data } = await api.get<AlertaRecepcion[]>("/recepciones/alertas", {
        params: estado ? { estado } : undefined
    });
    return Array.isArray(data) ? data : [];
};

export const getResumenAlertas = async () => {
    const { data } = await api.get<ResumenAlertas>("/recepciones/alertas/resumen");
    return data;
};

export const atenderAlerta = async (id_cierre: number, comentario: string) => {
    const { data } = await api.patch<{ mensaje: string }>(`/recepciones/alertas/${id_cierre}/atender`, { comentario });
    return data;
};

export const reabrirLinea = async (id_cierre: number, motivo: string) => {
    const { data } = await api.patch<{ mensaje: string }>(`/recepciones/cierres/${id_cierre}/reabrir`, { motivo });
    return data;
};
