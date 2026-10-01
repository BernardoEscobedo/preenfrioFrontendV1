import type { AxiosError } from "axios";
import api from "../api/axios";
import type { CamaraTablero, Tablero } from "../types/dashboard";
import { num } from "../types/dashboard";
import type { Camara, CamaraForm, OcupacionCamara } from "../types/camara";

// ============================================================================
// CÁMARAS · endpoints
// ============================================================================
//   GET    /camaras/camaras                         listado (con alcance)
//   POST   /camaras/registrarcamara                 alta     (coordinador+)
//   PUT    /camaras/actualizarcamara/:id_camara     edición  (coordinador+)
//   PATCH  /bajas/camaras/:id                       baja        (solo admin)
//   PATCH  /bajas/camaras/:id/reactivar             reactivar   (solo admin)
//   GET    /ocupaciones/tablero                     ocupación actual
//
// Ya no existe DELETE: la baja es lógica, exige motivo y queda en el
// historial. El backend la rechaza si la cámara tiene fruta, cola,
// mantenimiento en proceso o producción pendiente de llegar.
// ============================================================================

/** Mayúsculas y sin espacios repetidos: así están las cámaras existentes. */
const limpiar = (t: string) => t.trim().replace(/\s+/g, " ").toUpperCase();

const normalizar = (d: CamaraForm): CamaraForm => ({
    ...d,
    nombre_camara: limpiar(d.nombre_camara),
    ubicacion: limpiar(d.ubicacion)
});

export const getCamaras = async (): Promise<Camara[]> => {
    const { data } = await api.get<Camara[] | { camaras: Camara[] }>("/camaras/camaras");
    return Array.isArray(data) ? data : data.camaras ?? [];
};

/**
 * Ocupación de cada cámara, indexada por id.
 * Es complementaria: si el tablero falla, el catálogo se sigue mostrando
 * sin las barras de ocupación.
 */
export const getOcupacion = async (): Promise<Map<number, OcupacionCamara>> => {
    try {
        const { data } = await api.get<Tablero>("/ocupaciones/tablero");
        return new Map(
            (data.camaras ?? []).map((c: CamaraTablero) => [
                c.id_camara,
                {
                    tarimas_ocupadas: num(c.tarimas_ocupadas),
                    tarimas_en_espera: num(c.tarimas_en_espera),
                    procesos_en_espera: num(c.procesos_en_espera),
                    en_mantenimiento: Boolean(c.en_mantenimiento)
                }
            ])
        );
    } catch {
        return new Map();
    }
};

export const crearCamara = async (datos: CamaraForm) => {
    const { data } = await api.post("/camaras/registrarcamara", normalizar(datos));
    return data;
};

export const actualizarCamara = async (id: number, datos: CamaraForm) => {
    const { data } = await api.put(`/camaras/actualizarcamara/${id}`, normalizar(datos));
    return data;
};

interface RespuestaEstado {
    mensaje: string;
    avisos?: string[];
}

interface ErrorBaja {
    error?: string;
    pendientes?: string[];
}

/**
 * Si la cámara no está vacía, el backend responde 409 con la lista de
 * pendientes. Se juntan en el mensaje para que el modal los muestre.
 */
export const darDeBaja = async (id: number, motivo: string): Promise<RespuestaEstado> => {
    try {
        const { data } = await api.patch<RespuestaEstado>(`/bajas/camaras/${id}`, { motivo });
        return data;
    } catch (err) {
        const e = err as AxiosError<ErrorBaja>;
        const pendientes = e.response?.data?.pendientes;

        if (e.response?.data && pendientes?.length) {
            e.response.data.error = `${e.response.data.error ?? "No se puede dar de baja."} ${pendientes.join(" ")}`;
        }

        throw e;
    }
};

export const reactivar = async (id: number, motivo: string): Promise<RespuestaEstado> => {
    const { data } = await api.patch<RespuestaEstado>(
        `/bajas/camaras/${id}/reactivar`,
        motivo ? { motivo } : {}
    );
    return data;
};
