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
    expect(searchMunicipalities('MADRÍD', 3).length).toBeGreaterThan(0)
  })
})
