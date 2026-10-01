import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, Layers, Snowflake, Wrench } from "lucide-react";
import { num } from "../../types/dashboard";
import type { CamaraTablero, MantenimientoActivo } from "../../types/dashboard";

// ============================================================================
// TARJETA DE CÁMARA
// ============================================================================
// Semáforo por ocupación:
//   verde   < 70 %
//   ámbar   70 – 89 %
//   rojo    ≥ 90 %
//   gris    en mantenimiento (no recibe fruta aunque esté vacía)
// ============================================================================

export type EstadoCamara = "normal" | "alta" | "saturada" | "mantenimiento";

export const estadoCamara = (c: CamaraTablero): EstadoCamara => {
    if (c.en_mantenimiento) return "mantenimiento";
    const pct = num(c.porcentaje_ocupacion);
    if (pct >= 90) return "saturada";
    if (pct >= 70) return "alta";
    return "normal";
};

interface Props {
    camara: CamaraTablero;
    mantenimiento?: MantenimientoActivo;
}

export default function CamaraCard({ camara, mantenimiento }: Props) {
    const estado = estadoCamara(camara);
    const pct = Math.round(num(camara.porcentaje_ocupacion));
    const enCola = num(camara.procesos_en_espera);
    const tarimasCola = num(camara.tarimas_en_espera);
    const criticas = num(camara.procesos_criticos_en_cola);
    const Icono = estado === "mantenimiento" ? Wrench : Snowflake;

    return (
        <Link to={`/cola?camara=${camara.id_camara}`} className={`camara camara--${estado}`}>
            <div className="camara__cabeza">
                <span className="camara__icono">
                    <Icono size={22} />
                </span>
                <div className="camara__nombre">
                    <strong>{camara.nombre_camara}</strong>
                    <small>{camara.tipo_camara === 1 ? "Preenfrío" : "Conservación"} · {camara.ubicacion}</small>
                </div>
                <ChevronRight size={18} className="camara__flecha" />
            </div>

            {estado === "mantenimiento" ? (
                <div className="camara__mantenimiento">
                    <strong>En mantenimiento</strong>
                    {mantenimiento && (
                        <>
                            <span>{mantenimiento.motivo}</span>
                            <small>
                                Lleva {Math.round(num(mantenimiento.horas_paro))} h parada
                            </small>
                        </>
                    )}
                    <small>{num(camara.tarimas_ocupadas)} tarima(s) dentro</small>
                </div>
            ) : (
                <>
                    <div className="camara__porcentaje">
                        <strong>{pct}%</strong>
                        <span>
                            {num(camara.tarimas_ocupadas)} / {num(camara.capacidad_max_tarimas)} tarimas
                        </span>
                    </div>

                    <span className="barra barra--grande">
                        <span className="barra__relleno" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </span>

                    <ul className="camara__datos">
                        <li>
                            <Layers size={16} />
                            {enCola > 0
                                ? `${enCola} en cola (${tarimasCola} tarimas)`
                                : "Sin cola"}
                        </li>
                        <li className={criticas > 0 ? "camara__dato--alerta" : ""}>
                            <AlertTriangle size={16} />
                            {criticas > 0 ? `${criticas} crítica(s) esperando` : "Sin fruta crítica"}
                        </li>
                        <li>
                            <Snowflake size={16} />
                            {num(camara.tarimas_disponibles_operativas)} espacio(s) libre(s)
                        </li>
                    </ul>
                </>
            )}
        </Link>
    );
}
