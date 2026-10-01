import { useCallback, useEffect, useRef, useState } from "react";
import { cargarDashboard } from "../services/dashboard.service";
import type { DatosDashboard } from "../types/dashboard";

// ============================================================================
// useDashboard · carga y auto-refresco
// ============================================================================
// · Se refresca solo cada 60 s, pero NO si la pestaña está oculta: una
//   tablet con la pantalla apagada no tiene por qué seguir consultando.
// · Al volver a la pestaña se refresca de inmediato.
// · Si se pierde la conexión, se CONSERVAN los últimos datos y se marca
//   sinConexion: la pantalla avisa en vez de mostrar datos viejos como si
//   fueran actuales, y tampoco se queda en blanco.
// ============================================================================

export function useDashboard(intervaloMs = 60_000) {
    const [datos, setDatos] = useState<DatosDashboard | null>(null);
    const [cargando, setCargando] = useState(true);
    const [refrescando, setRefrescando] = useState(false);
    const [actualizado, setActualizado] = useState<Date | null>(null);
    const [fallas, setFallas] = useState<string[]>([]);
    const [sinConexion, setSinConexion] = useState(false);

    // Evita dos cargas encimadas si el usuario aprieta "actualizar" justo
    // cuando entra el refresco automático
    const enCurso = useRef(false);

    const refrescar = useCallback(async () => {
        if (enCurso.current) return;
        enCurso.current = true;
        setRefrescando(true);

        try {
            const r = await cargarDashboard();

            setSinConexion(r.sinConexion);

            if (!r.sinConexion) {
                setDatos(r.datos);
                setFallas(r.fallas);
                setActualizado(new Date());
            }
        } finally {
            enCurso.current = false;
            setRefrescando(false);
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        refrescar();

        const id = window.setInterval(() => {
            if (document.visibilityState === "visible") refrescar();
        }, intervaloMs);

        const alVolver = () => {
            if (document.visibilityState === "visible") refrescar();
        };

        document.addEventListener("visibilitychange", alVolver);

        return () => {
            window.clearInterval(id);
            document.removeEventListener("visibilitychange", alVolver);
        };
    }, [refrescar, intervaloMs]);

    return { datos, cargando, refrescando, actualizado, fallas, sinConexion, refrescar };
}

// ----------------------------------------------------------------------------
// useReloj · la hora del encabezado y el "actualizado hace X"
// ----------------------------------------------------------------------------
export function useReloj(intervaloMs = 15_000) {
    const [ahora, setAhora] = useState(() => new Date());

    useEffect(() => {
        const id = window.setInterval(() => setAhora(new Date()), intervaloMs);
        return () => window.clearInterval(id);
    }, [intervaloMs]);

    return ahora;
}
