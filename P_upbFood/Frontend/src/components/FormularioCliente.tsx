import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getApiBaseUrl } from "../auth";
import { useCart } from "../context/useCart";
import { guardarPedido } from "../utils/pedidosGuardados";
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

type ErroresCliente = { nombre: string; telefono: string; correo: string };

// HU010/HU011: reglas de validación compartidas por los mensajes en vivo y el envío.
function validarCliente(nombre: string, telefono: string, correo: string): ErroresCliente {
    const errores: ErroresCliente = { nombre: "", telefono: "", correo: "" };

    if (!nombre.trim()) {
        errores.nombre = "El nombre es obligatorio";
    }

    if (!telefono.trim()) {
        errores.telefono = "El teléfono es obligatorio";
    } else if (!/^3[0-9]{9}$/.test(telefono.trim())) {
        errores.telefono = "Ingresa un celular colombiano de 10 dígitos";
    }

    if (!correo.trim()) {
        errores.correo = "El correo es obligatorio";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
        errores.correo = "Ingresa un correo electrónico válido";
    }

    return errores;
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

    const [tocados, setTocados] = useState({
        nombre: false,
        telefono: false,
        correo: false,
    });
    const erroresActuales = validarCliente(nombre, telefono, correo);
    const formularioValido =
        !erroresActuales.nombre && !erroresActuales.telefono && !erroresActuales.correo;
    // Los mensajes aparecen cuando el usuario sale del campo o intenta continuar.
    const errores = {
        nombre: tocados.nombre ? erroresActuales.nombre : "",
        telefono: tocados.telefono ? erroresActuales.telefono : "",
        correo: tocados.correo ? erroresActuales.correo : "",
    };
    const marcarTocado = (campo: keyof ErroresCliente) =>
        setTocados((actual) => ({ ...actual, [campo]: true }));

    const [mensaje, setMensaje] = useState("");
    const [enviando, setEnviando] = useState(false);

    const guardarCliente = async (e: React.FormEvent) => {
        e.preventDefault();

        const nuevosErrores = validarCliente(nombre, telefono, correo);
        setTocados({ nombre: true, telefono: true, correo: true });
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

                // HU011: el pedido queda en estado "En pago" antes de abrir el portal.
                await apiFetch(
                    `${getApiBaseUrl()}/api/pedidos/seguimiento/${pedido.codigoSeguimiento}/iniciar-pago`,
                    { method: "POST" },
                ).catch(() => null);

                guardarPedido({
                    ...pedido,
                    clienteNombre: nombre.trim(),
                    clienteCorreo: correo.trim(),
                    clienteTelefono: telefono.trim(),
                });

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
                        <label htmlFor="cliente-nombre">Nombre completo</label>
                        <input
                            id="cliente-nombre"
                            type="text"
                            autoComplete="name"
                            placeholder="Ej. Julián Miranda"
                            value={nombre}
                            aria-invalid={Boolean(errores.nombre)}
                            aria-describedby={errores.nombre ? "error-cliente-nombre" : undefined}
                            onChange={(e) => setNombre(e.target.value)}
                            onBlur={() => marcarTocado("nombre")}
                        />
                        {errores.nombre && (
                            <span id="error-cliente-nombre" className="error" role="alert">
                                {errores.nombre}
                            </span>
                        )}
                    </div>

                    <div className="campo">
                        <label htmlFor="cliente-telefono">Teléfono</label>
                        <input
                            id="cliente-telefono"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel"
                            placeholder="Ej. 3001234567"
                            value={telefono}
                            aria-invalid={Boolean(errores.telefono)}
                            aria-describedby={errores.telefono ? "error-cliente-telefono" : undefined}
                            onChange={(e) => setTelefono(e.target.value)}
                            onBlur={() => marcarTocado("telefono")}
                        />
                        {errores.telefono && (
                            <span id="error-cliente-telefono" className="error" role="alert">
                                {errores.telefono}
                            </span>
                        )}
                    </div>

                    <div className="campo">
                        <label htmlFor="cliente-correo">Correo</label>
                        <input
                            id="cliente-correo"
                            type="email"
                            autoComplete="email"
                            placeholder="Ej. nombre.apellido@upb.edu.co"
                            value={correo}
                            aria-invalid={Boolean(errores.correo)}
                            aria-describedby={errores.correo ? "error-cliente-correo" : undefined}
                            onChange={(e) => setCorreo(e.target.value)}
                            onBlur={() => marcarTocado("correo")}
                        />
                        {errores.correo && (
                            <span id="error-cliente-correo" className="error" role="alert">
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

                    <button
                        type="submit"
                        disabled={enviando || items.length === 0 || !formularioValido}
                        aria-describedby={!formularioValido ? "ayuda-continuar-pago" : undefined}
                    >
                        {enviando ? "Abriendo pago..." : "Continuar al pago"}
                    </button>
                    {!formularioValido && (
                        <p id="ayuda-continuar-pago" className="campo-ayuda">
                            Completa tu nombre, un celular de 10 dígitos y un correo válido para continuar.
                        </p>
                    )}

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