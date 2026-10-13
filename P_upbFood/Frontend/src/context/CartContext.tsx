import { createContext, useMemo, useState, type ReactNode } from 'react'

export type CartProduct = {
  id: number
  nombre: string
  precio: number | string
  restauranteId: number
  imagenUrl?: string
}

export type CartItem = CartProduct & {
  cantidad: number
  observaciones: string
}

type CartContextValue = {
  items: CartItem[]
  totalItems: number
  total: number
  cartError: string
  agregarProducto: (product: CartProduct) => void
  quitarProducto: (productId: number) => void
  eliminarProducto: (productId: number) => void
  actualizarObservaciones: (productId: number, observaciones: string) => void
  vaciarCarrito: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [cartError, setCartError] = useState('')

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0)
    const total = items.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0)

    return {
      items,
      totalItems,
      total,
      cartError,
      agregarProducto: (product) => {
        if (
          items.length > 0 &&
          items.some((item) => item.restauranteId !== product.restauranteId)
        ) {
          setCartError('Tu pedido solo puede incluir productos de una cafetería.')
          return
        }

        setCartError('')
        setItems((current) => {
          const existing = current.find((item) => item.id === product.id)
          if (existing) {
            return current.map((item) => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item)
          }
          return [...current, { ...product, cantidad: 1, observaciones: '' }]
        })
      },
        actualizarObservaciones: (productId, observaciones) => setItems((current) => current.map((item) => (
          item.id === productId ? { ...item, observaciones } : item
        ))),
      quitarProducto: (productId) => {
        setItems((current) => current.flatMap((item) => {
          if (item.id !== productId) return [item]
          return item.cantidad > 1 ? [{ ...item, cantidad: item.cantidad - 1 }] : []
        }))
      },
      eliminarProducto: (productId) => setItems((current) => current.filter((item) => item.id !== productId)),
      vaciarCarrito: () => {
        setItems([])
        setCartError('')
      },
    }
  }, [cartError, items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export { CartContext }
