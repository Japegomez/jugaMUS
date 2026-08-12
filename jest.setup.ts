import '@testing-library/jest-dom'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('@/lib/supabase', () => {
  const { createSupabaseMock } = require('./src/__test-utils__/supabaseMock')
  return { supabase: createSupabaseMock() }
})
