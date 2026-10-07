import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getApiBaseUrl } from "../auth";
import { useCart } from "../context/useCart";
import "./FormularioCliente.css";

export default function FormularioCliente() {
    const navigate = useNavigate();
    const { items, vaciarCarrito } = useCart();
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [correo, setCorreo] = useState("");
    const [horaRecogida, setHoraRecogida] = useState("");

    const [errores, setErrores] = useState({
        nombre: "",
        telefono: "",
        correo: "",
    });

    const [mensaje, setMensaje] = useState("");
    const [enviando, setEnviando] = useState(false);
    const formularioValido = nombre.trim().length > 0
        && /^3[0-9]{9}$/.test(telefono.trim())
        && /^[^\s@]+@upb\.edu\.co$/.test(correo.trim());

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
        } else if (!/^[^\s@]+@upb\.edu\.co$/.test(correo)) {
            nuevosErrores.correo = "Debes utilizar tu correo institucional";
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
                    })),
                }),
            });

            if (respuesta.ok) {
                const pedido = await respuesta.json() as { id: number; codigoSeguimiento: string };
                const pago = await apiFetch(`${getApiBaseUrl()}/api/pedidos/seguimiento/${pedido.codigoSeguimiento}/pago`, {
                    method: "PUT",
                });
                if (!pago.ok) {
                    const error = await pago.json().catch(() => null) as { message?: string } | null;
                    setMensaje(error?.message ?? "No se pudo iniciar el pago.");
                    return;
                }

                const pedidoEnPago = await pago.json() as { id: number; total: number };
                vaciarCarrito();
                navigate("/pago", {
                    state: {
                        pedidoId: pedidoEnPago.id,
                        codigoSeguimiento: pedido.codigoSeguimiento,
                        total: pedidoEnPago.total,
                    },
                });
            } else {
                const error = await respuesta.json().catch(() => null) as { message?: string } | null;
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
                    <h2>Datos personales</h2>
                    <p>
                        Ingresa tus datos para continuar con tu pedido.
                    </p>
                </div>

                <form onSubmit={guardarCliente}>
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
                        <label>Correo institucional</label>
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
                        <label htmlFor="hora-recogida">Hora de recogida (opcional)</label>
                        <input
                            id="hora-recogida"
                            type="datetime-local"
                            value={horaRecogida}
                            onChange={(e) => setHoraRecogida(e.target.value)}
                        />
                        <small>Si no eliges una hora, se usará el tiempo estimado de la cafetería.</small>
                    </div>

                    <button type="submit" disabled={enviando || items.length === 0 || !formularioValido}>
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