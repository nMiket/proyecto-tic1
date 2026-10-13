import { useEffect, useState } from "react";
import CardRestaurante, { type Restaurante } from "./CardRestaurante";
import { apiFetch, getApiBaseUrl } from "../auth";
import "./ListaRestaurantes.css";

type ListaRestaurantesProps = {
  restauranteSeleccionadoId?: number;
  onSelectRestaurante?: (restaurante: Restaurante) => void;
};

function ListaRestaurantes({ restauranteSeleccionadoId, onSelectRestaurante }: ListaRestaurantesProps) {
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    apiFetch(`${getApiBaseUrl()}/api/restaurantes`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Error en la respuesta del servidor");
        }

        return response.json();
      })
      .then((data: Restaurante[]) => {
        setRestaurantes(data);
        setCargando(false);
      })
      .catch(() => {
        setError(true);
        setCargando(false);
      });
  }, [restauranteSeleccionadoId]);

  if (cargando) {
    return <p>Cargando restaurantes...</p>;
  }

  if (error) {
    return <p>No se pudieron cargar los restaurantes.</p>;
  }

  const restaurantesVisibles = [...restaurantes]
    .filter((restaurante) => {
      const texto = `${restaurante.nombre} ${restaurante.ubicacion} ${restaurante.estado}`.toLowerCase();
      return texto.includes(busqueda.trim().toLowerCase());
    })
    .sort((a, b) => {
      if (a.id === restauranteSeleccionadoId) return -1;
      if (b.id === restauranteSeleccionadoId) return 1;
      return a.nombre.localeCompare(b.nombre, 'es');
    });

  return (
    <section className="lista-restaurantes">
      <div className="restaurant-directory-heading">
        <div>
          <p className="section-kicker">Explora el campus</p>
          <h2>¿Dónde quieres comer?</h2>
          <span>Elige una cafetería para descubrir su menú.</span>
        </div>

        <label className="restaurant-search">
          <span>Buscar cafetería</span>
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Nombre o ubicación"
            aria-label="Buscar cafetería por nombre o ubicación"
          />
        </label>
      </div>

      <div className="restaurant-directory-meta">
        <span>{restaurantesVisibles.length} opciones disponibles</span>
        {busqueda && <button type="button" onClick={() => setBusqueda('')}>Limpiar búsqueda</button>}
      </div>

      <div className="restaurantes-container">
        {restaurantesVisibles.length === 0 ? (
          <p className="restaurant-empty">No encontramos cafeterías con esa búsqueda.</p>
        ) : restaurantesVisibles.map((restaurante) => (
          <CardRestaurante 
            key={restaurante.id} 
            restaurante={restaurante} 
            seleccionado={restaurante.id === restauranteSeleccionadoId}
            onClick={() => onSelectRestaurante && onSelectRestaurante(restaurante)}
          />
        ))}
      </div>
    </section>
    );
}

export default ListaRestaurantes;
