import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getApiBaseUrl } from "../auth";
import { useCart } from "../context/useCart";
import "./FormularioCliente.css";

function crearOpcionesHora(tiempoPreparacionMin: number) {
    const ahora = new Date();
    const minutosMinimos = Math.max(15, tiempoPreparacionMin || 15);
    const primeraHora = new Date(ahora.getTime() + minutosMinimos * 60 * 1000);
    // Ofrecemos horarios cada 15 minutos, redondeando hacia arriba para no
    // sugerir una recogida anterior al tiempo mínimo de preparación.
    primeraHora.setMinutes(Math.ceil(primeraHora.getMinutes() / 15) * 15, 0, 0);

    return Array.from({ length: 8 }, (_, indice) => {
        const hora = new Date(primeraHora.getTime() + (indice * 15 * 60 * 1000));
        const fecha = [
            hora.getFullYear(),
            String(hora.getMonth() + 1).padStart(2, "0"),
            String(hora.getDate()).padStart(2, "0"),
        ].join("-");
        const tiempo = [
            String(hora.getHours()).padStart(2, "0"),
            String(hora.getMinutes()).padStart(2, "0"),
        ].join(":");

        return {
            value: `${fecha}T${tiempo}`,
            label: hora.toLocaleTimeString("es-CO", {
                hour: "2-digit",
                minute: "2-digit",
            }),
        };
    });
}

export default function FormularioCliente() {
    const navigate = useNavigate();
    const { items, vaciarCarrito } = useCart();
    const tiempoPreparacionMin = Math.max(15, ...items.map((item) => item.tiempoEstimadoMin || 15));
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [correo, setCorreo] = useState("");
    const [horaRecogida, setHoraRecogida] = useState("");
    const opcionesHora = useMemo(
        () => crearOpcionesHora(tiempoPreparacionMin),
        [tiempoPreparacionMin]
    );

    const [errores, setErrores] = useState({
        nombre: "",
        telefono: "",
        correo: "",
    });

    const [mensaje, setMensaje] = useState("");
    const [enviando, setEnviando] = useState(false);

    const guardarCliente = async (e: React.FormEvent) => {
        e.preventDefault();

        const nuevosErrores = {
            nombre: "",
            telefono: "",
            correo: "",
        };

        if (!nombre.trim()) {
            nuevosErrores.nombre = "El nombre es obligatorio";
        }

        if (!telefono.trim()) {
            nuevosErrores.telefono = "El teléfono es obligatorio";
        } else if (!/^3[0-9]{9}$/.test(telefono.trim())) {
            nuevosErrores.telefono = "Ingresa un celular colombiano de 10 dígitos";
        }

        if (!correo.trim()) {
            nuevosErrores.correo = "El correo es obligatorio";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            nuevosErrores.correo = "Ingresa un correo electrónico válido";
        }

        setErrores(nuevosErrores);
        setMensaje("");

        if (
            nuevosErrores.nombre ||
            nuevosErrores.telefono ||
            nuevosErrores.correo
        ) {
            return;
        }

        if (items.length === 0) {
            setMensaje("Agrega al menos un producto antes de confirmar el pedido.");
            return;
        }

        setEnviando(true);
        try {
            const respuesta = await apiFetch(`${getApiBaseUrl()}/api/pedidos`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    restauranteId: items[0].restauranteId,
                    clienteNombre: nombre.trim(),
                    clienteTelefono: telefono.trim(),
                    clienteCorreo: correo.trim(),
                    horaRecogida: horaRecogida || null,
                    items: items.map((item) => ({
                        productoId: item.id,
                        cantidad: item.cantidad,
                        observaciones: item.observaciones.trim(),
                        adiciones: (item.adiciones ?? []).map((extra) => extra.id),
                    })),
                }),
            });

            if (respuesta.ok) {
                const pedido = await respuesta.json() as {
                    id: number;
                    codigoSeguimiento: string;
                    total: number;
                };

                localStorage.setItem("upbfood.lastOrder", JSON.stringify({
                    ...pedido,
                    clienteNombre: nombre.trim(),
                    clienteCorreo: correo.trim(),
                    clienteTelefono: telefono.trim(),
                }));

                vaciarCarrito();

                navigate("/pago", {
                    state: {
                        pedidoId: pedido.id,
                        codigoSeguimiento: pedido.codigoSeguimiento,
                        total: pedido.total,
                    },
                });
            } else {
                const error = await respuesta.json().catch(() => null) as {
                    message?: string;
                } | null;

                setMensaje(error?.message ?? "No se pudo registrar el pedido.");
            }
        } catch (error) {
            console.error(error);
            setMensaje("No se pudo conectar con el servidor");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="cliente-container">
            <div className="cliente-card">
                <div className="cliente-header">
                        <p className="eyebrow">Paso 2 de 3 · Datos y recogida</p>
                        <h2>Prepara tu recogida</h2>
                    <p>
                            Cuéntanos quién recoge el pedido y cuándo quieres pasar por él.
                    </p>
                </div>

                <form onSubmit={guardarCliente} noValidate>
                    <div className="campo">
                        <label>Nombre completo</label>
                        <input
                            type="text"
                            placeholder="Ej. Julián Miranda"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                        />
                        {errores.nombre && (
                            <span className="error">
                                {errores.nombre}
                            </span>
                        )}
                    </div>

                    <div className="campo">
                        <label>Teléfono</label>
                        <input
                            type="text"
                            placeholder="Ej. 3001234567"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                        />
                        {errores.telefono && (
                            <span className="error">
                                {errores.telefono}
                            </span>
                        )}
                    </div>

                    <div className="campo">
                        <label>Correo</label>
                        <input
                            type="email"
                            placeholder="Ej. nombre.apellido@upb.edu.co"
                            value={correo}
                            onChange={(e) => setCorreo(e.target.value)}
                        />
                        {errores.correo && (
                            <span className="error">
                                {errores.correo}
                            </span>
                        )}
                    </div>

                    <div className="campo">
                        <label htmlFor="hora-recogida">¿Cuándo quieres recogerlo?</label>
                        <div className="pickup-options">
                            <button
                                type="button"
                                className={!horaRecogida ? "pickup-option active" : "pickup-option"}
                                onClick={() => setHoraRecogida("")}
                            >
                                <strong>Lo antes posible</strong>
                                <span>Listo en aproximadamente {tiempoPreparacionMin} minutos</span>
                            </button>
                            <span className="pickup-or">o elige una hora</span>
                        </div>
                        <div className="pickup-time-grid" aria-label="Horarios disponibles">
                            {opcionesHora.map((opcion) => (
                                <button
                                    key={opcion.value}
                                    type="button"
                                    className={horaRecogida === opcion.value ? "pickup-time active" : "pickup-time"}
                                    aria-pressed={horaRecogida === opcion.value}
                                    onClick={() => setHoraRecogida(opcion.value)}
                                >
                                    {opcion.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button type="submit" disabled={enviando || items.length === 0}>
                        {enviando ? "Abriendo pago..." : "Continuar al pago"}
                    </button>

                    {mensaje && (
                        <p className="mensaje-exito" aria-live="polite">
                            {mensaje}
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}