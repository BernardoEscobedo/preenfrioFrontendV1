import api from "../api/axios";
import type { LineaFletera, LineaFleteraForm } from "../types/lineaFletera";

// ============================================================================
// LÍNEAS FLETERAS · endpoints (ver = operativo+ · escribir = coordinador+)
// ============================================================================
//   GET    /lineas-fleteras                 listado (?estado ?buscar)
//   POST   /lineas-fleteras                 alta
//   PUT    /lineas-fleteras/:id             edición (conserva el estado)
//   DELETE /lineas-fleteras/:id             baja LÓGICA (estado = 0)
//   PATCH  /lineas-fleteras/:id/reactivar   reactivar
// ============================================================================

interface RespuestaMensaje {
    mensaje?: string;
    aviso?: string | null;
}

const limpiar = (t: string) => t.trim().replace(/\s+/g, " ").toUpperCase();

const normalizar = (d: LineaFleteraForm): LineaFleteraForm => ({
    razon_social: limpiar(d.razon_social),
    // El backend lo vuelve a normalizar; aquí solo se evita mandar basura
    rfc: d.rfc.toUpperCase().replace(/[^A-ZÑ&0-9]/g, ""),
    telefono_contacto: d.telefono_contacto.replace(/\D/g, "")
});

export const getLineas = async (estado?: 0 | 1): Promise<LineaFletera[]> => {
    const { data } = await api.get<LineaFletera[]>("/lineas-fleteras", {
        params: estado === undefined ? undefined : { estado }
    });
    return Array.isArray(data) ? data : [];
};

export const crearLinea = async (datos: LineaFleteraForm) => {
    const { data } = await api.post<RespuestaMensaje>("/lineas-fleteras", normalizar(datos));
    return data;
};

export const actualizarLinea = async (id: number, datos: LineaFleteraForm) => {
    const { data } = await api.put<RespuestaMensaje>(`/lineas-fleteras/${id}`, normalizar(datos));
    return data;
};

export const darDeBaja = async (id: number) => {
    const { data } = await api.delete<RespuestaMensaje>(`/lineas-fleteras/${id}`);
    return data;
};

export const reactivar = async (id: number) => {
    const { data } = await api.patch<RespuestaMensaje>(`/lineas-fleteras/${id}/reactivar`);
    return data;
};
