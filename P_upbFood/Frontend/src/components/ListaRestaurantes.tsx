import { useEffect, useState } from "react";
import "./ListaRestaurantes.css";

interface Restaurante {
  id: number;
  nombre: string;
  ubicacion: string;
  estado: string;
  tiempoEstimadoMin: number;
}

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
      .catch((error) => {
        console.error("Error al obtener los restaurantes:", error);
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
          <div className="restaurante-card" key={restaurante.id}>
            <h3>{restaurante.nombre}</h3>

            <p>
              <strong>Ubicación:</strong> {restaurante.ubicacion}
            </p>

            <p>
              <strong>Estado:</strong>{" "}
              <span className={restaurante.estado === "Abierto" ? "estado-abierto" : "estado-cerrado"}>
                {restaurante.estado}
              </span>
            </p>

            <p>
              <strong>Tiempo estimado:</strong>{" "}
              {restaurante.tiempoEstimadoMin} minutos
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ListaRestaurantes;
