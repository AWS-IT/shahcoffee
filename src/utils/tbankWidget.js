// Probe: виджет T-Bank ходит на securepay.tinkoff.ru (сертификат Минцифры).
// Без корня Russian Trusted Root CA fetch падает с ERR_CERT_AUTHORITY_INVALID.
export const TBANK_TERMINAL_KEY = '1769767428904'

export async function probeTbankWidgetAvailable(timeoutMs = 4000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(
      `https://securepay.tinkoff.ru/platform/api/v1/widget/settings/${TBANK_TERMINAL_KEY}`,
      { signal: ctrl.signal, mode: 'cors', cache: 'no-store' }
    )
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
