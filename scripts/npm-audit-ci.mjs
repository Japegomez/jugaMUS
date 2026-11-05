#!/usr/bin/env node
/**
 * CI wrapper around `npm audit --audit-level=high`.
 *
 * Expo SDK 54 toolchain advisories (build-time DoS only) whose fixes break the
 * current Metro / Expo CLI pin and cannot land without an SDK upgrade:
 *
 * - `image-size` (via Metro): fix 2.0.3+ breaks `metro@0.83.3` (string path vs
 *   ArrayBuffer/TypedArray API). Needs Metro 0.87+.
 * - `minimatch` (eslint/jest/Expo): fix 11.0.1+ breaks minimatch@3 CJS default
 *   export consumers (`test-exclude`).
 * - `glob` (Expo CLI/config): fix 14.0.2+ while Expo 54 pins `glob@13.x`.
 *
 * Allowlist is per GHSA id (not per package): a new advisory on the same
 * package still fails the job. Any other high/critical advisory also fails.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ALLOWED_GHSA = new Set([
  'GHSA-w3rx-r6r6-pgpr', // image-size ICNS infinite loop
  'GHSA-5p2g-fcmc-qvqq', // image-size JXL/HEIF infinite loop
  'GHSA-g3hv-75wg-m249', // minimatch globparts amplification
  'GHSA-3g3m-2fjr-6pw4', // glob AbortSignal cancellation bypass
])

const ALLOWED_PACKAGES = new Set(['image-size', 'minimatch', 'glob'])

/**
 * Check if an advisory hit is blocking (not allowlisted).
 * Only the GHSA ids above on their Expo-toolchain packages are skipped.
 * @param {Object} hit - Advisory hit object with package, ghsa, etc.
 * @returns {boolean} - true if the hit should block the build
 */
export function isBlocking(hit) {
  if (!hit.ghsa || !ALLOWED_GHSA.has(hit.ghsa)) return true
  return !ALLOWED_PACKAGES.has(hit.package)
}

function main() {
  const result = spawnSync('npm', ['audit', '--json', '--audit-level=high'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === 'win32',
  })

  const stdout = result.stdout || ''
  let report
  try {
    report = JSON.parse(stdout)
  } catch {
    console.error('npm audit did not return JSON')
    console.error(stdout || result.stderr)
    process.exit(1)
  }

  if (result.status === 0) {
    console.log('npm audit: no high/critical vulnerabilities')
    process.exit(0)
  }

  const advisoryHits = []
  for (const [name, vuln] of Object.entries(report.vulnerabilities || {})) {
    if (!['high', 'critical'].includes(vuln.severity)) continue
    for (const via of vuln.via || []) {
      if (typeof via !== 'object' || !via) continue
      const match = String(via.url || '').match(/GHSA-[\w-]+/)
      const ghsa = match ? match[0] : null
      advisoryHits.push({
        package: name,
        severity: vuln.severity,
        ghsa,
        title: via.title || via.name || 'unknown',
        url: via.url || null,
      })
    }
  }

  const blocking = advisoryHits.filter(isBlocking)

  if (blocking.length === 0) {
    const allowed = [...new Set(advisoryHits.map((h) => h.ghsa).filter(Boolean))]
    console.log(
      `npm audit: only allowlisted build-toolchain advisories remain (${allowed.join(', ')}; no upstream patch on Expo SDK 54).`,
    )
    process.exit(0)
  }

  console.error('npm audit: blocking high/critical advisories:')
  for (const hit of blocking) {
    console.error(`- ${hit.severity} ${hit.package}: ${hit.title}${hit.ghsa ? ` (${hit.ghsa})` : ''}`)
  }
  process.exit(1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
