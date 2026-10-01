import { useEffect, useMemo, useState } from "react";
import { Snowflake, Warehouse } from "lucide-react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import { claveSitio, etiquetaSitio } from "../../utils/sitios";
import * as usuariosService from "../../services/usuarios.service";
import type { CamaraCatalogo, UsuarioCuenta } from "../../types/usuario";

// ============================================================================
// ZONA DE TRABAJO · qué cámaras ve un supervisor u operativo
// ============================================================================
// Las cámaras se agrupan por preenfrío (Nelly, Fortaleza…), igual que en el
// dashboard. Cada grupo tiene un atajo para marcar su preenfrío y su
// conservación de un solo clic, que es el caso normal.
//
// Al guardar se manda la lista final: el backend cierra (fecha_fin) las que
// se quitaron y abre las nuevas. El histórico de asignaciones se conserva.
//
// Las cámaras dadas de baja no se ofrecen. Si el usuario ya tenía una
// asignada, aparece marcada y avisada, para poder quitársela.
// ============================================================================

interface Grupo {
    clave: string;
    etiqueta: string;
    camaras: CamaraCatalogo[];
}

interface Props {
    cuenta: UsuarioCuenta;
    onGuardado: (mensaje: string, avisos: string[]) => void;
    onCerrar: () => void;
}

export default function ModalZonaTrabajo({ cuenta, onGuardado, onCerrar }: Props) {
    const [camaras, setCamaras] = useState<CamaraCatalogo[]>([]);
    const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
    const [inicial, setInicial] = useState<Set<number>>(new Set());
    const [nota, setNota] = useState<string | null>(null);

    const [cargando, setCargando] = useState(true);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState("");

    // ---- Carga ----
    useEffect(() => {
        Promise.all([usuariosService.getZonaTrabajo(cuenta.id_usuario), usuariosService.getCamaras()])
            .then(([zona, catalogo]) => {
                const vigentes = new Set(zona.camaras.filter((a) => a.vigente).map((a) => a.id_camara));
                setSeleccion(new Set(vigentes));
                setInicial(vigentes);
                setNota(zona.nota);
                // Operativas + las de baja que ya tenía asignadas
                setCamaras(catalogo.filter((c) => Number(c.estado) === 1 || vigentes.has(c.id_camara)));
            })
            .catch((err) => setError(mensajeError(err)))
            .finally(() => setCargando(false));
    }, [cuenta.id_usuario]);

    // ---- Agrupación por preenfrío ----
    const grupos = useMemo<Grupo[]>(() => {
        const mapa = new Map<string, CamaraCatalogo[]>();

        for (const c of camaras) {
            const clave = claveSitio(c.nombre_camara, c.ubicacion);
            mapa.set(clave, [...(mapa.get(clave) ?? []), c]);
        }

        return [...mapa.entries()]
            .map(([clave, lista]) => ({
                clave,
                etiqueta: etiquetaSitio(clave),
                camaras: lista.sort((a, b) => a.tipo_camara - b.tipo_camara)
            }))
            .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
    }, [camaras]);

    const alternar = (id: number) => {
        setSeleccion((s) => {
            const nuevo = new Set(s);
            if (nuevo.has(id)) nuevo.delete(id);
            else nuevo.add(id);
            return nuevo;
        });
    };

    const alternarGrupo = (grupo: Grupo) => {
        const operativas = grupo.camaras.filter((c) => Number(c.estado) === 1).map((c) => c.id_camara);
        const todas = operativas.every((id) => seleccion.has(id));

        setSeleccion((s) => {
            const nuevo = new Set(s);
            operativas.forEach((id) => (todas ? nuevo.delete(id) : nuevo.add(id)));
            return nuevo;
        });
    };

    const huboCambios =
        seleccion.size !== inicial.size || [...seleccion].some((id) => !inicial.has(id));

    // ---- Guardar ----
    const guardar = async () => {
        setError("");
        setEnviando(true);

        try {
            const r = await usuariosService.guardarZonaTrabajo(cuenta.id_usuario, [...seleccion]);
            onGuardado(r.mensaje, r.avisos ?? []);
        } catch (err) {
            setError(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo="Zona de trabajo"
            subtitulo={`${cuenta.usuario} · ${cuenta.nombre_empleado} ${cuenta.apellidos_empleado}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <span className="zona__contador">
                        {seleccion.size} cámara(s) seleccionada(s)
                    </span>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className="boton boton--primario"
                        onClick={guardar}
                        disabled={enviando || cargando || !huboCambios}
                    >
                        {enviando ? <span className="spinner spinner--chico" /> : "Guardar zona"}
                    </button>
                </>
            }
        >
            {nota && <p className="formulario__nota">{nota}</p>}
            {error && <div className="alerta alerta--error">{error}</div>}

            {cargando ? (
                <div className="crud__vacio">
                    <div className="spinner" />
                    <p>Cargando cámaras…</p>
                </div>
            ) : grupos.length === 0 ? (
                <p className="panel__vacio">No hay cámaras operativas registradas.</p>
            ) : (
                <div className="zona">
                    {grupos.map((g) => {
                        const operativas = g.camaras.filter((c) => Number(c.estado) === 1);
                        const completo =
                            operativas.length > 0 && operativas.every((c) => seleccion.has(c.id_camara));

                        return (
                            <section key={g.clave} className="zona__grupo">
                                <div className="zona__cabeza">
                                    <strong>{g.etiqueta}</strong>
                                    {operativas.length > 1 && (
                                        <button
                                            type="button"
                                            className="zona__atajo"
                                            onClick={() => alternarGrupo(g)}
                                            disabled={enviando}
                                        >
                                            {completo ? "Quitar todo" : "Asignar todo"}
                                        </button>
                                    )}
                                </div>

                                <div className="zona__camaras">
                                    {g.camaras.map((c) => {
                                        const deBaja = Number(c.estado) !== 1;
                                        const marcada = seleccion.has(c.id_camara);
                                        const Icono = c.tipo_camara === 1 ? Snowflake : Warehouse;

                                        return (
                                            <label
                                                key={c.id_camara}
                                                className={`zona__camara ${marcada ? "zona__camara--activa" : ""} ${deBaja ? "zona__camara--baja" : ""}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={marcada}
                                                    onChange={() => alternar(c.id_camara)}
                                                    disabled={enviando || (deBaja && !marcada)}
                                                />
                                                <Icono size={18} />
                                                <span>
                                                    <strong>{c.nombre_camara}</strong>
                                                    <small>
                                                        {deBaja
                                                            ? "Dada de baja: no la verá aunque esté asignada"
                                                            : `${c.tipo_camara === 1 ? "Preenfrío" : "Conservación"} · ${c.ubicacion}`}
                                                    </small>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            {!cargando && seleccion.size === 0 && (
                <p className="modal__advertencia">
                    Sin cámaras asignadas, este usuario no verá ningún dato en el sistema.
                </p>
            )}
        </Modal>
    );
}
