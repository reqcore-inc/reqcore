/**
 * Lark (Feishu) VC integration via Calendar API.
 *
 * Creates a calendar event with vchat.vc_type="vc" which auto-generates
 * a Lark video meeting URL, then registers interviewer emails as event
 * attendees so they're recognized by Lark VC and can start the meeting
 * without waiting for the (bot) organizer.
 *
 * Required bot permissions: calendar:calendar:write, calendar:calendar.event:create,
 * contact:user.base:readonly (to resolve interviewer emails to open_id).
 *
 * Docs:
 * https://open.feishu.cn/document/server-docs/calendar-v4/calendar-event/create
 * https://open.feishu.cn/document/server-docs/calendar-v4/calendar-event-attendee/create
 * https://open.feishu.cn/document/server-docs/contact-v3/user/batch_get_id
 */
import { env } from './env'

export function isLarkVcConfigured(): boolean {
  return !!(env.LARK_APP_ID && env.LARK_APP_SECRET)
}

async function getLarkTenantAccessToken(): Promise<string> {
  const res = await $fetch<{ code: number; tenant_access_token: string; msg: string }>(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      body: { app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET },
    },
  )
  if (res.code !== 0) throw new Error(`Lark auth failed: ${res.msg}`)
  return res.tenant_access_token
}

/** Resolve emails to Lark open_ids. Unmatched emails are silently skipped. */
async function resolveOpenIds(token: string, emails: string[]): Promise<string[]> {
  if (emails.length === 0) return []

  const res = await $fetch<{
    code: number
    msg: string
    data?: { user_list: { user_id?: string; email: string }[] }
  }>('https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    query: { user_id_type: 'open_id' },
    body: { emails },
  })

  if (res.code !== 0 || !res.data) return []
  return res.data.user_list.map(u => u.user_id).filter((id): id is string => !!id)
}

export interface LarkVcReserveResult {
  /** Lark calendar event ID */
  reserveId: string
  /** Direct VC join URL */
  joinUrl: string
  /** Meeting number (empty string when not returned by calendar API) */
  meetingNo: string
}

export async function createLarkVcReserve(options: {
  title: string
  startTime: Date
  durationMinutes: number
  timezone: string
  /** Interviewer emails — added as calendar event attendees so they can start the VC without the bot organizer */
  interviewerEmails?: string[]
}): Promise<LarkVcReserveResult | null> {
  if (!isLarkVcConfigured()) return null

  const token = await getLarkTenantAccessToken()

  const endTime = new Date(options.startTime.getTime() + options.durationMinutes * 60 * 1000)

  const res = await $fetch<{
    code: number
    msg: string
    data?: {
      event: {
        event_id: string
        vchat?: {
          vc_type: string
          meeting_url?: string
        }
      }
    }
  }>('https://open.feishu.cn/open-apis/calendar/v4/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      summary: options.title,
      start_time: {
        timestamp: String(Math.floor(options.startTime.getTime() / 1000)),
        timezone: options.timezone,
      },
      end_time: {
        timestamp: String(Math.floor(endTime.getTime() / 1000)),
        timezone: options.timezone,
      },
      vchat: {
        vc_type: 'vc',
        meeting_settings: {
          allow_attendees_start: true,
        },
      },
    },
  })

  if (res.code !== 0 || !res.data) {
    throw new Error(`Lark calendar event creation failed (${res.code}): ${res.msg}`)
  }

  const eventId = res.data.event.event_id
  const joinUrl = res.data.event.vchat?.meeting_url ?? ''

  // Register interviewers as attendees — required for them to be recognized
  // by Lark VC and start the meeting without waiting for the bot organizer.
  const openIds = await resolveOpenIds(token, options.interviewerEmails ?? [])
  if (openIds.length > 0) {
    await $fetch('https://open.feishu.cn/open-apis/calendar/v4/calendars/primary/events/' + eventId + '/attendees', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      query: { user_id_type: 'open_id' },
      body: {
        attendees: openIds.map(openId => ({ type: 'user', user_id: openId })),
      },
    }).catch(() => {})
  }

  return {
    reserveId: eventId,
    joinUrl,
    meetingNo: '',
  }
}
