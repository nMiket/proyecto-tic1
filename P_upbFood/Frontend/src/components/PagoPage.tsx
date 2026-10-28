import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { apiFetch, getApiBaseUrl } from "../auth";

type PagoState = {
    pedidoId?: number;
    codigoSeguimiento?: string;
    total?: number;
};

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

type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

const metodosPago: Array<{ valor: MetodoPago; etiqueta: string; tipoPagoId: number }> = [
    { valor: "efectivo", etiqueta: "Efectivo", tipoPagoId: 1 },
    { valor: "tarjeta", etiqueta: "Tarjeta", tipoPagoId: 2 },
    { valor: "transferencia", etiqueta: "Transferencia", tipoPagoId: 3 },
];

export default function PagoPage() {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const state =
        (location.state as PagoState | null) ?? obtenerPedidoRespaldo(searchParams);

    const [procesando, setProcesando] = useState(false);
    const [redirigiendoStripe, setRedirigiendoStripe] = useState(false);
    const [estadoPago, setEstadoPago] = useState<
        "pendiente" | "aprobado" | "rechazado"
    >("pendiente");
    const [mensaje, setMensaje] = useState("");
    const verificadoStripeRef = useRef(false);
    // HU022: el cliente elige el medio de pago. Tarjeta usa Stripe (sandbox);
    // efectivo y transferencia se registran con el pago simulado.
    const [metodo, setMetodo] = useState<MetodoPago>("tarjeta");

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
        setMensaje("Verificando pago con Stripe...");

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
                    "¡Pago confirmado en Stripe! Tu pedido ha sido registrado como pagado."
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
                        "No se pudo abrir la pasarela de Stripe. Inténtalo nuevamente."
                );
                setRedirigiendoStripe(false);
                return;
            }

            window.location.href = data.checkoutUrl;
        } catch (error) {
            console.error(error);
            setMensaje(
                "No se pudo conectar con Stripe. Verifica tu conexión e inténtalo nuevamente."
            );
            setRedirigiendoStripe(false);
        }
    };

    const simularPago = async () => {
        if (!codigoSeguimiento || total <= 0) {
            setMensaje("No se encontraron los datos completos del pedido.");
            return;
        }
        const tipoPagoId = metodosPago.find((item) => item.valor === metodo)?.tipoPagoId ?? 1;

        setProcesando(true);
        setMensaje("");
        try {
            const respuesta = await apiFetch(
                `${getApiBaseUrl()}/api/pedidos/seguimiento/${codigoSeguimiento}/pago`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tipoPagoId, monto: total }),
                }
            );
            if (!respuesta.ok) {
                const err = (await respuesta.json().catch(() => null)) as {
                    message?: string;
                } | null;
                setEstadoPago("rechazado");
                setMensaje(err?.message ?? "El pago no pudo registrarse. Inténtalo nuevamente.");
                return;
            }
            setEstadoPago("aprobado");
            setMensaje("¡Pago aprobado! Tu pedido quedó registrado como pagado.");
        } catch {
            setEstadoPago("rechazado");
            setMensaje("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.");
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
                        Completa el pago de tu pedido de forma segura a través
                        de la pasarela de Stripe.
                    </p>
                </div>

                <div className="pago-summary-box">
                    <p>
                        <strong>Pedido:</strong> #{pedidoId}
                    </p>
                    <p>
                        <strong>Total a pagar:</strong> $
                        {total.toLocaleString("es-CO")} COP
                    </p>
                </div>

                {estadoPago === "pendiente" || estadoPago === "rechazado" ? (
                    <>
                        <fieldset className="pago-metodos">
                            <legend>Método de pago</legend>
                            {metodosPago.map((item) => (
                                <label
                                    key={item.valor}
                                    className={metodo === item.valor ? "pago-metodo is-active" : "pago-metodo"}
                                >
                                    <input
                                        type="radio"
                                        name="metodo-pago"
                                        value={item.valor}
                                        checked={metodo === item.valor}
                                        onChange={() => setMetodo(item.valor)}
                                    />
                                    {item.etiqueta}
                                </label>
                            ))}
                        </fieldset>

                        {metodo === "tarjeta" ? (
                            <>
                                <div className="pago-sandbox-card">
                                    <strong>Tarjeta de prueba (Stripe Sandbox):</strong>
                                    <div>
                                        Número: <code>4242 4242 4242 4242</code> ·
                                        Fecha: cualquier mes/año futuro (ej.{" "}
                                        <code>12/28</code>) · CVC: <code>123</code>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="pago-stripe-button"
                                    onClick={() => void iniciarPagoStripe()}
                                    disabled={procesando || redirigiendoStripe}
                                >
                                    {redirigiendoStripe
                                        ? "Abriendo Stripe Checkout..."
                                        : procesando
                                        ? "Verificando pago..."
                                        : "Pagar con Stripe"}
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="campo-ayuda">
                                    {metodo === "efectivo"
                                        ? "Pagarás en el mostrador al recoger. En este prototipo el pago se simula."
                                        : "La transferencia se simula en este prototipo y se valida por el valor exacto del pedido."}
                                </p>
                                <button
                                    type="button"
                                    className="pago-stripe-button"
                                    onClick={() => void simularPago()}
                                    disabled={procesando}
                                >
                                    {procesando ? "Registrando pago..." : "Simular aprobación del pago"}
                                </button>
                            </>
                        )}
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
                    <div className="pago-approved-box">
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
