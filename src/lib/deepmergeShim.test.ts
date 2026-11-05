/**
 * Guards the vendored `deepmerge` shim (vendor/deepmerge).
 *
 * The override in package.json replaces deepmerge 4.3.1 with a local copy that
 * carries the GHSA-gcqx-w48m-w2h4 fix, because 4.3.1 is the latest published
 * release and the advisory has no patched version upstream. These tests fail if
 * someone drops the override, restores the unpatched package, or loses the
 * `__proto__`/`constructor`/`prototype` filtering.
 */
import deepmerge from 'deepmerge'

describe('deepmerge shim', () => {
  it('does not leak a tainted __proto__ from the target onto the result', () => {
    const tainted = JSON.parse('{"__proto__":{"polluted":"yes"}}')
    const merged = deepmerge<{ safe: number; polluted?: string }>(tainted, { safe: 1 })

    expect(merged.safe).toBe(1)
    expect(merged.polluted).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(merged, '__proto__')).toBe(false)
  })

  it('does not leak a tainted __proto__ from the source onto the result', () => {
    const tainted = JSON.parse('{"nested":{"__proto__":{"polluted":"yes"}}}')
    const merged = deepmerge({}, tainted)

    expect(merged).toEqual({ nested: {} })
  })

  it('does not pollute Object.prototype', () => {
    deepmerge(JSON.parse('{"__proto__":{"polluted":"yes"}}'), {})
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('still deep-merges plain objects', () => {
    expect(deepmerge({ a: { b: 1 } }, { a: { c: 2 } })).toEqual({ a: { b: 1, c: 2 } })
  })

  it('still concatenates arrays by default', () => {
    expect(deepmerge({ list: [1, 2] }, { list: [3] })).toEqual({ list: [1, 2, 3] })
  })

  it('still honours a custom arrayMerge', () => {
    const merged = deepmerge(
      { list: [1] },
      { list: [2] },
      {
        arrayMerge: (_target, source) => source,
      }
    )

    expect(merged.list).toEqual([2])
  })

  it('still supports deepmerge.all', () => {
    expect(deepmerge.all([{ a: 1 }, { b: 2 }])).toEqual({ a: 1, b: 2 })
  })
})
