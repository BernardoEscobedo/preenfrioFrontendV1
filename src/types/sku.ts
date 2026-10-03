// ============================================================================
// TIPOS · SKU DE PRODUCTO TERMINADO
// ============================================================================
// El TURNO es el último carácter del código de lote: B12015-392209-[T].
// Producción maneja turnos del 1 al 5. Cambiarlo afecta los lotes nuevos.
//
// cajas_por_tarima lo calcula el backend: 42 en la familia CPL0813, 48 en
// el resto. total_producciones dice si admite borrado físico (solo si es 0).
// Los dos pueden llegar como texto desde PostgreSQL.
// ============================================================================

export interface Sku {
    id_sku: number;
    codigo_sku: string;
    calidad: string;
    turno: number;
    estado: number;                     // 1 activo · 0 descontinuado
    cajas_por_tarima?: number | string;
    total_producciones?: number | string;
}

export interface SkuForm {
    codigo_sku: string;
    calidad: string;
    turno: number;
}

/** Turnos válidos. Mismo rango que el CHECK de la BD y el backend. */
export const TURNOS = [1, 2, 3, 4, 5] as const;

/** Misma regla que el backend: CPL0813 lleva 42 cajas por tarima. */
export const cajasPorTarima = (codigo: string) =>
    codigo.trim().toUpperCase().replace(/\s+/g, "").startsWith("CPL0813") ? 42 : 48;

export const CALIDADES_BASE = ["PRIMERA", "SEGUNDA", "TERCERA"];
