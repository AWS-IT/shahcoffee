import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Создаём пул подключений для эффективной работы с MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'u3358557_default',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'u3358557_default',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Инициализация схемы БД (создаём таблицы если их нет)
export async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Таблица для товаров (кеш из МойСклад)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        code VARCHAR(255),
        description TEXT,
        price_rub DECIMAL(10, 2),
        image_url TEXT,
        meta_href TEXT,
        data JSON,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name(255)),
        INDEX idx_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Таблица для настроек (токен МойСклад, дата последней синхронизации)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key_name VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Таблица для пользователей (авторизация через Telegram или email/пароль)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        telegram_id BIGINT UNIQUE,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        username VARCHAR(255),
        phone VARCHAR(50),
        photo_url TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        auth_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_telegram_id (telegram_id),
        INDEX idx_email (email),
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Таблица для заказов
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(100) UNIQUE NOT NULL,
        user_id BIGINT,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_email VARCHAR(255),
        customer_address TEXT,
        coordinates_lat DECIMAL(10, 8),
        coordinates_lon DECIMAL(11, 8),
        items JSON,
        total_price DECIMAL(10, 2),
        status VARCHAR(50) DEFAULT 'pending',
        payment_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_order_id (order_id),
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Таблица для меток на карте (админка)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS map_markers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        address VARCHAR(500),
        lat DECIMAL(10, 8) NOT NULL,
        lon DECIMAL(11, 8) NOT NULL,
        icon_color VARCHAR(20) DEFAULT 'red',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    connection.release();
    console.log('✓ База данных инициализирована');
    return true;
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error.message);
    return false;
  }
}

// Получить все товары из кеша
export async function getProducts() {
  const [rows] = await pool.query(
    'SELECT id, name, code, description, price_rub, image_url, meta_href, data FROM products ORDER BY name'
  );
  return rows;
}

// Получить один товар по ID
export async function getProductById(id) {
  const [rows] = await pool.query(
    'SELECT id, name, code, description, price_rub, image_url, meta_href, data FROM products WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

// Сохранить/обновить товар в БД
export async function upsertProduct(product) {
  const { id, name, code, description, price_rub, image_url, meta_href, data } = product;
  
  await pool.query(
    `INSERT INTO products (id, name, code, description, price_rub, image_url, meta_href, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       code = VALUES(code),
       description = VALUES(description),
       price_rub = VALUES(price_rub),
       image_url = VALUES(image_url),
       meta_href = VALUES(meta_href),
       data = VALUES(data),
       updated_at = CURRENT_TIMESTAMP`,
    [id, name, code, description, price_rub, image_url, meta_href, JSON.stringify(data)]
  );
}

// Очистить все товары (перед полной пересинхронизацией)
export async function clearProducts() {
  await pool.query('DELETE FROM products');
}

// Получить настройку по ключу
export async function getSetting(key) {
  const [rows] = await pool.query(
    'SELECT value FROM settings WHERE key_name = ?',
    [key]
  );
  return rows[0]?.value || null;
}

// Сохранить настройку
export async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO settings (key_name, value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       value = VALUES(value),
       updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
}

// ==================== ПОЛЬЗОВАТЕЛИ ====================

// Создать или обновить пользователя (при авторизации через Telegram)
export async function upsertUser(userData) {
  const { id, first_name, last_name, username, photo_url, auth_date } = userData;
  
  // Проверяем, есть ли пользователь с таким telegram_id
  const [existing] = await pool.query(
    'SELECT id FROM users WHERE telegram_id = ?',
    [id]
  );
  
  if (existing.length > 0) {
    // Обновляем существующего
    await pool.query(
      `UPDATE users SET 
        first_name = ?, last_name = ?, username = ?, photo_url = ?, 
        auth_date = FROM_UNIXTIME(?), updated_at = CURRENT_TIMESTAMP
       WHERE telegram_id = ?`,
      [first_name, last_name || null, username || null, photo_url || null, 
       auth_date || Math.floor(Date.now() / 1000), id]
    );
    return { id: existing[0].id, telegram_id: id, first_name, last_name, username, photo_url };
  }
  
  // Создаём нового
  const [result] = await pool.query(
    `INSERT INTO users (telegram_id, first_name, last_name, username, photo_url, auth_date)
     VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?))`,
    [id, first_name, last_name || null, username || null, photo_url || null, 
     auth_date || Math.floor(Date.now() / 1000)]
  );
  
  return { id: result.insertId, telegram_id: id, first_name, last_name, username, photo_url };
}

// Регистрация через email/пароль
export async function createUserWithEmail(email, passwordHash, firstName, phone = null) {
  const [result] = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, phone)
     VALUES (?, ?, ?, ?)`,
    [email, passwordHash, firstName, phone]
  );
  return { id: result.insertId, email, first_name: firstName, phone };
}

// Получить пользователя по email
export async function getUserByEmail(email) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  return rows[0] || null;
}

// Получить пользователя по ID
export async function getUserById(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
}

// Получить пользователя по Telegram ID
export async function getUserByTelegramId(telegramId) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE telegram_id = ?',
    [telegramId]
  );
  return rows[0] || null;
}

// Привязать Telegram к существующему аккаунту
export async function linkTelegramToUser(userId, telegramData) {
  const { id, first_name, last_name, username, photo_url, auth_date } = telegramData;
  
  await pool.query(
    `UPDATE users SET 
      telegram_id = ?, 
      first_name = COALESCE(first_name, ?),
      last_name = COALESCE(last_name, ?),
      username = COALESCE(username, ?),
      photo_url = COALESCE(photo_url, ?),
      auth_date = FROM_UNIXTIME(?),
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id, first_name, last_name || null, username || null, photo_url || null, 
     auth_date || Math.floor(Date.now() / 1000), userId]
  );
  
  return getUserById(userId);
}

// Проверить, является ли пользователь админом
export async function isUserAdmin(userId) {
  const [rows] = await pool.query(
    'SELECT is_admin FROM users WHERE id = ?',
    [userId]
  );
  return rows[0]?.is_admin === 1;
}

// Сделать пользователя админом
export async function setUserAdmin(userId, isAdmin = true) {
  await pool.query(
    'UPDATE users SET is_admin = ? WHERE id = ?',
    [isAdmin ? 1 : 0, userId]
  );
}

// ==================== ЗАКАЗЫ ====================

// Создать заказ
export async function createOrder(orderData) {
  const {
    orderId,
    userId,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    coordinates,
    items,
    totalPrice,
    status = 'pending'
  } = orderData;

  const itemsJson = Array.isArray(items)
    ? JSON.stringify(items)
    : (typeof items === 'string' ? items : null);

  const coordinatesLat = coordinates?.lat ?? null;
  const coordinatesLon = coordinates?.lon ?? null;

  await pool.query(
    `INSERT INTO orders (order_id, user_id, customer_name, customer_phone, customer_email, 
     customer_address, coordinates_lat, coordinates_lon, items, total_price, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = COALESCE(VALUES(user_id), user_id),
       customer_name = COALESCE(VALUES(customer_name), customer_name),
       customer_phone = COALESCE(VALUES(customer_phone), customer_phone),
       customer_email = COALESCE(VALUES(customer_email), customer_email),
       customer_address = COALESCE(VALUES(customer_address), customer_address),
       coordinates_lat = COALESCE(VALUES(coordinates_lat), coordinates_lat),
       coordinates_lon = COALESCE(VALUES(coordinates_lon), coordinates_lon),
       items = COALESCE(VALUES(items), items),
       total_price = COALESCE(VALUES(total_price), total_price),
       updated_at = CURRENT_TIMESTAMP`,
    [
      orderId,
      userId ?? null,
      customerName ?? null,
      customerPhone ?? null,
      customerEmail ?? null,
      customerAddress ?? null,
      coordinatesLat,
      coordinatesLon,
      itemsJson,
      totalPrice ?? null,
      status
    ]
  );

  return { orderId, status };
}

// Обновить статус заказа (например, после оплаты)
export async function updateOrderStatus(orderId, status, paymentId = null) {
  await pool.query(
    `UPDATE orders SET status = ?, payment_id = COALESCE(?, payment_id), updated_at = CURRENT_TIMESTAMP
     WHERE order_id = ?`,
    [status, paymentId, orderId]
  );
}

// Получить заказ по ID
export async function getOrderById(orderId) {
  const [rows] = await pool.query(
    'SELECT * FROM orders WHERE order_id = ?',
    [orderId]
  );
  if (rows[0]) {
    let items = [];
    try {
      if (rows[0].items && typeof rows[0].items === 'string' && rows[0].items.trim()) {
        items = JSON.parse(rows[0].items);
      } else if (Array.isArray(rows[0].items)) {
        items = rows[0].items;
      }
    } catch (e) {
      console.warn('Failed to parse items for order', orderId, e.message);
    }
    // Преобразуем snake_case в camelCase для фронтенда
    return {
      orderId: rows[0].order_id,
      userId: rows[0].user_id,
      customerData: {
        name: rows[0].customer_name,
        phone: rows[0].customer_phone,
        email: rows[0].customer_email,
        address: rows[0].customer_address
      },
      coordinates: rows[0].coordinates_lat && rows[0].coordinates_lon ? {
        lat: parseFloat(rows[0].coordinates_lat),
        lon: parseFloat(rows[0].coordinates_lon)
      } : null,
      items,
      totalPrice: parseFloat(rows[0].total_price) || 0,
      status: rows[0].status,
      paymentId: rows[0].payment_id,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at
    };
  }
  return null;
}

// Получить все заказы пользователя
export async function getOrdersByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(row => {
    let items = [];
    try {
      if (row.items && typeof row.items === 'string' && row.items.trim()) {
        items = JSON.parse(row.items);
      } else if (Array.isArray(row.items)) {
        items = row.items;
      }
    } catch (e) {
      console.warn('Failed to parse items for order', row.order_id, e.message);
    }
    // Преобразуем snake_case в camelCase для фронтенда
    return {
      orderId: row.order_id,
      userId: row.user_id,
      customerData: {
        name: row.customer_name,
        phone: row.customer_phone,
        email: row.customer_email,
        address: row.customer_address
      },
      coordinates: row.coordinates_lat && row.coordinates_lon ? {
        lat: parseFloat(row.coordinates_lat),
        lon: parseFloat(row.coordinates_lon)
      } : null,
      items,
      totalPrice: parseFloat(row.total_price) || 0,
      status: row.status,
      paymentId: row.payment_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
}

// Получить все заказы (для админки)
export async function getAllOrders(limit = 100, offset = 0) {
  const [rows] = await pool.query(
    'SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  return rows.map(row => {
    let items = [];
    try {
      if (row.items && typeof row.items === 'string' && row.items.trim()) {
        items = JSON.parse(row.items);
      } else if (Array.isArray(row.items)) {
        items = row.items;
      }
    } catch (e) {
      console.warn('Failed to parse items for order', row.order_id, e.message);
    }
    // Преобразуем snake_case в camelCase для фронтенда
    return {
      orderId: row.order_id,
      userId: row.user_id,
      customerData: {
        name: row.customer_name,
        phone: row.customer_phone,
        email: row.customer_email,
        address: row.customer_address
      },
      coordinates: row.coordinates_lat && row.coordinates_lon ? {
        lat: parseFloat(row.coordinates_lat),
        lon: parseFloat(row.coordinates_lon)
      } : null,
      items,
      totalPrice: parseFloat(row.total_price) || 0,
      status: row.status,
      paymentId: row.payment_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });
}

// ==================== МЕТКИ НА КАРТЕ ====================

// Получить все активные метки
export async function getMapMarkers() {
  const [rows] = await pool.query(
    'SELECT * FROM map_markers WHERE is_active = TRUE ORDER BY created_at DESC'
  );
  return rows;
}

// Получить все метки (для админки)
export async function getAllMapMarkers() {
  const [rows] = await pool.query(
    'SELECT * FROM map_markers ORDER BY created_at DESC'
  );
  return rows;
}

// Создать метку
export async function createMapMarker(marker) {
  const { title, description, address, lat, lon, icon_color } = marker;
  const [result] = await pool.query(
    `INSERT INTO map_markers (title, description, address, lat, lon, icon_color)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, description || '', address || '', lat, lon, icon_color || 'red']
  );
  return { id: result.insertId, ...marker };
}

// Обновить метку
export async function updateMapMarker(id, marker) {
  const { title, description, address, lat, lon, icon_color, is_active } = marker;
  await pool.query(
    `UPDATE map_markers SET title = ?, description = ?, address = ?, lat = ?, lon = ?, 
     icon_color = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [title, description, address, lat, lon, icon_color, is_active, id]
  );
  return { id, ...marker };
}

// Удалить метку
export async function deleteMapMarker(id) {
  await pool.query('DELETE FROM map_markers WHERE id = ?', [id]);
}

export default pool;
