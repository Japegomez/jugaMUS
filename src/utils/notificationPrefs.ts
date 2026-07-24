export type NotificationPrefState = {
  notify_push: boolean
  notify_on_join: boolean
  notify_on_match_start: boolean
  notify_on_match_edit: boolean
  notify_on_match_cancel: boolean
  notify_on_result: boolean
  notify_on_reminder_24h: boolean
  notify_on_reminder_2h: boolean
  notify_on_reminder_in_progress: boolean
}

export type NotificationPrefField = keyof NotificationPrefState

const EVENT_FIELDS = [
  'notify_on_join',
  'notify_on_match_start',
  'notify_on_match_edit',
  'notify_on_match_cancel',
  'notify_on_result',
  'notify_on_reminder_24h',
  'notify_on_reminder_2h',
  'notify_on_reminder_in_progress',
] as const satisfies ReadonlyArray<Exclude<NotificationPrefField, 'notify_push'>>

const ALL_ON: NotificationPrefState = {
  notify_push: true,
  notify_on_join: true,
  notify_on_match_start: true,
  notify_on_match_edit: true,
  notify_on_match_cancel: true,
  notify_on_result: true,
  notify_on_reminder_24h: true,
  notify_on_reminder_2h: true,
  notify_on_reminder_in_progress: true,
}

const ALL_OFF: NotificationPrefState = {
  notify_push: false,
  notify_on_join: false,
  notify_on_match_start: false,
  notify_on_match_edit: false,
  notify_on_match_cancel: false,
  notify_on_result: false,
  notify_on_reminder_24h: false,
  notify_on_reminder_2h: false,
  notify_on_reminder_in_progress: false,
}

function withMasterPush(events: Omit<NotificationPrefState, 'notify_push'>): NotificationPrefState {
  const anyEventOn = EVENT_FIELDS.some((key) => events[key])
  return { ...events, notify_push: anyEventOn }
}

/** Couples master push toggle with per-event preferences. */
export function buildNotifUpdates(
  profile: NotificationPrefState,
  field: NotificationPrefField,
  value: boolean
): NotificationPrefState {
  if (field === 'notify_push') {
    return value ? { ...ALL_ON } : { ...ALL_OFF }
  }

  return withMasterPush({
    notify_on_join: profile.notify_on_join,
    notify_on_match_start: profile.notify_on_match_start,
    notify_on_match_edit: profile.notify_on_match_edit,
    notify_on_match_cancel: profile.notify_on_match_cancel,
    notify_on_result: profile.notify_on_result,
    notify_on_reminder_24h: profile.notify_on_reminder_24h,
    notify_on_reminder_2h: profile.notify_on_reminder_2h,
    notify_on_reminder_in_progress: profile.notify_on_reminder_in_progress,
    [field]: value,
  })
}

/** Toggle 24h / 2h reminder chips (independent; both can be on). */
export function buildReminderTimingUpdates(
  profile: NotificationPrefState,
  timing: '24h' | '2h',
  enabled: boolean
): NotificationPrefState {
  return withMasterPush({
    notify_on_join: profile.notify_on_join,
    notify_on_match_start: profile.notify_on_match_start,
    notify_on_match_edit: profile.notify_on_match_edit,
    notify_on_match_cancel: profile.notify_on_match_cancel,
    notify_on_result: profile.notify_on_result,
    notify_on_reminder_24h: timing === '24h' ? enabled : profile.notify_on_reminder_24h,
    notify_on_reminder_2h: timing === '2h' ? enabled : profile.notify_on_reminder_2h,
    notify_on_reminder_in_progress: profile.notify_on_reminder_in_progress,
  })
}
