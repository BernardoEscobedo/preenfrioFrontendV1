import type { AxiosError, AxiosResponse } from "axios";
import api from "../api/axios";
import type {
    Criticas,
    DatosDashboard,
    DespachoResumen,
    MantenimientoActivo,
    PulpeosPendientes,
    RecepcionEsperada,
    Tablero
} from "../types/dashboard";

// ============================================================================
// DATOS DEL DASHBOARD
// ============================================================================
// Seis endpoints que ya existen, pedidos EN PARALELO con Promise.allSettled.
//
// Por qué allSettled y no all: si uno falla (por ejemplo, pulpeos), el resto
// del tablero se sigue mostrando y solo ese bloque avisa. Con Promise.all,
// una sola falla dejaría la pantalla en blanco.
//
// Todos aplican el alcance por cámara en el backend: un supervisor solo
// recibe lo de sus cámaras sin que el frontend tenga que filtrar.
// ============================================================================

export interface ResultadoDashboard {
    datos: DatosDashboard;
    fallas: string[];       // bloques que no se pudieron cargar
    sinConexion: boolean;   // no respondió nada: probablemente no hay red
}

const NOMBRES = ["cámaras", "fruta crítica", "recepciones", "pulpeos", "mantenimientos", "despachos"];

export const cargarDashboard = async (): Promise<ResultadoDashboard> => {
    const resultados = await Promise.allSettled([
        api.get<Tablero>("/ocupaciones/tablero", { params: { solo_operativas: 1 } }),
        api.get<Criticas>("/ocupaciones/criticas"),
        api.get<RecepcionEsperada[]>("/recepciones/esperadas"),
        api.get<PulpeosPendientes>("/pulpeos/pendientes"),
        api.get<{ mantenimientos: MantenimientoActivo[] }>("/mantenimientos/activos"),
        api.get<DespachoResumen[]>("/despachos", { params: { estado: 1 } })
    ]);

    const fallas = resultados
        .map((r, i) => (r.status === "rejected" ? NOMBRES[i] : null))
        .filter((n): n is string => n !== null);

    // Sin respuesta de NINGÚN endpoint = no hay conexión con el servidor
    const sinConexion = resultados.every(
        (r) => r.status === "rejected" && !(r.reason as AxiosError).response
    );

    const ok = <T,>(r: PromiseSettledResult<AxiosResponse<T>>): T | null =>
        r.status === "fulfilled" ? r.value.data : null;

    const [tablero, criticas, esperadas, pulpeos, mantenimientos, despachos] = resultados;

    const c = ok(criticas);

    return {
        datos: {
            camaras: ok(tablero)?.camaras ?? [],
            // Las tres listas en un solo arreglo, de lo más grave a lo menos
            criticas: c ? [...c.cita_vencida, ...c.sale_hoy, ...c.fruta_vieja] : [],
            esperadas: ok(esperadas) ?? [],
            pulpeos: ok(pulpeos),
            mantenimientos: ok(mantenimientos)?.mantenimientos ?? [],
            despachos: ok(despachos) ?? []
        },
        fallas,
        sinConexion
    };
};
