// ============================================================================
// TIPOS · DESPACHOS
// ============================================================================
// El despacho es un DOCUMENTO (folio, transporte, cita, cliente). Lo que
// lleva es el picking (despachos_detalle), que puede salir de varias
// cámaras.
//
// ESTADOS
//   1 = borrador  se edita, se carga fruta, se inspecciona, se elimina
//   2 = cerrado   el camión salió; solo admite corrección auditada
//
// INOCUIDAD (del despacho, no del transporte)
//   null = pendiente · 0 = rechazada · 1 = aprobada
//   No se puede cerrar sin inocuidad = 1. Si el borrador cambia de
//   transporte, la BD borra la inspección y hay que volver a revisar.
//
// ⚠️ Los campos marcados como opcionales dependen de lo que exponga
// vw_despachos / vw_despachos_detalle / vw_inventario_disponible. La
// pantalla los muestra si vienen y no truena si no vienen.
// ============================================================================

export type ResultadoInocuidad = 0 | 1 | null;

export interface Despacho {
    id_despacho: number;
    folio_despacho: number | string;
    estado: number;                          // 1 borrador · 2 cerrado
    id_transporte: number;
    id_cc: number;
    cliente: string;
    cedis: string;
    acronimo?: string | null;
    fecha_despacho: string;
    hora_salida?: string | null;
    orden_venta?: string | null;
    cita?: string | null;
    fecha_cita?: string | null;
    temperatura_salida?: number | string | null;
    observaciones?: string | null;
    cantidad_tarimas: number | string;
    cantidad_cajas: number | string;
    lineas: number | string;
    // Transporte (leídos de los catálogos en vivo)
    razon_social?: string | null;
    nombre_operador?: string | null;
    celular?: string | null;
    placas_tracto?: string | null;
    placas_caja?: string | null;
    no_economico_caja?: string | null;
    // Inspección
    inocuidad: ResultadoInocuidad;
    inocuidad_fecha?: string | null;
    inocuidad_id_usuario?: number | null;
    inocuidad_usuario?: string | null;
    inocuidad_observaciones?: string | null;
}

export interface LineaDespacho {
    id_detalle: number;
    id_despacho: number;
    id_produccion?: number | null;
    id_ocupacion_origen?: number | null;
    id_camara_origen?: number | null;
    camara_origen?: string | null;
    codigo_lote?: string | null;
    cantidad_tarimas: number | string;
    cantidad_cajas: number | string;
    temperatura?: number | string | null;
    observaciones?: string | null;
}

export interface LineaOtroCliente {
    id_detalle: number;
    cantidad_tarimas: number | string;
    codigo_lote: string | null;
    cliente_fruta: string | null;
    cedis_fruta: string | null;
    cliente_despacho: string;
    cedis_despacho: string;
}

export interface AuditoriaDespacho {
    id_auditoria?: number;
    fecha_hora: string;
    estado_al_editar: number;
    motivo: string;
    cambios: string;
    usuario?: string | null;
    nombre_usuario?: string | null;
}

export interface DespachoCompleto extends Despacho {
    detalle: LineaDespacho[];
    auditoria: AuditoriaDespacho[];
    lineas_de_otro_cliente: LineaOtroCliente[];
}

export interface FrutaDisponible {
    id_ocupacion: number;
    id_camara: number;
    nombre_camara?: string | null;
    id_produccion?: number | null;
    codigo_lote?: string | null;
    id_cc: number | null;
    cliente?: string | null;
    cedis?: string | null;
    acronimo_cc?: string | null;
    tarimas_disponibles: number | string;
    cajas_disponibles: number | string;
    fecha_empaque?: string | null;
    fecha_entrega?: string | null;
    nivel_criticidad?: number | null;
    holgura_dias?: number | null;
    es_de_otro_cliente: boolean;
}

export interface DespachoForm {
    id_transporte: number;
    id_cc: number;
    fecha_despacho: string;
    hora_salida: string;
    orden_venta: string;
    cita: string;
    fecha_cita: string;
    temperatura_salida: string;
    observaciones: string;
}

export interface LineaForm {
    id_ocupacion_origen: number;
    cantidad_tarimas: number;
    cantidad_cajas: number;
    temperatura: string;
    observaciones: string;
}
