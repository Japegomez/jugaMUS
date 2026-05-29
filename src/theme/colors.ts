export const Colors = {
  background: '#FFFFFF',
  surface: '#F8F8F8',
  primary: '#1A5F4A',
  textPrimary: '#111111',
  textSecondary: '#767676',
  border: '#E8E8E8',
  tabActive: '#1A5F4A',
  /** Bottom tab bar: active label and pill background (text-only tabs). */
  tabBarActive: '#4A4A4A',
  tabBarInactive: '#A8A8A8',
  tabBarActiveBackground: '#EDEDED',
  danger: '#B00020',
  warning: '#7A6000',
  white: '#FFFFFF',
  statusActive: '#1A5F4A',
  statusPending: '#7A6000',
  statusUpcoming: '#767676',
  wonBackground: '#F3FAF6',
  lostBackground: '#FDF5F5',
  /** Profile match history — slightly stronger tint than generic won/lost surfaces. */
  historyWonBackground: '#D4EDDF',
  historyLostBackground: '#F8D4D4',
  admin: '#2C5282',
  switchTrackOff: '#CFCFCF',
} as const

export type ColorToken = (typeof Colors)[keyof typeof Colors]
