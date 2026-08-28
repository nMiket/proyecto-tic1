import { useEffect, useState } from "react";
import CardRestaurante, { type Restaurante } from "./CardRestaurante";
import "./ListaRestaurantes.css";

function ListaRestaurantes() {
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
      .then((data) => {
        setRestaurantes(data);
        setCargando(false);
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
      <h2>Restaurantes y cafeterías</h2>

      <div className="restaurantes-container">
        {restaurantes.map((restaurante) => (
          <CardRestaurante key={restaurante.id} restaurante={restaurante} />
        ))}
      </div>
    </section>
  );
}

export default ListaRestaurantes;
