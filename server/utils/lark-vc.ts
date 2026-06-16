/**
 * Lark (Feishu) VC integration via Calendar API.
 *
 * Creates a calendar event with vchat.vc_type="vc" which auto-generates
 * a Lark video meeting URL. Uses bot (tenant) token — requires the app to
 * have calendar:calendar:write and calendar:calendar.event:create permissions.
 *
 * Docs: https://open.feishu.cn/document/server-docs/calendar-v4/calendar-event/create
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
}): Promise<LarkVcReserveResult | null> {
  if (!isLarkVcConfigured()) return null

  const token = await getLarkTenantAccessToken()

  const endTime = new Date(options.startTime.getTime() + options.durationMinutes * 60 * 1000)

  const toRfc3339 = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '+00:00')

  const res = await $fetch<{
    code: number
    msg: string
    data?: {
      event: {
        event_id: string
        vchat?: {
          vc_type: string
          icon_type?: string
          description?: string
          meeting_url?: string
          live_link?: string
          meeting_settings?: Record<string, unknown>
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
      },
    },
  })

  if (res.code !== 0 || !res.data) {
    throw new Error(`Lark calendar event creation failed (${res.code}): ${res.msg}`)
  }

  const joinUrl = res.data.event.vchat?.meeting_url ?? ''

  return {
    reserveId: res.data.event.event_id,
    joinUrl,
    meetingNo: '',
  }
}
