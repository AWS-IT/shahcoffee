// Self-check: probe helper exports + URL shape
import { TBANK_TERMINAL_KEY, probeTbankWidgetAvailable } from './src/utils/tbankWidget.js'

console.assert(typeof TBANK_TERMINAL_KEY === 'string' && TBANK_TERMINAL_KEY.length > 5, 'terminal key')
console.assert(typeof probeTbankWidgetAvailable === 'function', 'probe fn')
const url = `https://securepay.tinkoff.ru/platform/api/v1/widget/settings/${TBANK_TERMINAL_KEY}`
console.assert(url.includes(TBANK_TERMINAL_KEY), 'probe url')
console.log('ok')
