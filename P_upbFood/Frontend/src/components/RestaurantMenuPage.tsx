import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ListaProductos from './ListaProductos'
import ResumenPedido from './ResumenPedido'
import { useCart } from '../context/useCart'
import { apiFetch, getApiBaseUrl } from '../auth'
import './RestaurantMenuPage.css'

type Restaurante = {
  id: number
  nombre: string
  ubicacion: string
  estado?: string
  tiempoEstimadoMin?: number
  imagen?: string
}

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80'

export default function RestaurantMenuPage() {
  const { restauranteId } = useParams()
  const navigate = useNavigate()
  const { agregarProducto } = useCart()
  const [restaurante, setRestaurante] = useState<Restaurante | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const id = Number(restauranteId)

    apiFetch(`${getApiBaseUrl()}/api/restaurantes`)
      .then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar el restaurante')
        return response.json() as Promise<Restaurante[]>
      })
      .then((restaurantes) => {
        const encontrado = restaurantes.find((item) => item.id === id)
        if (!encontrado) throw new Error('Restaurante no encontrado')
        setRestaurante(encontrado)
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false))
  }, [restauranteId])

  if (cargando) return <div className="restaurant-menu-state">Cargando menú...</div>

  if (error || !restaurante) {
    return (
      <div className="restaurant-menu-state">
        <h1>No encontramos este restaurante</h1>
        <button type="button" onClick={() => navigate('/')}>Volver al directorio</button>
      </div>
    )
  }

  return (
    <section className="restaurant-menu-page">
      <button className="restaurant-menu__back" type="button" onClick={() => navigate('/')}>
        Volver a restaurantes
      </button>

      <header className="restaurant-menu__hero">
        <img src={restaurante.imagen || DEFAULT_IMAGE} alt={`Imagen de ${restaurante.nombre}`} />
        <div className="restaurant-menu__hero-content">
          <span className="restaurant-menu__status">{restaurante.estado || 'Disponible'}</span>
          <p className="section-kicker">Menú de la cafetería</p>
          <h1>{restaurante.nombre}</h1>
          <p>{restaurante.ubicacion} · Recogida estimada en {restaurante.tiempoEstimadoMin || 15} minutos</p>
        </div>
      </header>

      <div className="restaurant-menu__layout">
        <div className="restaurant-menu__catalog">
          <div className="restaurant-menu__heading">
            <div>
              <p className="section-kicker">Carta disponible</p>
              <h2>Elige tus productos</h2>
            </div>
            <span>Abre los detalles para elegir ingredientes extra.</span>
          </div>
          <ListaProductos
            restauranteId={restaurante.id}
            mostrarBuscador
            onAgregar={(product) => agregarProducto({
              ...product,
              id: Number(product.id),
              restauranteId: restaurante.id,
              tiempoEstimadoMin: restaurante.tiempoEstimadoMin || 15,
              imagenUrl: product.imagenUrl,
              adiciones: product.adiciones ?? [],
            })}
          />
        </div>

        <ResumenPedido checkoutLabel="Ir al pedido" checkoutPath="/pedido" />
      </div>
    </section>
  )
}
