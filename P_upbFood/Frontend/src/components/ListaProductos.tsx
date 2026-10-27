import { useEffect, useState } from "react";
import { CardProducto } from "./CardProducto";
import type { Producto } from "../types/Producto";
import { apiFetch, getApiBaseUrl } from "../auth";
import { getProductFallbackImage } from "../utils/formatters";

type ListaProductosProps = {
  restauranteId: number;
  onAgregar?: (producto: Producto) => void;
  mostrarBuscador?: boolean;
  cafeteriaCerrada?: boolean;
};

function ListaProductos({
  restauranteId,
  onAgregar,
  mostrarBuscador = false,
  cafeteriaCerrada = false,
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
      <div className="skeleton-grid skeleton-grid--products" role="status" aria-live="polite" aria-label="Cargando carta de productos">
        {[1, 2, 3, 4].map((item) => (
          <div className="skeleton-card" key={item}>
            <div className="skeleton-block skeleton-block--media" />
            <div className="skeleton-block skeleton-block--title" />
            <div className="skeleton-block skeleton-block--line" />
            <div className="skeleton-block skeleton-block--pill" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="product-search__empty">No se pudieron cargar los productos.</p>;
  }

  if (productos.length === 0) {
    return (
      <div className="product-search__empty">
        <strong>Sin productos en este momento</strong>
        <p>Esta cafetería aún no tiene productos registrados en su carta.</p>
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

      <div className="product-catalog__grid">
      {productosVisibles.map((producto) => (
        <CardProducto
          key={producto.id}
          producto={producto}
          onAgregar={onAgregar}
          cafeteriaCerrada={cafeteriaCerrada}
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
