import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Публичный токен
const PUBLIC_TOKEN = process.env.MOYSKLAD_PUBLIC_TOKEN;
const ADMIN_TOKEN = process.env.MOYSKLAD_TOKEN;
const PUBLIC_API_URL = 'https://b2b.moysklad.ru';
const ADMIN_API_URL = 'https://api.moysklad.ru';

if (!PUBLIC_TOKEN) {
  console.error('ОШИБКА! Проверь .env файл:');
  console.error('MOYSKLAD_PUBLIC_TOKEN=твой_публичный_токен');
  process.exit(1);
}

// Прокси 
app.use('/api_ms', async (req, res) => {
  const url = `${PUBLIC_API_URL}/api/remap/1.2${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${PUBLIC_TOKEN}`, 
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip',
      },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
    });

    if (!response.ok) {
      console.error(`Ошибка с запросом: ${response.status} - ${response.statusText}`);
      return res.status(response.status).json({ error: 'Ошибка при обращении к MySklad' });
    }

    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (e) {
    console.error('Ошибка проксирования:', e);
    res.status(500).json({ error: 'Proxy error' });
  }
});

// Robokassa
const ROBOKASSA_MERCHANT_ID = process.env.ROBOKASSA_MERCHANT_ID;
const ROBOKASSA_PASS1 = process.env.ROBOKASSA_PASS1;
const ROBOKASSA_PASS2 = process.env.ROBOKASSA_PASS2;

if (!ROBOKASSA_MERCHANT_ID || !ROBOKASSA_PASS1 || !ROBOKASSA_PASS2) {
  console.error('ОШИБКА! Проверь .env файл для Robokassa');
}

// Генерация подписи MD5
function generateSignature(merchantId, sum, orderId, pass) {
  const sumStr = String(sum);
  const signatureString = `${merchantId}:${sumStr}:${orderId}:${pass}`;
  console.log('Signature generation string:', signatureString);
  const hash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log('Generated hash:', hash);
  return hash;
}

// Инициирование платежа
app.post('/robokassa/init-payment', (req, res) => {
  const { orderId, amount, description, customerEmail } = req.body;

  if (!orderId || !amount || !description) {
    return res.status(400).json({ error: 'Отсутствуют обязательные данные' });
  }

  const sum = Math.round(parseFloat(amount) * 100) / 100;
  const signature = generateSignature(ROBOKASSA_MERCHANT_ID, sum, orderId, ROBOKASSA_PASS1);

  console.log('=== Robokassa Init Payment ===');
  console.log('OrderId:', orderId);
  console.log('Amount (input):', amount);
  console.log('Sum (normalized):', sum);
  console.log('Signature:', signature);

  res.json({
    merchantId: ROBOKASSA_MERCHANT_ID,
    orderId,
    sum,
    description,
    signature,
    customerEmail: customerEmail || '',
    redirectUrl: `https://auth.robokassa.ru/Merchant/Index/${ROBOKASSA_MERCHANT_ID}/${sum}/${orderId}/${signature}`
  });
});

// Обработка уведомления от Robokassa
function handleRobokassaResult(req, res) {
  const data = req.method === 'POST' ? req.body : req.query;
  const { OrderId, Sum, SignatureValue } = data;

  console.log('\n=== Robokassa Result Callback ===');
  console.log('Method:', req.method);
  console.log('OrderId:', OrderId);
  console.log('Sum:', Sum);
  console.log('SignatureValue:', SignatureValue);

  let sumStr = String(Sum).replace(',', '.').trim();
  
  if (sumStr.includes('.') && sumStr.endsWith('00')) {
    const [intPart, decPart] = sumStr.split('.');
    if (decPart === '00') {
      sumStr = intPart;
    }
  }

  const expectedSignature = generateSignature(ROBOKASSA_MERCHANT_ID, sumStr, OrderId, ROBOKASSA_PASS2);

  console.log('Expected Signature:', expectedSignature);
  console.log('Received Signature:', SignatureValue);
  console.log('Match:', expectedSignature.toLowerCase() === SignatureValue.toLowerCase());

  if (SignatureValue.toLowerCase() !== expectedSignature.toLowerCase()) {
    console.error('❌ Ошибка подписи Robokassa!');
    return res.status(403).json({ error: 'Signature mismatch' });
  }

  console.log(`✓ Платеж подтвержден. Заказ: ${OrderId}, Сумма: ${Sum}`);
  
  res.json({ ok: true, message: 'Payment processed' });
}

app.post('/robokassa/result', handleRobokassaResult);
app.get('/robokassa/result', handleRobokassaResult);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Сервер работает на http://localhost:${PORT}`);
});
