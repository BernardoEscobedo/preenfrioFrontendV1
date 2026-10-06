import type { ResultadoInocuidad } from "../../types/despacho";

// ============================================================================
// CHIP DE INOCUIDAD
// ============================================================================
//   null → Pendiente (ámbar) · 1 → Aprobada (verde) · 0 → Rechazada (rojo)
// ============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export const estadoInocuidad = (valor: ResultadoInocuidad | undefined) => {
    if (valor === null || valor === undefined) return { clase: "chip--ambar", texto: "Pendiente", tono: "pendiente" } as const;
    if (Number(valor) === 1) return { clase: "chip--verde", texto: "Aprobada", tono: "aprobada" } as const;
    return { clase: "chip--rojo", texto: "Rechazada", tono: "rechazada" } as const;
};

export default function ChipInocuidad({ valor }: { valor: ResultadoInocuidad | undefined }) {
    const e = estadoInocuidad(valor);
    return <span className={`chip ${e.clase}`}>{e.texto}</span>;
}
