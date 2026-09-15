import { useEffect, useState } from "react";
import { CardProducto } from "./CardProducto";
import type { Producto } from "../types/Producto";
import { apiFetch, getApiBaseUrl } from "../auth";

type ListaProductosProps = {
  restauranteId: number;
  onAgregar?: (producto: Producto) => void;
};

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
        setProductos(data);
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