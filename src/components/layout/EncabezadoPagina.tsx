import type { ReactNode } from "react";

// ============================================================================
// ENCABEZADO DE PÁGINA
// ============================================================================
// Franja con /HEADER_DASHBOARD.jpg y velo verde (ver layout.css).
// La usan todas las páginas para que el sistema se vea uniforme:
//   · izquierda: título y subtítulo
//   · derecha: acciones (botones, selectores, estado)
// ============================================================================

interface Props {
    titulo: ReactNode;
    subtitulo?: ReactNode;
    children?: ReactNode;
}

export default function EncabezadoPagina({ titulo, subtitulo, children }: Props) {
    return (
        <header className="encabezado">
            <div className="encabezado__texto">
                <h1>{titulo}</h1>
                {subtitulo && <p>{subtitulo}</p>}
            </div>

            {children && <div className="encabezado__acciones">{children}</div>}
        </header>
    );
}
