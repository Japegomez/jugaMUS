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
  notify_on_friend_request: boolean
  notify_on_match_invitation: boolean
}

export type NotificationPrefField = keyof NotificationPrefState

type EventField = Exclude<NotificationPrefField, 'notify_push'>

const EVENT_FIELDS = [
  'notify_on_join',
  'notify_on_match_start',
  'notify_on_match_edit',
  'notify_on_match_cancel',
  'notify_on_result',
  'notify_on_reminder_24h',
  'notify_on_reminder_2h',
  'notify_on_reminder_in_progress',
  'notify_on_friend_request',
  'notify_on_match_invitation',
] as const satisfies ReadonlyArray<EventField>

/** Compile-time guard: EVENT_FIELDS must list every EventField member. */
type _AssertEventFieldsComplete =
  Exclude<EventField, (typeof EVENT_FIELDS)[number]> extends never ? true : never
const _eventFieldsComplete: _AssertEventFieldsComplete = true
void _eventFieldsComplete

function eventPrefsFrom(
  profile: NotificationPrefState,
  override?: Partial<Pick<NotificationPrefState, EventField>>
): Omit<NotificationPrefState, 'notify_push'> {
  const next = {} as Omit<NotificationPrefState, 'notify_push'>
  for (const field of EVENT_FIELDS) {
    next[field] = override?.[field] ?? profile[field]
  }
  return next
}

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
  notify_on_friend_request: true,
  notify_on_match_invitation: true,
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
  notify_on_friend_request: false,
  notify_on_match_invitation: false,
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

  return withMasterPush(
    eventPrefsFrom(profile, { [field]: value } as Partial<Pick<NotificationPrefState, EventField>>)
  )
}

/** Toggle 24h / 2h reminder chips (independent; both can be on). */
export function buildReminderTimingUpdates(
  profile: NotificationPrefState,
  timing: '24h' | '2h',
  enabled: boolean
): NotificationPrefState {
  return withMasterPush(
    eventPrefsFrom(profile, {
      notify_on_reminder_24h: timing === '24h' ? enabled : profile.notify_on_reminder_24h,
      notify_on_reminder_2h: timing === '2h' ? enabled : profile.notify_on_reminder_2h,
    })
  )
}
