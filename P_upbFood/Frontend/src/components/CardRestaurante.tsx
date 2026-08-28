import './CardRestaurante.css'

export type EstadoRestaurante = 'Abierto' | 'Cerrado' | 'Alta demanda'

export interface Restaurante {
  id: number
  nombre: string
  imagen?: string
  ubicacion: string
  estado: EstadoRestaurante
  tiempoEstimadoMin: number
}

type CardRestauranteProps = {
  restaurante: Restaurante
}

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=80'

function CardRestaurante({ restaurante }: CardRestauranteProps) {
  const estadoClass = restaurante.estado.toLowerCase().replace(' ', '-')

  return (
    <article className="restaurant-card">
      <img
        className="restaurant-card__image"
        src={restaurante.imagen || DEFAULT_IMAGE}
        alt={`Imagen de ${restaurante.nombre}`}
      />

      <div className="restaurant-card__content">
        <div className="restaurant-card__heading">
          <h3>{restaurante.nombre}</h3>
          <span className={`restaurant-card__status restaurant-card__status--${estadoClass}`}>
            {restaurante.estado}
          </span>
        </div>

        <p className="restaurant-card__location">{restaurante.ubicacion}</p>
        <p className="restaurant-card__time">
          Tiempo estimado: <strong>{restaurante.tiempoEstimadoMin} min</strong>
        </p>
      </div>
    </article>
  )
}

export default CardRestaurante
