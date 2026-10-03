// ============================================================================
// TIPOS · CLIENTES / CEDIS
// ============================================================================
// Cada fila es un DESTINO: un cliente en un CEDIS concreto
// (ej. WALMART · CEDIS GUADALAJARA).
//
// El ACRÓNIMO es la llave que cruza con el Excel de planeación semanal: es
// único en la BD y cambiarlo rompe el enlace con las hojas que ya circulan.
//
// Los conteos (producciones, despachos) pueden no venir del backend o
// llegar como texto: siempre se pasan por Number() con respaldo.
// ============================================================================

export interface Cedis {
    id_cc: number;
    cliente: string;
    cedis: string;
    acronimo: string;
    estado: number;                     // 1 activo · 0 dado de baja
    total_producciones?: number | string;
    total_despachos?: number | string;
}

export interface CedisForm {
    cliente: string;
    cedis: string;
    acronimo: string;
}
