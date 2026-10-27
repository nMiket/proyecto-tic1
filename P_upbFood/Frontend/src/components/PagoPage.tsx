import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
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
    { id: 2, nombre: "Tarjeta (Pasarela Stripe Sandbox)" },
    { id: 3, nombre: "Transferencia" },
    { id: 1, nombre: "Efectivo" },
];

function obtenerPedidoRespaldo(searchParams: URLSearchParams): PagoState | null {
    const queryCodigo = searchParams.get("codigo");
    const queryPedidoId = searchParams.get("pedidoId");
    const queryTotal = searchParams.get("total");

    if (queryCodigo && queryPedidoId) {
        return {
            pedidoId: Number(queryPedidoId),
            codigoSeguimiento: queryCodigo,
            total: Number(queryTotal ?? 0),
        };
    }

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
    const [searchParams] = useSearchParams();
    const state =
        (location.state as PagoState | null) ?? obtenerPedidoRespaldo(searchParams);

    const [tipoPagoId, setTipoPagoId] = useState(2);
    const [procesando, setProcesando] = useState(false);
    const [redirigiendoStripe, setRedirigiendoStripe] = useState(false);
    const [estadoPago, setEstadoPago] = useState<
        "pendiente" | "aprobado" | "rechazado"
    >("pendiente");
    const [mensaje, setMensaje] = useState("");
    const verificadoStripeRef = useRef(false);

    const total = Number(state?.total ?? 0);
    const codigoSeguimiento = state?.codigoSeguimiento ?? "";
    const pedidoId = state?.pedidoId;

    useEffect(() => {
        const stripeSessionId = searchParams.get("stripe_session_id");
        const stripeCancelled = searchParams.get("stripe_cancelled");

        if (stripeCancelled && !verificadoStripeRef.current) {
            verificadoStripeRef.current = true;
            setEstadoPago("rechazado");
            setMensaje(
                "Cancelaste el proceso en Stripe. Tu pedido sigue pendiente de pago."
            );
            return;
        }

        if (
            !stripeSessionId ||
            !codigoSeguimiento ||
            verificadoStripeRef.current
        ) {
            return;
        }

        verificadoStripeRef.current = true;
        setProcesando(true);
        setMensaje("Verificando pago con Stripe Sandbox...");

        void apiFetch(
            `${getApiBaseUrl()}/api/pedidos/seguimiento/${codigoSeguimiento}/stripe-confirmar?sessionId=${encodeURIComponent(
                stripeSessionId
            )}`,
            { method: "POST" }
        )
            .then(async (res) => {
                if (!res.ok) {
                    const err = (await res.json().catch(() => null)) as {
                        message?: string;
                    } | null;
                    setEstadoPago("rechazado");
                    setMensaje(
                        err?.message ??
                            "No se pudo confirmar el pago en Stripe. Inténtalo nuevamente."
                    );
                    return;
                }
                setEstadoPago("aprobado");
                setMensaje(
                    "¡Pago confirmado en Stripe Sandbox! Tu pedido ha sido marcado como pagado."
                );
            })
            .catch(() => {
                setEstadoPago("rechazado");
                setMensaje(
                    "No se pudo conectar con el servidor al verificar el pago de Stripe."
                );
            })
            .finally(() => {
                setProcesando(false);
            });
    }, [searchParams, codigoSeguimiento]);

    const iniciarPagoStripe = async () => {
        if (!pedidoId || !codigoSeguimiento || total <= 0) {
            setMensaje("No se encontraron los datos completos del pedido.");
            return;
        }

        setRedirigiendoStripe(true);
        setMensaje("");

        try {
            const respuesta = await apiFetch(
                `${getApiBaseUrl()}/api/pedidos/seguimiento/${codigoSeguimiento}/stripe-session`,
                { method: "POST" }
            );

            const data = (await respuesta.json().catch(() => null)) as {
                checkoutUrl?: string;
                message?: string;
            } | null;

            if (!respuesta.ok || !data?.checkoutUrl) {
                setEstadoPago("rechazado");
                setMensaje(
                    data?.message ??
                        "No se pudo abrir la pasarela de Stripe. Puedes usar la simulación local."
                );
                setRedirigiendoStripe(false);
                return;
            }

            window.location.href = data.checkoutUrl;
        } catch (error) {
            console.error(error);
            setMensaje(
                "No se pudo conectar con Stripe. Verifica tu conexión o usa la simulación local."
            );
            setRedirigiendoStripe(false);
        }
    };

    const simularRechazo = () => {
        setEstadoPago("rechazado");
        setMensaje(
            "El pago simulado fue rechazado. Tu pedido sigue pendiente de pago."
        );
    };

    const simularAprobacion = async () => {
        if (!pedidoId || !codigoSeguimiento || total <= 0) {
            setMensaje("No se encontraron los datos completos del pedido.");
            return;
        }

        setProcesando(true);
        setMensaje("");

        try {
            const respuesta = await apiFetch(
                `${getApiBaseUrl()}/api/pedidos/seguimiento/${codigoSeguimiento}/pago`,
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
                const error = (await respuesta.json().catch(() => null)) as {
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
            setMensaje(
                "¡Pago aprobado! Tu pedido ha sido registrado como pagado."
            );
        } catch (error) {
            console.error(error);
            setMensaje(
                "No se pudo conectar con el servidor. Verifica el estado del pago antes de volver a intentarlo."
            );
        } finally {
            setProcesando(false);
        }
    };

    if (!pedidoId || !codigoSeguimiento) {
        return (
            <section className="cliente-container">
                <div className="cliente-card">
                    <div className="cliente-header">
                        <h2>Sin pedido pendiente</h2>
                        <p>
                            No encontramos los datos necesarios para continuar
                            con el pago.
                        </p>
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
                    <p className="eyebrow">Paso 3 de 3 · Pasarela de pago</p>
                    <h2>Portal de pago</h2>
                    <p>
                        Paga con tarjeta en la pasarela de pruebas de Stripe o
                        usa la confirmación rápida.
                    </p>
                </div>

                <div
                    style={{
                        padding: "14px 16px",
                        borderRadius: "12px",
                        background: "#f5f3ef",
                        border: "1px solid #e5e5e7",
                        marginBottom: "16px",
                    }}
                >
                    <p style={{ margin: "0 0 6px" }}>
                        <strong>Pedido:</strong> #{pedidoId}
                    </p>
                    <p style={{ margin: 0 }}>
                        <strong>Total a pagar:</strong> $
                        {total.toLocaleString("es-CO")} COP
                    </p>
                </div>

                {estadoPago === "pendiente" || estadoPago === "rechazado" ? (
                    <>
                        <div className="campo">
                            <label htmlFor="medio-pago">Medio de pago</label>
                            <select
                                id="medio-pago"
                                value={tipoPagoId}
                                onChange={(e) =>
                                    setTipoPagoId(Number(e.target.value))
                                }
                                disabled={procesando || redirigiendoStripe}
                            >
                                {mediosPago.map((medio) => (
                                    <option key={medio.id} value={medio.id}>
                                        {medio.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div
                            style={{
                                padding: "12px 14px",
                                borderRadius: "10px",
                                background: "#f8faf9",
                                border: "1px dashed #b2d8d0",
                                fontSize: "0.84rem",
                                color: "#1d433d",
                                marginBottom: "14px",
                            }}
                        >
                            <strong>Datos de prueba para Stripe Sandbox:</strong>
                            <div style={{ marginTop: "4px" }}>
                                Tarjeta: <code>4242 4242 4242 4242</code> ·
                                Fecha: cualquier mes/año futuro (ej.{" "}
                                <code>12/28</code>) · CVC: <code>123</code>
                            </div>
                        </div>

                        <div style={{ display: "grid", gap: "10px" }}>
                            <button
                                type="button"
                                onClick={() => void iniciarPagoStripe()}
                                disabled={procesando || redirigiendoStripe}
                                style={{
                                    background: "#1d1d1b",
                                    color: "#c0d901",
                                    fontWeight: 700,
                                }}
                            >
                                {redirigiendoStripe
                                    ? "Abriendo Stripe Checkout..."
                                    : "Pagar con Tarjeta en Stripe (Sandbox)"}
                            </button>

                            <button
                                type="button"
                                onClick={() => void simularAprobacion()}
                                disabled={procesando || redirigiendoStripe}
                            >
                                {procesando
                                    ? "Procesando..."
                                    : "Simular pago aprobado (confirmación rápida)"}
                            </button>

                            <button
                                type="button"
                                className="secondary-button"
                                onClick={simularRechazo}
                                disabled={procesando || redirigiendoStripe}
                            >
                                Simular pago rechazado
                            </button>
                        </div>
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
                    <div style={{ marginTop: "14px" }}>
                        <p>
                            <strong>Código de seguimiento:</strong>{" "}
                            {codigoSeguimiento}
                        </p>
                        <Link
                            className="directory-tracking-cta"
                            to={`/seguimiento/${codigoSeguimiento}`}
                        >
                            Consultar estado de mi pedido en vivo
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
