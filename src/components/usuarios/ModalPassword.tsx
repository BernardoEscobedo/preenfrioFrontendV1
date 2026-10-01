import { useState } from "react";
import type { FormEvent } from "react";
import Modal from "../ui/Modal";
import CampoPassword, { validarPassword } from "./CampoPassword";
import { mensajeError } from "../../api/axios";
import * as usuariosService from "../../services/usuarios.service";
import type { UsuarioCuenta } from "../../types/usuario";

// ============================================================================
// RESTABLECER CONTRASEÑA
// ============================================================================
// Lo usa el admin cuando alguien olvida su contraseña. No pide la anterior.
// La sesión que el usuario tenga abierta sigue activa: si lo que se busca es
// sacarlo del sistema, la vía es deshabilitar la cuenta.
// ============================================================================

interface Props {
    cuenta: UsuarioCuenta;
    onGuardado: (mensaje: string) => void;
    onCerrar: () => void;
}

export default function ModalPassword({ cuenta, onGuardado, onCerrar }: Props) {
    const [password, setPassword] = useState("");
    const [confirmacion, setConfirmacion] = useState("");
    const [errores, setErrores] = useState<{ password?: string; confirmacion?: string }>({});
    const [errorGeneral, setErrorGeneral] = useState("");
    const [enviando, setEnviando] = useState(false);

    const guardar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorGeneral("");

        const nuevos = validarPassword(password, confirmacion);
        setErrores(nuevos);
        if (Object.keys(nuevos).length > 0) return;

        setEnviando(true);

        try {
            const r = await usuariosService.restablecerPassword(cuenta.id_usuario, password);
            onGuardado(r.mensaje);
        } catch (err) {
            setErrorGeneral(mensajeError(err));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo="Restablecer contraseña"
            subtitulo={`Cuenta ${cuenta.usuario} · ${cuenta.nombre_empleado} ${cuenta.apellidos_empleado}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            ancho="chico"
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="submit" form="form-password" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : "Guardar contraseña"}
                    </button>
                </>
            }
        >
            {errorGeneral && <div className="alerta alerta--error">{errorGeneral}</div>}

            <form id="form-password" className="formulario formulario--una" onSubmit={guardar} noValidate>
                <CampoPassword
                    etiqueta="Nueva contraseña"
                    valor={password}
                    onCambiar={(v) => {
                        setPassword(v);
                        setErrores((x) => ({ ...x, password: undefined }));
                    }}
                    error={errores.password}
                    disabled={enviando}
                    autoFocus
                />
                <CampoPassword
                    etiqueta="Confirmar contraseña"
                    valor={confirmacion}
                    onCambiar={(v) => {
                        setConfirmacion(v);
                        setErrores((x) => ({ ...x, confirmacion: undefined }));
                    }}
                    error={errores.confirmacion}
                    disabled={enviando}
                />
            </form>

            <p className="formulario__nota">
                Compártela con el usuario por un medio privado y pídele que la cambie al entrar.
            </p>
        </Modal>
    );
}
