import api from "../api/axios";
import type { AxiosError } from "axios";
import type {
    CamaraPreenfrio,
    CatalogosCorreccion,
    FilaExcel,
    Produccion,
    ProduccionSinCamara,
    VistaPrevia
} from "../types/produccion";

// ============================================================================
// PRODUCCIÓN · endpoints
// ============================================================================
//   GET   /produccion?semana=41                          plan (operativo+)
//   GET   /produccion-importacion/catalogos              combos de corrección
//   POST  /produccion-importacion/vista-previa           evalúa sin guardar
//   POST  /produccion-importacion/confirmar              guarda ✅ y ⚠️
//   GET   /produccion-importacion/sin-camara             sin preenfrío
//   GET   /produccion-importacion/camaras                preenfríos
//   PATCH /produccion-importacion/asignar-camara         { ids, id_camara }
// ============================================================================

const BASE = "/produccion-importacion";

export const getProduccion = async (semana: number | null): Promise<Produccion[]> => {
    const { data } = await api.get<Produccion[]>("/produccion", {
        params: semana ? { semana } : undefined
    });
    return Array.isArray(data) ? data : [];
};

export const getCatalogos = async (): Promise<CatalogosCorreccion> => {
    const { data } = await api.get<CatalogosCorreccion>(`${BASE}/catalogos`);
    return data;
};

export const vistaPrevia = async (filas: FilaExcel[], destinos: Record<string, number>) => {
    const { data } = await api.post<VistaPrevia>(`${BASE}/vista-previa`, { filas, destinos });
    return data;
};

export interface RespuestaConfirmar {
    mensaje: string;
    id_importacion: number;
    insertadas: number;
    omitidas: number;
    con_error: number;
    equivalencias_guardadas: number;
}

export const confirmar = async (
    filas: FilaExcel[],
    destinos: Record<string, number>,
    nombre_archivo: string,
    esperadas: number
) => {
    const { data } = await api.post<RespuestaConfirmar>(`${BASE}/confirmar`, {
        filas,
        destinos,
        nombre_archivo,
        esperadas
    });
    return data;
};

/** Si la confirmación detectó cambios, el backend devuelve la vista nueva. */
export const vistaPreviaEnError = (error: unknown): VistaPrevia | null => {
    const err = error as AxiosError<{ vista_previa?: VistaPrevia }>;
    return err.response?.status === 409 ? err.response.data?.vista_previa ?? null : null;
};

export const getSinCamara = async (filtros: { semana?: number | null; fecha_empaque?: string }) => {
    const params: Record<string, string | number> = {};
    if (filtros.semana) params.semana = filtros.semana;
    if (filtros.fecha_empaque) params.fecha_empaque = filtros.fecha_empaque;
    const { data } = await api.get<ProduccionSinCamara[]>(`${BASE}/sin-camara`, { params });
    return Array.isArray(data) ? data : [];
};

export const getCamaras = async (): Promise<CamaraPreenfrio[]> => {
    const { data } = await api.get<CamaraPreenfrio[]>(`${BASE}/camaras`);
    return Array.isArray(data) ? data : [];
};

export const asignarCamara = async (ids: number[], id_camara: number) => {
    const { data } = await api.patch<{ mensaje: string; avisos?: string[] }>(`${BASE}/asignar-camara`, {
        ids,
        id_camara
    });
    return data;
};
