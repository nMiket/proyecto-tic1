import { useEffect, useState } from "react";
import { CardProducto } from "./CardProducto";
import type { Producto } from "../types/Producto";
import { apiFetch, getApiBaseUrl } from "../auth";

type ListaProductosProps = {
  restauranteId: number;
  onAgregar?: (producto: Producto) => void;
};

function imagenFallback(producto: Producto): string {
  const nombre = producto.nombre.toLowerCase();
  if (nombre.includes("carne") || nombre.includes("asado") || nombre.includes("res")) {
    return "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400";
  }
  if (nombre.includes("jugo") || nombre.includes("bebida") || nombre.includes("agua")) {
    return "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400";
  }
  if (producto.categoriaId === 2) {
    return "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400";
  }
  return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
}

function ListaProductos({
  restauranteId,
  onAgregar,
}: ListaProductosProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setCargando(true);
    setError(false);

    apiFetch(
      `${getApiBaseUrl()}/api/productos?restauranteId=${restauranteId}`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Error al cargar productos");
        }

        return response.json();
      })
      .then((data: Producto[]) => {
        setProductos(data.map((producto) => ({
          ...producto,
          imagenUrl: producto.imagenUrl || imagenFallback(producto),
        })));
        setCargando(false);
      })
      .catch(() => {
        setError(true);
        setCargando(false);
      });
  }, [restauranteId]);

  if (cargando) {
    return (
      <p style={{ color: "#557571" }}>
        Cargando menú de la cafetería...
      </p>
    );
  }

  if (error) {
    return <p>No se pudieron cargar los productos.</p>;
  }

  if (productos.length === 0) {
    return (
      <div
        style={{
          padding: "36px 20px",
          backgroundColor: "#fff",
          borderRadius: "14px",
          textAlign: "center",
          border: "1px dashed #b2ded6",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            color: "#0f3d3e",
          }}
        >
          Sin productos en este momento
        </h3>

        <p
          style={{
            color: "#557571",
            margin: 0,
            fontSize: "0.95rem",
          }}
        >
          Esta cafetería aún no tiene productos registrados en su carta.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "20px",
        maxHeight: "600px",
        overflowY: "auto",
        padding: "8px",
      }}
    >
      {productos.map((producto) => (
        <CardProducto
          key={producto.id}
          producto={producto}
          onAgregar={onAgregar}
        />
      ))}
    </div>
  );
}

export default ListaProductos;