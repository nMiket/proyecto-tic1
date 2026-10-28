import { useEffect, useState } from 'react'
import { useCart } from '../context/useCart'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiFetch, getApiBaseUrl } from '../auth'
import './ResumenPedido.css'

function obtenerSugerencias(producto: { nombre: string; descripcion?: string }): string[] {
  const texto = `${producto.nombre} ${producto.descripcion ?? ''}`.toLocaleLowerCase('es-CO')

  if (texto.includes('jugo') || texto.includes('limonada')) {
    return ['Sin azúcar', 'Sin hielo', 'Poca azúcar']
  }
  if (
    texto.includes('café') ||
    texto.includes('cafe') ||
    texto.includes('latte') ||
    texto.includes('capuchino') ||
    texto.includes('capuccino')
  ) {
    return ['Sin azúcar', 'Leche deslactosada', 'Bien caliente']
  }
  if (
    texto.includes('sándwich') ||
    texto.includes('sandwich') ||
    texto.includes('hamburguesa') ||
    texto.includes('perro caliente')
  ) {
    return ['Sin queso', 'Sin tomate', 'Sin cebolla', 'Sin salsas', 'Sin lechuga']
  }
  if (
    texto.includes('ejecutivo') ||
    texto.includes('almuerzo') ||
    texto.includes('carne') ||
    texto.includes('pollo')
  ) {
    const opciones = ['Sin arroz', 'Sin ensalada', 'Sin papas', 'Salsas aparte']
    if (texto.includes('queso')) opciones.push('Sin queso')
    return opciones
  }
  return ['Para llevar', 'Sin salsas', 'Servilletas extra']
}

const precioCOP = (valor: number) => `$${valor.toLocaleString('es-CO')}`

function separarObservaciones(observaciones: string, sugerenciasDisponibles: string[]) {
  const partes = observaciones
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const marcadas = partes.filter((p) => sugerenciasDisponibles.includes(p))
  const libres = partes.filter((p) => !sugerenciasDisponibles.includes(p))
  return {
    marcadas,
    notaLibre: libres.join(', '),
  }
}

function combinarObservaciones(marcadas: string[], notaLibre: string): string {
  const limpia = notaLibre.trim()
  const todas = [...marcadas, ...(limpia ? [limpia] : [])]
  return todas.join(', ')
}

function ResumenPedido({
  checkoutLabel = 'Confirmar pedido',
  checkoutPath = '/cliente',
}: {
  checkoutLabel?: string
  checkoutPath?: string
}) {
  const {
    items,
    totalItems,
    total,
    cartError,
    agregarProducto,
    quitarProducto,
    eliminarProducto,
    actualizarObservaciones,
    actualizarAdiciones,
    vaciarCarrito,
  } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const enVistaPedido = location.pathname === '/pedido'

  const tiempoEstimadoMin =
    items.length > 0 ? Math.max(15, ...items.map((item) => item.tiempoEstimadoMin || 15)) : 15
  const restauranteActivoId = items[0]?.restauranteId
  const [estadoCerrada, setCafeteriaCerrada] = useState(false)
  const cafeteriaCerrada = Boolean(restauranteActivoId) && estadoCerrada

  useEffect(() => {
    if (!restauranteActivoId) return
    let cancelled = false
    void apiFetch(`${getApiBaseUrl()}/api/restaurantes`)
      .then((res) => (res.ok ? (res.json() as Promise<Array<{ id: number; estado?: string }>>) : []))
      .then((lista) => {
        if (cancelled) return
        const actual = lista.find((r) => Number(r.id) === Number(restauranteActivoId))
        setCafeteriaCerrada(actual?.estado?.trim().toLowerCase() === 'cerrado')
      })
      .catch(() => {
        if (!cancelled) setCafeteriaCerrada(false)
      })
    return () => {
      cancelled = true
    }
  }, [restauranteActivoId, location.pathname])

  const subtotalBase = items.reduce(
    (acc, item) => acc + Number(item.precio) * item.cantidad,
    0,
  )
  const totalExtras = items.reduce((acc, item) => {
    const extrasUnit = (item.adiciones ?? []).reduce((s, extra) => s + Number(extra.precio), 0)
    return acc + extrasUnit * item.cantidad
  }, 0)

  const cambiarSugerencia = (
    cartKey: string,
    observaciones: string,
    sugerenciasDisponibles: string[],
    sugerencia: string,
    marcada: boolean,
  ) => {
    const { marcadas, notaLibre } = separarObservaciones(observaciones, sugerenciasDisponibles)
    const nuevasMarcadas = marcada
      ? [...new Set([...marcadas, sugerencia])]
      : marcadas.filter((item) => item !== sugerencia)
    actualizarObservaciones(cartKey, combinarObservaciones(nuevasMarcadas, notaLibre))
  }

  const cambiarNotaLibre = (
    cartKey: string,
    observaciones: string,
    sugerenciasDisponibles: string[],
    nuevaNota: string,
  ) => {
    const { marcadas } = separarObservaciones(observaciones, sugerenciasDisponibles)
    actualizarObservaciones(cartKey, combinarObservaciones(marcadas, nuevaNota))
  }

  return (
    <aside
      className={`order-summary ${enVistaPedido ? 'order-summary--expanded' : ''}`}
      aria-label="Resumen del pedido"
    >
      <div className="order-summary__heading">
        <div>
          <p className="eyebrow">Tu pedido</p>
          <h2>Resumen</h2>
          {items.length > 0 && (
            <p className="order-summary__sub">
              Preparación estimada: {tiempoEstimadoMin} min
            </p>
          )}
        </div>
        <span className="order-badge">{totalItems}</span>
      </div>

      {enVistaPedido && restauranteActivoId && (
        <div className="order-summary__QuickBar">
          <span>¿Quieres agregar otro producto de esta cafetería?</span>
          <button
            type="button"
            className="order-summary__add-more"
            onClick={() => navigate(`/restaurante/${restauranteActivoId}`)}
          >
            Agregar más productos
          </button>
        </div>
      )}

      {cartError && (
        <p className="cart-error" role="alert">
          {cartError}
        </p>
      )}

      {cafeteriaCerrada && items.length > 0 && (
        <p className="cart-error" role="alert">
          Esta cafetería se encuentra cerrada en este momento. No es posible confirmar el pedido hasta que vuelva a abrir.
        </p>
      )}

      {items.length === 0 ? (
        <div className="empty-order">
          <strong>Tu pedido está vacío</strong>
          <p>
            Explora una cafetería y agrega tus productos favoritos para comenzar.
          </p>
          <button type="button" onClick={() => navigate('/')}>
            Explorar cafeterías
          </button>
        </div>
      ) : (
        <>
          <div className="order-items">
            {items.map((item) => {
              const extrasTotal = (item.adiciones ?? []).reduce(
                (sum, extra) => sum + Number(extra.precio),
                0,
              )
              const precioUnidad = Number(item.precio) + extrasTotal
              const sugerenciasDisponibles = obtenerSugerencias(item)
              const { marcadas: sugerenciasMarcadas, notaLibre } = separarObservaciones(
                item.observaciones,
                sugerenciasDisponibles,
              )

              return (
                <div className="order-item" key={item.cartKey}>
                  <div className="order-item__main">
                    <img className="order-item__image" src={item.imagenUrl} alt="" />
                    <div className="order-item__details">
                      <div className="order-item__title-row">
                        <strong>{item.nombre}</strong>
                        <span>{precioCOP(precioUnidad * item.cantidad)}</span>
                      </div>
                      <span className="order-item__unit-price">
                        {precioCOP(Number(item.precio))} base · {precioCOP(precioUnidad)} por unidad
                      </span>
                    </div>
                  </div>

                  {(item.ingredientesExtra ?? []).length > 0 ? (
                    <fieldset className="order-item__suggestions order-item__extras-editor">
                      <legend>Ingredientes extra</legend>
                      <p>Agrega o quita adiciones sin volver a la carta. Se cobran por cada unidad.</p>
                      <div className="suggestion-options">
                        {item.ingredientesExtra?.map((extra) => {
                          const seleccionado = (item.adiciones ?? []).some(
                            (actual) => Number(actual.id) === Number(extra.id),
                          )
                          return (
                            <label key={extra.id}>
                              <input
                                type="checkbox"
                                checked={seleccionado}
                                onChange={(event) => {
                                  const actuales = item.adiciones ?? []
                                  const nuevas = event.target.checked
                                    ? [...actuales, extra]
                                    : actuales.filter((actual) => Number(actual.id) !== Number(extra.id))
                                  actualizarAdiciones(item.cartKey, nuevas)
                                }}
                              />
                              <span>
                                {extra.nombre} <strong>+{precioCOP(Number(extra.precio))}</strong>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>
                  ) : (item.adiciones ?? []).length > 0 && (
                    <div className="order-item__extras">
                      <span>Extras seleccionados</span>
                      {item.adiciones?.map((extra) => (
                        <div key={extra.id}>
                          <span>{extra.nombre}</span>
                          <strong>+{precioCOP(Number(extra.precio))}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="quantity-controls">
                    <button
                      type="button"
                      aria-label={`Quitar una unidad de ${item.nombre}`}
                      onClick={() => quitarProducto(item.cartKey)}
                    >
                      −
                    </button>
                    <span>{item.cantidad}</span>
                    <button
                      type="button"
                      aria-label={`Agregar una unidad de ${item.nombre}`}
                      onClick={() => agregarProducto(item)}
                    >
                      +
                    </button>
                    <button
                      className="remove-item"
                      type="button"
                      aria-label={`Eliminar ${item.nombre}`}
                      onClick={() => eliminarProducto(item.cartKey)}
                    >
                      Eliminar
                    </button>
                  </div>

                  {sugerenciasDisponibles.length > 0 && (
                    <fieldset className="order-item__suggestions">
                      <legend>Personaliza tu producto</legend>
                      <p>Marca si quieres retirar o ajustar algún ingrediente.</p>
                      <div className="suggestion-options">
                        {sugerenciasDisponibles.map((sugerencia) => (
                          <label key={sugerencia}>
                            <input
                              type="checkbox"
                              checked={sugerenciasMarcadas.includes(sugerencia)}
                              onChange={(event) =>
                                cambiarSugerencia(
                                  item.cartKey,
                                  item.observaciones,
                                  sugerenciasDisponibles,
                                  sugerencia,
                                  event.target.checked,
                                )
                              }
                            />
                            <span>{sugerencia}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  <label className="order-item__notes">
                    <span>Nota para cocina (opcional)</span>
                    <textarea
                      rows={2}
                      value={notaLibre}
                      onChange={(event) =>
                        cambiarNotaLibre(
                          item.cartKey,
                          item.observaciones,
                          sugerenciasDisponibles,
                          event.target.value,
                        )
                      }
                      placeholder="Ej. Salsas aparte, bien caliente, empacar para llevar..."
                      maxLength={160}
                    />
                  </label>
                </div>
              )
            })}
          </div>

          <div className="order-breakdown">
            <div className="order-breakdown__row">
              <span>Productos ({totalItems})</span>
              <strong>{precioCOP(subtotalBase)}</strong>
            </div>
            {totalExtras > 0 && (
              <div className="order-breakdown__row">
                <span>Adiciones</span>
                <strong>+{precioCOP(totalExtras)}</strong>
              </div>
            )}
            <div className="order-total">
              <span>Total</span>
              <strong>{precioCOP(total)}</strong>
            </div>
          </div>
        </>
      )}

      <div className="order-actions">
        {items.length > 0 && (
          <button
            type="button"
            className="checkout-button"
            disabled={cafeteriaCerrada}
            onClick={() => !cafeteriaCerrada && navigate(checkoutPath)}
          >
            {cafeteriaCerrada ? 'Cafetería cerrada' : checkoutLabel}
          </button>
        )}
        {items.length > 0 && (
          <button type="button" className="clear-button" onClick={vaciarCarrito}>
            Vaciar carrito
          </button>
        )}
      </div>
    </aside>
  )
}

export default ResumenPedido
