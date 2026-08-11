import { formatCityAndPlace } from '@/utils/location'

describe('formatCityAndPlace', () => {
  it('shows city and trimmed place when defined', () => {
    expect(formatCityAndPlace('Madrid', true, '  Bar La Peña  ')).toBe('Madrid · Bar La Peña')
  })

  it('shows placeholder when place is not defined', () => {
    expect(formatCityAndPlace('Sevilla', false, null)).toBe('Sevilla · Lugar por definir')
  })

  it('falls back when city is empty', () => {
    expect(formatCityAndPlace('  ', true, 'Local')).toBe('Ciudad por definir · Local')
  })

  it('returns only city when defined but text missing', () => {
    expect(formatCityAndPlace('Bilbao', true, '')).toBe('Bilbao')
  })
})
