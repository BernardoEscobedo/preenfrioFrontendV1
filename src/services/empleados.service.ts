import api from "../api/axios";
import type { Empleado, EmpleadoForm, RespuestaCambioEstado } from "../types/empleado";

// ============================================================================
// EMPLEADOS · endpoints
// ============================================================================
//   GET    /empleados/empleados                  listado (coordinador+)
//   POST   /empleados/registrarempleado          alta    (coordinador+)
//   PUT    /empleados/actualizarempleado/:id     edición (coordinador+)
//   PATCH  /bajas/empleados/:id                  baja        (solo admin)
//   PATCH  /bajas/empleados/:id/reactivar        reactivar   (solo admin)
//
// Ya no existe DELETE: la baja es lógica, exige motivo y queda en el
// historial. Dar de baja a un empleado deshabilita también su cuenta.
// ============================================================================

/** Quita espacios de los extremos y los dobles del medio. */
const limpiar = (texto: string) => texto.trim().replace(/\s+/g, " ");

const normalizar = (datos: EmpleadoForm): EmpleadoForm => ({
    nombre: limpiar(datos.nombre),
    apellidos: limpiar(datos.apellidos),
    turno: limpiar(datos.turno),
    zona: limpiar(datos.zona)
});

export const getEmpleados = async (): Promise<Empleado[]> => {
    const { data } = await api.get<Empleado[]>("/empleados/empleados");
    return data;
};

export const crearEmpleado = async (datos: EmpleadoForm) => {
    const { data } = await api.post("/empleados/registrarempleado", normalizar(datos));
    return data;
};

export const actualizarEmpleado = async (id: number, datos: EmpleadoForm) => {
    const { data } = await api.put(`/empleados/actualizarempleado/${id}`, normalizar(datos));
    return data;
};

export const darDeBaja = async (id: number, motivo: string): Promise<RespuestaCambioEstado> => {
    const { data } = await api.patch<RespuestaCambioEstado>(`/bajas/empleados/${id}`, { motivo });
    return data;
};

// El motivo es opcional al reactivar
export const reactivar = async (id: number, motivo: string): Promise<RespuestaCambioEstado> => {
    const { data } = await api.patch<RespuestaCambioEstado>(
        `/bajas/empleados/${id}/reactivar`,
        motivo ? { motivo } : {}
    );
    return data;
};
