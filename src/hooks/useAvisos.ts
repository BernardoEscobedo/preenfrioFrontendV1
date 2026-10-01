import { useCallback, useState } from "react";

// ============================================================================
// AVISOS FLOTANTES (toasts)
// ============================================================================
// Mensajes cortos en la esquina que se van solos a los 5 segundos.
// Se usa en todos los catálogos para confirmar "Empleado guardado", etc.
// ============================================================================

export type TipoAviso = "exito" | "error" | "info";

export interface Aviso {
    id: number;
    tipo: TipoAviso;
    texto: string;
}

export function useAvisos(duracionMs = 5000) {
    const [avisos, setAvisos] = useState<Aviso[]>([]);

    const quitar = useCallback((id: number) => {
        setAvisos((lista) => lista.filter((a) => a.id !== id));
    }, []);

    const mostrar = useCallback(
        (tipo: TipoAviso, texto: string) => {
            const id = Date.now() + Math.random();
            setAvisos((lista) => [...lista, { id, tipo, texto }]);
            window.setTimeout(() => quitar(id), duracionMs);
        },
        [quitar, duracionMs]
    );

    return { avisos, mostrar, quitar };
}
