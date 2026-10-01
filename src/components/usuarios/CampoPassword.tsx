import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// ============================================================================
// CAMPO DE CONTRASEÑA CON "VER / OCULTAR"
// ============================================================================

interface Props {
    etiqueta: string;
    valor: string;
    onCambiar: (valor: string) => void;
    error?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    autoComplete?: string;
}

export default function CampoPassword({
    etiqueta,
    valor,
    onCambiar,
    error,
    disabled,
    autoFocus,
    autoComplete = "new-password"
}: Props) {
    const [ver, setVer] = useState(false);

    return (
        <label className={`campo ${error ? "campo--error" : ""}`}>
            <span>
                {etiqueta} <em className="campo__requerido">*</em>
            </span>
            <div className="clave">
                <input
                    type={ver ? "text" : "password"}
                    value={valor}
                    onChange={(e) => onCambiar(e.target.value)}
                    maxLength={72}
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    disabled={disabled}
                />
                <button
                    type="button"
                    className="clave__ojo"
                    onClick={() => setVer((v) => !v)}
                    aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
                    tabIndex={-1}
                >
                    {ver ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
            {error && <small className="campo__mensaje">{error}</small>}
        </label>
    );
}

// ----------------------------------------------------------------------------
// Reglas de contraseña
// ----------------------------------------------------------------------------
// Mínimo 6 (lo que exige el backend al restablecer). Máximo 72 porque bcrypt
// ignora lo que pase de 72 bytes: dos contraseñas que solo difieran después
// del caracter 72 serían la misma.
export const MIN_PASSWORD = 6;

export const validarPassword = (password: string, confirmacion: string) => {
    const errores: { password?: string; confirmacion?: string } = {};

    if (!password) errores.password = "Escribe la contraseña";
    else if (password.length < MIN_PASSWORD) errores.password = `Mínimo ${MIN_PASSWORD} caracteres`;

    if (!confirmacion) errores.confirmacion = "Vuelve a escribir la contraseña";
    else if (password !== confirmacion) errores.confirmacion = "Las contraseñas no coinciden";

    return errores;
};
