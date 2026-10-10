import type { NivelCriticidad } from "../../types/ocupacion";

// ============================================================================
// CHIP DE CRITICIDAD · 1 crítica · 2 urgente · 3 normal · 4 holgada
// ============================================================================

const CLASES: Record<NivelCriticidad, string> = {
    1: "chip--rojo",
    2: "chip--ambar",
    3: "chip--azul",
    4: "chip--gris"
};

export default function ChipCriticidad({ nivel, texto }: { nivel: NivelCriticidad; texto: string }) {
    return <span className={`chip ${CLASES[nivel] ?? "chip--gris"}`}>{texto}</span>;
}
