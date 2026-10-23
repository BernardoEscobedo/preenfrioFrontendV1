import { useState } from "react";
import Modal from "../ui/Modal";
import { mensajeError } from "../../api/axios";
import * as tarimasService from "../../services/tarimas.service";
import type { BloqueTarimas, CamaraBloques } from "../../types/tarima";

// ============================================================================
// MOVER BLOQUE · supervisor+
// ============================================================================
// El bloque se mueve completo. Las tarimas que todavía no llegan a la
// temperatura óptima se marcan para que se queden en el preenfrío.
//
// Mueve la ubicación física. El inventario de cámaras se traslada en
// Movimientos.
// ============================================================================

const num = (v: number | string | null | undefined) => Number(v ?? 0);

interface Props {
    bloque: BloqueTarimas;
    camaraActual: CamaraBloques;
    camaras: CamaraBloques[];
    onGuardado: (mensaje: string, avisos: string[]) => void;
    onCerrar: () => void;
}

export default function ModalMoverBloque({ bloque, camaraActual, camaras, onGuardado, onCerrar }: Props) {
    const destinos = camaras.filter((c) => c.id_camara !== camaraActual.id_camara && !c.en_mantenimiento);
    const conserva = destinos.find((c) => Number(c.tipo_camara) === 2);
    const [destino, setDestino] = useState(conserva ? String(conserva.id_camara) : "");
    const [excluir, setExcluir] = useState<Set<number>>(new Set());
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const alternar = (id: number) =>
        setExcluir((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    const mueven = bloque.tarimas.length - excluir.size;

    const guardar = async () => {
        if (!destino) return setError("Elige la cámara destino.");
        if (mueven === 0) return setError("Todas las tarimas están marcadas para quedarse.");
        setError("");
        setEnviando(true);
        try {
            const r = await tarimasService.moverBloque(bloque.id_bloque, Number(destino), [...excluir]);
            onGuardado(r.mensaje, r.avisos ?? []);
        } catch (e) {
            setError(mensajeError(e));
            setEnviando(false);
        }
    };

    return (
        <Modal
            titulo={`Mover bloque ${bloque.codigo_bloque}`}
            subtitulo={`Desde ${camaraActual.nombre_camara}`}
            onCerrar={onCerrar}
            bloqueado={enviando}
            pie={
                <>
                    <button type="button" className="boton boton--claro" onClick={onCerrar} disabled={enviando}>
                        Cancelar
                    </button>
                    <button type="button" className="boton boton--primario" onClick={guardar} disabled={enviando}>
                        {enviando ? <span className="spinner spinner--chico" /> : `Mover ${mueven} tarima(s)`}
                    </button>
                </>
            }
        >
            {error && <div className="alerta alerta--error">{error}</div>}
            <label className="campo campo--completo">
                <span>Cámara destino</span>
                <select value={destino} onChange={(e) => setDestino(e.target.value)} disabled={enviando}>
                    <option value="">Selecciona…</option>
                    {destinos.map((c) => (
                        <option key={c.id_camara} value={c.id_camara}>
                            {c.nombre_camara} · {Number(c.tipo_camara) === 2 ? "Conservación" : "Preenfrío"}
                        </option>
                    ))}
                </select>
            </label>

            <p className="pieza__vacio">Marca las tarimas que se quedan (no han llegado a la temperatura óptima):</p>
            <ul className="mover__lista">
                {bloque.tarimas.map((t) => (
                    <li key={t.id_tarima}>
                        <label className="interruptor">
                            <input type="checkbox" checked={excluir.has(t.id_tarima)} onChange={() => alternar(t.id_tarima)} disabled={enviando} />
                            Tarima {t.posicion} se queda
                        </label>
                        <small>
                            {t.ultima_temperatura === null ? "Sin pulpeo" : `${num(t.ultima_temperatura)} °C`} · {num(t.horas_en_camara)} h
                        </small>
                    </li>
                ))}
            </ul>
            <p className="modal__advertencia">Esto mueve la ubicación de las tarimas. El inventario se traslada en Movimientos.</p>
        </Modal>
    );
}
