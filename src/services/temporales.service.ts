import api from "../api/axios";
import type { TipoCierre, RespuestaLote } from "../types/recepcion";
import type { CajaTemporal, DestinoCamara, DestinoReubicar, DestinosRecepcion, RespuestaReubicar } from "../types/temporal";

// ============================================================================
// CAJAS TEMPORALES · endpoints
// ============================================================================
//   GET  /temporales                      cajas abiertas
//   GET  /temporales/destinos?excluir=    cámaras operando
//   GET  /temporales/recepcion/:id        dónde recibir
//   POST /temporales/reubicar             sacar toda la fruta de una cámara
//   POST /temporales/:id/cerrar           cerrar caja vacía
//   POST /recepciones/lote                recibir (con id_camara destino)
// ============================================================================

export const getCajas = async () => {
    const { data } = await api.get<CajaTemporal[]>("/temporales");
    return Array.isArray(data) ? data : [];
};

export const getDestinos = async (excluir: number) => {
    const { data } = await api.get<DestinoCamara[]>("/temporales/destinos", { params: { excluir } });
    return Array.isArray(data) ? data : [];
};

export const getDestinosRecepcion = async (id_camara: number) => {
    const { data } = await api.get<DestinosRecepcion>(`/temporales/recepcion/${id_camara}`);
    return data;
};

export const reubicar = async (id_camara_origen: number, destino: DestinoReubicar) => {
    const { data } = await api.post<RespuestaReubicar>("/temporales/reubicar", { id_camara_origen, destino });
    return data;
};

export const cerrarCaja = async (id_camara: number) => {
    const { data } = await api.post<{ mensaje: string }>(`/temporales/${id_camara}/cerrar`);
    return data;
};

/** Recepción de un proceso indicando la cámara donde se recibe */
export const recibirEn = async (payload: {
    fecha_recepcion: string;
    hora_recepcion: string;
    id_camara: number | null;
    temperatura: number | null;
    observaciones: string | null;
    lineas: { id_produccion: number; cajas: number; tarimas: number; cierre: TipoCierre; observaciones?: string | null }[];
}) => {
    const { data } = await api.post<RespuestaLote>("/recepciones/lote", payload);
    return data;
};
