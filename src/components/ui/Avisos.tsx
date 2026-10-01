import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { Aviso } from "../../hooks/useAvisos";

// ============================================================================
// PILA DE AVISOS FLOTANTES
// ============================================================================

const ICONOS = {
    exito: CheckCircle2,
    error: XCircle,
    info: Info
} as const;

interface Props {
    avisos: Aviso[];
    onCerrar: (id: number) => void;
}

export default function Avisos({ avisos, onCerrar }: Props) {
    if (avisos.length === 0) return null;

    return (
        <div className="avisos" role="status" aria-live="polite">
            {avisos.map((a) => {
                const Icono = ICONOS[a.tipo];
                return (
                    <div key={a.id} className={`aviso aviso--${a.tipo}`}>
                        <Icono size={20} />
                        <span>{a.texto}</span>
                        <button type="button" onClick={() => onCerrar(a.id)} aria-label="Cerrar aviso">
                            <X size={16} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
