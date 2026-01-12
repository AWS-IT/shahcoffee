import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { 
  initDatabase, 
  upsertUser, 
  getUserByTelegramId, 
  createOrder, 
  updateOrderStatus, 
  getOrderById, 
  getOrdersByUserId, 
  getAllOrders,
  getMapMarkers,
  getAllMapMarkers,
  createMapMarker,
  updateMapMarker,
  deleteMapMarker
} from './db.js';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Для form-data от Robokassa

// Инициализация БД при старте
initDatabase().catch(console.error);

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

    res.json({
      success: true,
      user,
    });
  } catch (dbError) {
    console.error('❌ Ошибка сохранения пользователя в БД:', dbError);
    // Возвращаем успех даже если БД недоступна
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
app.get('/api/auth/profile', (req, res) => {
  // В production здесь должна быть проверка JWT токена
  const userData = req.headers.authorization?.split(' ')[1];
  
  if (!userData) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Декодируем/верифицируем токен
  res.json({ success: true, message: 'User profile' });
});

// ========== END TELEGRAM AUTH ==========

// ==================== API МЕТОК НА КАРТЕ ====================

// Получить все активные метки (публичный)
app.get('/api/markers', async (req, res) => {
  try {
    const markers = await getMapMarkers();
    res.json(markers);
  } catch (error) {
    console.error('❌ Ошибка получения меток:', error);
    res.status(500).json({ error: 'Failed to get markers' });
  }
});

// Получить все метки (админка)
app.get('/api/admin/markers', async (req, res) => {
  try {
    const markers = await getAllMapMarkers();
    res.json(markers);
  } catch (error) {
    console.error('❌ Ошибка получения меток:', error);
    res.status(500).json({ error: 'Failed to get markers' });
  }
});

// Создать метку (админка)
app.post('/api/admin/markers', async (req, res) => {
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

// Обновить метку (админка)
app.put('/api/admin/markers/:id', async (req, res) => {
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

// Удалить метку (админка)
app.delete('/api/admin/markers/:id', async (req, res) => {
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Сервер работает на http://localhost:${PORT}`);
});
