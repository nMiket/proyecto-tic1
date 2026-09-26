import { useState } from "react";
import "./FormularioCliente.css";

export default function FormularioCliente() {
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [correo, setCorreo] = useState("");

    const [errores, setErrores] = useState({
        nombre: "",
        telefono: "",
        correo: "",
    });

    const [mensaje, setMensaje] = useState("");

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
        } else if (!/^[0-9]{7,10}$/.test(telefono)) {
            nuevosErrores.telefono = "Ingresa un número de teléfono válido";
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

        try {
            const respuesta = await fetch("http://localhost:8080/api/clientes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nombre,
                    telefono,
                    correo,
                }),
            });

            if (respuesta.ok) {
                const cliente = await respuesta.json();

                console.log("Cliente guardado:", cliente);
                setMensaje("Datos registrados correctamente");
            } else {
                setMensaje("No se pudieron registrar los datos");
            }
        } catch (error) {
            console.error(error);
            setMensaje("No se pudo conectar con el servidor");
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

                    <button type="submit">
                        Continuar
                    </button>

                    {mensaje && (
                        <p className="mensaje-exito">
                            {mensaje}
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}