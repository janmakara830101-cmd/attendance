const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN
const GROUP_CHAT_ID  = process.env.TELEGRAM_GROUP_CHAT_ID

/** Send a message to any Telegram chat ID */
export async function sendTelegram(chatId: string, html: string): Promise<void> {
  if (!BOT_TOKEN || !chatId) return
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' }),
      },
    )
    if (!res.ok) console.error('[Telegram] send failed:', await res.text())
  } catch (e) {
    console.error('[Telegram] error:', e)
  }
}

/** Notify the group channel */
export async function notifyGroup(html: string): Promise<void> {
  if (!GROUP_CHAT_ID) return
  await sendTelegram(GROUP_CHAT_ID, html)
}

/** Build a payslip message for an employee */
export function buildPayslipMessage(opts: {
  name: string
  month: string
  base: number
  bonuses: number
  bonusReasons: string | null
  deductions: number
  deductionReasons: string | null
  net: number
}): string {
  return (
    `💰 <b>ប្រាក់ខែ — ${opts.month}</b>\n` +
    `👤 ${opts.name}\n\n` +
    `📌 ប្រាក់ខែមូលដ្ឋាន : <b>$${opts.base.toFixed(2)}</b>\n` +
    `➕ ប្រាក់រង្វាន់      : <b>$${opts.bonuses.toFixed(2)}</b>` +
    (opts.bonusReasons ? ` (${opts.bonusReasons})` : '') + '\n' +
    `➖ ការកាត់ប្រាក់     : <b>$${opts.deductions.toFixed(2)}</b>` +
    (opts.deductionReasons ? ` (${opts.deductionReasons})` : '') + '\n' +
    `━━━━━━━━━━━━━━━\n` +
    `💵 សរុបសុទ្ធ         : <b>$${opts.net.toFixed(2)}</b>\n\n` +
    `✅ ស្ថានភាព: បានទូទាត់`
  )
}
