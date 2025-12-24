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
const PUBLIC_TOKEN = process.env.VITE_MOYSKLAD_TOKEN;
const ADMIN_TOKEN = process.env.VITE_MOYSKLAD_TOKEN;
const PUBLIC_API_URL = 'https://b2b.moysklad.ru';
const ADMIN_API_URL = 'https://api.moysklad.ru';

if (!PUBLIC_TOKEN) {
  console.error('ОШИБКА! Проверь .env файл:');
  console.error('VITE_MOYSKLAD_TOKEN=твой_токен');
  process.exit(1);
}

// Прокси 
app.use('/api_ms', async (req, res) => {
  // Используем приватный API для полного доступа к товарам и данным
  const url = `${ADMIN_API_URL}/api/remap/1.2${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

  console.log(`\n📥 Входящий запрос: ${req.method} /api_ms${req.path}`);
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

// Временное хранилище заказов (в production лучше использовать Redis или БД)
const pendingOrders = new Map();

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
app.post('/api/robokassa/init-payment', (req, res) => {
  const { orderId, amount, description, customerEmail, customerData, items } = req.body;

  if (!orderId || !amount || !description) {
    return res.status(400).json({ error: 'Отсутствуют обязательные данные' });
  }

  const sum = Math.round(parseFloat(amount) * 100) / 100;
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
  
  // Получаем данные заказа из временного хранилища
  const orderData = pendingOrders.get(OrderId);
  
  if (orderData) {
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
  
  res.json({ ok: true, message: 'Payment processed' });
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
      description: `Оплачен через Robokassa\nТелефон: ${customerData.phone}\nАдрес: ${customerData.address}`,
      agent: { meta: counterparty.meta },
      organization: { meta: organization.meta },
      store: { meta: store.meta },
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
  console.log('📥 GET /api/products');
  try {
    const response = await fetch(`${PUBLIC_API_URL}/api/remap/1.2/entity/product`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PUBLIC_TOKEN}`,
        'Content-Type': 'application/json',
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
  console.log(`📥 GET /api/products/${id}`);
  try {
    const response = await fetch(`${PUBLIC_API_URL}/api/remap/1.2/entity/product/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PUBLIC_TOKEN}`,
        'Content-Type': 'application/json',
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Сервер работает на http://localhost:${PORT}`);
});
