# PostHog funnels 1–2 events

## Goal

Instrument events for:

1. `user_signed_up` → `match_created` / `match_joined`
2. `match_created` → `match_completed`

## Events

| Event             | When                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| `user_signed_up`  | Email signup OK; OAuth/Apple when user is new (`created_at` ≈ `last_sign_in_at`) |
| `match_created`   | After `createMatch` succeeds                                                     |
| `match_joined`    | After `joinMatch` succeeds when not the auto-join from create                    |
| `match_completed` | When match reaches `finished` via rival **approve**, or direct/referee record    |

## Identity

`posthog.identify(userId)` after successful login/signup/OAuth; `reset` on sign-out.

## Out of scope

Invite funnel, screen tracking, tournament-specific funnels.
