import { useCart } from '../context/useCart'
import { useNavigate } from 'react-router-dom'
import './ResumenPedido.css'

function obtenerSugerencias(producto: { nombre: string; descripcion?: string }): string[] {
  const texto = `${producto.nombre} ${producto.descripcion ?? ''}`.toLocaleLowerCase('es-CO')

  if (texto.includes('jugo') || texto.includes('limonada')) {
    return ['Sin azúcar', 'Sin hielo']
  }
  if (texto.includes('café') || texto.includes('cafe') || texto.includes('latte') || texto.includes('capuchino') || texto.includes('capuccino')) {
    return ['Sin azúcar', 'Sin leche']
  }
  if (texto.includes('sándwich') || texto.includes('sandwich') || texto.includes('hamburguesa') || texto.includes('perro caliente')) {
    return ['Sin queso', 'Sin tomate', 'Sin cebolla', 'Sin salsas', 'Sin lechuga']
  }
  if (texto.includes('ejecutivo') || texto.includes('almuerzo') || texto.includes('carne') || texto.includes('pollo')) {
    const opciones = ['Sin arroz', 'Sin ensalada', 'Sin papas']
    if (texto.includes('queso')) opciones.push('Sin queso')
    if (texto.includes('salsa')) opciones.push('Sin salsas')
    return opciones
  }
  return []
}
const precioCOP = (valor: number) => `$${valor.toLocaleString('es-CO')}`

function ResumenPedido({
  checkoutLabel = 'Confirmar pedido',
  checkoutPath = '/cliente',
}: {
  checkoutLabel?: string
  checkoutPath?: string
}) {
  const { items, totalItems, total, cartError, agregarProducto, quitarProducto, eliminarProducto, actualizarObservaciones, vaciarCarrito } = useCart()
  const navigate = useNavigate()

  const cambiarSugerencia = (cartKey: string, observaciones: string, sugerencia: string, marcada: boolean) => {
    const actuales = observaciones.split(',').map((item) => item.trim()).filter(Boolean)
    const actualizadas = marcada
      ? [...new Set([...actuales, sugerencia])]
      : actuales.filter((item) => item !== sugerencia)
    actualizarObservaciones(cartKey, actualizadas.join(', '))
  }

  return (
    <aside className="order-summary" aria-label="Resumen del pedido">
      <div className="order-summary__heading">
        <div><p className="eyebrow">Tu pedido</p><h2>Resumen</h2></div>
        <span className="order-badge">{totalItems}</span>
      </div>
      {cartError && <p className="cart-error" role="alert">{cartError}</p>}
      {items.length === 0 ? (
        <div className="empty-order">
          <strong>Tu pedido está vacío</strong>
          <p>Explora una cafetería y agrega tus productos favoritos para comenzar.</p>
          <button type="button" onClick={() => navigate('/')}>Explorar cafeterías</button>
        </div>
      ) : (
        <>
          <div className="order-items">
            {items.map((item) => {
              const extrasTotal = (item.adiciones ?? []).reduce((sum, extra) => sum + Number(extra.precio), 0)
              const precioUnidad = Number(item.precio) + extrasTotal
              const sugerenciasMarcadas = item.observaciones.split(',').map((value) => value.trim()).filter(Boolean)
              const sugerenciasDisponibles = obtenerSugerencias(item)
              return (
                <div className="order-item" key={item.cartKey}>
                  <div className="order-item__main">
                    <img className="order-item__image" src={item.imagenUrl} alt="" />
                    <div className="order-item__details">
                      <div className="order-item__title-row">
                        <strong>{item.nombre}</strong>
                        <span>{precioCOP(precioUnidad * item.cantidad)}</span>
                      </div>
                      <span className="order-item__unit-price">{precioCOP(Number(item.precio))} base · {precioCOP(precioUnidad)} por unidad</span>
                    </div>
                  </div>
                  {(item.adiciones ?? []).length > 0 && (
                    <div className="order-item__extras">
                      <span>Extras seleccionados</span>
                      {item.adiciones?.map((extra) => (
                        <div key={extra.id}><span>{extra.nombre}</span><strong>+{precioCOP(Number(extra.precio))}</strong></div>
                      ))}
                    </div>
                  )}
                  <div className="quantity-controls">
                    <button type="button" aria-label={`Quitar una unidad de ${item.nombre}`} onClick={() => quitarProducto(item.cartKey)}>−</button>
                    <span>{item.cantidad}</span>
                    <button type="button" aria-label={`Agregar una unidad de ${item.nombre}`} onClick={() => agregarProducto(item)}>+</button>
                    <button className="remove-item" type="button" aria-label={`Eliminar ${item.nombre}`} onClick={() => eliminarProducto(item.cartKey)}>Eliminar</button>
                  </div>
                  {sugerenciasDisponibles.length > 0 && <fieldset className="order-item__suggestions">
                    <legend>Personaliza tu producto</legend>
                    <p>Marca si quieres retirar algún ingrediente.</p>
                    <div className="suggestion-options">
                      {sugerenciasDisponibles.map((sugerencia) => (
                        <label key={sugerencia}>
                          <input
                            type="checkbox"
                            checked={sugerenciasMarcadas.includes(sugerencia)}
                            onChange={(event) => cambiarSugerencia(item.cartKey, item.observaciones, sugerencia, event.target.checked)}
                          />
                          <span>{sugerencia}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>}
                </div>
              )
            })}
          </div>
          <div className="order-total"><span>Total</span><strong>{precioCOP(total)}</strong></div>
        </>
      )}
      <div className="order-actions">
        {items.length > 0 && <button type="button" className="checkout-button" onClick={() => navigate(checkoutPath)}>{checkoutLabel}</button>}
        {items.length > 0 && <button type="button" className="clear-button" onClick={vaciarCarrito}>Vaciar carrito</button>}
      </div>
    </aside>
  )
}

export default ResumenPedido
