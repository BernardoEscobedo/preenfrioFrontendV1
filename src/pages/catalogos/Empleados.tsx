import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, UserCheck, UserX, Users } from "lucide-react";
import EncabezadoPagina from "../../components/layout/EncabezadoPagina";
import EmpleadoFormulario from "../../components/empleados/EmpleadoFormulario";
import ModalMotivo from "../../components/ui/ModalMotivo";
import Avisos from "../../components/ui/Avisos";
import { useAvisos } from "../../hooks/useAvisos";
import { useAuth } from "../../context/AuthContext";
import { ROLES, tieneRol } from "../../config/permissions";
import { mensajeError } from "../../api/axios";
import * as empleadosService from "../../services/empleados.service";
import type { Empleado } from "../../types/empleado";
import "../../styles/crud.css";

// ============================================================================
// CATÁLOGO DE EMPLEADOS
// ============================================================================
//   Ver, dar de alta y editar      coordinador+
//   Dar de baja y reactivar        solo admin (con motivo, queda en historial)
//
// No hay botón de eliminar: el borrado físico se retiró en la v3.0 porque
// recepciones, movimientos y pulpeos guardan quién los registró.
// ============================================================================

type FiltroEstado = "activos" | "bajas" | "todos";

type AccionEstado = { tipo: "baja" | "reactivar"; empleado: Empleado } | null;

const TURNOS_BASE = ["MATUTINO", "VESPERTINO", "NOCTURNO", "MIXTO"];

/** Sin acentos y en minúsculas: "Peña" encuentra "PENA" y viceversa. */
const normalizar = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const iniciales = (e: Empleado) =>
    `${e.nombre.trim()[0] ?? ""}${e.apellidos.trim()[0] ?? ""}`.toUpperCase();

const valoresUnicos = (lista: string[]) =>
    [...new Set(lista.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

export default function Empleados() {
    const { usuario } = useAuth();
    const esAdmin = tieneRol(usuario, ROLES.ADMIN);
    const { avisos, mostrar, quitar } = useAvisos();

    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("activos");

    // undefined = cerrado · null = alta · Empleado = edición
    const [formulario, setFormulario] = useState<Empleado | null | undefined>(undefined);
    const [accionEstado, setAccionEstado] = useState<AccionEstado>(null);

    // ---- Carga ----
    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            setEmpleados(await empleadosService.getEmpleados());
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
    const conteo = useMemo(
        () => ({
            activos: empleados.filter((e) => Number(e.estado) === 1).length,
            bajas: empleados.filter((e) => Number(e.estado) === 0).length,
            todos: empleados.length,
            sinCuenta: empleados.filter((e) => Number(e.estado) === 1 && !e.tiene_usuario).length
        }),
        [empleados]
    );

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());

        return empleados.filter((e) => {
            if (filtro === "activos" && Number(e.estado) !== 1) return false;
            if (filtro === "bajas" && Number(e.estado) !== 0) return false;
            if (!texto) return true;

            return normalizar(
                [e.nombre, e.apellidos, e.turno, e.zona, e.usuario ?? ""].join(" ")
            ).includes(texto);
        });
    }, [empleados, busqueda, filtro]);

    const turnos = useMemo(
        () => valoresUnicos([...TURNOS_BASE, ...empleados.map((e) => e.turno)]),
        [empleados]
    );
    const zonas = useMemo(() => valoresUnicos(empleados.map((e) => e.zona)), [empleados]);

    // ---- Acciones ----
    const alGuardar = (mensaje: string) => {
        setFormulario(undefined);
        mostrar("exito", mensaje);
        cargar();
    };

    const confirmarEstado = async (motivo: string) => {
        if (!accionEstado) return;

        const { tipo, empleado } = accionEstado;
        const respuesta =
            tipo === "baja"
                ? await empleadosService.darDeBaja(empleado.id_empleado, motivo)
                : await empleadosService.reactivar(empleado.id_empleado, motivo);

        setAccionEstado(null);
        mostrar("exito", respuesta.mensaje);
        if (respuesta.cuenta) mostrar("info", respuesta.cuenta);
        if (respuesta.aviso) mostrar("info", respuesta.aviso);
        cargar();
    };

    const esUnoMismo = (e: Empleado) =>
        e.id_usuario !== null && Number(e.id_usuario) === usuario?.id_usuario;

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Empleados" subtitulo="Personal de la operación de preenfrío">
                <button type="button" className="boton-encabezado boton-encabezado--primario" onClick={() => setFormulario(null)}>
                    <Plus size={18} />
                    <span>Nuevo empleado</span>
                </button>
            </EncabezadoPagina>

            {/* Resumen */}
            <section className="crud__resumen">
                <div className="mini-kpi">
                    <Users size={22} />
                    <div>
                        <strong>{conteo.activos}</strong>
                        <span>Activos</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--gris">
                    <UserX size={22} />
                    <div>
                        <strong>{conteo.bajas}</strong>
                        <span>Dados de baja</span>
                    </div>
                </div>
                <div className={`mini-kpi ${conteo.sinCuenta > 0 ? "mini-kpi--ambar" : ""}`}>
                    <UserCheck size={22} />
                    <div>
                        <strong>{conteo.sinCuenta}</strong>
                        <span>Activos sin cuenta</span>
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
                            placeholder="Buscar por nombre, turno, zona o usuario…"
                        />
                    </label>

                    <div className="segmentado" role="tablist">
                        {(
                            [
                                ["activos", "Activos"],
                                ["bajas", "Bajas"],
                                ["todos", "Todos"]
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

                {/* Tabla */}
                {cargando && empleados.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando empleados…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <Users size={40} />
                        <p>
                            {busqueda
                                ? `Ningún empleado coincide con "${busqueda}".`
                                : filtro === "bajas"
                                    ? "No hay empleados dados de baja."
                                    : "Todavía no hay empleados registrados."}
                        </p>
                        {!busqueda && filtro !== "bajas" && (
                            <button type="button" className="boton boton--primario boton--auto" onClick={() => setFormulario(null)}>
                                <Plus size={18} /> Registrar el primero
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="tabla-contenedor">
                        <table className="tabla tabla--crud">
                            <thead>
                                <tr>
                                    <th>Empleado</th>
                                    <th>Turno</th>
                                    <th>Zona</th>
                                    <th>Cuenta</th>
                                    <th>Estado</th>
                                    <th className="acciones">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((e) => {
                                    const activo = Number(e.estado) === 1;
                                    return (
                                        <tr key={e.id_empleado} className={activo ? "" : "fila--baja"}>
                                            <td data-etiqueta="Empleado">
                                                <div className="persona">
                                                    <span className="persona__avatar">{iniciales(e)}</span>
                                                    <div>
                                                        <strong>{e.nombre}</strong>
                                                        <small>{e.apellidos}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Turno">{e.turno}</td>
                                            <td data-etiqueta="Zona">{e.zona}</td>
                                            <td data-etiqueta="Cuenta">
                                                {e.tiene_usuario ? (
                                                    <span className="chip chip--azul">{e.usuario}</span>
                                                ) : (
                                                    <span className="chip chip--gris">Sin cuenta</span>
                                                )}
                                            </td>
                                            <td data-etiqueta="Estado">
                                                <span className={`chip ${activo ? "chip--verde" : "chip--rojo"}`}>
                                                    {activo ? "Activo" : "Baja"}
                                                </span>
                                            </td>
                                            <td className="acciones">
                                                <button
                                                    type="button"
                                                    className="boton-icono"
                                                    onClick={() => setFormulario(e)}
                                                    title="Editar"
                                                    aria-label={`Editar a ${e.nombre}`}
                                                >
                                                    <Pencil size={18} />
                                                </button>

                                                {esAdmin &&
                                                    (activo ? (
                                                        <button
                                                            type="button"
                                                            className="boton-icono boton-icono--peligro"
                                                            onClick={() => setAccionEstado({ tipo: "baja", empleado: e })}
                                                            disabled={esUnoMismo(e)}
                                                            title={esUnoMismo(e) ? "No puedes darte de baja a ti mismo" : "Dar de baja"}
                                                            aria-label={`Dar de baja a ${e.nombre}`}
                                                        >
                                                            <UserX size={18} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="boton-icono boton-icono--exito"
                                                            onClick={() => setAccionEstado({ tipo: "reactivar", empleado: e })}
                                                            title="Reactivar"
                                                            aria-label={`Reactivar a ${e.nombre}`}
                                                        >
                                                            <UserCheck size={18} />
                                                        </button>
                                                    ))}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {!cargando && visibles.length > 0 && (
                    <p className="crud__pie">
                        Mostrando {visibles.length} de {empleados.length} empleado(s)
                    </p>
                )}
            </section>

            {/* Alta / edición */}
            {formulario !== undefined && (
                <EmpleadoFormulario
                    empleado={formulario}
                    turnos={turnos}
                    zonas={zonas}
                    onGuardado={alGuardar}
                    onCerrar={() => setFormulario(undefined)}
                />
            )}

            {/* Baja / reactivación */}
            {accionEstado && (
                <ModalMotivo
                    titulo={
                        accionEstado.tipo === "baja"
                            ? `Dar de baja a ${accionEstado.empleado.nombre}`
                            : `Reactivar a ${accionEstado.empleado.nombre}`
                    }
                    obligatorio={accionEstado.tipo === "baja"}
                    tono={accionEstado.tipo === "baja" ? "peligro" : "primario"}
                    etiquetaConfirmar={accionEstado.tipo === "baja" ? "Dar de baja" : "Reactivar"}
                    descripcion={
                        accionEstado.tipo === "baja" ? (
                            <>
                                <p>
                                    <strong>
                                        {accionEstado.empleado.nombre} {accionEstado.empleado.apellidos}
                                    </strong>{" "}
                                    dejará de aparecer en las listas. Sus registros anteriores se conservan.
                                </p>
                                {accionEstado.empleado.tiene_usuario && (
                                    <p className="modal__advertencia">
                                        Su cuenta <strong>{accionEstado.empleado.usuario}</strong> se deshabilitará y
                                        perderá el acceso de inmediato, aunque tenga la sesión abierta.
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                <p>
                                    <strong>
                                        {accionEstado.empleado.nombre} {accionEstado.empleado.apellidos}
                                    </strong>{" "}
                                    volverá a aparecer en las listas.
                                </p>
                                {accionEstado.empleado.tiene_usuario && (
                                    <p className="modal__advertencia">
                                        Su cuenta <strong>{accionEstado.empleado.usuario}</strong> NO se reactiva sola:
                                        habilítala desde Usuarios si debe volver a entrar.
                                    </p>
                                )}
                            </>
                        )
                    }
                    onConfirmar={confirmarEstado}
                    onCerrar={() => setAccionEstado(null)}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
