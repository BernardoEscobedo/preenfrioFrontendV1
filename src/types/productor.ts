// ============================================================================
// TIPOS · PRODUCTORES
// ============================================================================
// codigo_productor aporta 2 de los 15 dígitos del código de lote
// (se toman los 2 últimos caracteres). Por eso cambiarlo afecta los lotes
// que se generen después.
//
// Los conteos (fincas, producciones) pueden llegar como texto desde
// PostgreSQL o no venir: siempre se pasan por Number() con respaldo.
// ============================================================================

export interface Productor {
    id_productor: number;
    codigo_productor: string;
    nombre: string;
    estado: number;                     // 1 activo · 0 dado de baja
    total_fincas?: number | string;
    total_producciones?: number | string;
}

export interface ProductorForm {
    codigo_productor: string;
    nombre: string;
}
