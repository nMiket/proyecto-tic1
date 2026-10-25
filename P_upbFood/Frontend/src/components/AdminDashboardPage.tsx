
import {
  startTransition,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import { apiFetch, getApiBaseUrl, type AsignacionRestaurante } from '../auth'

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
}

type AdministradorCocinaItem = {
  administradorId: number
  nombre: string
  telefono: string
  correo: string
  estado: string
}


function getImagenPorCategoria(categoriaId: number, nombre: string): string {
  const n = nombre.toLowerCase()

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
  const [selectedRestauranteId, setSelectedRestauranteId] =
    useState<number>(initialRestauranteId)

  const [listaRestaurantes, setListaRestaurantes] = useState<RestauranteItem[]>([])
  const [productDescription, setProductDescription] = useState('')
  const [products, setProducts] = useState<ProductItem[]>([])
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [categoriaId, setCategoriaId] = useState('1')
  const [disponible, setDisponible] = useState(true)
  const [productError, setProductError] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [restaurantExtras, setRestaurantExtras] = useState<RestaurantExtra[]>([])
  const [selectedExtraIds, setSelectedExtraIds] = useState<number[]>([])
  const [newExtraName, setNewExtraName] = useState('')
  const [newExtraPrice, setNewExtraPrice] = useState('')
  const [savingExtra, setSavingExtra] = useState(false)
  const [editingExtraId, setEditingExtraId] = useState<number | null>(null)
  const [editingExtraName, setEditingExtraName] = useState('')
  const [editingExtraPrice, setEditingExtraPrice] = useState('')

  const restauranteSeleccionado = listaRestaurantes.find(
    (r) => Number(r.id) === Number(selectedRestauranteId),
  )

  const resetProductForm = () => {
    setProductName('')
    setProductDescription('')
    setProductPrice('')
    setCategoriaId('1')
    setDisponible(true)
    setEditingProductId(null)
    setSelectedExtraIds([])
  }

  // Consulta y filtra los restaurantes que tiene asignados la sesión.
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

        if (
          permitidos.some(
            (r) => Number(r.id) === Number(initialRestauranteId),
          )
        ) {
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

  const [administradoresCocina, setAdministradoresCocina] =
    useState<AdministradorCocinaItem[]>([])
  const [nombreAdminCocina, setNombreAdminCocina] = useState('')
  const [telefonoAdminCocina, setTelefonoAdminCocina] = useState('')
  const [correoAdminCocina, setCorreoAdminCocina] = useState('')
  const [passwordAdminCocina, setPasswordAdminCocina] = useState('')
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [savingAdmin, setSavingAdmin] = useState(false)
  const [adminCocinaError, setAdminCocinaError] = useState('')
  const [adminCocinaSuccess, setAdminCocinaSuccess] = useState('')

  const asignacionSeleccionada = asignaciones.find(
    (a) => Number(a.restauranteId) === Number(selectedRestauranteId),
  )

  const esDueno =
    Number(asignacionSeleccionada?.tipoAdministradorId) === 1


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
          (product) =>
            Number(product.restauranteId) === Number(selectedRestauranteId),
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

  const fetchRestaurantExtras = useCallback(async () => {
    if (!selectedRestauranteId) return
    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/productos/extras?restauranteId=${selectedRestauranteId}`,
      )
      if (!response.ok) throw new Error('No se pudieron cargar los ingredientes extra.')
      setRestaurantExtras(await response.json() as RestaurantExtra[])
    } catch (error) {
      console.error('Error al cargar ingredientes extra:', error)
      setProductError('No se pudieron cargar los ingredientes extra del restaurante.')
    }
  }, [selectedRestauranteId])

  useEffect(() => {
    void Promise.resolve().then(() => fetchRestaurantExtras())
  }, [fetchRestaurantExtras])

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
      const data = await response.json() as { id?: number; message?: string }
      if (!response.ok || !data.id) throw new Error(data.message ?? 'No se pudo crear el ingrediente extra.')
      setSelectedExtraIds((ids) => [...new Set([...ids, data.id as number])])
      setNewExtraName('')
      setNewExtraPrice('')
      await fetchRestaurantExtras()
    } catch (error) {
      setProductError(error instanceof Error ? error.message : 'No se pudo crear el ingrediente extra.')
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
      const response = await apiFetch(`${getApiBaseUrl()}/api/productos/extras/${extraId}?restauranteId=${selectedRestauranteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editingExtraName.trim(), precio: Number(editingExtraPrice) }),
      })
      const data = await response.json().catch(() => null) as { message?: string } | null
      if (!response.ok) throw new Error(data?.message ?? 'No se pudo actualizar el ingrediente extra.')
      setEditingExtraId(null)
      setEditingExtraName('')
      setEditingExtraPrice('')
      await fetchRestaurantExtras()
      await fetchProducts()
    } catch (error) {
      setProductError(error instanceof Error ? error.message : 'No se pudo actualizar el ingrediente extra.')
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
      const data = await response.json().catch(() => null) as { message?: string } | null
      throw new Error(data?.message ?? 'No se pudieron guardar los ingredientes extra del producto.')
    }
  }

  // Al cambiar de cafetería, limpia el formulario para evitar editar
  // accidentalmente un producto de la cafetería anterior.
  useEffect(() => {
    resetProductForm()
  }, [selectedRestauranteId])

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
    setCategoriaId(String(product.categoriaId))
    setDisponible(Boolean(product.disponible))
    setProductDescription(product.descripcion)
    setSelectedExtraIds((product.ingredientesExtra ?? []).map((extra) => Number(extra.id)))
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
            disponible,
          }),
        },
      )

      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(data.message ?? 'No se pudo actualizar el producto.')
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
    const confirmar = window.confirm(
      '¿Quieres retirar este producto de la cafetería?',
    )
    if (!confirmar) return

    setProductError('')

    try {
      const response = await apiFetch(
        `${getApiBaseUrl()}/api/products/${productId}?restauranteId=${selectedRestauranteId}`,
        { method: 'DELETE' },
      )

      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(data.message ?? 'No se pudo retirar el producto.')
      }

      await fetchProducts()
    } catch (error) {
      setProductError(
        error instanceof Error ? error.message : 'No se pudo retirar el producto.',
      )
    }
  }

  
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

      const data = (await response.json()) as AdministradorCocinaItem[]
      setAdministradoresCocina(data)
    } catch (error) {
      setAdminCocinaError(
        error instanceof Error
          ? error.message
          : 'Error al consultar los administradores.',
      )
    } finally {
      setLoadingAdmins(false)
    }
  }, [selectedRestauranteId, esDueno])

  useEffect(() => {
    void cargarAdministradoresCocina()
  }, [cargarAdministradoresCocina])

  const handleCrearAdminCocina = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    setAdminCocinaError('')
    setAdminCocinaSuccess('')

    if (!esDueno || !selectedRestauranteId) {
      setAdminCocinaError(
        'No tienes permisos para gestionar administradores de cocina.',
      )
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
      setAdminCocinaSuccess('Administrador de cocina creado correctamente.')

      await cargarAdministradoresCocina()
    } catch (error) {
      setAdminCocinaError(
        error instanceof Error
          ? error.message
          : 'No se pudo crear el administrador.',
      )
    } finally {
      setSavingAdmin(false)
    }
  }

  const handleRetirarAdminCocina = async (
    administrador: AdministradorCocinaItem,
  ) => {
    const confirmar = window.confirm(
      `¿Quieres retirar el acceso de ${administrador.nombre} a esta cafetería?`,
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
        error instanceof Error
          ? error.message
          : 'No se pudo retirar el acceso.',
      )
    }
  }


  return (
    <section className="dashboard-card">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Panel administrativo</p>
          <h2>Bienvenido, {adminName}</h2>
        </div>

        <button className="secondary" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>

      <div
        style={{
          margin: '0 0 24px',
          padding: '16px 20px',
          backgroundColor: '#f0f8f8',
          borderRadius: '12px',
          border: '1px solid #d3ebe7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <label
            htmlFor="restaurante-admin"
            style={{
              display: 'block',
              fontWeight: 700,
              color: '#0f3d3e',
              fontSize: '1rem',
              marginBottom: '8px',
            }}
          >
            Cafetería en gestión:
          </label>

          {listaRestaurantes.length > 1 ? (
            <select
              id="restaurante-admin"
              value={selectedRestauranteId}
              onChange={(e) => setSelectedRestauranteId(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #0d7377',
                fontWeight: 600,
                color: '#0d7377',
                backgroundColor: '#fff',
                fontSize: '0.95rem',
                maxWidth: '100%',
              }}
            >
              {listaRestaurantes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} ({r.ubicacion})
                </option>
              ))}
            </select>
          ) : (
            <p style={{ margin: 0, color: '#0d7377', fontWeight: 600 }}>
              {restauranteSeleccionado
                ? `${restauranteSeleccionado.nombre} (${restauranteSeleccionado.ubicacion})`
                : 'Cargando restaurante asignado...'}
            </p>
          )}
        </div>

        <span style={{ fontSize: '0.85rem', color: '#557571' }}>
          Los cambios se aplican al menú de esta cafetería.
        </span>
      </div>

      
      {esDueno && (
        <section
          className="panel"
          style={{
            marginBottom: '24px',
            border: '1px solid #d3ebe7',
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#0f3d3e', marginTop: 0 }}>
              Administradores de cocina
            </h3>
            <p style={{ color: '#557571', marginBottom: 0 }}>
              Crea y administra las cuentas que pueden gestionar la cocina de
              {` ${restauranteSeleccionado?.nombre ?? 'esta cafetería'}`}.
            </p>
          </div>

          <form
            onSubmit={handleCrearAdminCocina}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
              marginBottom: '24px',
            }}
          >
            <label>
              Nombre completo
              <input
                value={nombreAdminCocina}
                onChange={(e) => setNombreAdminCocina(e.target.value)}
                maxLength={50}
                placeholder="Ej: Carlos Pérez"
                required
              />
            </label>

            <label>
              Teléfono
              <input
                type="tel"
                value={telefonoAdminCocina}
                onChange={(e) => setTelefonoAdminCocina(e.target.value)}
                maxLength={20}
                placeholder="Ej: 3001234567"
                required
              />
            </label>

            <label>
              Correo institucional
              <input
                type="email"
                value={correoAdminCocina}
                onChange={(e) => setCorreoAdminCocina(e.target.value)}
                maxLength={100}
                placeholder="cocinero@upb.edu.co"
                required
              />
            </label>

            <label>
              Contraseña inicial
              <input
                type="password"
                value={passwordAdminCocina}
                onChange={(e) => setPasswordAdminCocina(e.target.value)}
                minLength={8}
                maxLength={72}
                placeholder="Mínimo 8 caracteres"
                required
              />
            </label>

            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                justifyContent: 'flex-start',
              }}
            >
              <button type="submit" disabled={savingAdmin}>
                {savingAdmin ? 'Creando cuenta...' : 'Crear administrador'}
              </button>
            </div>
          </form>

          {adminCocinaError && (
            <p className="error-message" role="alert">
              {adminCocinaError}
            </p>
          )}

          {adminCocinaSuccess && (
            <p role="status" style={{ color: '#16734a' }}>
              {adminCocinaSuccess}
            </p>
          )}

          <h4 style={{ color: '#0f3d3e' }}>
            Administradores asignados
          </h4>

          {loadingAdmins ? (
            <p>Cargando administradores...</p>
          ) : administradoresCocina.length === 0 ? (
            <p>No hay administradores de cocina activos en esta cafetería.</p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}
            >
              {administradoresCocina.map((administrador) => (
                <li
                  key={administrador.administradorId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '14px 0',
                    borderBottom: '1px solid #e0eeeb',
                  }}
                >
                  <div>
                    <strong>{administrador.nombre}</strong>
                    <p style={{ margin: '4px 0', color: '#557571' }}>
                      {administrador.correo}
                    </p>
                    <small style={{ color: '#557571' }}>
                      Teléfono: {administrador.telefono}
                    </small>
                  </div>

                  <button
                    type="button"
                    className="mini-button danger"
                    onClick={() => handleRetirarAdminCocina(administrador)}
                  >
                    Retirar acceso
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}


      <div className="dashboard-grid">
        <article className="metric-card accent">
          <span>Pedidos activos</span>
          <strong>24</strong>
          <small>5 nuevos hoy</small>
        </article>

        <article className="metric-card">
          <span>Productos</span>
          <strong>{products.length}</strong>
          <small>Catálogo del restaurante</small>
        </article>

        <article className="metric-card">
          <span>Ganancias</span>
          <strong>$3.4M</strong>
          <small>vs. $2.9M mes anterior</small>
        </article>
      </div>

      <div className="dashboard-panels">
        <div className="panel">
          <h3>Acciones rápidas</h3>
          <ul>
            <li>Ver pedidos pendientes</li>
            <li>Actualizar menú</li>
            <li>Configurar cafetería</li>
            <li>Revisar métricas</li>
          </ul>
        </div>

        <div className="panel">
          <h3>Resumen del día</h3>
          <div className="summary-row">
            <span>Entrega en curso</span>
            <strong>18</strong>
          </div>
          <div className="summary-row">
            <span>Clientes activos</span>
            <strong>312</strong>
          </div>
          <div className="summary-row">
            <span>Calificación promedio</span>
            <strong>4.8</strong>
          </div>
        </div>
      </div>

      <div className="product-section">
        <div className="panel">
          <h3>Gestión de productos</h3>

          <form
            className="product-form"
            onSubmit={
              editingProductId !== null
                ? handleUpdateProduct
                : handleCreateProduct
            }
          >
            <label>
              Nombre
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej: Café Americano"
                required
              />
            </label>

            <label>
              Descripción
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Ej: Café preparado con leche..."
                required
              />
            </label>

            <label>
              Precio (COP)
              <input
                type="number"
                min="1"
                step="1"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                placeholder="2500"
                required
              />
            </label>

            <label>
              Categoría
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
              >
                <option value="1">Almuerzos</option>
                <option value="2">Bebidas</option>
                <option value="3">Snacks</option>
              </select>
            </label>

            <div className="product-extra-manager">
              <h4>Ingredientes extra disponibles en esta cafetería</h4>
              <p>Marca cuáles se podrán agregar a este producto. Cada restaurante administra sus propios precios.</p>
              {restaurantExtras.length === 0 ? (
                <p>Aún no hay ingredientes extra creados.</p>
              ) : restaurantExtras.map((extra) => (
                <div className="restaurant-extra-row" key={extra.id}>
                  {editingExtraId === extra.id ? (
                    <>
                      <input aria-label="Nombre del ingrediente extra" value={editingExtraName} onChange={(event) => setEditingExtraName(event.target.value)} maxLength={50} />
                      <input aria-label="Precio del ingrediente extra" type="number" min="1" step="1" value={editingExtraPrice} onChange={(event) => setEditingExtraPrice(event.target.value)} />
                      <button type="button" onClick={() => void guardarEdicionExtra(extra.id)}>Guardar</button>
                      <button type="button" className="secondary-button" onClick={() => setEditingExtraId(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={selectedExtraIds.includes(Number(extra.id))}
                          onChange={(event) => setSelectedExtraIds((ids) => event.target.checked
                            ? [...new Set([...ids, Number(extra.id)])]
                            : ids.filter((id) => id !== Number(extra.id)))}
                        />
                        <span>{extra.nombre} · ${Number(extra.precio).toLocaleString('es-CO')}</span>
                      </label>
                      <button type="button" className="mini-button" onClick={() => { setEditingExtraId(extra.id); setEditingExtraName(extra.nombre); setEditingExtraPrice(String(extra.precio)) }}>Editar precio</button>
                    </>
                  )}
                </div>
              ))}
              <div className="new-extra-fields">
                <label>
                  Nuevo ingrediente extra
                  <input value={newExtraName} onChange={(event) => setNewExtraName(event.target.value)} placeholder="Ej. Queso extra" maxLength={50} />
                </label>
                <label>
                  Precio adicional (COP)
                  <input type="number" min="1" step="1" value={newExtraPrice} onChange={(event) => setNewExtraPrice(event.target.value)} placeholder="2000" />
                </label>
                <button type="button" onClick={() => void handleCreateExtra()} disabled={savingExtra}>
                  {savingExtra ? 'Creando...' : 'Crear ingrediente extra'}
                </button>
              </div>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={disponible}
                onChange={(e) => setDisponible(e.target.checked)}
              />
              Disponible
            </label>

            {productError && <p className="error-message">{productError}</p>}

            <div className="product-form-actions">
              <button
                type="submit"
                disabled={!selectedRestauranteId || listaRestaurantes.length === 0}
              >
                {editingProductId !== null
                  ? 'Actualizar producto'
                  : 'Guardar producto'}
              </button>

              {editingProductId !== null && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={resetProductForm}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="panel">
          <h3>Catálogo actual</h3>

          {loadingProducts ? (
            <p>Cargando productos...</p>
          ) : products.length === 0 ? (
            <p>No hay productos registrados para esta cafetería.</p>
          ) : (
            <ul className="product-list">
              {products.map((product) => (
                <li
                  key={product.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <img
                    src={getImagenPorCategoria(
                      product.categoriaId,
                      product.nombre,
                    )}
                    alt=""
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                    }}
                  />

                  <div style={{ flex: 1 }}>
                    <strong>{product.nombre}</strong>
                    <span>
                      {product.disponible ? 'Disponible' : 'Sin stock'}
                    </span>
                  </div>

                  <div className="product-actions">
                    <span>
                      ${Number(product.precio).toLocaleString('es-CO')}
                    </span>

                    <div className="inline-actions">
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => handleEditProduct(product)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="mini-button danger"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
