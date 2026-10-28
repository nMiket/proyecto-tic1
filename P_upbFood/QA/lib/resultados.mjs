// Registro de resultados por criterio y escritura del Excel y del reporte.
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'

const resultados = new Map()

function guardar(n, estado, obtenido) {
  const previo = resultados.get(n)
  // Un ERROR no se sobrescribe con un OK posterior del mismo criterio.
  if (previo && previo.estado === 'ERROR' && estado !== 'ERROR') return
  resultados.set(n, { estado, obtenido: String(obtenido).slice(0, 900) })
}

export const ok = (n, obtenido) => guardar(n, 'OK', obtenido)
export const error = (n, obtenido) => guardar(n, 'ERROR', obtenido)
export const pendiente = (n, obtenido) => guardar(n, 'PENDIENTE', obtenido)

/** Marca OK o ERROR según la condición. */
export function verificar(n, condicion, siCumple, siNoCumple) {
  if (condicion) ok(n, siCumple)
  else error(n, siNoCumple)
  return Boolean(condicion)
}

export const tieneResultado = (n) => resultados.has(n)

/**
 * Ejecuta un bloque de pruebas. Si algo falla de forma inesperada, los criterios
 * del bloque que aún no tengan resultado quedan en ERROR con el motivo.
 */
export async function caso(titulo, numeros, fn) {
  const inicio = Date.now()
  process.stdout.write(`▶ ${titulo} (${numeros.join(', ')})\n`)
  try {
    await fn()
  } catch (e) {
    const motivo = e?.message ?? String(e)
    for (const n of numeros) {
      if (!resultados.has(n)) error(n, `No se pudo completar la prueba: ${motivo}`)
    }
    process.stdout.write(`   ✖ ${motivo}\n`)
  }
  for (const n of numeros) {
    if (!resultados.has(n)) pendiente(n, 'La prueba no registró resultado; revisar manualmente.')
  }
  const resumen = numeros.map((n) => `${n}:${resultados.get(n).estado}`).join(' ')
  process.stdout.write(`   ${resumen}  (${((Date.now() - inicio) / 1000).toFixed(1)} s)\n`)
}

export async function escribirResultados({ plantilla, carpeta, inicio }) {
  fs.mkdirSync(carpeta, { recursive: true })
  const libro = new ExcelJS.Workbook()
  await libro.xlsx.readFile(plantilla)
  const hoja = libro.getWorksheet('Plan de Pruebas Funcionales')
  const filas = []

  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila < 3) return
    const n = Number(fila.getCell(1).value)
    if (!Number.isFinite(n) || !resultados.has(n)) return
    const { estado, obtenido } = resultados.get(n)
    fila.getCell(11).value = obtenido
    fila.getCell(12).value = estado
    filas.push({
      n,
      hu: fila.getCell(2).value,
      criterio: String(fila.getCell(6).value ?? ''),
      estado,
      obtenido,
    })
  })

  libro.calcProperties.fullCalcOnLoad = true
  const archivoExcel = path.join(carpeta, 'Plan_de_Pruebas_UPB_resultados.xlsx')
  await libro.xlsx.writeFile(archivoExcel)

  const total = filas.length
  const cuenta = (e) => filas.filter((f) => f.estado === e).length
  const porHu = new Map()
  for (const f of filas) {
    const r = porHu.get(f.hu) ?? { OK: 0, ERROR: 0, PENDIENTE: 0 }
    r[f.estado] += 1
    porHu.set(f.hu, r)
  }

  const lineas = [
    '# Resultados del plan de pruebas — UPB Food',
    '',
    `Ejecución: ${inicio.toLocaleString('es-CO')} · Duración: ${Math.round((Date.now() - inicio.getTime()) / 1000)} s`,
    '',
    `Criterios ejecutados: **${total}** · OK: **${cuenta('OK')}** · ERROR: **${cuenta('ERROR')}** · PENDIENTE (revisión manual o bloqueado): **${cuenta('PENDIENTE')}**`,
    '',
    '## Resumen por historia',
    '',
    '| HU | OK | ERROR | PENDIENTE |',
    '|---|---:|---:|---:|',
    ...[...porHu.entries()].map(([hu, r]) => `| ${hu} | ${r.OK} | ${r.ERROR} | ${r.PENDIENTE} |`),
    '',
    '## Detalle',
    '',
    '| N° | HU | Estado | Criterio | Resultado obtenido |',
    '|---:|---|---|---|---|',
    ...filas.map((f) => `| ${f.n} | ${f.hu} | ${f.estado} | ${f.criterio.replace(/\|/g, '/')} | ${f.obtenido.replace(/\|/g, '/').replace(/\n/g, ' ')} |`),
    '',
  ]
  const archivoReporte = path.join(carpeta, 'reporte.md')
  fs.writeFileSync(archivoReporte, lineas.join('\n'), 'utf8')

  return { archivoExcel, archivoReporte, total, ok: cuenta('OK'), error: cuenta('ERROR'), pendiente: cuenta('PENDIENTE') }
}
