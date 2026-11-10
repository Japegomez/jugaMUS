#!/usr/bin/env node
/**
 * Disposable Postgres security regression harness.
 *
 * Starts postgres:16-alpine, applies a Supabase shim, all supabase/migrations
 * in order, then scripts/security/assert-security.sql. Tears down the container.
 *
 * Usage: node scripts/security/db-harness.mjs
 * npm:   npm run verify:security
 */
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')
const SHIM_PATH = join(__dirname, 'supabase-shim.sql')
const ASSERT_PATH = join(__dirname, 'assert-security.sql')

const IMAGE = process.env.SECURITY_HARNESS_IMAGE || 'postgres:16-alpine'
const PG_USER = 'postgres'
const PG_PASSWORD = 'postgres'
const PG_DB = 'postgres'
const CONTAINER = `jugamus-sec-${randomBytes(4).toString('hex')}`
const HOST_PORT = String(55432 + (createHash('sha1').update(CONTAINER).digest()[0] % 1000))

const KEEP = process.env.SECURITY_HARNESS_KEEP === '1'

function log(msg) {
  process.stdout.write(`${msg}\n`)
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: opts.stdio ?? 'pipe',
    env: { ...process.env, ...(opts.env || {}) },
    cwd: opts.cwd || ROOT,
    maxBuffer: 32 * 1024 * 1024,
  })
  return res
}

function mustRun(cmd, args, opts = {}) {
  const res = run(cmd, args, opts)
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').trim()
    throw new Error(
      `Command failed (${cmd} ${args.join(' ')}): exit ${res.status}\n${err}`
    )
  }
  return res
}

function dockerAvailable() {
  const res = run('docker', ['version', '--format', '{{.Server.Version}}'])
  return res.status === 0 && Boolean((res.stdout || '').trim())
}

function waitForReady(maxMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const res = run('docker', [
      'exec',
      '-e',
      `PGPASSWORD=${PG_PASSWORD}`,
      CONTAINER,
      'pg_isready',
      '-U',
      PG_USER,
      '-d',
      PG_DB,
    ])
    if (res.status === 0) return
    spawnSync(process.execPath, ['-e', 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500)'], {
      stdio: 'ignore',
    })
  }
  throw new Error('Postgres did not become ready in time')
}

function psqlFile(filePath, label) {
  log(`→ applying ${label}`)
  const res = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      '-e',
      `PGPASSWORD=${PG_PASSWORD}`,
      CONTAINER,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      PG_USER,
      '-d',
      PG_DB,
      '-f',
      '-',
    ],
    {
      encoding: 'utf8',
      input: readFileSync(filePath, 'utf8'),
      maxBuffer: 64 * 1024 * 1024,
    }
  )
  if (res.status !== 0) {
    throw new Error(
      `psql failed for ${label} (exit ${res.status})\n${(res.stderr || res.stdout || '').trim()}`
    )
  }
  return res
}

function psqlSql(sql, label) {
  log(`→ ${label}`)
  const res = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      '-e',
      `PGPASSWORD=${PG_PASSWORD}`,
      CONTAINER,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      PG_USER,
      '-d',
      PG_DB,
      '-f',
      '-',
    ],
    {
      encoding: 'utf8',
      input: sql,
      maxBuffer: 64 * 1024 * 1024,
    }
  )
  if (res.status !== 0) {
    throw new Error(
      `psql failed for ${label} (exit ${res.status})\n${(res.stderr || res.stdout || '').trim()}`
    )
  }
  return res
}

/**
 * Strip CREATE EXTENSION for pg_net / pg_cron (not in alpine). Shim provides stubs.
 * Leave pgcrypto / pg_trgm alone (contrib is present).
 *
 * Also rewrite one historical SQL quirk in 098 (array_agg + ORDER BY ord LIMIT
 * outside the aggregate) that fails on stock Postgres 16; production already
 * applied a semantically equivalent normalize. Do not edit the migration file
 * (checksum drift).
 */
function preprocessMigration(sql, fileName) {
  let out = sql
  out = out.replace(
    /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_net\s+WITH\s+SCHEMA\s+extensions\s*;/gi,
    '-- harness: pg_net stubbed in supabase-shim.sql\n'
  )
  out = out.replace(
    /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_cron\s+WITH\s+SCHEMA\s+cron\s*;/gi,
    '-- harness: pg_cron stubbed in supabase-shim.sql\n'
  )
  out = out.replace(
    /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_net\s*;/gi,
    '-- harness: pg_net stubbed in supabase-shim.sql\n'
  )
  out = out.replace(
    /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_cron\s*;/gi,
    '-- harness: pg_cron stubbed in supabase-shim.sql\n'
  )

  if (fileName.includes('098_badge_showcase')) {
    // Move LIMIT inside the row source so ORDER BY ord is not at aggregate level.
    out = out.replace(
      /\) s\s*ORDER BY ord\s*LIMIT 3\s*\)/m,
      `) s
        )`
    )
    out = out.replace(
      /WHERE t\.rn = 1\s*\) s/m,
      `WHERE t.rn = 1
          ORDER BY ord
          LIMIT 3
        ) s`
    )
  }

  // 112 changes OUT columns vs 109; CREATE OR REPLACE cannot change return type.
  // Later migrations (117/120) DROP+CREATE correctly; for clean rebuilds, DROP first.
  if (fileName.includes('112_list_my_match_invitations')) {
    out = out.replace(
      /CREATE OR REPLACE FUNCTION public\.list_my_match_invitations\(\)/i,
      `DROP FUNCTION IF EXISTS public.list_my_match_invitations();\nCREATE OR REPLACE FUNCTION public.list_my_match_invitations()`
    )
  }

  // Ensure search_path sees extensions helpers during migration apply
  return `SET search_path TO public, extensions, auth, storage, net, cron;\n${out}`
}

function listMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory missing: ${MIGRATIONS_DIR}`)
  }
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

function cleanup() {
  if (KEEP) {
    log(`SECURITY_HARNESS_KEEP=1 — leaving container ${CONTAINER} running`)
    return
  }
  run('docker', ['rm', '-f', CONTAINER])
}

async function main() {
  if (!dockerAvailable()) {
    throw new Error('Docker is not available. Install/start Docker Desktop and retry.')
  }
  if (!existsSync(SHIM_PATH) || !existsSync(ASSERT_PATH)) {
    throw new Error('Missing shim or assert SQL under scripts/security/')
  }

  const migrations = listMigrations()
  log(`Security harness: image=${IMAGE} container=${CONTAINER} migrations=${migrations.length}`)

  mustRun('docker', [
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-e',
    `POSTGRES_PASSWORD=${PG_PASSWORD}`,
    '-p',
    `${HOST_PORT}:5432`,
    IMAGE,
  ])

  try {
    waitForReady()
    log('Postgres ready')

    psqlFile(SHIM_PATH, 'supabase-shim.sql')
    psqlSql(
      `ALTER DATABASE ${PG_DB} SET search_path TO public, extensions, auth, storage, net, cron;`,
      'set database search_path'
    )

    let applied = 0
    for (const file of migrations) {
      const full = join(MIGRATIONS_DIR, file)
      const sql = preprocessMigration(readFileSync(full, 'utf8'), file)
      try {
        psqlSql(sql, file)
      } catch (err) {
        throw new Error(`Migration failed: ${file}\n${err.message}`)
      }
      applied += 1
      if (applied % 20 === 0 || applied === migrations.length) {
        log(`… applied ${applied}/${migrations.length}`)
      }
    }

    const assertRes = psqlFile(ASSERT_PATH, 'assert-security.sql')
    const out = `${assertRes.stdout || ''}\n${assertRes.stderr || ''}`
    if (!/ALL SECURITY ASSERTIONS PASSED/i.test(out)) {
      throw new Error(
        `Assertions finished without success marker.\n${out.slice(-4000)}`
      )
    }

    const passes = [...out.matchAll(/NOTICE:\s+PASS:\s+(.+)/g)].map((m) => m[1])
    log(`verify:security PASS (${passes.length} assertions)`)
    for (const p of passes) log(`  ✓ ${p}`)
    process.exitCode = 0
  } catch (err) {
    log(`verify:security FAIL`)
    log(String(err && err.message ? err.message : err))
    process.exitCode = 1
  } finally {
    cleanup()
  }
}

main()
