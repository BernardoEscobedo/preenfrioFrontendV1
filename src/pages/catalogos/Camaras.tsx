import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Pencil,
    Plus,
    Power,
    PowerOff,
    RefreshCw,
    Search,
    Snowflake,
    Warehouse,
    Wrench
} from "lucide-react";
import EncabezadoPagina from "../../components/layout/EncabezadoPagina";
import CamaraFormulario from "../../components/camaras/CamaraFormulario";
import ModalMotivo from "../../components/ui/ModalMotivo";
import Avisos from "../../components/ui/Avisos";
import { useAvisos } from "../../hooks/useAvisos";
import { useAuth } from "../../context/AuthContext";
import { ROLES, tieneRol } from "../../config/permissions";
import { mensajeError } from "../../api/axios";
import { claveSitio, etiquetaSitio } from "../../utils/sitios";
import * as camarasService from "../../services/camaras.service";
import { TIPO_CAMARA } from "../../types/camara";
import type { Camara, OcupacionCamara } from "../../types/camara";
import "../../styles/crud.css";
import "../../styles/usuarios.css";
import "../../styles/camaras.css";

// ============================================================================
// CATÁLOGO DE CÁMARAS
// ============================================================================
//   Ver, dar de alta y editar      coordinador+
//   Dar de baja y reactivar        solo admin (con motivo, queda en historial)
//
// Las cámaras se muestran agrupadas por preenfrío (Nelly, Fortaleza…), con
// el mismo criterio del dashboard. Cada tarjeta trae la ocupación actual del
// tablero, para que al editar la capacidad se vea cuánto hay dentro.
//
// Una cámara solo se da de baja VACÍA y sin pendientes: el backend lo
// verifica y el modal muestra lo que falte resolver.
// ============================================================================

type FiltroEstado = "operativas" | "baja" | "todas";

type Modal =
    | { tipo: "formulario"; camara: Camara | null }
    | { tipo: "baja"; camara: Camara }
    | { tipo: "reactivar"; camara: Camara }
    | null;

const normalizar = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface Grupo {
    clave: string;
    etiqueta: string;
    camaras: Camara[];
}

export default function Camaras() {
    const { usuario } = useAuth();
    const esAdmin = tieneRol(usuario, ROLES.ADMIN);
    const { avisos, mostrar, quitar } = useAvisos();

    const [camaras, setCamaras] = useState<Camara[]>([]);
    const [ocupacion, setOcupacion] = useState<Map<number, OcupacionCamara>>(new Map());
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("operativas");
    const [filtroTipo, setFiltroTipo] = useState(0);

    const [modal, setModal] = useState<Modal>(null);
    const cerrarModal = () => setModal(null);

    // ---- Carga ----
    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const [lista, ocupacionActual] = await Promise.all([
                camarasService.getCamaras(),
                camarasService.getOcupacion()
            ]);
            setCamaras(lista);
            setOcupacion(ocupacionActual);
        } catch (err) {
            setError(mensajeError(err));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // ---- Derivados ----
    const operativas = camaras.filter((c) => Number(c.estado) === 1);

    const conteo = {
        operativas: operativas.length,
        baja: camaras.length - operativas.length,
        todas: camaras.length,
        preenfrios: operativas.filter((c) => Number(c.tipo_camara) === 1).length,
        conservaciones: operativas.filter((c) => Number(c.tipo_camara) === 2).length,
        capacidad: operativas.reduce((s, c) => s + Number(c.capacidad_max_tarimas), 0)
    };

    const grupos = useMemo<Grupo[]>(() => {
        const texto = normalizar(busqueda.trim());
        const mapa = new Map<string, Camara[]>();

        for (const c of camaras) {
            if (filtro === "operativas" && Number(c.estado) !== 1) continue;
            if (filtro === "baja" && Number(c.estado) !== 0) continue;
            if (filtroTipo && Number(c.tipo_camara) !== filtroTipo) continue;
            if (texto && !normalizar(`${c.nombre_camara} ${c.ubicacion}`).includes(texto)) continue;

            const clave = claveSitio(c.nombre_camara, c.ubicacion);
            mapa.set(clave, [...(mapa.get(clave) ?? []), c]);
        }

        return [...mapa.entries()]
            .map(([clave, lista]) => ({
                clave,
                etiqueta: etiquetaSitio(clave),
                camaras: lista.sort((a, b) => Number(a.tipo_camara) - Number(b.tipo_camara))
            }))
            .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
    }, [camaras, busqueda, filtro, filtroTipo]);

    const visibles = grupos.reduce((s, g) => s + g.camaras.length, 0);

    // ---- Acciones ----
    const terminar = (mensaje: string, extra: string[] = []) => {
        cerrarModal();
        mostrar("exito", mensaje);
        extra.forEach((a) => mostrar("info", a));
        cargar();
    };

    const confirmarBaja = async (motivo: string) => {
        if (modal?.tipo !== "baja") return;
        const r = await camarasService.darDeBaja(modal.camara.id_camara, motivo);
        terminar(r.mensaje, r.avisos ?? []);
    };

    const confirmarReactivar = async (motivo: string) => {
        if (modal?.tipo !== "reactivar") return;
        const r = await camarasService.reactivar(modal.camara.id_camara, motivo);
        terminar(r.mensaje);
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Cámaras" subtitulo="Preenfríos y conservaciones de cada planta">
                <button
                    type="button"
                    className="boton-encabezado boton-encabezado--primario"
                    onClick={() => setModal({ tipo: "formulario", camara: null })}
                >
                    <Plus size={18} />
                    <span>Nueva cámara</span>
                </button>
            </EncabezadoPagina>

            {/* Resumen */}
            <section className="crud__resumen crud__resumen--cuatro">
                <div className="mini-kpi mini-kpi--azul">
                    <Snowflake size={22} />
                    <div>
                        <strong>{conteo.preenfrios}</strong>
                        <span>Preenfríos operativos</span>
                    </div>
                </div>
                <div className="mini-kpi">
                    <Warehouse size={22} />
                    <div>
                        <strong>{conteo.conservaciones}</strong>
                        <span>Conservaciones operativas</span>
                    </div>
                </div>
                <div className="mini-kpi">
                    <Snowflake size={22} />
                    <div>
                        <strong>{conteo.capacidad}</strong>
                        <span>Tarimas de capacidad total</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--gris">
                    <PowerOff size={22} />
                    <div>
                        <strong>{conteo.baja}</strong>
                        <span>Fuera de servicio</span>
                    </div>
                </div>
            </section>

            <section className="panel">
                {/* Barra de herramientas */}
                <div className="crud__barra">
                    <label className="buscador">
                        <Search size={18} />
                        <input
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por nombre o ubicación…"
                        />
                    </label>

                    <select
                        className="selector"
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(Number(e.target.value))}
                        aria-label="Filtrar por tipo"
                    >
                        <option value={0}>Todos los tipos</option>
                        <option value={1}>Preenfrío</option>
                        <option value={2}>Conservación</option>
                    </select>

                    <div className="segmentado" role="tablist">
                        {(
                            [
                                ["operativas", "Operativas"],
                                ["baja", "Fuera de servicio"],
                                ["todas", "Todas"]
                            ] as const
                        ).map(([valor, etiqueta]) => (
                            <button
                                key={valor}
                                type="button"
                                role="tab"
                                aria-selected={filtro === valor}
                                className={filtro === valor ? "activo" : ""}
                                onClick={() => setFiltro(valor)}
                            >
                                {etiqueta} <span>{conteo[valor]}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className="boton-icono boton-icono--borde"
                        onClick={cargar}
                        disabled={cargando}
                        title="Actualizar"
                        aria-label="Actualizar"
                    >
                        <RefreshCw size={18} className={cargando ? "girando" : ""} />
                    </button>
                </div>

                {error && (
                    <div className="alerta alerta--error">
                        {error}{" "}
                        <button type="button" className="enlace" onClick={cargar}>
                            Reintentar
                        </button>
                    </div>
                )}

                {/* Grupos */}
                {cargando && camaras.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando cámaras…</p>
                    </div>
                ) : visibles === 0 && !error ? (
                    <div className="crud__vacio">
                        <Snowflake size={40} />
                        <p>
                            {busqueda || filtroTipo
                                ? "Ninguna cámara coincide con los filtros."
                                : filtro === "baja"
                                    ? "No hay cámaras fuera de servicio."
                                    : "Todavía no hay cámaras registradas."}
                        </p>
                        {!busqueda && !filtroTipo && filtro !== "baja" && (
                            <button
                                type="button"
                                className="boton boton--primario boton--auto"
                                onClick={() => setModal({ tipo: "formulario", camara: null })}
                            >
                                <Plus size={18} /> Registrar la primera
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="sitios">
                        {grupos.map((g) => (
                            <section key={g.clave} className="sitio">
                                <h3 className="sitio__titulo">
                                    {g.etiqueta}
                                    <span>{g.camaras[0]?.ubicacion}</span>
                                </h3>

                                <div className="sitio__camaras">
                                    {g.camaras.map((c) => {
                                        const activa = Number(c.estado) === 1;
                                        const occ = ocupacion.get(c.id_camara);
                                        const capacidad = Number(c.capacidad_max_tarimas);
                                        const ocupadas = occ?.tarimas_ocupadas ?? 0;
                                        const pct = capacidad > 0 ? Math.round((ocupadas / capacidad) * 100) : 0;
                                        const Icono = Number(c.tipo_camara) === 1 ? Snowflake : Warehouse;

                                        return (
                                            <article
                                                key={c.id_camara}
                                                className={`ficha ficha--tipo-${c.tipo_camara} ${activa ? "" : "ficha--baja"}`}
                                            >
                                                <header className="ficha__cabeza">
                                                    <span className="ficha__icono">
                                                        <Icono size={22} />
                                                    </span>
                                                    <div className="ficha__nombre">
                                                        <strong>{c.nombre_camara}</strong>
                                                        <small>{TIPO_CAMARA[Number(c.tipo_camara)]}</small>
                                                    </div>
                                                    <div className="ficha__estado">
                                                        {!activa ? (
                                                            <span className="chip chip--rojo">Fuera de servicio</span>
                                                        ) : occ?.en_mantenimiento ? (
                                                            <span className="chip chip--gris">
                                                                <Wrench size={12} /> Mantenimiento
                                                            </span>
                                                        ) : (
                                                            <span className="chip chip--verde">Operativa</span>
                                                        )}
                                                    </div>
                                                </header>

                                                {occ && (
                                                    <div className="ficha__ocupacion">
                                                        <div>
                                                            <span>Ocupación actual</span>
                                                            <strong>
                                                                {ocupadas} / {capacidad} tarimas
                                                            </strong>
                                                        </div>
                                                        <span className="ficha__barra">
                                                            <span style={{ width: `${Math.min(pct, 100)}%` }} />
                                                        </span>
                                                        {occ.procesos_en_espera > 0 && (
                                                            <small>
                                                                {occ.tarimas_en_espera} tarima(s) en cola
                                                            </small>
                                                        )}
                                                    </div>
                                                )}

                                                <dl className="ficha__capacidades">
                                                    <div>
                                                        <dt>Tarimas</dt>
                                                        <dd>{Number(c.capacidad_max_tarimas)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Cajas</dt>
                                                        <dd>
                                                            {Number(c.capacidad_max_cajas) === 0
                                                                ? "Sin control"
                                                                : Number(c.capacidad_max_cajas)}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt>Bloques</dt>
                                                        <dd>{Number(c.capacidad_max_bloques)}</dd>
                                                    </div>
                                                </dl>

                                                <footer className="ficha__acciones">
                                                    <button
                                                        type="button"
                                                        className="boton-icono"
                                                        onClick={() => setModal({ tipo: "formulario", camara: c })}
                                                        title="Editar"
                                                        aria-label={`Editar ${c.nombre_camara}`}
                                                    >
                                                        <Pencil size={18} />
                                                    </button>

                                                    {esAdmin &&
                                                        (activa ? (
                                                            <button
                                                                type="button"
                                                                className="boton-icono boton-icono--peligro"
                                                                onClick={() => setModal({ tipo: "baja", camara: c })}
                                                                title="Dar de baja"
                                                                aria-label={`Dar de baja ${c.nombre_camara}`}
                                                            >
                                                                <PowerOff size={18} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="boton-icono boton-icono--exito"
                                                                onClick={() => setModal({ tipo: "reactivar", camara: c })}
                                                                title="Reactivar"
                                                                aria-label={`Reactivar ${c.nombre_camara}`}
                                                            >
                                                                <Power size={18} />
                                                            </button>
                                                        ))}
                                                </footer>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                )}

                {!cargando && visibles > 0 && (
                    <p className="crud__pie">
                        Mostrando {visibles} de {camaras.length} cámara(s)
                    </p>
                )}
            </section>

            {/* ---- Modales ---- */}
            {modal?.tipo === "formulario" && (
                <CamaraFormulario
                    camara={modal.camara}
                    existentes={camaras}
                    ocupacion={modal.camara ? ocupacion.get(modal.camara.id_camara) : undefined}
                    onGuardado={(m) => terminar(m)}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "baja" && (
                <ModalMotivo
                    titulo={`Dar de baja ${modal.camara.nombre_camara}`}
                    obligatorio
                    tono="peligro"
                    etiquetaConfirmar="Dar de baja"
                    descripcion={(() => {
                        const occ = ocupacion.get(modal.camara.id_camara);
                        const pendiente =
                            occ && (occ.tarimas_ocupadas > 0 || occ.procesos_en_espera > 0 || occ.en_mantenimiento);
                        return (
                            <>
                                <p>
                                    La cámara quedará <strong>fuera de servicio</strong>: no recibirá fruta y
                                    desaparecerá de las listas. Su histórico se conserva.
                                </p>
                                <p>Solo se puede dar de baja si está vacía, sin cola, sin mantenimiento en proceso y sin producción pendiente de llegar.</p>
                                {pendiente && (
                                    <p className="modal__advertencia">
                                        Ahora mismo tiene {occ.tarimas_ocupadas} tarima(s) dentro
                                        {occ.procesos_en_espera > 0 && `, ${occ.tarimas_en_espera} en cola`}
                                        {occ.en_mantenimiento && " y un mantenimiento en proceso"}. El sistema no la
                                        dará de baja hasta resolverlo.
                                    </p>
                                )}
                            </>
                        );
                    })()}
                    onConfirmar={confirmarBaja}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "reactivar" && (
                <ModalMotivo
                    titulo={`Reactivar ${modal.camara.nombre_camara}`}
                    obligatorio={false}
                    tono="primario"
                    etiquetaConfirmar="Reactivar"
                    descripcion={
                        <p>
                            La cámara vuelve a recibir fruta y los usuarios que la tenían asignada la verán de
                            nuevo, sin reconfigurar su zona de trabajo.
                        </p>
                    }
                    onConfirmar={confirmarReactivar}
                    onCerrar={cerrarModal}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
