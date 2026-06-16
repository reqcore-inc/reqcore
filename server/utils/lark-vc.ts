/**
 * Lark (Feishu) VC integration utility.
 *
 * Creates pre-booked meeting rooms (reserves) via the Lark VC Open API
 * for interview scheduling. Requires a Lark self-built app with the
 * `vc:reserve` permission granted.
 *
 * Docs: https://open.feishu.cn/document/server-docs/vc-v1/reserve/apply
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
  /** Lark reserve ID */
  reserveId: string
  /** Direct join URL for the meeting */
  joinUrl: string
  /** 9-digit meeting number */
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

  const startEpoch = Math.floor(options.startTime.getTime() / 1000)
  const endEpoch = startEpoch + options.durationMinutes * 60

  const res = await $fetch<{
    code: number
    msg: string
    data?: {
      reserve: {
        id: string
        meeting_no: string
        join_url: string
        end_time: string
      }
    }
  }>('https://open.feishu.cn/open-apis/vc/v1/reserves/apply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      end_time: String(endEpoch),
      meeting_settings: {
        topic: options.title,
        auto_record: false,
        join_meeting_permission: 'everyone',
        waiting_room: false,
        meeting_password: '',
        meeting_initial_type: 1,
      },
    },
  })

  if (res.code !== 0 || !res.data) {
    throw new Error(`Lark VC reserve failed (${res.code}): ${res.msg}`)
  }

  return {
    reserveId: res.data.reserve.id,
    joinUrl: res.data.reserve.join_url,
    meetingNo: res.data.reserve.meeting_no,
  }
}
