const LOCALE = 'en-GB'

const dayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false })
const dateFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const moneyFormat = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso))
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

export function formatDayTime(iso: string): string {
  return `${dayFormat.format(new Date(iso))}, ${formatTime(iso)}`
}

/** "Sat 21 Nov, 08:00–10:00" */
export function formatSlot(slot: { start: string; end: string }): string {
  return `${dayFormat.format(new Date(slot.start))}, ${formatTime(slot.start)}–${formatTime(slot.end)}`
}

export function formatMoney(cents: number): string {
  return moneyFormat.format(cents / 100)
}
