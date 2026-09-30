import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { mensajeError } from "../api/axios";
import "../styles/login.css";

// ============================================================================
// LOGIN · pantalla dividida
// ============================================================================
// Izquierda: /FONDO_LOGIN.jpeg   ·   Derecha: formulario con /LOGO_CHANITOS.png
// Ambas imágenes viven en public/, por eso se usan con ruta absoluta.
// En tablet vertical y celular se oculta la foto y queda solo el formulario.
// ============================================================================

export default function Login() {
    const { iniciarSesion, autenticado, avisoSesion } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [usuario, setUsuario] = useState("");
    const [password, setPassword] = useState("");
    const [recordar, setRecordar] = useState(false);
    const [verPassword, setVerPassword] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState("");

    if (autenticado) return <Navigate to="/" replace />;

    const destino = (location.state as { desde?: string } | null)?.desde || "/";

    const enviar = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");

        if (!usuario.trim() || !password) {
            setError("Escribe tu usuario y tu contraseña.");
            return;
        }

        setEnviando(true);

        try {
            await iniciarSesion(usuario, password, recordar);
            navigate(destino, { replace: true });
        } catch (err) {
            setError(mensajeError(err));
            setPassword("");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="login">
            {/* ---- Foto ---- */}
            <aside className="login__portada">
                <div className="login__portada-velo">
                    <span className="login__marca">FRUTAS CHANITOS</span>
                    <h1>
                        Sistema de Control
                        <br />
                        de Preenfrío
                    </h1>
                    <p>Recepción, cámaras, cola y despachos en tiempo real.</p>
                </div>
            </aside>

            {/* ---- Formulario ---- */}
            <main className="login__panel">
                <form className="login__form" onSubmit={enviar} noValidate>
                    <div className="login__encabezado">
                        <img src="/LOGO_CHANITOS.png" alt="Frutas Chanitos" className="login__logo" />
                        <h2>Iniciar sesión</h2>
                        <p>Ingresa con tu cuenta asignada</p>
                    </div>

                    {avisoSesion && !error && (
                        <div className="alerta alerta--aviso" role="status">
                            {avisoSesion}
                        </div>
                    )}

                    {error && (
                        <div className="alerta alerta--error" role="alert">
                            {error}
                        </div>
                    )}

                    <label className="campo">
                        <span>Usuario</span>
                        <input
                            type="text"
                            value={usuario}
                            onChange={(e) => setUsuario(e.target.value)}
                            placeholder="ej. bescobedo"
                            autoComplete="username"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            autoFocus
                            disabled={enviando}
                        />
                    </label>

                    <label className="campo">
                        <span>Contraseña</span>
                        <div className="campo__password">
                            <input
                                type={verPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                disabled={enviando}
                            />
                            <button
                                type="button"
                                className="campo__ojo"
                                onClick={() => setVerPassword((v) => !v)}
                                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                tabIndex={-1}
                            >
                                {verPassword ? "Ocultar" : "Ver"}
                            </button>
                        </div>
                    </label>

                    <label className="login__recordar">
                        <input
                            type="checkbox"
                            checked={recordar}
                            onChange={(e) => setRecordar(e.target.checked)}
                            disabled={enviando}
                        />
                        <span>Mantener la sesión en este equipo</span>
                    </label>

                    <button type="submit" className="boton boton--primario" disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : "Entrar"}
                    </button>

                    <p className="login__pie">
                        ¿Olvidaste tu contraseña? Pide al administrador que la restablezca.
                    </p>
                </form>
            </main>
        </div>
    );
}
