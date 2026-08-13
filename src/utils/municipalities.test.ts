import { searchMunicipalities } from '@/utils/municipalities'

describe('searchMunicipalities', () => {
  it('returns empty for blank query', () => {
    expect(searchMunicipalities('')).toEqual([])
    expect(searchMunicipalities('   ')).toEqual([])
  })

  it('matches without accents and respects limit', () => {
    const results = searchMunicipalities('madrid', 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(5)
    expect(results.every((m) => typeof m.code === 'string' && typeof m.name === 'string')).toBe(
      true
    )
    expect(results.some((m) => m.name.toLowerCase().includes('madrid'))).toBe(true)

    const accented = searchMunicipalities('MADRÍD', 3)
    expect(accented.length).toBeGreaterThan(0)
    expect(
      accented.some((m) => /madrid/i.test(m.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
    ).toBe(true)
  })
})
