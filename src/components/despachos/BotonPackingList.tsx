import { useState } from "react";
import { FileDown } from "lucide-react";
import { mensajeError } from "../../api/axios";
import { getPacking } from "../../services/packing.service";
import { imprimirPackingList, logoComoDataUrl } from "../../utils/packingList";

// ============================================================================
// BOTÓN · PACKING LIST (PDF tamaño carta)
// ============================================================================
// Abre el packing list listo para imprimir; en el diálogo se elige
// "Guardar como PDF". La ventana se abre ANTES de pedir los datos para que
// el navegador no la bloquee como ventana emergente.
//
// LOGO: ruta del logo dentro de la carpeta public/ del frontend. Cámbiala
// aquí si tu archivo se llama distinto.
// ============================================================================

const RUTA_LOGO = "/LOGO_CHANITOS.png";

interface Props {
    idDespacho: number;
    onError?: (mensaje: string) => void;
}

export default function BotonPackingList({ idDespacho, onError }: Props) {
    const [cargando, setCargando] = useState(false);

    const abrir = async () => {
        const ventana = window.open("", "_blank");
        if (!ventana) {
            onError?.("El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio.");
            return;
        }
        ventana.document.write("<p style='font-family:Arial;padding:24px;color:#1E7A3C'>Generando packing list…</p>");
        setCargando(true);
        try {
            const [datos, logo] = await Promise.all([getPacking(idDespacho), logoComoDataUrl(RUTA_LOGO)]);
            imprimirPackingList(ventana, datos, logo);
        } catch (e) {
            ventana.close();
            onError?.(mensajeError(e));
        } finally {
            setCargando(false);
        }
    };

    return (
        <button type="button" className="boton boton--primario" onClick={abrir} disabled={cargando}>
            {cargando ? <span className="spinner spinner--chico" /> : <FileDown size={18} />} Packing list (PDF)
        </button>
    );
}
