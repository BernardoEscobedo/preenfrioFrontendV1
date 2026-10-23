import api from "../api/axios";
import type { CamaraBloques, LoteCamara, PulpeoHistorial, RespuestaBloques, TarimaCaptura } from "../types/tarima";

// ============================================================================
// BLOQUES POR TARIMA Y PULPEOS · endpoints
// ============================================================================
//   GET   /ocupaciones/tablero?tipo_camara=1|2   cámaras (selector)
//   GET   /tarimas?id_camara=                     bloques con tarimas
//   GET   /tarimas/lotes?id_camara=               lotes para armar
//   POST  /tarimas/bloques                        armar
//   POST  /tarimas/bloques/:id/tarimas            completar posiciones
//   PATCH /tarimas/:id/retirar                    retirar (supervisor+)
//   GET   /tarimas/:id/pulpeos                    historial
//   POST  /tarimas/:id/pulpeo/sesion              pulpeo · paso 1
//   POST  /tarimas/pulpeo/confirmar               pulpeo · paso 3
//   GET   /evidencias/pulpeos/archivo/:id/url     ver foto
//
// El traslado del bloque a conservación está en movimientos.service
// (trasladarBloque).
// ============================================================================

export const getCamaras = async (): Promise<CamaraBloques[]> => {
    const [pre, con] = await Promise.all([
        api.get<{ camaras: CamaraBloques[] }>("/ocupaciones/tablero", { params: { tipo_camara: 1 } }),
        api.get<{ camaras: CamaraBloques[] }>("/ocupaciones/tablero", { params: { tipo_camara: 2 } })
    ]);
    return [...(pre.data?.camaras ?? []), ...(con.data?.camaras ?? [])];
};

export const getBloques = async (id_camara: number) => {
    const { data } = await api.get<RespuestaBloques>("/tarimas", { params: { id_camara } });
    return data;
};

export const getLotes = async (id_camara: number) => {
    const { data } = await api.get<LoteCamara[]>("/tarimas/lotes", { params: { id_camara } });
    return Array.isArray(data) ? data : [];
};

export const armarBloque = async (datos: {
    codigo_bloque: string | null;
    id_camara: number;
    posiciones: 10 | 12;
    fecha_hora_ingreso: string | null;
    tarimas: TarimaCaptura[];
}) => {
    const { data } = await api.post<{ mensaje: string }>("/tarimas/bloques", datos);
    return data;
};

export const agregarTarimas = async (id_bloque: number, fecha_hora_ingreso: string | null, tarimas: TarimaCaptura[]) => {
    const { data } = await api.post<{ mensaje: string }>(`/tarimas/bloques/${id_bloque}/tarimas`, { fecha_hora_ingreso, tarimas });
    return data;
};

export const retirarTarima = async (id_tarima: number) => {
    const { data } = await api.patch<{ mensaje: string }>(`/tarimas/${id_tarima}/retirar`);
    return data;
};

export const getHistorial = async (id_tarima: number) => {
    const { data } = await api.get<PulpeoHistorial[]>(`/tarimas/${id_tarima}/pulpeos`);
    return Array.isArray(data) ? data : [];
};

export const sesionPulpeo = async (
    id_tarima: number,
    datos: { temperatura: number; fecha_hora: string | null; observaciones: string | null; foto: { mime_type: string; tamano_bytes: number; nombre_original: string } }
) => {
    const { data } = await api.post<{ upload_url: string; token_carga: string }>(`/tarimas/${id_tarima}/pulpeo/sesion`, datos);
    return data;
};

export const confirmarPulpeo = async (token_carga: string, item_id: string) => {
    const { data } = await api.post<{ mensaje: string }>("/tarimas/pulpeo/confirmar", { token_carga, item_id });
    return data;
};

export const urlFoto = async (id_evidencia: number) => {
    const { data } = await api.get<{ url: string }>(`/evidencias/pulpeos/archivo/${id_evidencia}/url`);
    return data.url;
};
