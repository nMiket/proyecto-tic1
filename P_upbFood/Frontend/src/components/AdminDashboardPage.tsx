import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { apiFetch, getApiBaseUrl, type AsignacionRestaurante } from '../auth'
import { formatCOP, formatDateTime as formatOrderDateTime, getProductFallbackImage } from '../utils/formatters'
import './AdminDashboardPage.css'

type RestaurantExtra = {
  id: number
  nombre: string
  precio: number | string
  disponible: boolean
}

type ProductItem = {
  id: number
  nombre: string
  descripcion: string
  precio: number | string
  imagenUrl?: string | null
  disponible: boolean
  categoriaId: number
  restauranteId: number
  ingredientesExtra: RestaurantExtra[]
}

type RestauranteItem = {
  id: number
  nombre: string
  ubicacion: string
  estado?: string
  tiempoEstimadoMin?: number
  imagenUrl?: string
  imagen?: string
}

type AdministradorCocinaItem = {
  administradorId: number
  nombre: string
  telefono: string
  correo: string
  estado: string
}

type ProductoMasVendido = {
  nombre: string
  unidades: number | string
}

type AdminEstadisticas = {
  pedidosActivos: number
  enPreparacion: number
  listos: number
  pedidosHoy: number
  entregadosHoy: number
  canceladosHoy: number
  clientesHoy: number
  ingresosHoy: number | string
  ingresosMes: number | string
  ingresosMesAnterior: number | string
  productosMasVendidos: ProductoMasVendido[]
}

type DetallePedidoItem = {
  detalle_pedido_id?: number
  nombre_producto?: string
  cantidad?: number
  precio_unitario?: number | string
  adiciones?: string | null
  observaciones?: string | null
  subtotal?: number | string
}

type HistorialPedido = {
  id: number
  client?: { nombre: string }
  correoCliente?: string | null
  telefonoCliente?: string | null
  estado: string
  total: number | string
  fechaCreacion?: string
  horaRecogida?: string | null
  details?: DetallePedidoItem[]
}

type FiltroHistorial = 'todos' | 'activos' | 'entregados' | 'cancelados'
type AdminTab = 'estadisticas' | 'historial' | 'menu' | 'personal'

const CATEGORIAS_MENU = [
  { id: '1', nombre: 'Almuerzos' },
  { id: '2', nombre: 'Bebidas' },
  { id: '3', nombre: 'Snacks' },
] as const

const formatMoney = formatCOP

const formatDateTime = formatOrderDateTime

function etiquetaEstado(estado: string): string {
  const etiquetas: Record<string, string> = {
    PAGADO: 'Pagado',
    EN_PREPARACION: 'En preparación',
    LISTO: 'Listo para recoger',
    ENTREGADO: 'Entregado',
    CANCELADO: 'Cancelado',
  }
  return etiquetas[estado] ?? estado.replaceAll('_', ' ')
}

function claseEstado(estado: string): string {
  if (estado === 'ENTREGADO') return 'is-delivered'
  if (estado === 'CANCELADO') return 'is-cancelled'
  if (estado === 'LISTO') return 'is-ready'
  return 'is-active'
}

const getImagenPorCategoria = getProductFallbackImage

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function procesarImagenDesdeArchivo(file: File, maxDimension = 960): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen válido (JPG, PNG, WEBP).'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('El archivo supera el límite de 10 MB.'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'))
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : ''
      const img = new Image()
      img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(rawDataUrl)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = rawDataUrl
    }
    reader.readAsDataURL(file)
  })
}

export default function AdminDashboardPage({
  adminName,
  restauranteId: initialRestauranteId,
  asignaciones,
  onLogout,
}: {
  adminName: string
  restauranteId: number
  asignaciones: AsignacionRestaurante[]
  onLogout: () => void
}) {
  const [selectedRestauranteId, setSelectedRestauranteId] = useState<number>(initialRestauranteId)
  const [activeTab, setActiveTab] = useState<AdminTab>('estadisticas')

  // Catálogo y productos
  const [listaRestaurantes, setListaRestaurantes] = useState<RestauranteItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productImageUrl, setProductImageUrl] = useState('')
  const [categoriaId, setCategoriaId] = useState('1')
  const [disponible, setDisponible] = useState(true)
  const [productError, setProductError] = useState('')
  const [productSuccess, setProductSuccess] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [togglingProductId, setTogglingProductId] = useState<number | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('todas')

  // Ingredientes extra
  const [restaurantExtras, setRestaurantExtras] = useState<RestaurantExtra[]>([])
  const [selectedExtraIds, setSelectedExtraIds] = useState<number[]>([])
  const [newExtraName, setNewExtraName] = useState('')
  const [newExtraPrice, setNewExtraPrice] = useState('')
  const [savingExtra, setSavingExtra] = useState(false)
  const [editingExtraId, setEditingExtraId] = useState<number | null>(null)
  const [editingExtraName, setEditingExtraName] = useState('')
  const [editingExtraPrice, setEditingExtraPrice] = useState('')

  // Estadísticas e historial
  const [estadisticas, setEstadisticas] = useState<AdminEstadisticas | null>(null)
  const [historialPedidos, setHistorialPedidos] = useState<HistorialPedido[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [statsError, setStatsError] = useState('')
  const [filtroHistorial, setFiltroHistorial] = useState<FiltroHistorial>('todos')
  const [busquedaHistorial, setBusquedaHistorial] = useState('')
  const [expandedOrderIds, setExpandedOrderIds] = useState<number[]>([])

  // Personal de cocina
  const [administradoresCocina, setAdministradoresCocina] = useState<AdministradorCocinaItem[]>([])
  const [nombreAdminCocina, setNombreAdminCocina] = useState('')
  const [telefonoAdminCocina, setTelefonoAdminCocina] = useState('')
  const [correoAdminCocina, setCorreoAdminCocina] = useState('')
  const [passwordAdminCocina, setPasswordAdminCocina] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [savingAdmin, setSavingAdmin] = useState(false)
  const [adminCocinaError, setAdminCocinaError] = useState('')
  const [adminCocinaSuccess, setAdminCocinaSuccess] = useState('')

  // Configuración de identidad y control operativo de la cafetería
  const [cafeNombre, setCafeNombre] = useState<string>('')
  const [cafeUbicacion, setCafeUbicacion] = useState<string>('')
  const [cafeImagenUrl, setCafeImagenUrl] = useState<string>('')
  const [cafeEstado, setCafeEstado] = useState<string>('Abierto')
  const [cafeTiempoMin, setCafeTiempoMin] = useState<number>(15)
  const [savingCafeConfig, setSavingCafeConfig] = useState(false)
  const [cafeConfigSuccess, setCafeConfigSuccess] = useState('')
  const [cafeConfigError, setCafeConfigError] = useState('')

  const restauranteSeleccionado = listaRestaurantes.find(
    (r) => Number(r.id) === Number(selectedRestauranteId),
  )

  const asignacionSeleccionada = asignaciones.find(
    (a) => Number(a.restauranteId) === Number(selectedRestauranteId),
  )

  const esDueno = Number(asignacionSeleccionada?.tipoAdministradorId) === 1

  useEffect(() => {
    if (restauranteSeleccionado) {
      setCafeNombre(restauranteSeleccionado.nombre ?? '')
      setCafeUbicacion(restauranteSeleccionado.ubicacion ?? '')
      setCafeImagenUrl(restauranteSeleccionado.imagenUrl ?? restauranteSeleccionado.imagen ?? '')
      setCafeEstado(restauranteSeleccionado.estado ?? 'Abierto')
      setCafeTiempoMin(restauranteSeleccionado.tiempoEstimadoMin ?? 15)
      setCafeConfigSuccess('')
      setCafeConfigError('')
    }
  }, [restauranteSeleccionado])

  const handleGuardarConfigCafeteria = async () => {
    if (!selectedRestauranteId) return
    if (!cafeNombre.trim()) {
      setCafeConfigError('El nombre de la cafetería no puede estar vacío.')
      return
    }
    if (cafeNombre.trim().length > 50) {
      setCafeConfigError('El nombre no puede exceder 50 caracteres.')
      return
    }
    if (!cafeUbicacion.trim()) {
      setCafeConfigError('La ubicación de la cafetería no puede estar vacía.')
      return
    }
    if (cafeUbicacion.trim().length > 50) {
      setCafeConfigError('La ubicación no puede exceder 50 caracteres.')
      return
    }
    if (!Number.isFinite(cafeTiempoMin) || cafeTiempoMin <= 0 || cafeTiempoMin > 240) {
      setCafeConfigError('El tiempo de espera debe ser un número entre 1 y 240 minutos.')
      return
    }
    setSavingCafeConfig(true)
    setCafeConfigSuccess('')
    setCafeConfigError('')

    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/admin/restaurantes/${selectedRestauranteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: cafeNombre.trim(),
            ubicacion: cafeUbicacion.trim(),
            imagenUrl: cafeImagenUrl.trim() || null,
            estado: cafeEstado,
            tiempoEstimadoMin: cafeTiempoMin,
          }),
        },
      )

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          message?: string
          detail?: string
        } | null
        throw new Error(
          errorData?.message ??
            errorData?.detail ??
            'No se pudo actualizar la información de la cafetería.',
        )
      }

      const updated = (await response.json()) as RestauranteItem
      setListaRestaurantes((prev) =>
        prev.map((r) => (r.id === selectedRestauranteId ? { ...r, ...updated } : r)),
      )
      setCafeConfigSuccess('Información de la cafetería y parámetros operativos guardados correctamente.')
    } catch (err) {
      setCafeConfigError(err instanceof Error ? err.message : 'Error al guardar configuración.')
    } finally {
      setSavingCafeConfig(false)
    }
  }

  const resetProductForm = () => {
    setProductName('')
    setProductDescription('')
    setProductPrice('')
    setProductImageUrl('')
    setCategoriaId('1')
    setDisponible(true)
    setEditingProductId(null)
    setSelectedExtraIds([])
  }

  // Consulta los restaurantes autorizados para el administrador
  useEffect(() => {
    let cancelled = false
    const idsAutorizados = new Set(
      asignaciones
        .filter((a) => Number(a.restauranteId) > 0)
        .map((a) => Number(a.restauranteId)),
    )

    apiFetch(`${getApiBaseUrl()}/api/admin/restaurantes`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('No se pudieron consultar los restaurantes asignados.')
        }
        return (await res.json()) as RestauranteItem[]
      })
      .then((data) => {
        if (cancelled) return
        const permitidos = data.filter((r) => idsAutorizados.has(Number(r.id)))
        setListaRestaurantes(permitidos)

        if (permitidos.some((r) => Number(r.id) === Number(initialRestauranteId))) {
          setSelectedRestauranteId(initialRestauranteId)
        } else if (permitidos.length > 0) {
          setSelectedRestauranteId(permitidos[0].id)
        } else {
          setProductError('Tu cuenta no tiene restaurantes asignados activos.')
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Error al consultar restaurantes:', error)
          setProductError('No se pudieron consultar los restaurantes asignados.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [asignaciones, initialRestauranteId])

  // Carga los productos de la cafetería seleccionada
  const fetchProducts = useCallback(async () => {
    if (!selectedRestauranteId) return
    startTransition(() => setLoadingProducts(true))
    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/productos/admin?restauranteId=${selectedRestauranteId}`,
      )
      if (!response.ok) {
        throw new Error('No se pudo cargar el menú.')
      }
      const data = (await response.json()) as ProductItem[]
      setProducts(
        data.filter(
          (product) => Number(product.restauranteId) === Number(selectedRestauranteId),
        ),
      )
      setProductError('')
    } catch (error) {
      console.error('Error al cargar productos:', error)
      setProductError('No se pudo cargar el catálogo de productos.')
    } finally {
      setLoadingProducts(false)
    }
  }, [selectedRestauranteId])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  // Carga extras de la cafetería
  const fetchRestaurantExtras = useCallback(async () => {
    if (!selectedRestauranteId) return
    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/productos/extras?restauranteId=${selectedRestauranteId}`,
      )
      if (!response.ok) throw new Error('No se pudieron cargar los ingredientes extra.')
      setRestaurantExtras((await response.json()) as RestaurantExtra[])
    } catch (error) {
      console.error('Error al cargar ingredientes extra:', error)
    }
  }, [selectedRestauranteId])

  useEffect(() => {
    void fetchRestaurantExtras()
  }, [fetchRestaurantExtras])

  // Carga estadísticas e historial
  const fetchEstadisticas = useCallback(async () => {
    if (!selectedRestauranteId) return
    setLoadingStats(true)
    setStatsError('')

    try {
      const [statsResponse, historyResponse] = await Promise.all([
        apiFetch(
          `${getApiBaseUrl()}/api/admin/pedidos/estadisticas?restauranteId=${selectedRestauranteId}`,
        ),
        apiFetch(
          `${getApiBaseUrl()}/api/admin/pedidos/historial?restauranteId=${selectedRestauranteId}`,
        ),
      ])

      if (!statsResponse.ok || !historyResponse.ok) {
        throw new Error('No se pudieron cargar las métricas de esta cafetería.')
      }

      setEstadisticas((await statsResponse.json()) as AdminEstadisticas)
      setHistorialPedidos((await historyResponse.json()) as HistorialPedido[])
    } catch (error) {
      console.error('Error al cargar estadísticas administrativas:', error)
      setEstadisticas(null)
      setHistorialPedidos([])
      setStatsError('No se pudieron cargar las estadísticas de esta cafetería.')
    } finally {
      setLoadingStats(false)
    }
  }, [selectedRestauranteId])

  useEffect(() => {
    void fetchEstadisticas()
    if (activeTab === 'estadisticas' || activeTab === 'historial') {
      const interval = setInterval(() => {
        void fetchEstadisticas()
      }, 15000)
      return () => clearInterval(interval)
    }
  }, [fetchEstadisticas, activeTab])

  // Carga administradores de cocina
  const cargarAdministradoresCocina = useCallback(async () => {
    if (!selectedRestauranteId || !esDueno) {
      setAdministradoresCocina([])
      return
    }
    setLoadingAdmins(true)
    setAdminCocinaError('')

    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/admin/restaurantes/${selectedRestauranteId}/administradores-cocina`,
      )
      if (!response.ok) {
        throw new Error('No se pudieron consultar los administradores de cocina.')
      }
      setAdministradoresCocina((await response.json()) as AdministradorCocinaItem[])
    } catch (error) {
      setAdminCocinaError(
        error instanceof Error ? error.message : 'Error al consultar los administradores.',
      )
    } finally {
      setLoadingAdmins(false)
    }
  }, [selectedRestauranteId, esDueno])

  useEffect(() => {
    void cargarAdministradoresCocina()
  }, [cargarAdministradoresCocina])

  // Resetea formularios al cambiar cafetería
  useEffect(() => {
    resetProductForm()
    setBusquedaHistorial('')
    setCatalogSearch('')
  }, [selectedRestauranteId])

  // Filtrado de pedidos para el historial
  const pedidosFiltrados = useMemo(() => {
    return historialPedidos.filter((pedido) => {
      if (filtroHistorial === 'entregados' && pedido.estado !== 'ENTREGADO') return false
      if (filtroHistorial === 'cancelados' && pedido.estado !== 'CANCELADO') return false
      if (
        filtroHistorial === 'activos' &&
        !['PAGADO', 'EN_PREPARACION', 'LISTO'].includes(pedido.estado)
      ) {
        return false
      }

      if (!busquedaHistorial.trim()) return true
      const q = busquedaHistorial.trim().toLowerCase()
      const idCoincide = String(pedido.id).includes(q)
      const nombreCoincide = pedido.client?.nombre?.toLowerCase().includes(q)
      const correoCoincide = pedido.correoCliente?.toLowerCase().includes(q)
      const telefonoCoincide = pedido.telefonoCliente?.toLowerCase().includes(q)
      return Boolean(idCoincide || nombreCoincide || correoCoincide || telefonoCoincide)
    })
  }, [filtroHistorial, historialPedidos, busquedaHistorial])

  // Filtrado de productos en el catálogo
  const catalogoFiltrado = useMemo(() => {
    return products.filter((prod) => {
      if (catalogCategoryFilter !== 'todas' && String(prod.categoriaId) !== catalogCategoryFilter) {
        return false
      }
      if (!catalogSearch.trim()) return true
      const q = catalogSearch.trim().toLowerCase()
      return prod.nombre.toLowerCase().includes(q) || prod.descripcion.toLowerCase().includes(q)
    })
  }, [products, catalogCategoryFilter, catalogSearch])

  const toggleExpandOrder = (id: number) => {
    setExpandedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Variación mensual
  const variacionMes = useMemo(() => {
    const actual = Number(estadisticas?.ingresosMes ?? 0)
    const anterior = Number(estadisticas?.ingresosMesAnterior ?? 0)
    if (!Number.isFinite(actual) || !Number.isFinite(anterior) || anterior <= 0) {
      return null
    }
    return Math.round(((actual - anterior) / anterior) * 100)
  }, [estadisticas])

  const maxVentasRanking = useMemo(() => {
    const list = estadisticas?.productosMasVendidos ?? []
    if (list.length === 0) return 1
    return Math.max(...list.map((p) => Number(p.unidades)), 1)
  }, [estadisticas])

  // Cambio rápido de disponibilidad de producto
  const handleToggleDisponibilidad = async (
    productoId: number,
    disponibleActual: boolean,
  ) => {
    setTogglingProductId(productoId)
    setProductError('')
    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/productos/${productoId}/disponibilidad?restauranteId=${selectedRestauranteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disponible: !disponibleActual }),
        },
      )
      if (!response.ok) {
        throw new Error('No se pudo actualizar la disponibilidad del producto.')
      }
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productoId ? { ...p, disponible: !disponibleActual } : p,
        ),
      )
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'Error al cambiar disponibilidad.',
      )
    } finally {
      setTogglingProductId(null)
    }
  }

  // Ingredientes extra
  const handleCreateExtra = async () => {
    if (!newExtraName.trim() || !newExtraPrice || Number(newExtraPrice) <= 0) {
      setProductError('Escribe el nombre y un precio válido para el ingrediente extra.')
      return
    }
    setSavingExtra(true)
    setProductError('')
    try {
      const response = await apiFetch(`${getApiBaseUrl()}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newExtraName.trim(),
          descripcion: `Ingrediente adicional: ${newExtraName.trim()}`,
          precio: Number(newExtraPrice),
          categoriaId: 4,
          restauranteId: selectedRestauranteId,
          disponible: true,
        }),
      })
      const data = (await response.json()) as { id?: number; message?: string }
      if (!response.ok || !data.id) {
        throw new Error(data.message ?? 'No se pudo crear el ingrediente extra.')
      }
      setSelectedExtraIds((ids) => [...new Set([...ids, data.id as number])])
      setNewExtraName('')
      setNewExtraPrice('')
      await fetchRestaurantExtras()
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No se pudo crear el ingrediente extra.',
      )
    } finally {
      setSavingExtra(false)
    }
  }

  const guardarEdicionExtra = async (extraId: number) => {
    if (!editingExtraName.trim() || !editingExtraPrice || Number(editingExtraPrice) <= 0) {
      setProductError('Escribe un nombre y un precio válido para el ingrediente extra.')
      return
    }
    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/productos/extras/${extraId}?restauranteId=${selectedRestauranteId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: editingExtraName.trim(),
            precio: Number(editingExtraPrice),
          }),
        },
      )
      const data = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(data?.message ?? 'No se pudo actualizar el ingrediente extra.')
      }
      setEditingExtraId(null)
      setEditingExtraName('')
      setEditingExtraPrice('')
      await fetchRestaurantExtras()
      await fetchProducts()
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No se pudo actualizar el ingrediente extra.',
      )
    }
  }

  const guardarExtrasDelProducto = async (productId: number) => {
    const response = await apiFetch(
      `${getApiBaseUrl()}/api/productos/${productId}/extras?restauranteId=${selectedRestauranteId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adiciones: selectedExtraIds }),
      },
    )
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null
      throw new Error(
        data?.message ?? 'No se pudieron guardar los ingredientes extra del producto.',
      )
    }
  }

  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProductError('')

    if (!selectedRestauranteId || !productName.trim() || !productPrice) {
      setProductError('Completa el nombre y el precio del producto.')
      return
    }

    if (!Number.isFinite(Number(productPrice)) || Number(productPrice) <= 0) {
      setProductError('El precio debe ser un número mayor que cero.')
      return
    }

    try {
      const response = await apiFetch(`${getApiBaseUrl()}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: productName.trim(),
          descripcion: productDescription.trim(),
          precio: Number(productPrice),
          categoriaId: Number(categoriaId),
          restauranteId: selectedRestauranteId,
          imagenUrl: productImageUrl.trim() || null,
          disponible,
        }),
      })

      const data = (await response.json()) as { id?: number; message?: string }
      if (!response.ok || !data.id) {
        throw new Error(data.message ?? 'No se pudo guardar el producto.')
      }
      await guardarExtrasDelProducto(data.id)

      resetProductForm()
      await fetchProducts()
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No se pudo guardar el producto.',
      )
    }
  }

  const handleEditProduct = (product: ProductItem) => {
    setEditingProductId(product.id)
    setProductName(product.nombre)
    setProductPrice(String(product.precio))
    setProductImageUrl(product.imagenUrl ?? '')
    setCategoriaId(String(product.categoriaId))
    setDisponible(Boolean(product.disponible))
    setProductDescription(product.descripcion)
    setSelectedExtraIds((product.ingredientesExtra ?? []).map((extra) => Number(extra.id)))
    setActiveTab('menu')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleUpdateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProductError('')
    if (editingProductId === null) return

    if (!productName.trim() || !productPrice) {
      setProductError('Completa el nombre y el precio del producto.')
      return
    }

    if (!Number.isFinite(Number(productPrice)) || Number(productPrice) <= 0) {
      setProductError('El precio debe ser un número mayor que cero.')
      return
    }

    const confirmar = window.confirm(
      '¿Estás seguro de que quieres guardar los cambios de este producto?',
    )
    if (!confirmar) return

    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/products/${editingProductId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: productName.trim(),
            descripcion: productDescription.trim(),
            precio: Number(productPrice),
            categoriaId: Number(categoriaId),
            restauranteId: selectedRestauranteId,
            imagenUrl: productImageUrl.trim() || null,
            disponible,
          }),
        },
      )

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(data?.message ?? 'No se pudo actualizar el producto.')
      }

      await guardarExtrasDelProducto(editingProductId)
      resetProductForm()
      await fetchProducts()
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No se pudo actualizar el producto.',
      )
    }
  }

  const handleDeleteProduct = async (productId: number) => {
    const confirmar = window.confirm('¿Quieres retirar este producto de la cafetería?')
    if (!confirmar) return

    setProductError('')
    setProductSuccess('')
    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/products/${productId}?restauranteId=${selectedRestauranteId}`,
        { method: 'DELETE' },
      )
      const data = (await response.json().catch(() => null)) as {
        message?: string
        deactivatedInsteadOfDeleted?: boolean
      } | null
      if (!response.ok) {
        throw new Error(data?.message ?? 'No se pudo retirar el producto.')
      }
      if (data?.message) {
        setProductSuccess(data.message)
      }
      await fetchProducts()
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No se pudo retirar el producto.',
      )
    }
  }

  // Personal de cocina
  const handleCrearAdminCocina = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAdminCocinaError('')
    setAdminCocinaSuccess('')

    if (!esDueno || !selectedRestauranteId) {
      setAdminCocinaError('No tienes permisos para gestionar administradores de cocina.')
      return
    }

    setSavingAdmin(true)
    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/admin/restaurantes/${selectedRestauranteId}/administradores-cocina`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: nombreAdminCocina.trim(),
            telefono: telefonoAdminCocina.trim(),
            correo: correoAdminCocina.trim(),
            password: passwordAdminCocina,
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(
          errorData?.message ??
            errorData?.detail ??
            'No se pudo crear el administrador de cocina.',
        )
      }

      setNombreAdminCocina('')
      setTelefonoAdminCocina('')
      setCorreoAdminCocina('')
      setPasswordAdminCocina('')
      setAdminCocinaSuccess(
        'Cuenta de cocinero creada y persistida correctamente en la base de datos.',
      )
      await cargarAdministradoresCocina()
    } catch (error) {
      setAdminCocinaError(
        error instanceof Error ? error.message : 'No se pudo crear el administrador.',
      )
    } finally {
      setSavingAdmin(false)
    }
  }

  const handleRetirarAdminCocina = async (administrador: AdministradorCocinaItem) => {
    const confirmar = window.confirm(
      `¿Deseas revocar el acceso de ${administrador.nombre} a esta cafetería? La asignación se marcará como inactiva en la base de datos.`,
    )
    if (!confirmar) return

    setAdminCocinaError('')
    setAdminCocinaSuccess('')

    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/admin/restaurantes/${selectedRestauranteId}/administradores-cocina/${administrador.administradorId}`,
        { method: 'DELETE' },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(
          errorData?.message ??
            errorData?.detail ??
            'No se pudo retirar el acceso al administrador.',
        )
      }

      setAdminCocinaSuccess(
        `Se retiró el acceso de ${administrador.nombre} a esta cafetería.`,
      )
      await cargarAdministradoresCocina()
    } catch (error) {
      setAdminCocinaError(
        error instanceof Error ? error.message : 'No se pudo retirar el acceso.',
      )
    }
  }

  // Imagen computada para previsualización
  const previewImgSrc =
    productImageUrl.trim() || getImagenPorCategoria(Number(categoriaId), productName)

  return (
    <div className="admin-dashboard-container">
      {/* Encabezado principal */}
      <header className="admin-header-strip">
        <div className="admin-header-titles">
          <p className="section-kicker">Panel administrativo</p>
          <h2>Bienvenido, {adminName}</h2>
          <p>
            Gestión de {restauranteSeleccionado?.nombre ?? 'tu cafetería'} · Ubicación:{' '}
            {restauranteSeleccionado?.ubicacion ?? 'Campus UPB'}
          </p>
        </div>

        <div className="admin-header-actions">
          <div className="admin-cafe-selector-box">
            <label htmlFor="selector-restaurante-admin">Cafetería activa</label>
            {listaRestaurantes.length > 1 ? (
              <select
                id="selector-restaurante-admin"
                value={selectedRestauranteId}
                onChange={(e) => setSelectedRestauranteId(Number(e.target.value))}
              >
                {listaRestaurantes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} ({r.ubicacion})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontWeight: 700, color: '#123e36', padding: '0.4rem 0' }}>
                {restauranteSeleccionado
                  ? `${restauranteSeleccionado.nombre} (${restauranteSeleccionado.ubicacion})`
                  : 'Cargando cafetería...'}
              </div>
            )}
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={onLogout}
            style={{ padding: '0.65rem 1.25rem', borderRadius: '0.75rem' }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Gestión de la cafetería: Identidad (Nombre, Ubicación, Imagen) y Control Operativo (Estado, Tiempo) */}
      <section className="admin-operational-panel" aria-label="Gestión y control de la cafetería">
        <div className="admin-operational-header">
          <div className="admin-operational-title">
            <h3>Gestión y control de la cafetería</h3>
            <p>
              Administra el nombre comercial, la sede en el campus, la imagen de portada y los parámetros operativos en tiempo real.
            </p>
          </div>

          <button
            type="button"
            className="admin-primary-btn"
            disabled={savingCafeConfig}
            onClick={() => void handleGuardarConfigCafeteria()}
            style={{ width: 'auto', padding: '0.65rem 1.4rem', fontSize: '0.875rem' }}
          >
            {savingCafeConfig ? 'Guardando...' : 'Guardar información y estado'}
          </button>
        </div>

        {cafeConfigSuccess && (
          <div className="admin-alert-banner success" role="status">
            {cafeConfigSuccess}
          </div>
        )}

        {cafeConfigError && (
          <div className="admin-alert-banner error" role="alert">
            {cafeConfigError}
          </div>
        )}

        <div className="admin-cafe-config-grid">
          {/* Bloque 1: Identidad visual y sede */}
          <div className="admin-cafe-identity-card">
            <h4 className="admin-cafe-section-subtitle">Identidad del restaurante</h4>

            <div className="admin-field-compact">
              <label htmlFor="cafe-nombre">Nombre de la cafetería</label>
              <input
                id="cafe-nombre"
                type="text"
                maxLength={50}
                value={cafeNombre}
                onChange={(e) => setCafeNombre(e.target.value)}
                placeholder="Ej. Cafetería Central - Bloque 11"
              />
            </div>

            <div className="admin-field-compact">
              <label htmlFor="cafe-ubicacion">Ubicación en el campus</label>
              <input
                id="cafe-ubicacion"
                type="text"
                maxLength={50}
                value={cafeUbicacion}
                onChange={(e) => setCafeUbicacion(e.target.value)}
                placeholder="Ej. Bloque 11, primer piso"
              />
            </div>

            <div className="admin-field-compact">
              <label htmlFor="cafe-imagen">Imagen principal del restaurante</label>
              <div className="admin-cafe-image-row">
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label
                      className="admin-secondary-btn"
                      style={{
                        cursor: 'pointer',
                        padding: '0.42rem 0.75rem',
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        margin: 0,
                      }}
                    >
                      Subir desde dispositivo
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setCafeConfigError('')
                          void procesarImagenDesdeArchivo(file, 1200)
                            .then((dataUrl) => setCafeImagenUrl(dataUrl))
                            .catch((err: unknown) =>
                              setCafeConfigError(
                                err instanceof Error ? err.message : 'No se pudo procesar la imagen.',
                              ),
                            )
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {cafeImagenUrl.trim() && (
                      <button
                        type="button"
                        className="admin-secondary-btn"
                        style={{ padding: '0.42rem 0.65rem', fontSize: '0.76rem' }}
                        onClick={() => setCafeImagenUrl('')}
                      >
                        Quitar imagen
                      </button>
                    )}
                  </div>
                  <input
                    id="cafe-imagen"
                    type="text"
                    value={cafeImagenUrl.startsWith('data:image/') ? '' : cafeImagenUrl}
                    onChange={(e) => setCafeImagenUrl(e.target.value)}
                    placeholder={
                      cafeImagenUrl.startsWith('data:image/')
                        ? 'Imagen local cargada desde el dispositivo (o pega un enlace https://...)'
                        : 'O pega un enlace https://images.unsplash.com/...'
                    }
                  />
                </div>
                <div className="admin-cafe-image-preview">
                  {cafeImagenUrl.trim() ? (
                    <img
                      src={cafeImagenUrl.trim()}
                      alt="Vista previa"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=400&q=80'
                      }}
                    />
                  ) : (
                    <span className="admin-cafe-image-placeholder">Sin imagen</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bloque 2: Control operativo en vivo */}
          <div className="admin-cafe-ops-card">
            <h4 className="admin-cafe-section-subtitle">Control operativo en vivo</h4>

            <div className="admin-field-compact">
              <label>Estado del restaurante</label>
              <div className="admin-state-options">
                <button
                  type="button"
                  className={`admin-state-btn ${cafeEstado === 'Abierto' ? 'active-abierto' : ''}`}
                  onClick={() => setCafeEstado('Abierto')}
                >
                  <span className="state-dot" />
                  Abierto
                </button>

                <button
                  type="button"
                  className={`admin-state-btn ${cafeEstado === 'Alta demanda' ? 'active-demanda' : ''}`}
                  onClick={() => setCafeEstado('Alta demanda')}
                >
                  <span className="state-dot" />
                  Alta demanda
                </button>

                <button
                  type="button"
                  className={`admin-state-btn ${cafeEstado === 'Cerrado' ? 'active-cerrado' : ''}`}
                  onClick={() => setCafeEstado('Cerrado')}
                >
                  <span className="state-dot" />
                  Cerrado
                </button>
              </div>
            </div>

            <div className="admin-field-compact">
              <label>Tiempo de espera aproximado</label>
              <div className="admin-time-control">
                <div className="admin-time-input-group">
                  <input
                    type="number"
                    min="1"
                    max="240"
                    value={cafeTiempoMin}
                    onChange={(e) => setCafeTiempoMin(Number(e.target.value))}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>min</span>
                </div>

                {[10, 15, 20, 30, 45].map((min) => (
                  <button
                    key={min}
                    type="button"
                    className={`admin-time-preset-btn ${cafeTiempoMin === min ? 'is-active' : ''}`}
                    onClick={() => setCafeTiempoMin(min)}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Navegación por pestañas */}
      <nav className="admin-tabs-nav" aria-label="Secciones del panel">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'estadisticas' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('estadisticas')}
        >
          Estadísticas y Métricas
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'historial' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('historial')}
        >
          Historial de Pedidos
          <span className="admin-tab-badge">{historialPedidos.length}</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'menu' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          Menú y Catálogo
          <span className="admin-tab-badge">{products.length}</span>
        </button>

        {esDueno && (
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'personal' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            Personal de Cocina
            <span className="admin-tab-badge">{administradoresCocina.length}</span>
          </button>
        )}
      </nav>

      {/* ============================================================== */}
      {/* PESTAÑA 1: ESTADÍSTICAS Y MÉTRICAS                             */}
      {/* ============================================================== */}
      {activeTab === 'estadisticas' && (
        <section aria-label="Estadísticas de la cafetería">
          {statsError && (
            <p className="error-message" role="alert" style={{ marginBottom: '1.25rem' }}>
              {statsError}
            </p>
          )}

          <div className="admin-stats-toolbar">
            <span className="admin-stats-toolbar-title">
              Métricas consolidadas y rendimiento de hoy
            </span>
            <button
              type="button"
              className="admin-secondary-btn admin-stats-refresh-btn"
              onClick={() => void fetchEstadisticas()}
              disabled={loadingStats}
            >
              {loadingStats ? 'Actualizando...' : 'Actualizar métricas'}
            </button>
          </div>

          <div className="admin-kpi-grid">
            {loadingStats ? (
              <>
                <div className="skeleton-shimmer skeleton-kpi-card" />
                <div className="skeleton-shimmer skeleton-kpi-card" />
                <div className="skeleton-shimmer skeleton-kpi-card" />
                <div className="skeleton-shimmer skeleton-kpi-card" />
              </>
            ) : (
              <>
                <article className="admin-kpi-card accent-active">
                  <span className="admin-kpi-label">Pedidos activos</span>
                  <strong className="admin-kpi-value">
                    {estadisticas?.pedidosActivos ?? 0}
                  </strong>
                  <span className="admin-kpi-subtext">
                    {estadisticas?.enPreparacion ?? 0} en preparación ·{' '}
                    {estadisticas?.listos ?? 0} listos
                  </span>
                </article>

                <article className="admin-kpi-card accent-revenue">
                  <span className="admin-kpi-label">Ventas de hoy</span>
                  <strong className="admin-kpi-value">
                    {formatMoney(estadisticas?.ingresosHoy ?? 0)}
                  </strong>
                  <span className="admin-kpi-subtext">
                    {estadisticas?.pedidosHoy ?? 0} pedidos registrados hoy
                  </span>
                </article>

                <article className="admin-kpi-card accent-month">
                  <span className="admin-kpi-label">Ventas del mes</span>
                  <strong className="admin-kpi-value">
                    {formatMoney(estadisticas?.ingresosMes ?? 0)}
                  </strong>
                  <span className="admin-kpi-subtext">
                    {variacionMes !== null ? (
                      <span
                        className={`admin-variation-badge ${variacionMes >= 0 ? 'positive' : 'negative'}`}
                      >
                        {variacionMes >= 0 ? `+${variacionMes}%` : `${variacionMes}%`} vs mes
                        anterior
                      </span>
                    ) : (
                      'Mes en curso'
                    )}
                  </span>
                </article>

                <article className="admin-kpi-card accent-products">
                  <span className="admin-kpi-label">Catálogo de productos</span>
                  <strong className="admin-kpi-value">
                    {products.filter((p) => p.disponible).length} / {products.length}
                  </strong>
                  <span className="admin-kpi-subtext">
                    {products.filter((p) => !p.disponible).length} agotados actualmente
                  </span>
                </article>
              </>
            )}
          </div>

          <div className="admin-two-cols">
            <div className="admin-panel-card">
              <h3>Resumen operativo de hoy</h3>
              {loadingStats ? (
                <div className="skeleton-shimmer" style={{ height: '170px' }} />
              ) : (
                <div className="admin-summary-grid">
                  <div className="admin-summary-item">
                    <span>Pedidos recibidos</span>
                    <strong>{estadisticas?.pedidosHoy ?? 0}</strong>
                  </div>
                  <div className="admin-summary-item">
                    <span>En preparación</span>
                    <strong>{estadisticas?.enPreparacion ?? 0}</strong>
                  </div>
                  <div className="admin-summary-item">
                    <span>Listos para entrega</span>
                    <strong>{estadisticas?.listos ?? 0}</strong>
                  </div>
                  <div className="admin-summary-item">
                    <span>Entregados con éxito</span>
                    <strong>{estadisticas?.entregadosHoy ?? 0}</strong>
                  </div>
                  <div className="admin-summary-item">
                    <span>Clientes atendidos</span>
                    <strong>{estadisticas?.clientesHoy ?? 0}</strong>
                  </div>
                  <div className="admin-summary-item">
                    <span>Cancelados</span>
                    <strong style={{ color: '#b91c1c' }}>
                      {estadisticas?.canceladosHoy ?? 0}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="admin-panel-card">
              <h3>Productos más pedidos</h3>
              {loadingStats ? (
                <div className="skeleton-shimmer" style={{ height: '170px' }} />
              ) : (estadisticas?.productosMasVendidos ?? []).length === 0 ? (
                <div className="admin-empty-state">
                  <strong>Sin ventas registradas</strong>
                  <p>Aún no se han completado pedidos en esta cafetería.</p>
                </div>
              ) : (
                <ul className="admin-ranking-list">
                  {(estadisticas?.productosMasVendidos ?? []).map((prod) => {
                    const unidades = Number(prod.unidades)
                    const porcentaje = Math.round((unidades / maxVentasRanking) * 100)
                    return (
                      <li key={prod.nombre} className="admin-ranking-item">
                        <div className="admin-ranking-info">
                          <strong>{prod.nombre}</strong>
                          <span>{unidades} uds.</span>
                        </div>
                        <div className="admin-ranking-bar-track">
                          <div
                            className="admin-ranking-bar-fill"
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

        </section>
      )}

      {/* ============================================================== */}
      {/* PESTAÑA 2: HISTORIAL DE PEDIDOS                                */}
      {/* ============================================================== */}
      {activeTab === 'historial' && (
        <section aria-label="Historial de pedidos">
          <div className="admin-filter-bar">
            <div className="admin-search-box">
              <input
                type="search"
                placeholder="Buscar por ID (#), nombre, correo o teléfono..."
                value={busquedaHistorial}
                onChange={(e) => setBusquedaHistorial(e.target.value)}
              />
              {busquedaHistorial && (
                <button
                  type="button"
                  onClick={() => setBusquedaHistorial('')}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    fontWeight: 700,
                  }}
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="admin-status-filters" role="tablist">
              {(
                [
                  ['todos', 'Todos'],
                  ['activos', 'En curso'],
                  ['entregados', 'Entregados'],
                  ['cancelados', 'Cancelados'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  className={`admin-filter-chip ${filtroHistorial === val ? 'is-active' : ''}`}
                  onClick={() => setFiltroHistorial(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loadingStats ? (
            <div className="admin-order-cards">
              <div className="skeleton-shimmer skeleton-card" />
              <div className="skeleton-shimmer skeleton-card" />
              <div className="skeleton-shimmer skeleton-card" />
            </div>
          ) : pedidosFiltrados.length === 0 ? (
            <div className="admin-empty-state">
              <strong>No se encontraron pedidos</strong>
              <p>No hay registros coincidentes con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="admin-order-cards">
              {pedidosFiltrados.map((pedido) => {
                const isExpanded = expandedOrderIds.includes(pedido.id)
                const itemsCount = pedido.details?.length ?? 0

                return (
                  <article key={pedido.id} className="admin-order-card">
                    <div className="admin-order-card-header">
                      <div className="admin-order-id-group">
                        <span className="admin-order-id">Pedido #{pedido.id}</span>
                        <span className={`admin-status-chip ${claseEstado(pedido.estado)}`}>
                          {etiquetaEstado(pedido.estado)}
                        </span>
                        <span className="admin-order-date">
                          {formatDateTime(pedido.fechaCreacion)}
                        </span>
                      </div>

                      <div className="admin-order-total-group">
                        <span className="admin-order-total">
                          {formatMoney(pedido.total)}
                        </span>
                      </div>
                    </div>

                    <div className="admin-order-client-info">
                      <span>
                        Cliente: <strong>{pedido.client?.nombre ?? 'Anónimo'}</strong>
                      </span>
                      {pedido.correoCliente && (
                        <span>
                          Correo: <strong>{pedido.correoCliente}</strong>
                        </span>
                      )}
                      {pedido.telefonoCliente && (
                        <span>
                          Teléfono: <strong>{pedido.telefonoCliente}</strong>
                        </span>
                      )}
                      {pedido.horaRecogida && (
                        <span>
                          Hora recogida: <strong>{pedido.horaRecogida}</strong>
                        </span>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        className="admin-order-expand-btn"
                        onClick={() => toggleExpandOrder(pedido.id)}
                      >
                        {isExpanded
                          ? 'Ocultar desglose de productos'
                          : `Ver desglose del pedido (${itemsCount} ${itemsCount === 1 ? 'producto' : 'productos'})`}
                      </button>

                      {isExpanded && (
                        <div className="admin-order-details-table">
                          {!pedido.details || pedido.details.length === 0 ? (
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                              Detalles de productos no disponibles para este pedido.
                            </p>
                          ) : (
                            <ul className="admin-details-list">
                              {pedido.details.map((detalle, idx) => (
                                <li
                                  key={detalle.detalle_pedido_id ?? idx}
                                  className="admin-details-item"
                                >
                                  <div>
                                    <span className="admin-details-item-title">
                                      {detalle.cantidad ?? 1}x{' '}
                                      {detalle.nombre_producto ?? 'Producto'}
                                    </span>
                                    {detalle.adiciones && (
                                      <div className="admin-details-extras">
                                        Adiciones: {detalle.adiciones}
                                      </div>
                                    )}
                                    {detalle.observaciones && (
                                      <div className="admin-details-obs">
                                        Nota: {detalle.observaciones}
                                      </div>
                                    )}
                                  </div>
                                  <span className="admin-details-item-price">
                                    {formatMoney(detalle.subtotal ?? detalle.precio_unitario)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* PESTAÑA 3: MENÚ Y CATÁLOGO                                     */}
      {/* ============================================================== */}
      {activeTab === 'menu' && (
        <section aria-label="Gestión de menú">
          <div className="admin-two-cols" style={{ alignItems: 'start' }}>
            {/* Formulario estilizado de producto */}
            <div className="admin-panel-card">
              <h3>
                {editingProductId !== null ? 'Editar producto' : 'Nuevo producto en catálogo'}
              </h3>
              <p className="admin-panel-card-subtitle">
                {editingProductId !== null
                  ? 'Modifica los datos del producto y actualiza los cambios en la base de datos.'
                  : 'Registra un nuevo plato o bebida disponible para la cafetería activa.'}
              </p>

              {/* Vista previa de imagen en vivo */}
              <div className="admin-img-preview-box" style={{ marginBottom: '1.25rem' }}>
                <img
                  src={previewImgSrc}
                  alt="Vista previa"
                  className="admin-img-preview-thumb"
                  onError={(e) => {
                    // Fallback si la URL no carga
                    ;(e.target as HTMLImageElement).src = getImagenPorCategoria(
                      Number(categoriaId),
                      productName,
                    )
                  }}
                />
                <div className="admin-img-preview-info">
                  <strong>
                    {productName.trim() || 'Nombre del producto'}
                  </strong>
                  <span>
                    Vista previa de imagen · {formatMoney(productPrice || 0)}
                  </span>
                </div>
              </div>

              <form
                onSubmit={
                  editingProductId !== null ? handleUpdateProduct : handleCreateProduct
                }
                style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
              >
                <div className="admin-form-group">
                  <label htmlFor="prod-nombre">Nombre del producto *</label>
                  <input
                    id="prod-nombre"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Ej: Café Americano, Sándwich Artesanal..."
                    maxLength={50}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="prod-desc">Descripción detallada *</label>
                  <textarea
                    id="prod-desc"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    placeholder="Ingredientes principales, tipo de pan, preparación..."
                    rows={2}
                    maxLength={120}
                    required
                  />
                </div>

                <div className="admin-form-row-2">
                  <div className="admin-form-group">
                    <label htmlFor="prod-precio">Precio de venta (COP) *</label>
                    <input
                      id="prod-precio"
                      type="number"
                      min="1"
                      step="1"
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      placeholder="3500"
                      required
                    />
                  </div>

                  <div className="admin-form-group">
                    <label>Categoría</label>
                    <div className="admin-category-pills">
                      {CATEGORIAS_MENU.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          className={`admin-category-pill-btn ${categoriaId === cat.id ? 'is-selected' : ''}`}
                          onClick={() => setCategoriaId(cat.id)}
                        >
                          {cat.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="prod-img">Imagen del producto (subir archivo o enlace)</label>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <label
                      className="admin-secondary-btn"
                      style={{
                        cursor: 'pointer',
                        padding: '0.45rem 0.85rem',
                        fontSize: '0.8rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        margin: 0,
                      }}
                    >
                      Subir desde dispositivo
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setProductError('')
                          void procesarImagenDesdeArchivo(file, 900)
                            .then((dataUrl) => setProductImageUrl(dataUrl))
                            .catch((err: unknown) =>
                              setProductError(
                                err instanceof Error ? err.message : 'No se pudo procesar la imagen.',
                              ),
                            )
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {productImageUrl.trim() && (
                      <button
                        type="button"
                        className="admin-secondary-btn"
                        style={{ padding: '0.45rem 0.7rem', fontSize: '0.78rem' }}
                        onClick={() => setProductImageUrl('')}
                      >
                        Usar imagen sugerida
                      </button>
                    )}
                  </div>
                  <input
                    id="prod-img"
                    type="text"
                    value={productImageUrl.startsWith('data:image/') ? '' : productImageUrl}
                    onChange={(e) => setProductImageUrl(e.target.value)}
                    placeholder={
                      productImageUrl.startsWith('data:image/')
                        ? 'Imagen local cargada desde el dispositivo (o pega un enlace https://...)'
                        : 'https://images.unsplash.com/... (o déjalo vacío para usar sugerida)'
                    }
                  />
                </div>

                {/* Administrador de ingredientes extra */}
                <div className="admin-extras-section">
                  <strong style={{ display: 'block', fontSize: '0.85rem', color: '#123e36' }}>
                    Ingredientes extra disponibles en esta cafetería
                  </strong>
                  <p style={{ margin: '0.2rem 0 0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
                    Selecciona los ingredientes adicionales que el cliente podrá agregar al pedir este producto.
                  </p>

                  {restaurantExtras.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                      Aún no hay ingredientes extra configurados en esta cafetería.
                    </p>
                  ) : (
                    <div className="admin-extras-grid">
                      {restaurantExtras.map((extra) => {
                        const isChecked = selectedExtraIds.includes(Number(extra.id))

                        return (
                          <div
                            key={extra.id}
                            className={`admin-extra-chip-card ${isChecked ? 'is-checked' : ''}`}
                          >
                            {editingExtraId === extra.id ? (
                              <div style={{ display: 'flex', gap: '0.35rem', width: '100%' }}>
                                <input
                                  value={editingExtraName}
                                  onChange={(e) => setEditingExtraName(e.target.value)}
                                  placeholder="Nombre"
                                  maxLength={50}
                                  style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem' }}
                                />
                                <input
                                  type="number"
                                  value={editingExtraPrice}
                                  onChange={(e) => setEditingExtraPrice(e.target.value)}
                                  placeholder="Precio"
                                  style={{ width: '65px', padding: '0.3rem', fontSize: '0.75rem' }}
                                />
                                <button
                                  type="button"
                                  className="mini-button"
                                  onClick={() => void guardarEdicionExtra(extra.id)}
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  className="mini-button"
                                  onClick={() => setEditingExtraId(null)}
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <>
                                <label className="admin-extra-chip-label">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) =>
                                      setSelectedExtraIds((ids) =>
                                        e.target.checked
                                          ? [...new Set([...ids, Number(extra.id)])]
                                          : ids.filter((id) => id !== Number(extra.id)),
                                      )
                                    }
                                  />
                                  <span>{extra.nombre}</span>
                                </label>
                                <span className="admin-extra-chip-price">
                                  {formatMoney(extra.precio)}
                                </span>
                                <button
                                  type="button"
                                  className="admin-extra-edit-btn"
                                  onClick={() => {
                                    setEditingExtraId(extra.id)
                                    setEditingExtraName(extra.nombre)
                                    setEditingExtraPrice(String(extra.precio))
                                  }}
                                  title="Editar precio de este extra"
                                >
                                  Editar
                                </button>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Formulario rápido para nuevo ingrediente extra */}
                  <div className="admin-new-extra-box">
                    <div className="admin-form-group">
                      <label htmlFor="nuevo-extra-nombre">Nuevo ingrediente extra</label>
                      <input
                        id="nuevo-extra-nombre"
                        value={newExtraName}
                        onChange={(e) => setNewExtraName(e.target.value)}
                        placeholder="Ej: Queso extra, Tocineta..."
                        maxLength={50}
                      />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="nuevo-extra-precio">Precio adicional</label>
                      <input
                        id="nuevo-extra-precio"
                        type="number"
                        min="1"
                        step="1"
                        value={newExtraPrice}
                        onChange={(e) => setNewExtraPrice(e.target.value)}
                        placeholder="1500"
                      />
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleCreateExtra()}
                      disabled={savingExtra}
                      style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                      {savingExtra ? 'Creando...' : 'Guardar extra'}
                    </button>
                  </div>
                </div>

                {/* Interruptor de disponibilidad */}
                <label className="admin-toggle-switch">
                  <input
                    type="checkbox"
                    checked={disponible}
                    onChange={(e) => setDisponible(e.target.checked)}
                  />
                  <span className="admin-switch-slider" />
                  <span className="admin-switch-label">
                    {disponible
                      ? 'Producto disponible para la venta inmediata'
                      : 'Producto agotado temporalmente'}
                  </span>
                </label>

                {productError && (
                  <div className="admin-alert-banner error" role="alert">
                    {productError}
                  </div>
                )}

                {productSuccess && (
                  <div className="admin-alert-banner success" role="status">
                    {productSuccess}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="submit"
                    className="admin-primary-btn"
                    disabled={!selectedRestauranteId || listaRestaurantes.length === 0}
                  >
                    {editingProductId !== null ? 'Guardar cambios' : 'Publicar producto en catálogo'}
                  </button>

                  {editingProductId !== null && (
                    <button
                      type="button"
                      className="admin-secondary-btn"
                      onClick={resetProductForm}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Listado de catálogo con toolbar, filtros y acción rápida */}
            <div className="admin-panel-card">
              <h3>Catálogo de la cafetería ({products.length})</h3>
              <p className="admin-panel-card-subtitle">
                Productos activos y existencias en{' '}
                {restauranteSeleccionado?.nombre ?? 'esta cafetería'}.
              </p>

              {/* Toolbar con buscador y filtros por categoría */}
              <div className="admin-catalog-toolbar">
                <div className="admin-catalog-search">
                  <input
                    type="search"
                    placeholder="Buscar producto por nombre..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                </div>

                <div className="admin-category-pills">
                  <button
                    type="button"
                    className={`admin-category-pill-btn ${catalogCategoryFilter === 'todas' ? 'is-selected' : ''}`}
                    onClick={() => setCatalogCategoryFilter('todas')}
                  >
                    Todos ({products.length})
                  </button>
                  {CATEGORIAS_MENU.map((cat) => {
                    const count = products.filter((p) => String(p.categoriaId) === cat.id).length
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={`admin-category-pill-btn ${catalogCategoryFilter === cat.id ? 'is-selected' : ''}`}
                        onClick={() => setCatalogCategoryFilter(cat.id)}
                      >
                        {cat.nombre} ({count})
                      </button>
                    )
                  })}
                </div>
              </div>

              {loadingProducts ? (
                <div>
                  <div className="skeleton-shimmer skeleton-row" />
                  <div className="skeleton-shimmer skeleton-row" />
                  <div className="skeleton-shimmer skeleton-row" />
                  <div className="skeleton-shimmer skeleton-row" />
                </div>
              ) : catalogoFiltrado.length === 0 ? (
                <div className="admin-empty-state">
                  <strong>No hay productos que coincidan</strong>
                  <p>Intenta con otro término de búsqueda o categoría.</p>
                </div>
              ) : (
                <div className="admin-catalog-cards-list">
                  {catalogoFiltrado.map((product) => {
                    const isToggling = togglingProductId === product.id
                    const extrasCount = product.ingredientesExtra?.length ?? 0
                    const categoryLabel =
                      CATEGORIAS_MENU.find((c) => c.id === String(product.categoriaId))?.nombre ??
                      'Menú'

                    return (
                      <article key={product.id} className="admin-product-card-row">
                        <img
                          src={
                            product.imagenUrl?.trim() ||
                            getImagenPorCategoria(product.categoriaId, product.nombre)
                          }
                          alt={product.nombre}
                          className="admin-product-card-img"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = getImagenPorCategoria(
                              product.categoriaId,
                              product.nombre,
                            )
                          }}
                        />

                        <div className="admin-product-card-body">
                          <span
                            className={`admin-product-category-badge cat-${product.categoriaId}`}
                          >
                            {categoryLabel}
                          </span>
                          <h4 className="admin-product-card-name">{product.nombre}</h4>
                          <p className="admin-product-card-desc">{product.descripcion}</p>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              marginTop: '0.25rem',
                              fontSize: '0.75rem',
                              color: '#64748b',
                            }}
                          >
                            <span>{extrasCount} extras configurados</span>
                          </div>
                        </div>

                        <div className="admin-product-card-meta">
                          <span className="admin-product-price">
                            {formatMoney(product.precio)}
                          </span>

                          {/* Botón compacto de disponibilidad */}
                          <button
                            type="button"
                            className={`admin-avail-pill ${product.disponible ? 'is-available' : 'is-out'}`}
                            disabled={isToggling}
                            onClick={() =>
                              void handleToggleDisponibilidad(product.id, product.disponible)
                            }
                            title={
                              product.disponible
                                ? 'Clic para marcar como Agotado en la cafetería'
                                : 'Clic para marcar como Disponible'
                            }
                          >
                            <span className="admin-avail-dot" />
                            {isToggling
                              ? '...'
                              : product.disponible
                                ? 'Disponible'
                                : 'Agotado'}
                          </button>

                          <div className="admin-card-actions">
                            <button
                              type="button"
                              className="admin-card-btn edit"
                              onClick={() => handleEditProduct(product)}
                              title="Editar datos del producto"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              className="admin-card-btn delete"
                              onClick={() => handleDeleteProduct(product.id)}
                              title="Eliminar este producto"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* PESTAÑA 4: PERSONAL DE COCINA (SOLO DUEÑOS)                     */}
      {/* ============================================================== */}
      {activeTab === 'personal' && esDueno && (
        <section aria-label="Personal de cocina">
          <div className="admin-two-cols" style={{ alignItems: 'start' }}>
            {/* Formulario estilizado para crear cocinero */}
            <div className="admin-panel-card">
              <h3>Registro de Administrador de Cocina</h3>
              <p className="admin-panel-card-subtitle">
                Crea una cuenta para el cocinero responsable. Esta cuenta tendrá acceso
                exclusivo al panel de cocina (/admin/cocina) y se guardará de forma persistente
                en la base de datos de {restauranteSeleccionado?.nombre ?? 'esta cafetería'}.
              </p>

              {adminCocinaSuccess && (
                <div className="admin-alert-banner success" role="status">
                  {adminCocinaSuccess}
                </div>
              )}

              {adminCocinaError && (
                <div className="admin-alert-banner error" role="alert">
                  {adminCocinaError}
                </div>
              )}

              <form
                onSubmit={handleCrearAdminCocina}
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div className="admin-form-group">
                  <label htmlFor="cocina-nombre">Nombre y apellidos *</label>
                  <input
                    id="cocina-nombre"
                    value={nombreAdminCocina}
                    onChange={(e) => setNombreAdminCocina(e.target.value)}
                    maxLength={50}
                    placeholder="Ej: Carlos Andrés Pérez"
                    required
                  />
                </div>

                <div className="admin-form-row-2">
                  <div className="admin-form-group">
                    <label htmlFor="cocina-telefono">Teléfono de contacto *</label>
                    <input
                      id="cocina-telefono"
                      type="tel"
                      value={telefonoAdminCocina}
                      onChange={(e) => setTelefonoAdminCocina(e.target.value)}
                      maxLength={20}
                      placeholder="Ej: 3001234567"
                      required
                    />
                  </div>

                  <div className="admin-form-group">
                    <label htmlFor="cocina-correo">Correo institucional UPB *</label>
                    <input
                      id="cocina-correo"
                      type="email"
                      value={correoAdminCocina}
                      onChange={(e) => setCorreoAdminCocina(e.target.value)}
                      maxLength={100}
                      placeholder="cocinero@upb.edu.co"
                      required
                    />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="cocina-pass">Contraseña inicial *</label>
                  <div className="password-input-wrapper">
                    <input
                      id="cocina-pass"
                      type={showPassword ? 'text' : 'password'}
                      value={passwordAdminCocina}
                      onChange={(e) => setPasswordAdminCocina(e.target.value)}
                      minLength={8}
                      maxLength={72}
                      placeholder="Mínimo 8 caracteres alfanuméricos"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  <small style={{ color: '#64748b', fontSize: '0.78rem' }}>
                    Esta contraseña será encriptada con algoritmo BCrypt en la base de datos.
                  </small>
                </div>

                <button
                  type="submit"
                  className="admin-primary-btn"
                  disabled={savingAdmin}
                  style={{ marginTop: '0.5rem' }}
                >
                  {savingAdmin ? 'Guardando en base de datos...' : 'Crear cuenta de cocinero'}
                </button>
              </form>
            </div>

            {/* Listado estilizado de cuentas de cocina activas */}
            <div className="admin-panel-card">
              <h3>
                Personal asignado a la cafetería ({administradoresCocina.length})
              </h3>
              <p className="admin-panel-card-subtitle">
                Cuentas autorizadas para gestionar pedidos en la cocina de{' '}
                {restauranteSeleccionado?.nombre ?? 'esta cafetería'}.
              </p>

              {loadingAdmins ? (
                <div>
                  <div className="skeleton-shimmer skeleton-row" />
                  <div className="skeleton-shimmer skeleton-row" />
                </div>
              ) : administradoresCocina.length === 0 ? (
                <div className="admin-empty-state">
                  <strong>No hay cocineros registrados</strong>
                  <p>
                    Utiliza el formulario de la izquierda para registrar y autorizar al
                    primer cocinero.
                  </p>
                </div>
              ) : (
                <div className="admin-staff-card-list">
                  {administradoresCocina.map((administrador) => (
                    <article key={administrador.administradorId} className="admin-staff-card">
                      <div className="admin-staff-info-group">
                        <div className="admin-staff-avatar">
                          {getInitials(administrador.nombre)}
                        </div>
                        <div className="admin-staff-details">
                          <strong>{administrador.nombre}</strong>
                          <p>{administrador.correo}</p>
                          <small>Tel: {administrador.telefono}</small>
                          <div>
                            <span className="admin-staff-role-badge">
                              Rol: Cocina
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="mini-button danger"
                        onClick={() => handleRetirarAdminCocina(administrador)}
                        title="Revocar asignación de este usuario en esta cafetería"
                      >
                        Retirar acceso
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
