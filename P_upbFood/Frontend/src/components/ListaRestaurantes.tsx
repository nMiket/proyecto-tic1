import { useEffect, useState } from "react";
import CardRestaurante, { type Restaurante } from "./CardRestaurante";
import "./ListaRestaurantes.css";

type ListaRestaurantesProps = {
  restauranteSeleccionadoId?: number;
  onSelectRestaurante?: (restaurante: Restaurante) => void;
};

function ListaRestaurantes({ restauranteSeleccionadoId, onSelectRestaurante }: ListaRestaurantesProps) {
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8080/api/restaurantes")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Error en la respuesta del servidor");
        }

        return response.json();
      })
      .then((data: Restaurante[]) => {
        setRestaurantes(data);
        setCargando(false);
        if (data.length > 0 && onSelectRestaurante && !restauranteSeleccionadoId) {
          onSelectRestaurante(data[0]);
        }
      })
      .catch(() => {
        setError(true);
        setCargando(false);
      });
  }, []);

  if (cargando) {
    return <p>Cargando restaurantes...</p>;
  }

  if (error) {
    return <p>No se pudieron cargar los restaurantes.</p>;
  }

  return (
    <section className="lista-restaurantes">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Restaurantes y cafeterías</h2>
        <span style={{ fontSize: '0.85rem', color: '#557571' }}>Selecciona una cafetería para ver su menú</span>
      </div>

      <div className="restaurantes-container">
        {restaurantes.map((restaurante) => (
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
