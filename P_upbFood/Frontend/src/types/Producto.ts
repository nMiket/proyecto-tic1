export interface IngredienteExtra {
  id: number;
  nombre: string;
  precio: number;
}

export interface Producto {
  id: number | string;
  nombre: string;
  descripcion: string;
  precio: number;
  imagenUrl?: string;
  categoriaId?: number;
  disponible?: boolean;
  ingredientesExtra?: IngredienteExtra[];
  adiciones?: IngredienteExtra[];
}
