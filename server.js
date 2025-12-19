import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { initDatabase, getProducts, getProductById, upsertProduct, clearProducts, getSetting, setSetting } from './db.js';
dotenv.config();

const __dirname = path.dirname(new URL(import.meta.url).pathname);

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

// Файл для хранения credentials
const CREDENTIALS_FILE = './moysklad_credentials.json';

// Переменная для хранения credentials в памяти
let storedCredentials = null;

// Загружаем сохраненные credentials при запуске
function loadCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      storedCredentials = JSON.parse(data);
      console.log('✓ Credentials загружены из файла');
      return true;
    }
  } catch (error) {
    console.error('Ошибка при загрузке credentials:', error);
  }
  return false;
}

// Сохраняем credentials в файл
function saveCredentials(creds) {
  try {
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
    storedCredentials = creds;
    console.log('✓ Credentials сохранены в файл');
    return true;
  } catch (error) {
    console.error('Ошибка при сохранении credentials:', error);
    return false;
  }
}

// Загружаем credentials при старте
loadCredentials();

// Инициализируем БД
await initDatabase();

if (!PUBLIC_TOKEN) {
  console.error('ОШИБКА! Проверь .env файл:');
  console.error('MOYSKLAD_PUBLIC_TOKEN=твой_публичный_токен');
  process.exit(1);
}

if (!ADMIN_TOKEN) {
  console.warn('ВНИМАНИЕ! MOYSKLAD_ADMIN_TOKEN не установлен. Заказы создаваться не будут.');
}

// Прокси для всех запросов к МойСклад
app.use('/api_ms', async (req, res) => {
  const path = req.path.replace('/api_ms', '');
  const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const url = `${PUBLIC_API_URL}${path}${query}`;

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

// ========== API ДЛЯ ТОВАРОВ (ИЗ БД) ==========

// Получить все товары из кеша БД
app.get('/api/products', async (req, res) => {
  try {
    const products = await getProducts();
    
    // Преобразуем формат БД обратно в формат МойСклад (для совместимости с фронтендом)
    const formatted = products.map(p => {
      const baseProduct = {
        id: p.id,
        name: p.name,
        code: p.code,
        description: p.description,
        meta: { href: p.meta_href }
      };
      
      // Если есть сохранённый data (полный объект), используем его
      if (p.data) {
        try {
          const fullData = JSON.parse(p.data);
          return { ...fullData, id: p.id };
        } catch (e) {
          console.warn('Не удалось распарсить data для товара', p.id);
        }
      }
      
      // Иначе собираем минимальный объект
      return {
        ...baseProduct,
        salePrices: p.price_rub ? [{ value: p.price_rub * 100, priceType: { name: 'Цена продажи' } }] : [],
        images: p.image_url ? { rows: [{ miniature: { downloadHref: p.image_url } }] } : { rows: [] }
      };
    });
    
    res.json({ rows: formatted });
  } catch (error) {
    console.error('Ошибка получения товаров из БД:', error);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
});

// Получить один товар по ID из БД
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    
    // Если есть полный data, возвращаем его
    if (product.data) {
      try {
        const fullData = JSON.parse(product.data);
        return res.json({ ...fullData, id: product.id });
      } catch (e) {
        console.warn('Не удалось распарсить data для товара', product.id);
      }
    }
    
    // Иначе минимальный объект
    res.json({
      id: product.id,
      name: product.name,
      code: product.code,
      description: product.description,
      meta: { href: product.meta_href },
      salePrices: product.price_rub ? [{ value: product.price_rub * 100, priceType: { name: 'Цена продажи' } }] : [],
      images: product.image_url ? { rows: [{ miniature: { downloadHref: product.image_url } }] } : { rows: [] }
    });
  } catch (error) {
    console.error('Ошибка получения товара из БД:', error);
    res.status(500).json({ error: 'Ошибка получения товара' });
  }
});

// Синхронизация товаров из МойСклад в БД
app.post('/admin/sync-products', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Токен обязателен' });
    }
    
    console.log('Начинаем синхронизацию товаров из МойСклад...');
    
    // Очищаем старый кеш перед началом синхронизации
    await clearProducts();
    
    let allProducts = [];
    let offset = 0;
    const limit = 20; // Очень маленькая порция для виртуального хостинга
    let hasMore = true;
    
    // Пагинация: загружаем товары порциями
    while (hasMore) {
      console.log(`Загрузка товаров: offset=${offset}, limit=${limit}`);
      
      try {
        // Запрашиваем товары из МойСклад порциями
        // Используем ADMIN API с images (только 1 картинка для экономии памяти)
        // node-fetch не использует WebAssembly, поэтому проблем с памятью быть не должно
        const response = await fetch(
          `${ADMIN_API_URL}/api/remap/1.2/entity/product?limit=${limit}&offset=${offset}&expand=salePrices.priceType,images&images.limit=1`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Ошибка МойСклад:', response.status, errorText);
          return res.status(response.status).json({ error: 'Ошибка МойСклад API', details: errorText });
        }
        
        const data = await response.json();
        const products = data.rows || [];
        
        console.log(`Получено ${products.length} товаров в этой пачке`);
        
        // Сохраняем каждый товар сразу, не накапливая в памяти
        for (const product of products) {
          const priceEntry = product.salePrices?.find(p => p.priceType?.name === 'Цена продажи');
          const priceRub = priceEntry ? priceEntry.value / 100 : 0;
          
          // Получаем URL изображения из первой картинки
          const imageUrl = product.images?.rows?.[0]?.miniature?.downloadHref || 
                           product.images?.rows?.[0]?.tiny?.href || 
                           null;
          
          await upsertProduct({
            id: product.id,
            name: product.name,
            code: product.code || null,
            description: product.description || null,
            price_rub: priceRub,
            image_url: imageUrl,
            meta_href: product.meta?.href || null,
            data: product // сохраняем полный объект для точности
          });
        }
        
        allProducts.push(...products);
        
        // Проверяем, есть ли еще товары
        hasMore = products.length === limit;
        offset += limit;
        
        // Пауза между запросами, чтобы не перегрузить память
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (fetchError) {
        console.error('Ошибка при загрузке пачки товаров:', fetchError);
        // Если произошла ошибка памяти, прерываем цикл
        hasMore = false;
      }
    }
    
    // Сохраняем токен и дату синхронизации
    await setSetting('moysklad_token', token);
    await setSetting('last_sync', new Date().toISOString());
    
    console.log(`✓ Синхронизация завершена: ${allProducts.length} товаров сохранено`);
    
    res.json({
      success: true,
      count: allProducts.length,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Ошибка синхронизации:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить статус синхронизации
app.get('/admin/sync-status', async (req, res) => {
  try {
    const lastSync = await getSetting('last_sync');
    const hasToken = !!(await getSetting('moysklad_token'));
    const productsCount = (await getProducts()).length;
    
    res.json({
      lastSync: lastSync ? new Date(lastSync).toISOString() : null,
      hasToken,
      productsCount
    });
  } catch (error) {
    console.error('Ошибка получения статуса:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== АДМИНКА МАРШРУТЫ ==========

// Сохранение credentials (админка)
app.post('/admin/set-credentials', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  const saved = saveCredentials({ email, password });
  
  if (saved) {
    res.json({ success: true, message: 'Credentials сохранены' });
  } else {
    res.status(500).json({ error: 'Ошибка при сохранении credentials' });
  }
});

// Проверка, установлены ли credentials
app.get('/admin/credentials-status', (req, res) => {
  const hasCredentials = storedCredentials !== null;
  res.json({
    hasCredentials,
    email: hasCredentials ? storedCredentials.email : null
  });
});

// ========== ЗАКАЗЫ ==========

// Создание заказа в МойСклад
app.post('/api/orders', async (req, res) => {
  if (!ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Admin token не настроен' });
  }

  try {
    const { customer, items, totalPrice } = req.body;

    // Валидация
    if (!customer || !customer.name || !customer.phone || !customer.address || !items || items.length === 0) {
      return res.status(400).json({ error: 'Неполные данные заказа' });
    }

    // Создаем контрагента (если нужно)
    const counterparty = await createOrGetCounterparty(customer);
    
    // Создаем заказ
    const order = await createOrder(counterparty, customer, items, totalPrice);
    
    res.json({
      success: true,
      orderNumber: order.name,
      orderHref: order.href
    });
  } catch (error) {
    console.error('Ошибка при создании заказа:', error);
    res.status(500).json({ error: error.message });
  }
});

// Вспомогательная функция для создания/получения контрагента
async function createOrGetCounterparty(customer) {
  try {
    // Пытаемся найти контрагента по имени
    const searchResponse = await fetch(`${ADMIN_API_URL}/api/remap/1.2/entity/counterparty?filter=name=${encodeURIComponent(customer.name)}&limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });

    const searchData = await searchResponse.json();
    
    if (searchData.rows && searchData.rows.length > 0) {
      return searchData.rows[0];
    }

    // Если не найден - создаем нового контрагента
    const createResponse = await fetch(`${ADMIN_API_URL}/api/remap/1.2/entity/counterparty`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: customer.name,
        phone: customer.phone,
        actualAddress: customer.address,
        description: customer.comment || ''
      })
    });

    if (!createResponse.ok) {
      throw new Error('Ошибка при создании контрагента');
    }

    return await createResponse.json();
  } catch (error) {
    console.error('Ошибка контрагента:', error);
    throw error;
  }
}

// Вспомогательная функция для создания заказа
async function createOrder(counterparty, customer, items, totalPrice) {
  try {
    console.log('Создание заказа для:', customer.name);

    // Получаем склад по умолчанию
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
      throw new Error('Склад не найден в системе');
    }

    console.log('Склад найден:', store.name);

    // Получаем организацию по умолчанию
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
      throw new Error('Организация не найдена в системе');
    }

    console.log('Организация найдена:', organization.name);

    // Формируем позиции для отгрузки
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

    console.log('Позиции сформированы:', positions.length);

    // Создаем отгрузку
    const orderPayload = {
      name: `Заказ от ${customer.name}`,
      description: `Телефон: ${customer.phone}\nАдрес: ${customer.address}${customer.comment ? '\nКомментарий: ' + customer.comment : ''}`,
      agent: { meta: counterparty.meta },
      organization: { meta: organization.meta },
      store: { meta: store.meta },
      positions: positions
    };

    console.log('Отправляю заказ:', JSON.stringify(orderPayload, null, 2));

    const shipmentResponse = await fetch(`${ADMIN_API_URL}/api/remap/1.2/entity/demand`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload)
    });

    if (!shipmentResponse.ok) {
      const errorData = await shipmentResponse.json();
      console.error('Полная ошибка МойСклад:', JSON.stringify(errorData, null, 2));
      throw new Error('Ошибка МойСклад: ' + (errorData.errors?.[0]?.title || errorData.errors?.[0]?.detail || 'неизвестная ошибка'));
    }

    const result = await shipmentResponse.json();
    console.log('Заказ успешно создан:', result.name);
    return result;
  } catch (error) {
    console.error('Ошибка создания заказа:', error.message);
    throw error;
  }
}

// ======= STATIC (production) - ДОЛЖНО БЫТЬ В САМОМ КОНЦЕ =======
// Отдаём статику и SPA fallback только после всех API роутов
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // SPA fallback - для всех не-API путей отдаём index.html
  app.use((req, res, next) => {
    // Пропускаем только API запросы
    if (req.path.startsWith('/api')) {
      return next();
    }
    // Для всех остальных путей (включая /admin) отдаём index.html
    // React Router обработает клиентский роутинг
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Сервер работает на http://localhost:${PORT}`);
});
