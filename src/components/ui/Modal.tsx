import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

// ============================================================================
// MODAL GENÉRICO
// ============================================================================
// Se cierra con Esc, con la X o tocando fuera; salvo mientras "bloqueado"
// (guardando), para que no se pierda una petición a medias.
// Mientras está abierto, la página de fondo no hace scroll.
// ============================================================================

interface Props {
    titulo: ReactNode;
    subtitulo?: ReactNode;
    onCerrar: () => void;
    bloqueado?: boolean;
    pie?: ReactNode;
    ancho?: "chico" | "mediano";
    children: ReactNode;
}

export default function Modal({
    titulo,
    subtitulo,
    onCerrar,
    bloqueado = false,
    pie,
    ancho = "mediano",
    children
}: Props) {
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !bloqueado) onCerrar();
        };

        document.addEventListener("keydown", alTeclear);
        const anterior = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", alTeclear);
            document.body.style.overflow = anterior;
        };
    }, [onCerrar, bloqueado]);

    return (
        <div
            className="modal-fondo"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !bloqueado) onCerrar();
            }}
        >
            <div className={`modal modal--${ancho}`} role="dialog" aria-modal="true">
                <div className="modal__cabeza">
                    <div>
                        <h2>{titulo}</h2>
                        {subtitulo && <p>{subtitulo}</p>}
                    </div>
                    <button
                        type="button"
                        className="boton-icono"
                        onClick={onCerrar}
                        disabled={bloqueado}
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="modal__cuerpo">{children}</div>

                {pie && <div className="modal__pie">{pie}</div>}
            </div>
        </div>
    );
}
