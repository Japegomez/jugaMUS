import { Platform } from 'react-native'

import { createDefaultScoreboardState } from '@/hooks/useLiveScoreboard'
import {
  clearScoreboardState,
  loadScoreboardState,
  saveScoreboardState,
} from '@/lib/scoreboardStorage'

const mockStorage = new Map<string, string>()

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value)
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key)
    }),
  },
}))

describe('scoreboardStorage', () => {
  beforeEach(() => {
    mockStorage.clear()
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
  })

  it('returns null when nothing stored', async () => {
    await expect(loadScoreboardState('m1')).resolves.toBeNull()
  })

  it('persists and loads scoreboard state', async () => {
    const state = createDefaultScoreboardState()
    state.pointsA = 15

    await saveScoreboardState('m1', state)
    await expect(loadScoreboardState('m1')).resolves.toEqual(state)
  })

  it('clears stored state', async () => {
    await saveScoreboardState('m1', createDefaultScoreboardState())
    await clearScoreboardState('m1')
    await expect(loadScoreboardState('m1')).resolves.toBeNull()
  })

  it('returns null for invalid JSON', async () => {
    mockStorage.set('jugamus.scoreboard.m1', '{bad json')
    await expect(loadScoreboardState('m1')).resolves.toBeNull()
  })
})
