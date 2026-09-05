// Self-check: payment status ranking used after CheckOrder (fails if logic drifts)
const rank = { CONFIRMED: 5, AUTHORIZED: 4, REJECTED: 3, CANCELED: 3, DEADLINE_EXPIRED: 3, REFUNDED: 3, FORM_SHOWED: 1, NEW: 0 };
const pick = (payments) => payments.reduce((a, b) =>
  (rank[String(b.Status).toUpperCase()] || 0) >= (rank[String(a.Status).toUpperCase()] || 0) ? b : a
);

const best = pick([{ Status: 'NEW' }, { Status: 'FORM_SHOWED' }, { Status: 'CONFIRMED', PaymentId: 1 }]);
console.assert(best.Status === 'CONFIRMED' && best.PaymentId === 1, 'should prefer CONFIRMED');

const auth = pick([{ Status: 'AUTHORIZED' }, { Status: 'NEW' }]);
console.assert(auth.Status === 'AUTHORIZED', 'should prefer AUTHORIZED over NEW');

function appendOrderIdToUrl(url, orderId) {
  const u = new URL(url, 'http://dummy');
  u.searchParams.set('orderId', orderId);
  if (!/^https?:\/\//i.test(url)) return u.pathname + u.search + u.hash;
  return u.toString();
}
console.assert(
  appendOrderIdToUrl('https://shahshop.ru/payment-result', 'o-1') === 'https://shahshop.ru/payment-result?orderId=o-1',
  'SuccessURL must carry orderId'
);

console.log('ok');
