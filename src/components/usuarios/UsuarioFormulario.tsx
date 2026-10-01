import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import CampoPassword, { validarPassword } from "./CampoPassword";
import { mensajeError } from "../../api/axios";
import { NOMBRE_ROL } from "../../config/permissions";
import * as usuariosService from "../../services/usuarios.service";
import type { EmpleadoLibre, RolCatalogo, UsuarioCuenta } from "../../types/usuario";

// ============================================================================
// FORMULARIO DE USUARIO (alta y edición)
// ============================================================================
// cuenta = null → alta: usuario, contraseña, empleado y rol.
// cuenta con datos → edición: usuario, empleado y rol. La contraseña tiene
// su propio modal (restablecer) y el estado su propio flujo con motivo.
//
// El empleado solo se elige entre los ACTIVOS que todavía no tienen cuenta
// (GET /empleados/sinusuario). Al editar se agrega el empleado actual para
// que aparezca seleccionado.
// ============================================================================

export const DESCRIPCION_ROL: Record<number, string> = {
    1: "Acceso total: catálogos, usuarios, bajas e historial.",
    2: "Ve todas las cámaras. Administra catálogos, planeación y despachos.",
    3: "Solo sus cámaras. Recibe, traslada, pulpea y cierra despachos.",
    4: "Solo sus cámaras. Captura recepciones, picking y pulpeos."
};

const PATRON_USUARIO = /^[a-z0-9._-]+$/;

interface Errores {
    usuario?: string;
    password?: string;
    confirmacion?: string;
    id_empleado?: string;
    id_role?: string;
}

interface Props {
    cuenta: UsuarioCuenta | null;
    roles: RolCatalogo[];
    esUnoMismo: boolean;
    onGuardado: (mensaje: string, avisos: string[]) => void;
    onCerrar: () => void;
}

export default function UsuarioFormulario({ cuenta, roles, esUnoMismo, onGuardado, onCerrar }: Props) {
    const esEdicion = cuenta !== null;

    const [usuario, setUsuario] = useState(cuenta?.usuario ?? "");
    const [password, setPassword] = useState("");
    const [confirmacion, setConfirmacion] = useState("");
    const [idEmpleado, setIdEmpleado] = useState(cuenta ? String(cuenta.id_empleado) : "");
    const [idRole, setIdRole] = useState(cuenta ? String(cuenta.id_role) : "");

    const [empleados, setEmpleados] = useState<EmpleadoLibre[]>([]);
    const [cargandoEmpleados, setCargandoEmpleados] = useState(true);

    const [errores, setErrores] = useState<Errores>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    // ---- Empleados disponibles ----
    useEffect(() => {
        usuariosService
            .getEmpleadosSinUsuario()
            .then(setEmpleados)
            .catch((err) => setErrorGeneral(mensajeError(err)))
            .finally(() => setCargandoEmpleados(false));
    }, []);

    const opcionesEmpleado = useMemo(() => {
        const lista = [...empleados];

        // Al editar, el empleado actual no viene en "sin usuario" porque ya
        // tiene esta cuenta: se agrega para que aparezca seleccionado.
        if (cuenta && !lista.some((e) => e.id_empleado === cuenta.id_empleado)) {
            lista.unshift({
                id_empleado: cuenta.id_empleado,
                nombre: cuenta.nombre_empleado,
                apellidos: cuenta.apellidos_empleado,
                turno: cuenta.turno,
                zona: cuenta.zona
            });
        }

        return lista.sort((a, b) =>
            `${a.nombre} ${a.apellidos}`.localeCompare(`${b.nombre} ${b.apellidos}`, "es")
        );
    }, [empleados, cuenta]);

    // ---- Sugerencia de usuario al elegir empleado (solo en alta) ----
    // Primera letra del nombre + primer apellido: "Bernardo Escobedo" → bescobedo
    const sugerirUsuario = (id: string) => {
        if (esEdicion || usuario.trim()) return;
        const e = empleados.find((x) => String(x.id_empleado) === id);
        if (!e) return;

        const sinAcentos = (t: string) =>
            t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        const inicial = sinAcentos(e.nombre.trim())[0] ?? "";
        const apellido = sinAcentos(e.apellidos.trim().split(/\s+/)[0] ?? "").replace(/[^a-z0-9]/g, "");
        setUsuario(`${inicial}${apellido}`);
    };

    const limpiarError = (campo: keyof Errores) => {
        if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
    };

    // ---- Validación ----
    const validar = (): boolean => {
        const nuevos: Errores = {};
        const u = usuariosService.normalizarUsuario(usuario);

        if (!u) nuevos.usuario = "Escribe el nombre de usuario";
        else if (u.length < 3) nuevos.usuario = "Mínimo 3 caracteres";
        else if (u.length > 60) nuevos.usuario = "Máximo 60 caracteres";
        else if (!PATRON_USUARIO.test(u))
            nuevos.usuario = "Solo letras sin acento, números, punto, guion y guion bajo";

        if (!esEdicion) Object.assign(nuevos, validarPassword(password, confirmacion));

        if (!idEmpleado) nuevos.id_empleado = "Elige el empleado dueño de la cuenta";
        if (!idRole) nuevos.id_role = "Elige el rol";

        setErrores(nuevos);
        return Object.keys(nuevos).length === 0;
    };

    // ---- Guardar ----
    const guardar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorGeneral("");

        if (!validar()) return;

        setEnviando(true);

        try {
            if (esEdicion) {
                const r = await usuariosService.actualizarUsuario(cuenta.id_usuario, {
                    usuario,
                    id_empleado: Number(idEmpleado),
                    id_role: Number(idRole)
                });
                onGuardado("Usuario actualizado correctamente", r.aviso ? [r.aviso] : []);
            } else {
                const r = await usuariosService.crearUsuario({
                    usuario,
                    password,
                    id_empleado: Number(idEmpleado),
                    id_role: Number(idRole)
                });
                onGuardado(`Cuenta "${r.usuario.usuario}" creada correctamente`, r.avisos ?? []);
            }
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    const rolElegido = Number(idRole);
    const pierdeAdmin = esEdicion && esUnoMismo && cuenta.id_role === 1 && idRole !== "" && rolElegido !== 1;

    return (
        <Modal
            titulo={esEdicion ? "Editar usuario" : "Nuevo usuario"}
            subtitulo={
                esEdicion
                    ? `${cuenta.nombre_empleado} ${cuenta.apellidos_empleado}`
                    : "Crea la cuenta con la que el empleado entrará al sistema"
            }
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-usuario" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : esEdicion ? "Guardar cambios" : "Crear cuenta"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-usuario" className="formulario" onSubmit={guardar} noValidate>
                {/* Empleado */}
                <label className={`campo campo--completo ${errores.id_empleado ? "campo--error" : ""}`}>
                    <span>
                        Empleado <em className="campo__requerido">*</em>
                    </span>
                    <select
                        value={idEmpleado}
                        onChange={(e) => {
                            setIdEmpleado(e.target.value);
                            limpiarError("id_empleado");
                            sugerirUsuario(e.target.value);
                        }}
                        disabled={enviando || cargandoEmpleados}
                        autoFocus={!esEdicion}
                    >
                        <option value="">
                            {cargandoEmpleados
                                ? "Cargando empleados…"
                                : opcionesEmpleado.length === 0
                                    ? "No hay empleados activos sin cuenta"
                                    : "Selecciona un empleado"}
                        </option>
                        {opcionesEmpleado.map((e) => (
                            <option key={e.id_empleado} value={e.id_empleado}>
                                {e.nombre} {e.apellidos} · {e.zona}
                            </option>
                        ))}
                    </select>
                    {errores.id_empleado && <small className="campo__mensaje">{errores.id_empleado}</small>}
                    {!cargandoEmpleados && opcionesEmpleado.length === 0 && (
                        <small className="campo__ayuda">
                            Da de alta al empleado en Catálogos → Empleados y vuelve aquí.
                        </small>
                    )}
                </label>

                {/* Usuario */}
                <label className={`campo campo--completo ${errores.usuario ? "campo--error" : ""}`}>
                    <span>
                        Nombre de usuario <em className="campo__requerido">*</em>
                    </span>
                    <input
                        type="text"
                        value={usuario}
                        onChange={(e) => {
                            setUsuario(e.target.value.toLowerCase().replace(/\s+/g, ""));
                            limpiarError("usuario");
                        }}
                        maxLength={60}
                        placeholder="ej. bescobedo"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        autoFocus={esEdicion}
                        disabled={enviando}
                    />
                    {errores.usuario ? (
                        <small className="campo__mensaje">{errores.usuario}</small>
                    ) : (
                        <small className="campo__ayuda">Es con lo que inicia sesión. Se guarda en minúsculas.</small>
                    )}
                </label>

                {/* Contraseña (solo alta) */}
                {!esEdicion && (
                    <>
                        <CampoPassword
                            etiqueta="Contraseña"
                            valor={password}
                            onCambiar={(v) => {
                                setPassword(v);
                                limpiarError("password");
                            }}
                            error={errores.password}
                            disabled={enviando}
                        />
                        <CampoPassword
                            etiqueta="Confirmar contraseña"
                            valor={confirmacion}
                            onCambiar={(v) => {
                                setConfirmacion(v);
                                limpiarError("confirmacion");
                            }}
                            error={errores.confirmacion}
                            disabled={enviando}
                        />
                    </>
                )}

                {/* Rol */}
                <fieldset className={`campo campo--completo roles ${errores.id_role ? "campo--error" : ""}`}>
                    <legend>
                        Rol <em className="campo__requerido">*</em>
                    </legend>
                    <div className="roles__lista">
                        {roles.map((r) => (
                            <label
                                key={r.id_role}
                                className={`rol-opcion ${idRole === String(r.id_role) ? "rol-opcion--activa" : ""}`}
                            >
                                <input
                                    type="radio"
                                    name="rol"
                                    value={r.id_role}
                                    checked={idRole === String(r.id_role)}
                                    onChange={(e) => {
                                        setIdRole(e.target.value);
                                        limpiarError("id_role");
                                    }}
                                    disabled={enviando}
                                />
                                <span className={`rol-opcion__punto rol-opcion__punto--${r.id_role}`} />
                                <span className="rol-opcion__texto">
                                    <strong>{NOMBRE_ROL[r.id_role] ?? r.tipo}</strong>
                                    <small>{DESCRIPCION_ROL[r.id_role] ?? ""}</small>
                                </span>
                            </label>
                        ))}
                    </div>
                    {errores.id_role && <small className="campo__mensaje">{errores.id_role}</small>}
                </fieldset>
            </form>

            {(rolElegido === 3 || rolElegido === 4) && (
                <p className="formulario__nota">
                    Supervisores y operativos solo ven sus cámaras. Después de guardar, asígnale su
                    <strong> zona de trabajo</strong> o no verá ningún dato.
                </p>
            )}

            {pierdeAdmin && (
                <p className="modal__advertencia">
                    Te estás quitando el rol de administrador. Perderás el acceso a este módulo en cuanto guardes.
                </p>
            )}
        </Modal>
    );
}
