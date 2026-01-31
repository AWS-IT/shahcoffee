import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { 
  initDatabase, 
  upsertUser, 
  getUserByTelegramId, 
  getUserByEmail,
  getUserById,
  createUserWithEmail,
  linkTelegramToUser,
  isUserAdmin,
  createOrder, 
  updateOrderStatus, 
  getOrderById, 
  getOrdersByUserId, 
  getAllOrders,
  getMapMarkers,
  getAllMapMarkers,
  createMapMarker,
  updateMapMarker,
  deleteMapMarker,
  getSetting,
  setSetting
} from './db.js';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Для form-data от Robokassa

const JWT_SECRET = process.env.JWT_SECRET || 'shahcoffee-secret-key-2026';

// Инициализация БД при старте
initDatabase().catch(console.error);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});


// === NOMINATIM PROXY (Address Search) ===
app.get('/api/address-search', async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 3) {
    return res.json([]);
  }
  
  // Используем Яндекс Геокодер - он лучше знает российские адреса!
  const GEOCODER_KEY = process.env.VITE_YANDEX_GEOCODER_API_KEY;
  
  if (!GEOCODER_KEY) {
    console.error('❌ VITE_YANDEX_GEOCODER_API_KEY не задан');
    return res.status(500).json({ error: 'Geocoder not configured' });
  }
  
  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${GEOCODER_KEY}&format=json&geocode=${encodeURIComponent(q)}&results=5&lang=ru_RU`;
    console.log(`🔍 Поиск адреса (Yandex): ${q}`);
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Yandex Geocoder error: ${response.status}`);
    }

    const data = await response.json();
    const featureMembers = data.response?.GeoObjectCollection?.featureMember || [];
    
    // Преобразуем в формат, совместимый с Nominatim (для AddressSuggest.jsx)
    const results = featureMembers.map((item, index) => {
      const geo = item.GeoObject;
      const coords = geo.Point.pos.split(' '); // lon lat
      return {
        place_id: index + 1,
        lat: coords[1],
        lon: coords[0],
        display_name: geo.metaDataProperty.GeocoderMetaData.text,
        name: geo.name,
        addresstype: 'place'
      };
    });
    
    console.log(`✅ Найдено ${results.length} адресов`);
    res.json(results);
  } catch (error) {
    console.error('❌ Ошибка поиска адреса:', error.message);
    res.status(500).json({ error: 'Address search failed' });
  }
});

// === ЯНДЕКС ГЕОКОДЕР (прокси для обхода CORS) ===
const YANDEX_GEOCODER_KEY = process.env.VITE_YANDEX_GEOCODER_API_KEY;

app.get('/api/geocode', async (req, res) => {
  const { query } = req.query;
  
  if (!query || query.length < 3) {
    return res.json({ results: [] });
  }
  
  if (!YANDEX_GEOCODER_KEY) {
    console.error('❌ YANDEX_GEOCODER_API_KEY не задан');
    return res.status(500).json({ error: 'Geocoder not configured' });
  }
  
  try {
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_GEOCODER_KEY}&format=json&geocode=${encodeURIComponent(query)}&results=5&lang=ru_RU`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Yandex API error: ${response.status}`);
    }
    
    const data = await response.json();
    const featureMembers = data.response?.GeoObjectCollection?.featureMember || [];
    
    const results = featureMembers.map((item) => {
      const geo = item.GeoObject;
      const coords = geo.Point.pos.split(' ');
      return {
        address: geo.metaDataProperty.GeocoderMetaData.text,
        name: geo.name,
        description: geo.description || '',
        coordinates: {
          lat: parseFloat(coords[1]),
          lon: parseFloat(coords[0]),
        },
      };
    });
    
    console.log(`🗺️ Геокодер: "${query}" → ${results.length} результатов`);
    res.json({ results });
  } catch (error) {
    console.error('Ошибка геокодера:', error);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// Публичный токен
const PUBLIC_TOKEN = process.env.VITE_MOYSKLAD_TOKEN;
const ADMIN_TOKEN = process.env.VITE_MOYSKLAD_TOKEN;
const PUBLIC_API_URL = 'https://b2b.moysklad.ru';
const ADMIN_API_URL = 'https://api.moysklad.ru';

if (!PUBLIC_TOKEN) {
  console.error('ОШИБКА! Проверь .env файл:');
  console.error('VITE_MOYSKLAD_TOKEN=твой_токен');
  process.exit(1);
}

// Прокси для МойСклад (используем app.all вместо app.use чтобы не перехватывать /api/*)
app.all('/api_ms/{*path}', async (req, res) => {
  // В Express 5 с {*path} параметр path - это массив сегментов пути
  // Например: /api_ms/entity/product → path = ['entity', 'product']
  const pathSegments = req.params.path || [];
  const msPath = '/' + (Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments);
  // Используем приватный API для полного доступа к товарам и данным
  const url = `${ADMIN_API_URL}/api/remap/1.2${msPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

  console.log(`\n📥 Входящий запрос: ${req.method} ${req.path}`);
  console.log(`🔗 Формируем URL: ${url}`);
  console.log(`📋 Query string: ${req.url.includes('?') ? req.url.split('?')[1] : 'нет'}`);
  console.log(`🔑 TOKEN: ${PUBLIC_TOKEN ? `✓ (${PUBLIC_TOKEN.substring(0, 15)}...)` : '❌ нет'}`);

  if (!PUBLIC_TOKEN) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: TOKEN не задан в .env!');
    return res.status(500).json({ error: 'TOKEN not configured' });
  }

  try {
    console.log(`🚀 Отправляю запрос на МойСклад...`);
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${PUBLIC_TOKEN}`, 
        'Content-Type': 'application/json;charset=utf-8',
        'Accept': 'application/json;charset=utf-8',
        'User-Agent': 'ShahCoffee/1.0',
      },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
    });

    console.log(`📤 МойСклад ответил: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Ошибка: ${response.status}`);
      console.error(`📋 Тело: ${errorText.substring(0, 200)}`);
      return res.status(response.status).json({ error: `МойСклад: ${response.status} ${response.statusText}` });
    }

    const data = await response.json();
    console.log(`✓ Успешно получено: ${data.rows?.length || 0} записей`);
    
    res.status(response.status).json(data);
  } catch (e) {
    console.error('❌ Ошибка проксирования:', e.message);
    res.status(500).json({ error: 'Proxy error: ' + e.message });
  }
});

// Robokassa
const ROBOKASSA_MERCHANT_ID = process.env.ROBOKASSA_MERCHANT_ID;
const ROBOKASSA_PASS1 = process.env.ROBOKASSA_PASS1;
const ROBOKASSA_PASS2 = process.env.ROBOKASSA_PASS2;

if (!ROBOKASSA_MERCHANT_ID || !ROBOKASSA_PASS1 || !ROBOKASSA_PASS2) {
  console.error('ОШИБКА! Проверь .env файл для Robokassa');
}

// --- T-Bank (тестовые и боевые) конфигурация ---
const TBANK_TERMINAL = process.env.TBANK_TERMINAL; // Например: 1769767428862DEMO
const TBANK_PASSWORD = process.env.TBANK_PASSWORD; // Пароль для формирования Token
const TBANK_INIT_URL = process.env.TBANK_INIT_URL || ''; // Опционально: URL API инициации платежа от Т-Банка
const TBANK_NOTIFICATION_URL = process.env.TBANK_NOTIFICATION_URL || '/api/tbank/notification';
const TBANK_SUCCESS_URL = process.env.TBANK_SUCCESS_URL || '';
const TBANK_FAIL_URL = process.env.TBANK_FAIL_URL || '';

if (!TBANK_TERMINAL || !TBANK_PASSWORD) {
  console.warn('⚠️ T-Bank credentials not set in .env — tests will use a mock PaymentURL unless TBANK_INIT_URL is configured');
}

// Helper: build token for T-Bank requests according to docs
function buildTbankToken(params, password) {
  // Include only root-level primitive params (exclude objects and arrays), then add Password
  const pairs = [];
  for (const key of Object.keys(params)) {
    const v = params[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') continue; // exclude nested objects/arrays like DATA, Receipt
    pairs.push({ k: key, v: String(v) });
  }
  pairs.push({ k: 'Password', v: String(password) });
  // Sort alphabetically by key
  pairs.sort((a, b) => a.k.localeCompare(b.k));
  // Concatenate only values
  const concat = pairs.map(p => p.v).join('');
  const hash = crypto.createHash('sha256').update(concat, 'utf8').digest('hex');
  
  console.log('Token calculation:', { 
    sorted_keys: pairs.map(p => p.k).join(', '),
    concat_preview: concat.substring(0, 50) + '...',
    token: hash 
  });
  
  return hash;
}

// Endpoint: Инициировать платёж через T-Bank (backend должен вызывать метод Initiate и вернуть PaymentURL)
app.post('/api/tbank/initiate', async (req, res) => {
  const { orderId, amount, description, data } = req.body;

  if (!orderId || !amount) {
    return res.status(400).json({ error: 'Missing orderId or amount' });
  }

  // T-Bank принимает Amount в копейках в примерах — унифицируем: если передали дробное число, умножаем на 100
  let amountKopecks;
  if (Number.isInteger(amount)) {
    amountKopecks = amount; // assume already in kopecks
  } else {
    const a = parseFloat(amount);
    amountKopecks = Math.round(a * 100);
  }

  const params = {
    TerminalKey: TBANK_TERMINAL,
    Amount: amountKopecks,
    OrderId: orderId,
    Description: description || 'Оплата заказа',
  };
  
  // Добавляем URLs для success/fail если они настроены
  if (TBANK_SUCCESS_URL) params.SuccessURL = TBANK_SUCCESS_URL;
  if (TBANK_FAIL_URL) params.FailURL = TBANK_FAIL_URL;
  
  if (data) params.DATA = data; // will be ignored for token calculation

  const token = buildTbankToken(params, TBANK_PASSWORD);
  params.Token = token;

  console.log('T-Bank initiate params:', { ...params, Token: token.substring(0, 10) + '...' });

  if (TBANK_INIT_URL) {
    try {
      console.log('Sending request to T-Bank:', TBANK_INIT_URL);
      console.log('Request body:', JSON.stringify(params, null, 2));
      
      const response = await fetch(TBANK_INIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      console.log('Response status:', response.status, response.statusText);
      const contentType = response.headers.get('content-type');
      console.log('Response content-type:', contentType);
      
      const text = await response.text();
      console.log('Response body (first 500 chars):', text.substring(0, 500));
      
      let json;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        console.error('Failed to parse response as JSON:', parseErr.message);
        return res.status(502).json({ 
          error: 'Invalid JSON response from T-Bank', 
          status: response.status,
          contentType,
          body: text.substring(0, 200)
        });
      }
      
      console.log('T-Bank response:', json);
      
      // Expect PaymentURL in response
      const paymentUrl = json.PaymentURL || json.paymentUrl || json.paymentURL || json.PaymentUrl;
      if (!paymentUrl) {
        return res.status(502).json({ error: 'Invalid response from TBANK_INIT_URL', body: json });
      }
      return res.json({ PaymentURL: paymentUrl, Success: json.Success, PaymentId: json.PaymentId });
    } catch (err) {
      console.error('T-Bank initiate error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }
  // Если TBANK_INIT_URL не настроен — возвращаем локальный mock URL для тестирования фронтенда
  const localPort = process.env.PORT || 3001;
  const mockUrl = `http://localhost:${localPort}/mock-payment/${encodeURIComponent(orderId)}?amount=${encodeURIComponent(params.Amount)}`;
  return res.json({ PaymentURL: mockUrl, _debug: { params } });
});

// Простая страница mock-платежа для локального тестирования
app.get('/mock-payment/:orderId', (req, res) => {
  const { orderId } = req.params;
  const amount = req.query.amount || '';
  const successUrl = TBANK_SUCCESS_URL || '/payment-result';

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Mock Payment - ${orderId}</title>
    <style>body{font-family:Arial,Helvetica,sans-serif;padding:40px;background:#f6f6f6} .card{background:white;padding:24px;border-radius:8px;max-width:640px;margin:0 auto} button{background:#008B9D;color:white;border:none;padding:12px 20px;border-radius:6px;font-size:16px;cursor:pointer}</style>
  </head>
  <body>
    <div class="card">
      <h2>Mock Payment</h2>
      <p><strong>Order:</strong> ${orderId}</p>
      <p><strong>Amount:</strong> ${amount} (kopecks)</p>
      <p>This is a local mock of the payment provider. Click <em>Pay</em> to simulate a successful payment and send a notification to the server.</p>
      <button id="pay">Pay</button>
      <div id="status" style="margin-top:16px;color:#333"></div>
    </div>
    <script>
      document.getElementById('pay').addEventListener('click', async () => {
        const resp = await fetch('/api/tbank/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: '${orderId}', amount: '${amount}' })
        });
        const text = await resp.text();
        document.getElementById('status').innerText = 'Server response: ' + text;
        if (resp.ok) {
          // redirect to success URL
          window.location.href = '${successUrl}';
        }
      });
    </script>
  </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Симуляция уведомления от T-Bank: сервер отправляет внутренний notification обработчик
app.post('/api/tbank/simulate', async (req, res) => {
  const { orderId, amount } = req.body;
  if (!orderId) return res.status(400).send('Missing orderId');

  const payload = {
    TerminalKey: TBANK_TERMINAL,
    Amount: String(amount || 0),
    OrderId: orderId,
    Status: 'CONFIRMED'
  };

  // Добавляем Token и отправляем в локальный notification handler
  payload.Token = buildTbankToken(payload, TBANK_PASSWORD);

  try {
    // Call the notification handler logic by posting to the same route
    const url = TBANK_NOTIFICATION_URL;
    // since it's internal, call the handler directly using fetch to localhost
    const localUrl = `http://localhost:${process.env.PORT || 3001}${url}`;
    const r = await fetch(localUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    return res.status(r.status).send(text);
  } catch (e) {
    console.error('simulate notification error', e.message);
    return res.status(500).send(e.message);
  }
});

// Endpoint: Notification handler для T-Bank (обрабатывает POST уведомления)
app.post(TBANK_NOTIFICATION_URL, async (req, res) => {
  const payload = req.body || {};
  console.log('T-Bank notification received:', payload);

  const receivedToken = payload.Token;
  if (!receivedToken) {
    console.error('T-Bank notification missing Token');
    return res.status(400).send('Bad Request');
  }

  // Recompute token from root-level fields (excluding Token) and compare
  const copy = { ...payload };
  delete copy.Token;

  const expected = buildTbankToken(copy, TBANK_PASSWORD);
  if (expected !== receivedToken) {
    console.error('T-Bank notification token mismatch', { expected, receivedToken });
    return res.status(403).send('Forbidden');
  }

  // Пример обработки: обновляем статус заказа, если есть OrderId и Status
  const orderId = payload.OrderId || payload.OrderId;
  const status = payload.Status;
  console.log(`T-Bank: order=${orderId} status=${status}`);
  if (orderId && status) {
    try {
      await updateOrderStatus(orderId, String(status).toLowerCase());
      console.log(`Order ${orderId} status updated to ${status}`);
    } catch (e) {
      console.warn('Failed to update order status for T-Bank notification:', e.message);
    }
  }

  // Возвращаем OK как требует Т-Банк
  res.status(200).send('OK');
});

// Telegram уведомления
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_CHAT_ID = '8033066008';

// Функция отправки сообщения в Telegram
async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN не установлен');
    return;
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    
    if (response.ok) {
      console.log('✓ Уведомление отправлено в Telegram');
    } else {
      const error = await response.json();
      console.error('❌ Ошибка отправки в Telegram:', error);
    }
  } catch (error) {
    console.error('❌ Ошибка отправки в Telegram:', error.message);
  }
}

// Форматирование заказа для Telegram
function formatOrderForTelegram(orderId, orderData, sum) {
  const { customerData, items } = orderData;
  
  const itemsList = items?.map(item => 
    `  • ${item.name} × ${item.quantity} = ${(item.price * item.quantity).toLocaleString('ru-RU')} ₽`
  ).join('\n') || 'Нет товаров';
  
  return `🎉 <b>НОВЫЙ ЗАКАЗ!</b>

📦 <b>Заказ #${orderId}</b>
💰 <b>Сумма:</b> ${parseFloat(sum).toLocaleString('ru-RU')} ₽

👤 <b>Покупатель:</b>
• Имя: ${customerData?.name || 'Не указано'}
• Телефон: ${customerData?.phone || 'Не указан'}
• Email: ${customerData?.email || 'Не указан'}

📍 <b>Адрес доставки:</b>
${customerData?.address || 'Не указан'}

🛒 <b>Состав заказа:</b>
${itemsList}

✅ <b>Статус:</b> Оплачено`;
}

// Временное хранилище заказов (в production лучше использовать Redis или БД)
const pendingOrders = new Map();

// Генерация подписи MD5 для инициализации платежа
function generateSignature(merchantId, sum, orderId, pass) {
  // Robokassa: сумма как строка, формат X или X.XX
  const sumStr = String(sum);
  const signatureString = `${merchantId}:${sumStr}:${orderId}:${pass}`;
  console.log('Signature generation string:', signatureString);
  const hash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log('Generated hash:', hash);
  return hash;
}

// Генерация подписи MD5 для проверки Result callback (формула ДРУГАЯ!)
function generateResultSignature(sum, orderId, pass) {
  // Формула: MD5(OutSum:InvId:Password2) - БЕЗ MerchantLogin!
  const sumStr = String(sum);
  const signatureString = `${sumStr}:${orderId}:${pass}`;
  console.log('Result signature string:', signatureString);
  const hash = crypto.createHash('md5').update(signatureString).digest('hex');
  console.log('Generated result hash:', hash);
  return hash;
}

// Инициирование платежа
app.post('/api/robokassa/init-payment', (req, res) => {
  const { orderId, amount, description, customerEmail, customerData, items } = req.body;

  if (!orderId || !amount || !description) {
    return res.status(400).json({ error: 'Отсутствуют обязательные данные' });
  }

  // Robokassa: сумма с копейками, минимум 1 рубль
  const sumNum = parseFloat(amount);
  if (sumNum < 1) {
    return res.status(400).json({ error: 'Минимальная сумма заказа 1 рубль' });
  }
  // Формат суммы: целое или с двумя знаками
  const sum = Number.isInteger(sumNum) ? String(sumNum) : sumNum.toFixed(2);
  const signature = generateSignature(ROBOKASSA_MERCHANT_ID, sum, orderId, ROBOKASSA_PASS1);

  // Сохраняем данные заказа для последующего создания отгрузки
  if (customerData && items) {
    pendingOrders.set(orderId, {
      customerData,
      items,
      totalPrice: sum,
      createdAt: new Date(),
    });
    console.log(`✓ Заказ ${orderId} сохранен, ожидает оплаты`);
  }

  console.log('=== Robokassa Init Payment ===');
  console.log('OrderId:', orderId);
  console.log('Amount (input):', amount);
  console.log('Sum (formatted):', sum);
  console.log('Signature:', signature);

  res.json({
    merchantId: ROBOKASSA_MERCHANT_ID,
    orderId,
    sum: sum,
    description,
    signature,
    customerEmail: customerEmail || '',
  });
});

// Обработка уведомления от Robokassa
async function handleRobokassaResult(req, res) {
  const data = req.method === 'POST' ? req.body : req.query;
  
  console.log('\n=== Robokassa Result Callback ===');
  console.log('Method:', req.method);
  console.log('Raw data:', data);
  
  if (!data || !data.InvId) {
    console.error('❌ Нет данных от Robokassa');
    return res.status(400).send('Bad request');
  }
  
  // Robokassa использует InvId, не OrderId
  const OrderId = data.InvId;
  const Sum = data.OutSum;
  const SignatureValue = data.SignatureValue;

  console.log('OrderId (InvId):', OrderId);
  console.log('Sum (OutSum):', Sum);
  console.log('SignatureValue:', SignatureValue);

  // Robokassa присылает сумму как "1.150000" - используем КАК ЕСТЬ для подписи
  const expectedSignature = generateResultSignature(Sum, OrderId, ROBOKASSA_PASS2);

  console.log('Expected Signature:', expectedSignature);
  console.log('Received Signature:', SignatureValue);
  console.log('Match:', expectedSignature.toLowerCase() === SignatureValue.toLowerCase());

  if (SignatureValue.toLowerCase() !== expectedSignature.toLowerCase()) {
    console.error('❌ Ошибка подписи Robokassa!');
    return res.status(403).send('Signature mismatch');
  }

  console.log(`✓ Платеж подтвержден. Заказ: ${OrderId}, Сумма: ${Sum}`);
  
  // Обновляем статус заказа в БД
  try {
    await updateOrderStatus(OrderId, 'paid', SignatureValue);
    console.log(`✓ Статус заказа ${OrderId} обновлен на "paid" в БД`);
  } catch (dbError) {
    console.error(`⚠️ Ошибка обновления статуса в БД:`, dbError.message);
    // Продолжаем - это не критическая ошибка
  }
  
  // Получаем данные заказа из временного хранилища
  const orderData = pendingOrders.get(OrderId);
  
  if (orderData) {
    // Отправляем уведомление в Telegram
    const telegramMessage = formatOrderForTelegram(OrderId, orderData, Sum);
    sendTelegramNotification(telegramMessage);
    
    console.log(`📦 Создаем отгрузку в МойСклад для заказа ${OrderId}`);
    
    // Создаем отгрузку в МойСклад
    createMoySkladShipment(OrderId, orderData)
      .then(() => {
        console.log(`✓ Отгрузка создана для заказа ${OrderId}`);
        pendingOrders.delete(OrderId); // Удаляем из временного хранилища
      })
      .catch(err => {
        console.error(`❌ Ошибка создания отгрузки для ${OrderId}:`, err);
        // Не удаляем из хранилища - можно будет повторить позже
      });
  } else {
    console.warn(`⚠️ Данные заказа ${OrderId} не найдены в хранилище`);
  }
  
  // Robokassa ожидает ответ OK{InvId}
  res.send(`OK${OrderId}`);
}

// Функция создания отгрузки в МойСклад
async function createMoySkladShipment(orderId, orderData) {
  const { customerData, items, totalPrice } = orderData;
  
  try {
    // 1. Создаем или находим контрагента
    const counterparty = await createOrGetCounterparty(customerData);
    
    // 2. Получаем склад по умолчанию
    const storesResponse = await fetch(`${ADMIN_API_URL}/api/remap/1.2/entity/store?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!storesResponse.ok) {
      throw new Error('Ошибка при получении склада');
    }
    
    const storesData = await storesResponse.json();
    const store = storesData.rows?.[0];
    
    if (!store) {
      throw new Error('Склад не найден');
    }
    
    // 3. Получаем организацию
    const orgResponse = await fetch(`${ADMIN_API_URL}/api/remap/1.2/entity/organization?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!orgResponse.ok) {
      throw new Error('Ошибка при получении организации');
    }
    
    const orgData = await orgResponse.json();
    const organization = orgData.rows?.[0];
    
    if (!organization) {
      throw new Error('Организация не найдена');
    }
    
    // 4. Формируем позиции для отгрузки
    const positions = items.map((item) => ({
      quantity: item.quantity,
      price: item.priceRub * 100, // МойСклад хранит цены в копейках
      assortment: {
        meta: {
          href: `${ADMIN_API_URL}/api/remap/1.2/entity/product/${item.id}`,
          type: 'product',
          mediaType: 'application/json'
        }
      }
    }));
    
    // 5. Создаем отгрузку
    const shipmentPayload = {
      name: `Заказ №${orderId}`,
      description: `Телефон: ${customerData.phone}\nАдрес: ${customerData.address}`,
      agent: { meta: counterparty.meta },
      organization: { meta: organization.meta },
      store: { meta: store.meta },
      payedSum: totalPrice * 100, // Сумма оплаты в копейках
      applicable: true, // Проведён
      positions: positions
    };
    
    console.log('Отправка отгрузки в МойСклад:', JSON.stringify(shipmentPayload, null, 2));
    
    const shipmentResponse = await fetch(`${ADMIN_API_URL}/api/remap/1.2/entity/demand`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shipmentPayload)
    });
    
    if (!shipmentResponse.ok) {
      const errorData = await shipmentResponse.json();
      console.error('Ошибка МойСклад:', JSON.stringify(errorData, null, 2));
      throw new Error('Ошибка МойСклад: ' + (errorData.errors?.[0]?.title || 'неизвестная ошибка'));
    }
    
    const result = await shipmentResponse.json();
    console.log('✓ Отгрузка создана:', result.name, result.id);
    
    // 6. Создаём входящий платёж для отгрузки
    try {
      const paymentPayload = {
        sum: totalPrice * 100, // Сумма в копейках
        organization: { meta: organization.meta },
        agent: { meta: counterparty.meta },
        operations: [
          {
            meta: result.meta,
            linkedSum: totalPrice * 100
          }
        ],
        paymentPurpose: `Оплата заказа №${orderId} через Robokassa`
      };
      
      const paymentResponse = await fetch(`${ADMIN_API_URL}/api/remap/1.2/entity/paymentin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentPayload)
      });
      
      if (paymentResponse.ok) {
        const payment = await paymentResponse.json();
        console.log('✓ Входящий платёж создан:', payment.id);
      } else {
        console.error('⚠️ Не удалось создать входящий платёж');
      }
    } catch (paymentError) {
      console.error('⚠️ Ошибка создания платежа:', paymentError);
      // Не бросаем ошибку, т.к. отгрузка уже создана
    }
    
    return result;
    
  } catch (error) {
    console.error('Ошибка создания отгрузки:', error);
    throw error;
  }
}

// Функция создания/получения контрагента
async function createOrGetCounterparty(customerData) {
  try {
    // Ищем контрагента по имени
    const searchResponse = await fetch(
      `${ADMIN_API_URL}/api/remap/1.2/entity/counterparty?filter=name=${encodeURIComponent(customerData.name)}&limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    const searchData = await searchResponse.json();
    
    if (searchData.rows && searchData.rows.length > 0) {
      console.log('✓ Контрагент найден:', searchData.rows[0].name);
      return searchData.rows[0];
    }
    
    // Если не найден - создаем
    const createResponse = await fetch(`${ADMIN_API_URL}/api/remap/1.2/entity/counterparty`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        actualAddress: customerData.address,
      })
    });
    
    if (!createResponse.ok) {
      throw new Error('Ошибка при создании контрагента');
    }
    
    const newCounterparty = await createResponse.json();
    console.log('✓ Контрагент создан:', newCounterparty.name);
    return newCounterparty;
    
  } catch (error) {
    console.error('Ошибка работы с контрагентом:', error);
    throw error;
  }
}

// Получение списка товаров
app.get('/api/products', async (req, res) => {
  const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  console.log(`📥 GET /api/products${query}`);
  try {
    const response = await fetch(`${ADMIN_API_URL}/api/remap/1.2/entity/product${query}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PUBLIC_TOKEN}`,
        'Content-Type': 'application/json;charset=utf-8',
        'Accept': 'application/json;charset=utf-8',
      }
    });

    console.log(`📤 МойСклад ответил: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Ошибка: ${response.status} - ${errorText.substring(0, 500)}`);
      return res.status(response.status).json({ error: 'Ошибка при получении товаров' });
    }

    const data = await response.json();
    console.log(`✓ Получено товаров: ${data.rows?.length || 0}`);
    res.json(data);
  } catch (error) {
    console.error('❌ Ошибка получения товаров:', error.message);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Получение товара по ID
app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  console.log(`📥 GET /api/products/${id}${query}`);
  try {
    const response = await fetch(`${ADMIN_API_URL}/api/remap/1.2/entity/product/${id}${query}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PUBLIC_TOKEN}`,
        'Content-Type': 'application/json;charset=utf-8',
        'Accept': 'application/json;charset=utf-8',
      }
    });

    console.log(`📤 МойСклад ответил: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Ошибка: ${response.status} - ${errorText.substring(0, 500)}`);
      return res.status(response.status).json({ error: 'Товар не найден' });
    }

    const data = await response.json();
    console.log(`✓ Товар получен: ${data.name}`);
    res.json(data);
  } catch (error) {
    console.error('❌ Ошибка получения товара:', error.message);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.post('/api/robokassa/result', handleRobokassaResult);
app.get('/api/robokassa/result', handleRobokassaResult);

// ========== TELEGRAM AUTH ==========

// TELEGRAM_BOT_TOKEN уже объявлен выше для уведомлений

// Верификация Telegram Login Widget данных
function verifyTelegramHash(data, token) {
  const check_hash = data.hash;
  delete data.hash;
  
  const data_check_string = Object.keys(data)
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join('\n');

  const secret_key = crypto.createHash('sha256').update(token).digest();
  const computed_hash = crypto.createHmac('sha256', secret_key)
    .update(data_check_string)
    .digest('hex');

  return computed_hash === check_hash;
}

// Эндпоинт для авторизации через Telegram
app.post('/api/auth/telegram', async (req, res) => {
  console.log('\n=== Telegram Auth ===');

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не установлен в .env');
    return res.status(500).json({ error: 'Server not configured' });
  }

  const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body;

  if (!id || !hash) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Проверяем временную метку (не старше 24 часов)
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - parseInt(auth_date) > 86400) {
    console.error('❌ Данные авторизации истекли');
    return res.status(401).json({ error: 'Auth data expired' });
  }

  // Верифицируем хеш
  const dataToVerify = { ...req.body };
  if (!verifyTelegramHash(dataToVerify, TELEGRAM_BOT_TOKEN)) {
    console.error('❌ Неверная подпись Telegram');
    return res.status(401).json({ error: 'Invalid hash' });
  }

  console.log(`✓ Пользователь Telegram авторизован: ${first_name} (@${username})`);

  // Сохраняем/обновляем пользователя в БД
  try {
    const user = await upsertUser({
      id,
      first_name,
      last_name: last_name || '',
      username: username || '',
      photo_url: photo_url || '',
      auth_date: parseInt(auth_date),
    });

    // Создаём JWT токен
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        ...user,
        is_admin: false // По умолчанию новые пользователи не админы
      },
    });
  } catch (dbError) {
    console.error('❌ Ошибка сохранения пользователя в БД:', dbError);
    // Возвращаем успех даже если БД недоступна (без токена)
    res.json({
      success: true,
      user: {
        id,
        first_name,
        last_name: last_name || '',
        username: username || '',
        photo_url: photo_url || '',
      },
    });
  }
});

// GET эндпоинт для обработки redirect от Telegram виджета
app.get('/auth/telegram', async (req, res) => {
  console.log('\n=== Telegram Auth Redirect ===');
  const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.query;

  if (!id || !hash) {
    return res.redirect('/?auth_error=missing_fields');
  }

  // Проверяем временную метку
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - parseInt(auth_date) > 86400) {
    return res.redirect('/?auth_error=expired');
  }

  // Верифицируем хеш
  const dataToVerify = { ...req.query };
  if (!verifyTelegramHash(dataToVerify, TELEGRAM_BOT_TOKEN)) {
    return res.redirect('/?auth_error=invalid_hash');
  }

  // Сохраняем пользователя в БД
  try {
    await upsertUser({
      id,
      first_name,
      last_name: last_name || '',
      username: username || '',
      photo_url: photo_url || '',
      auth_date: parseInt(auth_date),
    });
  } catch (err) {
    console.error('Ошибка сохранения пользователя:', err);
  }

  // Редиректим на фронтенд с данными пользователя
  const userData = encodeURIComponent(JSON.stringify({
    id,
    first_name,
    last_name: last_name || '',
    username: username || '',
    photo_url: photo_url || '',
  }));
  
  res.redirect(`/?telegram_auth=${userData}`);
});

// ==================== API ЗАКАЗОВ ====================

// Создать заказ
app.post('/api/orders', async (req, res) => {
  try {
    const { orderId, userId, customerData, coordinates, items, totalPrice } = req.body;
    
    const order = await createOrder({
      orderId,
      userId,
      customerName: customerData?.name,
      customerPhone: customerData?.phone,
      customerEmail: customerData?.email,
      customerAddress: customerData?.address,
      coordinates,
      items,
      totalPrice,
      status: 'pending'
    });

    res.json({ success: true, order });
  } catch (error) {
    console.error('❌ Ошибка создания заказа:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Получить заказ по ID
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const order = await getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('❌ Ошибка получения заказа:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Получить заказы пользователя
app.get('/api/users/:userId/orders', async (req, res) => {
  try {
    const orders = await getOrdersByUserId(parseInt(req.params.userId));
    res.json(orders);
  } catch (error) {
    console.error('❌ Ошибка получения заказов:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Чтение профиля пользователя (требует авторизации)
app.get('/api/auth/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        phone: user.phone,
        photo_url: user.photo_url,
        telegram_id: user.telegram_id,
        is_admin: user.is_admin === 1
      }
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// ========== РЕГИСТРАЦИЯ И ВХОД ПО EMAIL ==========

// Регистрация
app.post('/api/auth/register', async (req, res) => {
  const { email, password, firstName, phone } = req.body;
  
  if (!email || !password || !firstName) {
    return res.status(400).json({ error: 'Email, пароль и имя обязательны' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
  }
  
  try {
    // Проверяем, существует ли пользователь
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }
    
    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Создаём пользователя
    const user = await createUserWithEmail(email, passwordHash, firstName, phone);
    
    // Создаём JWT токен
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    console.log(`✓ Зарегистрирован новый пользователь: ${email}`);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

// Вход по email/паролю
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }
  
  try {
    const user = await getUserByEmail(email);
    
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    
    // Создаём JWT токен
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    
    console.log(`✓ Вход пользователя: ${email}`);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        phone: user.phone,
        photo_url: user.photo_url,
        telegram_id: user.telegram_id,
        is_admin: user.is_admin === 1
      }
    });
  } catch (error) {
    console.error('❌ Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

// Привязка Telegram к аккаунту
app.post('/api/auth/link-telegram', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body;
    
    // Проверяем Telegram данные
    const dataToVerify = { ...req.body };
    if (!verifyTelegramHash(dataToVerify, TELEGRAM_BOT_TOKEN)) {
      return res.status(401).json({ error: 'Invalid Telegram hash' });
    }
    
    // Проверяем, не привязан ли уже этот Telegram к другому аккаунту
    const existingTgUser = await getUserByTelegramId(id);
    if (existingTgUser && existingTgUser.id !== decoded.userId) {
      return res.status(400).json({ error: 'Этот Telegram уже привязан к другому аккаунту' });
    }
    
    // Привязываем
    const updatedUser = await linkTelegramToUser(decoded.userId, {
      id, first_name, last_name, username, photo_url, auth_date
    });
    
    console.log(`✓ Telegram привязан к пользователю: ${updatedUser.email}`);
    
    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        username: updatedUser.username,
        phone: updatedUser.phone,
        photo_url: updatedUser.photo_url,
        telegram_id: updatedUser.telegram_id,
        is_admin: updatedUser.is_admin === 1
      }
    });
  } catch (error) {
    console.error('❌ Ошибка привязки Telegram:', error);
    res.status(500).json({ error: 'Ошибка привязки Telegram' });
  }
});

// Проверка прав администратора
app.get('/api/auth/check-admin', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated', isAdmin: false });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await isUserAdmin(decoded.userId);
    res.json({ isAdmin: admin });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token', isAdmin: false });
  }
});

// ========== END TELEGRAM AUTH ==========

// Middleware для проверки авторизации
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Неверный токен' });
  }
};

// Middleware для проверки прав администратора
const requireAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await isUserAdmin(decoded.userId);
    if (!admin) {
      return res.status(403).json({ error: 'Недостаточно прав. Требуется доступ администратора.' });
    }
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Неверный токен' });
  }
};

// ==================== API НАСТРОЕК ====================

// Получить настройку (публичный)
app.get('/api/settings/:key', async (req, res) => {
  try {
    const value = await getSetting(req.params.key);
    res.json({ value: value || null });
  } catch (error) {
    console.error('❌ Ошибка получения настройки:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

// Сохранить настройку (админка)
app.post('/api/admin/settings/:key', requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;
    await setSetting(req.params.key, value);
    console.log(`✓ Настройка сохранена: ${req.params.key} = ${value}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка сохранения настройки:', error);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

// Получить список складов из МойСклад (админка)
app.get('/api/admin/stores', requireAdmin, async (req, res) => {
  try {
    const url = `${ADMIN_API_URL}/api/remap/1.2/entity/store`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${PUBLIC_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`MoySklad error: ${response.status}`);
    }
    
    const data = await response.json();
    const stores = (data.rows || []).map(store => ({
      id: store.id,
      name: store.name,
      address: store.address || '',
    }));
    
    console.log(`📦 Получено складов: ${stores.length}`);
    res.json(stores);
  } catch (error) {
    console.error('❌ Ошибка получения складов:', error);
    res.status(500).json({ error: 'Failed to get stores' });
  }
});

// ==================== API МЕТОК НА КАРТЕ ====================

// Получить все активные метки (публичный)
app.get('/api/markers', async (req, res) => {
  try {
    const markers = await getMapMarkers();
    console.log(`📍 GET /api/markers - найдено ${markers.length} активных меток`);
    res.json(markers);
  } catch (error) {
    console.error('❌ Ошибка получения меток:', error);
    res.status(500).json({ error: 'Failed to get markers' });
  }
});

// Получить все метки (админка - требует админ права)
app.get('/api/admin/markers', requireAdmin, async (req, res) => {
  try {
    const markers = await getAllMapMarkers();
    res.json(markers);
  } catch (error) {
    console.error('❌ Ошибка получения меток:', error);
    res.status(500).json({ error: 'Failed to get markers' });
  }
});

// Создать метку (админка - требует админ права)
app.post('/api/admin/markers', requireAdmin, async (req, res) => {
  try {
    const { title, description, address, lat, lon, icon_color } = req.body;
    
    if (!title || !lat || !lon) {
      return res.status(400).json({ error: 'Title, lat and lon are required' });
    }
    
    const marker = await createMapMarker({ title, description, address, lat, lon, icon_color });
    console.log('✓ Метка создана:', title);
    res.json(marker);
  } catch (error) {
    console.error('❌ Ошибка создания метки:', error);
    res.status(500).json({ error: 'Failed to create marker' });
  }
});

// Обновить метку (админка - требует админ права)
app.put('/api/admin/markers/:id', requireAdmin, async (req, res) => {
  try {
    const { title, description, address, lat, lon, icon_color, is_active } = req.body;
    const marker = await updateMapMarker(req.params.id, { 
      title, description, address, lat, lon, icon_color, is_active 
    });
    console.log('✓ Метка обновлена:', title);
    res.json(marker);
  } catch (error) {
    console.error('❌ Ошибка обновления метки:', error);
    res.status(500).json({ error: 'Failed to update marker' });
  }
});

// Удалить метку (админка - требует админ права)
app.delete('/api/admin/markers/:id', requireAdmin, async (req, res) => {
  try {
    await deleteMapMarker(req.params.id);
    console.log('✓ Метка удалена:', req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка удаления метки:', error);
    res.status(500).json({ error: 'Failed to delete marker' });
  }
});

// ========== END MAP MARKERS ==========

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Сервер работает на http://localhost:${PORT}`);
});
