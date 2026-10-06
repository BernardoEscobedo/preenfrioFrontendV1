import api from "../api/axios";
import type { AxiosError } from "axios";
import type {
    Despacho,
    DespachoCompleto,
    DespachoForm,
    FrutaDisponible,
    LineaForm,
    LineaOtroCliente
} from "../types/despacho";

// ============================================================================
// DESPACHOS · endpoints
// ============================================================================
//   GET    /despachos                         listado (?estado ?inocuidad=1|0|pendiente ?buscar)
//   GET    /despachos/:id                     documento + picking + auditoría
//   GET    /despachos/:id/disponible          fruta que se puede subir (?todos=1)
//   POST   /despachos                         alta en borrador (coordinador+)
//   PUT    /despachos/:id                     editar borrador (coordinador+)
//   PUT    /despachos/:id/corregir            corregir CERRADO con motivo (coordinador+)
//   PATCH  /despachos/:id/inocuidad           inspección de la caja (supervisor+)
//   POST   /despachos/:id/lineas              agregar fruta (operativo+)
//   DELETE /despachos/:id/lineas/:id_detalle  quitar fruta (operativo+)
//   PATCH  /despachos/:id/cerrar              cerrar (supervisor+) (?confirmar=1)
//   PATCH  /despachos/:id/reabrir             reabrir con motivo (admin)
//   DELETE /despachos/:id                     eliminar borrador vacío (admin)
// ============================================================================

interface RespuestaDespacho {
    mensaje?: string;
    despacho?: Despacho;
    avisos?: string[];
}

export interface FiltrosDespacho {
    estado?: 1 | 2;
    inocuidad?: "1" | "0" | "pendiente";
    fecha_desde?: string;
    fecha_hasta?: string;
}

const textoONulo = (t: string) => (t.trim() === "" ? null : t.trim());

const normalizar = (d: DespachoForm) => ({
    id_transporte: d.id_transporte,
    id_cc: d.id_cc,
    fecha_despacho: d.fecha_despacho,
    hora_salida: textoONulo(d.hora_salida),
    orden_venta: textoONulo(d.orden_venta)?.toUpperCase() ?? null,
    cita: textoONulo(d.cita)?.toUpperCase() ?? null,
    fecha_cita: textoONulo(d.fecha_cita),
    temperatura_salida: d.temperatura_salida.trim() === "" ? null : Number(d.temperatura_salida),
    observaciones: textoONulo(d.observaciones)
});

export const getDespachos = async (filtros: FiltrosDespacho = {}): Promise<Despacho[]> => {
    const params: Record<string, string | number> = {};
    if (filtros.estado) params.estado = filtros.estado;
    if (filtros.inocuidad) params.inocuidad = filtros.inocuidad;
    if (filtros.fecha_desde) params.fecha_desde = filtros.fecha_desde;
    if (filtros.fecha_hasta) params.fecha_hasta = filtros.fecha_hasta;

    const { data } = await api.get<Despacho[]>("/despachos", { params });
    return Array.isArray(data) ? data : [];
};

export const getDespacho = async (id: number): Promise<DespachoCompleto> => {
    const { data } = await api.get<DespachoCompleto>(`/despachos/${id}`);
    return {
        ...data,
        detalle: data.detalle ?? [],
        auditoria: data.auditoria ?? [],
        lineas_de_otro_cliente: data.lineas_de_otro_cliente ?? []
    };
};

export const getDisponible = async (id: number, todos = false): Promise<FrutaDisponible[]> => {
    const { data } = await api.get<{ inventario: FrutaDisponible[] }>(`/despachos/${id}/disponible`, {
        params: todos ? { todos: 1 } : undefined
    });
    return data.inventario ?? [];
};

export const crearDespacho = async (datos: DespachoForm) => {
    const { data } = await api.post<RespuestaDespacho>("/despachos", normalizar(datos));
    return data;
};

export const actualizarDespacho = async (id: number, datos: DespachoForm) => {
    const { data } = await api.put<RespuestaDespacho>(`/despachos/${id}`, normalizar(datos));
    return data;
};

export const corregirDespacho = async (id: number, datos: DespachoForm, motivo: string) => {
    const { data } = await api.put<RespuestaDespacho>(`/despachos/${id}/corregir`, {
        ...normalizar(datos),
        motivo
    });
    return data;
};

export const registrarInocuidad = async (id: number, inocuidad: 0 | 1, observaciones: string) => {
    const { data } = await api.patch<RespuestaDespacho>(`/despachos/${id}/inocuidad`, {
        inocuidad,
        inocuidad_observaciones: textoONulo(observaciones)
    });
    return data;
};

export const agregarLinea = async (id: number, linea: LineaForm) => {
    const { data } = await api.post<{ mensaje?: string; avisos?: string[] }>(`/despachos/${id}/lineas`, {
        id_ocupacion_origen: linea.id_ocupacion_origen,
        cantidad_tarimas: linea.cantidad_tarimas,
        cantidad_cajas: linea.cantidad_cajas,
        temperatura: linea.temperatura.trim() === "" ? null : Number(linea.temperatura),
        observaciones: textoONulo(linea.observaciones)
    });
    return data;
};

export const quitarLinea = async (id: number, idDetalle: number) => {
    const { data } = await api.delete<{ mensaje?: string }>(`/despachos/${id}/lineas/${idDetalle}`);
    return data;
};

export const cerrarDespacho = async (id: number, confirmar = false) => {
    const { data } = await api.patch<RespuestaDespacho>(
        `/despachos/${id}/cerrar${confirmar ? "?confirmar=1" : ""}`
    );
    return data;
};

export const reabrirDespacho = async (id: number, motivo: string) => {
    const { data } = await api.patch<RespuestaDespacho>(`/despachos/${id}/reabrir`, { motivo });
    return data;
};

export const eliminarDespacho = async (id: number) => {
    const { data } = await api.delete<{ mensaje?: string }>(`/despachos/${id}`);
    return data;
};

/**
 * Si el cierre se rechazó por fruta de otro cliente, el backend responde
 * 409 con la lista de líneas. Devuelve esa lista, o null si fue otro error.
 */
export const lineasDeOtroClienteEnError = (error: unknown): LineaOtroCliente[] | null => {
    const err = error as AxiosError<{ lineas_de_otro_cliente?: LineaOtroCliente[] }>;
    if (err.response?.status !== 409) return null;
    const lista = err.response.data?.lineas_de_otro_cliente;
    return Array.isArray(lista) && lista.length > 0 ? lista : null;
};
