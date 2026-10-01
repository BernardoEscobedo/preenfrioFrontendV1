import { useCallback, useEffect, useMemo, useState } from "react";
import {
    KeyRound,
    MapPin,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Trash2,
    UserCheck,
    UserX,
    Users as IconoUsuarios
} from "lucide-react";
import EncabezadoPagina from "../components/layout/EncabezadoPagina";
import UsuarioFormulario from "../components/usuarios/UsuarioFormulario";
import ModalPassword from "../components/usuarios/ModalPassword";
import ModalZonaTrabajo from "../components/usuarios/ModalZonaTrabajo";
import ModalMotivo from "../components/ui/ModalMotivo";
import ModalConfirmar from "../components/ui/ModalConfirmar";
import Avisos from "../components/ui/Avisos";
import { useAvisos } from "../hooks/useAvisos";
import { useAuth } from "../context/AuthContext";
import { NOMBRE_ROL } from "../config/permissions";
import { mensajeError } from "../api/axios";
import * as usuariosService from "../services/usuarios.service";
import type { RolCatalogo, UsuarioCuenta } from "../types/usuario";
import "../styles/crud.css";
import "../styles/usuarios.css";

// ============================================================================
// USUARIOS · solo ADMIN
// ============================================================================
//   Alta, edición, zona de trabajo, contraseña     ✔
//   Deshabilitar (motivo obligatorio)              queda en el historial
//   Habilitar   (motivo opcional)                  queda en el historial
//   Eliminar                                        solo cuentas sin registros
//
// Protecciones que también aplica el backend:
//   · No puedes deshabilitarte ni eliminarte a ti mismo.
//   · No se puede quedar el sistema sin ningún administrador activo.
//   · No se habilita la cuenta de un empleado dado de baja.
// ============================================================================

type FiltroEstado = "activas" | "deshabilitadas" | "todas";

type Modal =
    | { tipo: "formulario"; cuenta: UsuarioCuenta | null }
    | { tipo: "password"; cuenta: UsuarioCuenta }
    | { tipo: "zona"; cuenta: UsuarioCuenta }
    | { tipo: "deshabilitar"; cuenta: UsuarioCuenta }
    | { tipo: "habilitar"; cuenta: UsuarioCuenta }
    | { tipo: "eliminar"; cuenta: UsuarioCuenta }
    | null;

const normalizar = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const iniciales = (u: UsuarioCuenta) =>
    `${u.nombre_empleado.trim()[0] ?? ""}${u.apellidos_empleado.trim()[0] ?? ""}`.toUpperCase() ||
    u.usuario.slice(0, 2).toUpperCase();

/** Supervisor u operativo activo sin cámaras: no ve ningún dato */
const sinZona = (u: UsuarioCuenta) =>
    Number(u.estado) === 1 && !u.alcance_total && Number(u.camaras_asignadas) === 0;

export default function Usuarios() {
    const { usuario: sesion, refrescarPerfil } = useAuth();
    const { avisos, mostrar, quitar } = useAvisos();

    const [cuentas, setCuentas] = useState<UsuarioCuenta[]>([]);
    const [roles, setRoles] = useState<RolCatalogo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<FiltroEstado>("activas");
    const [filtroRol, setFiltroRol] = useState(0);

    const [modal, setModal] = useState<Modal>(null);
    const cerrarModal = () => setModal(null);

    // ---- Carga ----
    const cargar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const [lista, catalogo] = await Promise.all([
                usuariosService.getUsuarios(),
                usuariosService.getRoles()
            ]);
            setCuentas(lista);
            setRoles(catalogo);
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
            activas: cuentas.filter((u) => Number(u.estado) === 1).length,
            deshabilitadas: cuentas.filter((u) => Number(u.estado) === 0).length,
            todas: cuentas.length,
            sinZona: cuentas.filter(sinZona).length,
            admins: cuentas.filter((u) => Number(u.estado) === 1 && u.id_role === 1).length
        }),
        [cuentas]
    );

    const visibles = useMemo(() => {
        const texto = normalizar(busqueda.trim());

        return cuentas.filter((u) => {
            if (filtro === "activas" && Number(u.estado) !== 1) return false;
            if (filtro === "deshabilitadas" && Number(u.estado) !== 0) return false;
            if (filtroRol && u.id_role !== filtroRol) return false;
            if (!texto) return true;

            return normalizar(
                [u.usuario, u.nombre_empleado, u.apellidos_empleado, u.rol, u.zona].join(" ")
            ).includes(texto);
        });
    }, [cuentas, busqueda, filtro, filtroRol]);

    const esUnoMismo = (u: UsuarioCuenta) => u.id_usuario === sesion?.id_usuario;

    // ---- Después de cada acción ----
    const terminar = (mensaje: string, extra: (string | null | undefined)[] = [], cuenta?: UsuarioCuenta) => {
        cerrarModal();
        mostrar("exito", mensaje);
        extra.filter((a): a is string => Boolean(a)).forEach((a) => mostrar("info", a));
        cargar();

        // Si se editó la propia cuenta, el menú y el saludo se actualizan
        if (cuenta && esUnoMismo(cuenta)) refrescarPerfil().catch(() => undefined);
    };

    const confirmarDeshabilitar = async (motivo: string) => {
        if (modal?.tipo !== "deshabilitar") return;
        const r = await usuariosService.deshabilitar(modal.cuenta.id_usuario, motivo);
        terminar(r.mensaje);
    };

    const confirmarHabilitar = async (motivo: string) => {
        if (modal?.tipo !== "habilitar") return;
        const r = await usuariosService.habilitar(modal.cuenta.id_usuario, motivo);
        terminar(r.mensaje, [r.aviso]);
    };

    const confirmarEliminar = async () => {
        if (modal?.tipo !== "eliminar") return;
        const r = await usuariosService.eliminarUsuario(modal.cuenta.id_usuario);
        terminar(r.mensaje);
    };

    // ---- Vista ----
    return (
        <div className="crud">
            <EncabezadoPagina titulo="Usuarios" subtitulo="Cuentas de acceso, roles y zonas de trabajo">
                <button
                    type="button"
                    className="boton-encabezado boton-encabezado--primario"
                    onClick={() => setModal({ tipo: "formulario", cuenta: null })}
                >
                    <Plus size={18} />
                    <span>Nuevo usuario</span>
                </button>
            </EncabezadoPagina>

            {/* Resumen */}
            <section className="crud__resumen crud__resumen--cuatro">
                <div className="mini-kpi">
                    <IconoUsuarios size={22} />
                    <div>
                        <strong>{conteo.activas}</strong>
                        <span>Cuentas habilitadas</span>
                    </div>
                </div>
                <div className="mini-kpi mini-kpi--gris">
                    <UserX size={22} />
                    <div>
                        <strong>{conteo.deshabilitadas}</strong>
                        <span>Deshabilitadas</span>
                    </div>
                </div>
                <div className={`mini-kpi ${conteo.sinZona > 0 ? "mini-kpi--ambar" : ""}`}>
                    <MapPin size={22} />
                    <div>
                        <strong>{conteo.sinZona}</strong>
                        <span>Sin zona de trabajo</span>
                    </div>
                </div>
                <div className={`mini-kpi ${conteo.admins <= 1 ? "mini-kpi--ambar" : ""}`}>
                    <ShieldCheck size={22} />
                    <div>
                        <strong>{conteo.admins}</strong>
                        <span>{conteo.admins === 1 ? "Administrador activo" : "Administradores activos"}</span>
                    </div>
                </div>
            </section>

            {conteo.sinZona > 0 && (
                <div className="alerta alerta--aviso">
                    {conteo.sinZona} supervisor(es) u operativo(s) no tienen cámaras asignadas y no ven ningún
                    dato. Usa el botón <MapPin size={14} className="icono-en-linea" /> para asignarles su zona.
                </div>
            )}

            <section className="panel">
                {/* Barra de herramientas */}
                <div className="crud__barra">
                    <label className="buscador">
                        <Search size={18} />
                        <input
                            type="search"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por usuario, nombre, rol o zona…"
                        />
                    </label>

                    <select
                        className="selector"
                        value={filtroRol}
                        onChange={(e) => setFiltroRol(Number(e.target.value))}
                        aria-label="Filtrar por rol"
                    >
                        <option value={0}>Todos los roles</option>
                        {roles.map((r) => (
                            <option key={r.id_role} value={r.id_role}>
                                {NOMBRE_ROL[r.id_role] ?? r.tipo}
                            </option>
                        ))}
                    </select>

                    <div className="segmentado" role="tablist">
                        {(
                            [
                                ["activas", "Habilitadas"],
                                ["deshabilitadas", "Deshabilitadas"],
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

                {/* Tabla */}
                {cargando && cuentas.length === 0 ? (
                    <div className="crud__vacio">
                        <div className="spinner" />
                        <p>Cargando usuarios…</p>
                    </div>
                ) : visibles.length === 0 && !error ? (
                    <div className="crud__vacio">
                        <IconoUsuarios size={40} />
                        <p>
                            {busqueda || filtroRol
                                ? "Ninguna cuenta coincide con los filtros."
                                : filtro === "deshabilitadas"
                                    ? "No hay cuentas deshabilitadas."
                                    : "Todavía no hay cuentas registradas."}
                        </p>
                    </div>
                ) : (
                    <div className="tabla-contenedor">
                        <table className="tabla tabla--crud">
                            <thead>
                                <tr>
                                    <th>Cuenta</th>
                                    <th>Rol</th>
                                    <th>Zona de trabajo</th>
                                    <th>Estado</th>
                                    <th className="acciones">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibles.map((u) => {
                                    const activa = Number(u.estado) === 1;
                                    const empleadoDeBaja = Number(u.empleado_estado) === 0;
                                    const yo = esUnoMismo(u);
                                    const camaras = Number(u.camaras_asignadas);

                                    return (
                                        <tr key={u.id_usuario} className={activa ? "" : "fila--baja"}>
                                            <td data-etiqueta="Cuenta">
                                                <div className="persona">
                                                    <span className={`persona__avatar persona__avatar--rol-${u.id_role}`}>
                                                        {iniciales(u)}
                                                    </span>
                                                    <div>
                                                        <strong>
                                                            {u.usuario}
                                                            {yo && <span className="chip chip--verde chip--mini">Tú</span>}
                                                        </strong>
                                                        <small>
                                                            {u.nombre_empleado} {u.apellidos_empleado}
                                                        </small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td data-etiqueta="Rol">
                                                <span className={`chip chip--rol-${u.id_role}`}>
                                                    {NOMBRE_ROL[u.id_role] ?? u.rol}
                                                </span>
                                            </td>
                                            <td data-etiqueta="Zona de trabajo">
                                                {u.alcance_total ? (
                                                    <span className="texto-suave">Todas las cámaras</span>
                                                ) : camaras > 0 ? (
                                                    <span>{camaras} cámara(s)</span>
                                                ) : (
                                                    <span className={`chip ${activa ? "chip--ambar" : "chip--gris"}`}>
                                                        Sin cámaras
                                                    </span>
                                                )}
                                            </td>
                                            <td data-etiqueta="Estado">
                                                <div className="estados">
                                                    <span className={`chip ${activa ? "chip--verde" : "chip--rojo"}`}>
                                                        {activa ? "Habilitada" : "Deshabilitada"}
                                                    </span>
                                                    {empleadoDeBaja && (
                                                        <span className="chip chip--gris">Empleado de baja</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="acciones">
                                                <button
                                                    type="button"
                                                    className="boton-icono"
                                                    onClick={() => setModal({ tipo: "formulario", cuenta: u })}
                                                    title="Editar"
                                                    aria-label={`Editar ${u.usuario}`}
                                                >
                                                    <Pencil size={18} />
                                                </button>

                                                {!u.alcance_total && (
                                                    <button
                                                        type="button"
                                                        className="boton-icono"
                                                        onClick={() => setModal({ tipo: "zona", cuenta: u })}
                                                        title="Zona de trabajo"
                                                        aria-label={`Zona de trabajo de ${u.usuario}`}
                                                    >
                                                        <MapPin size={18} />
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    className="boton-icono"
                                                    onClick={() => setModal({ tipo: "password", cuenta: u })}
                                                    title="Restablecer contraseña"
                                                    aria-label={`Restablecer contraseña de ${u.usuario}`}
                                                >
                                                    <KeyRound size={18} />
                                                </button>

                                                {activa ? (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--peligro"
                                                        onClick={() => setModal({ tipo: "deshabilitar", cuenta: u })}
                                                        disabled={yo}
                                                        title={yo ? "No puedes deshabilitar tu propia cuenta" : "Deshabilitar"}
                                                        aria-label={`Deshabilitar ${u.usuario}`}
                                                    >
                                                        <UserX size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="boton-icono boton-icono--exito"
                                                        onClick={() => setModal({ tipo: "habilitar", cuenta: u })}
                                                        disabled={empleadoDeBaja}
                                                        title={
                                                            empleadoDeBaja
                                                                ? "El empleado está dado de baja: reactívalo primero"
                                                                : "Habilitar"
                                                        }
                                                        aria-label={`Habilitar ${u.usuario}`}
                                                    >
                                                        <UserCheck size={18} />
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    className="boton-icono boton-icono--peligro"
                                                    onClick={() => setModal({ tipo: "eliminar", cuenta: u })}
                                                    disabled={yo}
                                                    title={yo ? "No puedes eliminar tu propia cuenta" : "Eliminar"}
                                                    aria-label={`Eliminar ${u.usuario}`}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
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
                        Mostrando {visibles.length} de {cuentas.length} cuenta(s)
                    </p>
                )}
            </section>

            {/* ---- Modales ---- */}
            {modal?.tipo === "formulario" && (
                <UsuarioFormulario
                    cuenta={modal.cuenta}
                    roles={roles}
                    esUnoMismo={modal.cuenta ? esUnoMismo(modal.cuenta) : false}
                    onGuardado={(mensaje, extra) => terminar(mensaje, extra, modal.cuenta ?? undefined)}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "password" && (
                <ModalPassword cuenta={modal.cuenta} onGuardado={(m) => terminar(m)} onCerrar={cerrarModal} />
            )}

            {modal?.tipo === "zona" && (
                <ModalZonaTrabajo
                    cuenta={modal.cuenta}
                    onGuardado={(mensaje, extra) => terminar(mensaje, extra)}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "deshabilitar" && (
                <ModalMotivo
                    titulo={`Deshabilitar la cuenta ${modal.cuenta.usuario}`}
                    obligatorio
                    tono="peligro"
                    etiquetaConfirmar="Deshabilitar"
                    descripcion={
                        <>
                            <p>
                                <strong>
                                    {modal.cuenta.nombre_empleado} {modal.cuenta.apellidos_empleado}
                                </strong>{" "}
                                perderá el acceso en su siguiente acción, aunque tenga la sesión abierta.
                            </p>
                            <p>Todo lo que registró con esta cuenta se conserva.</p>
                        </>
                    }
                    onConfirmar={confirmarDeshabilitar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "habilitar" && (
                <ModalMotivo
                    titulo={`Habilitar la cuenta ${modal.cuenta.usuario}`}
                    obligatorio={false}
                    tono="primario"
                    etiquetaConfirmar="Habilitar"
                    descripcion={
                        <p>
                            <strong>
                                {modal.cuenta.nombre_empleado} {modal.cuenta.apellidos_empleado}
                            </strong>{" "}
                            podrá volver a iniciar sesión con su contraseña actual.
                        </p>
                    }
                    onConfirmar={confirmarHabilitar}
                    onCerrar={cerrarModal}
                />
            )}

            {modal?.tipo === "eliminar" && (
                <ModalConfirmar
                    titulo={`Eliminar la cuenta ${modal.cuenta.usuario}`}
                    etiquetaConfirmar="Eliminar definitivamente"
                    descripcion={
                        <>
                            <p>
                                Solo se puede eliminar una cuenta que <strong>nunca registró nada</strong> (por
                                ejemplo, creada por error).
                            </p>
                            <p className="modal__advertencia">
                                Si la cuenta ya tiene recepciones, movimientos o evidencias, el sistema no la
                                eliminará: en ese caso, deshabilítala.
                            </p>
                        </>
                    }
                    onConfirmar={confirmarEliminar}
                    onCerrar={cerrarModal}
                />
            )}

            <Avisos avisos={avisos} onCerrar={quitar} />
        </div>
    );
}
