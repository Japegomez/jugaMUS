/**
 * Descarga un CSV de municipios (código INE 5 dígitos + nombre) y genera
 * `src/data/municipalities.json` para la app.
 *
 * Por defecto usa el dataset de codeforspain/ds-organizacion-administrativa
 * (CSV `municipios.csv`, basado en el INE). Puedes sustituirlo por un CSV
 * descargado del INE si las columnas son compatibles (ver detección abajo).
 *
 * Uso:
 *   node scripts/sync-municipalities.mjs
 *   node scripts/sync-municipalities.mjs --input ./ruta/al/archivo.csv
 *   INE_MUNICIPALITIES_URL=https://... node scripts/sync-municipalities.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_FILE = join(ROOT, 'src', 'data', 'municipalities.json')

/** CSV con columnas `municipio_id` y `nombre` (codeforspain / equivalente). */
const DEFAULT_CSV_URL =
  'https://raw.githubusercontent.com/codeforspain/ds-organizacion-administrativa/master/data/municipios.csv'

function parseArgs(argv) {
  const args = { input: null, url: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) {
      args.input = argv[++i]
    } else if (argv[i] === '--url' && argv[i + 1]) {
      args.url = argv[++i]
    }
  }
  return args
}

/** Parsea una línea CSV respetando comillas dobles. */
function parseCsvLine(line) {
  const fields = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      fields.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  fields.push(cur)
  return fields.map((f) => f.trim())
}

function normHeader(h) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function colIndex(headers, candidates) {
  const lower = headers.map(normHeader)
  for (const cand of candidates) {
    const n = normHeader(cand)
    const i = lower.indexOf(n)
    if (i >= 0) return i
  }
  return -1
}

function buildCode(fields, headers) {
  const codeDirect = colIndex(headers, ['municipio_id', 'codigo_ine', 'ine', 'id_municipio'])
  if (codeDirect >= 0) {
    const raw = fields[codeDirect]?.replace(/\D/g, '') ?? ''
    if (raw.length === 5) return raw
    if (raw.length === 6) return raw.slice(0, 5)
  }

  const iCpro = colIndex(headers, ['cpro', 'cp', 'provincia_id', 'cod_provincia'])
  const iCmun = colIndex(headers, ['cmun', 'cod_municipio', 'mun'])
  if (iCpro >= 0 && iCmun >= 0) {
    const p = (fields[iCpro] ?? '').replace(/\D/g, '').padStart(2, '0').slice(-2)
    const m = (fields[iCmun] ?? '').replace(/\D/g, '').padStart(3, '0').slice(-3)
    if (p.length === 2 && m.length === 3) return `${p}${m}`
  }

  return null
}

function buildName(fields, headers) {
  const iName = colIndex(headers, [
    'nombre',
    'denominacion',
    'literal',
    'nombre_municipio',
    'munombre',
  ])
  if (iName >= 0) return (fields[iName] ?? '').trim()
  return null
}

function parseMunicipalitiesCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) throw new Error('CSV vacío o sin datos')

  const headers = parseCsvLine(lines[0])
  const byCode = new Map()

  for (let li = 1; li < lines.length; li++) {
    const fields = parseCsvLine(lines[li])
    if (fields.length < headers.length && fields.every((f) => !f)) continue

    const code = buildCode(fields, headers)
    const name = buildName(fields, headers)
    if (!code || !name || code.length !== 5) continue
    byCode.set(code, name)
  }

  return [...byCode.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

async function main() {
  const args = parseArgs(process.argv)
  const url = args.url ?? process.env.INE_MUNICIPALITIES_URL ?? DEFAULT_CSV_URL
  const inputPath = args.input ?? process.env.INE_MUNICIPALITIES_INPUT ?? null

  let text
  if (inputPath) {
    const fullInput = isAbsolute(inputPath) ? inputPath : resolve(ROOT, inputPath)
    text = readFileSync(fullInput, 'utf8')
    console.log(`Leyendo CSV local: ${fullInput}`)
  } else {
    console.log(`Descargando: ${url}`)
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    text = await res.text()
  }

  const municipalities = parseMunicipalitiesCsv(text)
  if (municipalities.length < 1000) {
    throw new Error(`Pocos municipios parseados (${municipalities.length}). Revisa columnas del CSV.`)
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(municipalities), 'utf8')
  console.log(`OK → ${OUT_FILE} (${municipalities.length} municipios)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
