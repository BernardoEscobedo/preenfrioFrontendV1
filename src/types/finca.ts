// ============================================================================
// TIPOS · FINCAS
// ============================================================================
// Dos datos de la finca van al código de lote de 15 caracteres:
//
//   B 12 015 - 39 2209 - 1
//   │    └── codigo_finca (3 dígitos, se rellena con ceros a la izquierda)
//   └── zona → letra inicial: 1 = A (Chiapas) · 2 = B (Colima) · 3 = C (Tabasco)
//
// Por eso cambiar zona o código afecta los lotes que se generen después.
// ============================================================================

export interface Finca {
    id_finca: number;
    codigo_finca: string;
    nombre: string;
    org_inv_nombre: string;
    zona: number;
    id_productor: number;
    estado: number;                 // 1 activa · 0 dada de baja
    // Vienen del JOIN con productores (si el backend los manda)
    codigo_productor?: string;
    nombre_productor?: string;
    productor_estado?: number;
}

export interface FincaForm {
    codigo_finca: string;
    nombre: string;
    org_inv_nombre: string;
    zona: number;
    id_productor: number;
}

export const ZONAS: Record<number, { nombre: string; letra: string }> = {
    1: { nombre: "Chiapas", letra: "A" },
    2: { nombre: "Colima", letra: "B" },
    3: { nombre: "Tabasco", letra: "C" }
};
