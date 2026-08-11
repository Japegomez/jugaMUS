#!/usr/bin/env node
/**
 * CI wrapper around `npm audit --audit-level=high`.
 *
 * `image-size` (via Metro / Expo SDK 54) has high DoS advisories with no
 * patched release (package archived; all versions <=2.0.2). Those are
 * build-time only and cannot be fixed without an Expo SDK bump.
 *
 * Any other high/critical advisory still fails the job.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ALLOWED_GHSA = new Set([
  'GHSA-w3rx-r6r6-pgpr', // image-size ICNS infinite loop
  'GHSA-5p2g-fcmc-qvqq', // image-size JXL/HEIF infinite loop
])

/**
 * Check if an advisory hit is blocking (not allowlisted).
 * Only image-size advisories with specific GHSA ids are allowlisted.
 * @param {Object} hit - Advisory hit object with package, ghsa, etc.
 * @returns {boolean} - true if the hit should block the build
 */
export function isBlocking(hit) {
  return !(hit.package === 'image-size' && hit.ghsa && ALLOWED_GHSA.has(hit.ghsa))
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
      `npm audit: only allowlisted build-toolchain advisories remain (${allowed.join(', ')} via image-size/Metro; no upstream patch on Expo SDK 54).`,
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
