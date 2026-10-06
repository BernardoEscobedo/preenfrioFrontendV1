// ============================================================================
// TIPOS · LÍNEAS FLETERAS
// ============================================================================
// La empresa transportista: primera pieza de un servicio de transporte.
// Operadores, tractocamiones y cajas pueden pertenecer a una línea o ser
// independientes.
//
// La llave de negocio es el RFC: la razón social se escribe de mil formas,
// el RFC no. El backend lo guarda en mayúsculas y sin espacios ni guiones.
//
// Los conteos pueden llegar como texto desde PostgreSQL (COUNT devuelve
// bigint): siempre se pasan por Number() con respaldo.
// ============================================================================

export interface LineaFletera {
    id_linea_fletera: number;
    razon_social: string;
    rfc: string;
    telefono_contacto: string;
    estado: number;                          // 1 activa · 0 dada de baja
    operadores_activos?: number | string;
    tractocamiones_activos?: number | string;
    cajas_activas?: number | string;
}

export interface LineaFleteraForm {
    razon_social: string;
    rfc: string;
    telefono_contacto: string;
}
