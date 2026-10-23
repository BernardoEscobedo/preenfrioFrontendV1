// ============================================================================
// FOTOS · compresión y carga directa a SharePoint
// ============================================================================
// 1. comprimirFoto: lado mayor a 1600 px, JPEG al 80 % (de ~5 MB a ~400 KB).
//    Si el navegador no puede leer la imagen (HEIC en algunos equipos), se
//    sube la original.
// 2. subirASharePoint: PUT por pedazos a la upload_url de la sesión.
//    Cada pedazo es múltiplo de 320 KiB (regla de Microsoft Graph). La
//    upload_url ya viene autenticada: NO se manda el token de la app.
//    Devuelve el "id" del archivo creado (item_id) para confirmar.
// ============================================================================

const LADO_MAX = 1600;
const CALIDAD = 0.8;
const PEDAZO = 320 * 1024 * 10; // 3.2 MB

export const comprimirFoto = async (archivo: File): Promise<File> => {
    try {
        const bitmap = await createImageBitmap(archivo);
        const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * escala);
        canvas.height = Math.round(bitmap.height * escala);
        const ctx = canvas.getContext("2d");
        if (!ctx) return archivo;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", CALIDAD));
        if (!blob || blob.size >= archivo.size) return archivo;
        const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], nombre, { type: "image/jpeg" });
    } catch {
        return archivo;
    }
};

export const subirASharePoint = async (uploadUrl: string, archivo: File): Promise<string> => {
    const total = archivo.size;
    let inicio = 0;
    while (inicio < total) {
        const fin = Math.min(inicio + PEDAZO, total);
        const respuesta = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Range": `bytes ${inicio}-${fin - 1}/${total}` },
            body: archivo.slice(inicio, fin)
        });
        if (!respuesta.ok && respuesta.status !== 202) {
            throw new Error(`SharePoint rechazó la foto (${respuesta.status}). Intenta de nuevo.`);
        }
        if (respuesta.status === 200 || respuesta.status === 201) {
            const datos = await respuesta.json();
            if (!datos?.id) throw new Error("SharePoint no devolvió el id de la foto");
            return String(datos.id);
        }
        inicio = fin;
    }
    throw new Error("La carga terminó sin confirmación de SharePoint");
};
