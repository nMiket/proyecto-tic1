export function formatCOP(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '$0'
  return `$${amount.toLocaleString('es-CO')}`
}

export function formatDateTime(value?: string | null): string {
  if (!value) return 'Sin fecha'
  const fecha = new Date(value)
  if (Number.isNaN(fecha.getTime())) return value
  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getProductFallbackImage(categoriaId?: number, nombre?: string): string {
  const n = (nombre ?? '').toLowerCase()
  if (n.includes('empanada')) return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400'
  if (n.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400'
  if (n.includes('perro') || n.includes('hot dog')) return 'https://images.unsplash.com/photo-1599599811450-2c59409af2c0?w=400'
  if (n.includes('gatorade') || n.includes('energ') || n.includes('sport')) return 'https://images.unsplash.com/photo-1525397053281-a37d8a2ff7ce?w=400'
  if (n.includes('jugo') || n.includes('bebida') || n.includes('gaseosa') || n.includes('agua')) return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400'
  if (n.includes('cafe') || n.includes('café') || n.includes('cappuccino') || n.includes('latte')) return 'https://images.unsplash.com/photo-1572442388796-11668ba67e53?w=400'
  if (n.includes('asado') || n.includes('res') || n.includes('carne') || n.includes('parrilla') || n.includes('cerdo') || n.includes('chuleta') || n.includes('bbq') || n.includes('costilla')) return 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400'
  if (n.includes('almuerzo') || n.includes('ejecutivo') || n.includes('pollo') || n.includes('pescado')) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'
  if (n.includes('hamburguesa') || n.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400'
  if (n.includes('dedo') || n.includes('queso') || n.includes('pan') || n.includes('sandwich') || n.includes('sándwich')) return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'
  if (n.includes('postre') || n.includes('torta') || n.includes('dulce') || n.includes('brownie')) return 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400'
  if (n.includes('ensalada') || n.includes('saludable') || n.includes('vegetariano')) return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400'
  if (categoriaId === 1) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'
  if (categoriaId === 2) return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400'
  return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400'
}
