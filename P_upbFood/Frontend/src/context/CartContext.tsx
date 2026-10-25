import { createContext, useMemo, useState, type ReactNode } from 'react'
import type { IngredienteExtra } from '../types/Producto'

export type CartProduct = {
  id: number
  nombre: string
  descripcion?: string
  precio: number | string
  restauranteId: number
  tiempoEstimadoMin?: number
  imagenUrl?: string
  adiciones?: IngredienteExtra[]
}

export type CartItem = CartProduct & {
  cantidad: number
  observaciones: string
  cartKey: string
}

type CartContextValue = {
  items: CartItem[]
  totalItems: number
  total: number
  cartError: string
  agregarProducto: (product: CartProduct) => void
  quitarProducto: (cartKey: string) => void
  eliminarProducto: (cartKey: string) => void
  actualizarObservaciones: (cartKey: string, observaciones: string) => void
  vaciarCarrito: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

function getCartKey(product: CartProduct) {
  const extras = (product.adiciones ?? []).map((extra) => Number(extra.id)).sort((a, b) => a - b)
  return `${product.id}:${extras.join(',')}`
}

function getUnitTotal(item: CartProduct) {
  return Number(item.precio) + (item.adiciones ?? []).reduce((sum, extra) => sum + Number(extra.precio), 0)
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [cartError, setCartError] = useState('')

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0)
    const total = items.reduce((sum, item) => sum + getUnitTotal(item) * item.cantidad, 0)

    return {
      items,
      totalItems,
      total,
      cartError,
      agregarProducto: (product) => {
        if (items.length > 0 && items.some((item) => item.restauranteId !== product.restauranteId)) {
          setCartError('Tu pedido solo puede incluir productos de una cafetería.')
          return
        }

        setCartError('')
        const cartKey = getCartKey(product)
        setItems((current) => {
          const existing = current.find((item) => item.cartKey === cartKey)
          if (existing) {
            return current.map((item) => item.cartKey === cartKey ? { ...item, cantidad: item.cantidad + 1 } : item)
          }
          return [...current, { ...product, adiciones: product.adiciones ?? [], cantidad: 1, observaciones: '', cartKey }]
        })
      },
      actualizarObservaciones: (cartKey, observaciones) => setItems((current) => current.map((item) => (
        item.cartKey === cartKey ? { ...item, observaciones } : item
      ))),
      quitarProducto: (cartKey) => {
        setItems((current) => current.flatMap((item) => {
          if (item.cartKey !== cartKey) return [item]
          return item.cantidad > 1 ? [{ ...item, cantidad: item.cantidad - 1 }] : []
        }))
      },
      eliminarProducto: (cartKey) => setItems((current) => current.filter((item) => item.cartKey !== cartKey)),
      vaciarCarrito: () => {
        setItems([])
        setCartError('')
      },
    }
  }, [cartError, items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export { CartContext }
