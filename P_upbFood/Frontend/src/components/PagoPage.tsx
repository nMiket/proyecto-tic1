import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch, getApiBaseUrl } from "../auth";

type PagoState = {
    pedidoId?: number;
    codigoSeguimiento?: string;
    total?: number;
};

type MedioPago = {
    id: number;
    nombre: string;
};

const mediosPago: MedioPago[] = [
    { id: 1, nombre: "Efectivo" },
    { id: 2, nombre: "Tarjeta" },
    { id: 3, nombre: "Transferencia" },
];

function obtenerPedidoRespaldo(): PagoState | null {
    try {
        const raw = localStorage.getItem("upbfood.lastOrder");
        if (!raw) return null;
        const data = JSON.parse(raw) as {
            id?: number;
            pedidoId?: number;
            codigoSeguimiento?: string;
            total?: number;
        };
        const pedidoId = data.pedidoId ?? data.id;
        if (!pedidoId || !data.codigoSeguimiento) return null;
        return {
            pedidoId: Number(pedidoId),
            codigoSeguimiento: String(data.codigoSeguimiento),
            total: Number(data.total ?? 0),
        };
    } catch {
        return null;
    }
}

export default function PagoPage() {
    const location = useLocation();
    const state = (location.state as PagoState | null) ?? obtenerPedidoRespaldo();

    const [tipoPagoId, setTipoPagoId] = useState(1);
    const [procesando, setProcesando] = useState(false);
    const [estadoPago, setEstadoPago] = useState<
        "pendiente" | "aprobado" | "rechazado"
    >("pendiente");
    const [mensaje, setMensaje] = useState("");

    const total = Number(state?.total ?? 0);

    const simularRechazo = () => {
        setEstadoPago("rechazado");
        setMensaje(
            "El pago simulado fue rechazado. Tu pedido sigue pendiente de pago."
        );
    };

    const simularAprobacion = async () => {
        if (
            !state?.pedidoId ||
            !state.codigoSeguimiento ||
            total <= 0
        ) {
            setMensaje("No se encontraron los datos completos del pedido.");
            return;
        }

        setProcesando(true);
        setMensaje("");

        try {
            const respuesta = await apiFetch(
                `${getApiBaseUrl()}/api/pedidos/seguimiento/${state.codigoSeguimiento}/pago`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        tipoPagoId,
                        monto: total,
                    }),
                }
            );

            if (!respuesta.ok) {
                const error = await respuesta.json().catch(() => null) as {
                    message?: string;
                } | null;

                setEstadoPago("rechazado");
                setMensaje(
                    error?.message ??
                    "No se pudo registrar el pago. Puedes intentarlo nuevamente."
                );
                return;
            }

            setEstadoPago("aprobado");
            setMensaje("¡Pago aprobado! Tu pedido ha sido registrado como pagado.");
        } catch (error) {
            console.error(error);
            setMensaje("No se pudo conectar con el servidor. Verifica el estado del pago antes de volver a intentarlo.");
        } finally {
            setProcesando(false);
        }
    };

    if (!state?.pedidoId || !state.codigoSeguimiento) {
        return (
            <section className="cliente-container">
                <div className="cliente-card">
                    <div className="cliente-header">
                        <h2>Sin pedido pendiente</h2>
                        <p>No encontramos los datos necesarios para continuar con el pago.</p>
                    </div>
                    <Link to="/pedido">Volver al pedido</Link>
                </div>
            </section>
        );
    }

    return (
        <section className="cliente-container">
            <div className="cliente-card">
                <div className="cliente-header">
                    <p className="eyebrow">Pago simulado</p>
                    <h2>Portal de pago</h2>
                    <p>Selecciona el medio de pago para continuar.</p>
                </div>

                <div>
                    <p><strong>Pedido:</strong> #{state.pedidoId}</p>
                    <p>
                        <strong>Total:</strong>{" "}
                        ${total.toLocaleString("es-CO")}
                    </p>
                </div>

                {estadoPago === "pendiente" || estadoPago === "rechazado" ? (
                    <>
                        <div className="campo">
                            <label htmlFor="medio-pago">Medio de pago</label>
                            <select
                                id="medio-pago"
                                value={tipoPagoId}
                                onChange={(e) => setTipoPagoId(Number(e.target.value))}
                                disabled={procesando}
                            >
                                {mediosPago.map((medio) => (
                                    <option key={medio.id} value={medio.id}>
                                        {medio.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <p>
                            Esta es una demostración académica. No se realizará
                            ningún cobro real.
                        </p>

                        <button
                            type="button"
                            onClick={simularAprobacion}
                            disabled={procesando}
                        >
                            {procesando ? "Procesando..." : "Simular pago aprobado"}
                        </button>

                        <button
                            type="button"
                            onClick={simularRechazo}
                            disabled={procesando}
                        >
                            Simular pago rechazado
                        </button>
                    </>
                ) : null}

                {mensaje && (
                    <p
                        className={
                            estadoPago === "aprobado"
                                ? "mensaje-exito"
                                : "mensaje-error"
                        }
                        aria-live="polite"
                    >
                        {mensaje}
                    </p>
                )}

                {estadoPago === "aprobado" && (
                    <div>
                        <p>
                            <strong>Código de seguimiento:</strong>{" "}
                            {state.codigoSeguimiento}
                        </p>
                        <Link to={`/seguimiento/${state.codigoSeguimiento}`}>
                            Consultar mi pedido
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}