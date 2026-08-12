import { buildNotifUpdates, buildReminderTimingUpdates } from './notificationPrefs'

const allOn = {
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

const allOff = {
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

describe('buildNotifUpdates', () => {
  it('turns all events on when master push is enabled', () => {
    expect(buildNotifUpdates(allOff, 'notify_push', true)).toEqual(allOn)
  })

  it('turns all events off when master push is disabled', () => {
    expect(buildNotifUpdates(allOn, 'notify_push', false)).toEqual(allOff)
  })

  it('enables master push when any event is turned on', () => {
    expect(buildNotifUpdates(allOff, 'notify_on_match_start', true)).toEqual({
      ...allOff,
      notify_push: true,
      notify_on_match_start: true,
    })
  })

  it('disables master push when the last event is turned off', () => {
    const onlyStart = {
      ...allOff,
      notify_push: true,
      notify_on_match_start: true,
    }
    expect(buildNotifUpdates(onlyStart, 'notify_on_match_start', false)).toEqual(allOff)
  })

  it('keeps master push on when another event remains enabled', () => {
    expect(buildNotifUpdates(allOn, 'notify_on_join', false)).toEqual({
      ...allOn,
      notify_on_join: false,
    })
  })
})

describe('buildReminderTimingUpdates', () => {
  it('toggles 24h independently and keeps 2h', () => {
    expect(buildReminderTimingUpdates(allOn, '24h', false)).toEqual({
      ...allOn,
      notify_on_reminder_24h: false,
    })
  })

  it('enables master push when selecting a timing from all-off', () => {
    expect(buildReminderTimingUpdates(allOff, '2h', true)).toEqual({
      ...allOff,
      notify_push: true,
      notify_on_reminder_2h: true,
    })
  })
})

describe('friend / match-invitation preferences', () => {
  it('toggling notify_on_match_invitation on enables master push from all-off', () => {
    expect(buildNotifUpdates(allOff, 'notify_on_match_invitation', true)).toEqual({
      ...allOff,
      notify_push: true,
      notify_on_match_invitation: true,
    })
  })

  it('toggling notify_on_friend_request off keeps master push when others remain', () => {
    expect(buildNotifUpdates(allOn, 'notify_on_friend_request', false)).toEqual({
      ...allOn,
      notify_on_friend_request: false,
    })
  })

  it('reminder timing updates preserve the new preferences', () => {
    const mixed = {
      ...allOn,
      notify_on_friend_request: false,
      notify_on_match_invitation: false,
      notify_on_reminder_2h: true,
      notify_on_reminder_24h: true,
    }
    expect(buildReminderTimingUpdates(mixed, '24h', false)).toEqual({
      ...mixed,
      notify_on_reminder_24h: false,
    })
  })
})
