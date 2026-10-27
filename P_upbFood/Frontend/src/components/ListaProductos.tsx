import { useEffect, useState } from "react";
import { CardProducto } from "./CardProducto";
import type { Producto } from "../types/Producto";
import { apiFetch, getApiBaseUrl } from "../auth";
import { getProductFallbackImage } from "../utils/formatters";

type ListaProductosProps = {
  restauranteId: number;
  onAgregar?: (producto: Producto) => void;
  mostrarBuscador?: boolean;
};

function ListaProductos({
  restauranteId,
  onAgregar,
  mostrarBuscador = false,
}: ListaProductosProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [busqueda, setBusqueda] = useState('');

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
          imagenUrl: producto.imagenUrl || getProductFallbackImage(producto.categoriaId, producto.nombre),
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

  const productosVisibles = productos.filter((producto) => {
    const texto = `${producto.nombre} ${producto.descripcion}`.toLowerCase();
    return texto.includes(busqueda.trim().toLowerCase());
  });

  return (
    <div className="product-catalog">
      {mostrarBuscador && (
        <label className="product-search">
          <span>Buscar en el menú</span>
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Busca un plato, bebida o extra"
          />
        </label>
      )}

      <div
        className="product-catalog__grid"
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
      {productosVisibles.map((producto) => (
        <CardProducto
          key={producto.id}
          producto={producto}
          onAgregar={onAgregar}
        />
      ))}
      {productosVisibles.length === 0 && (
        <p className="product-search__empty">No encontramos productos con esa búsqueda.</p>
      )}
      </div>
    </div>
  );
}

export default ListaProductos;
