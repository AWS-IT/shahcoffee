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

    // Таблица для пользователей (авторизация через Telegram)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        username VARCHAR(255),
        photo_url TEXT,
        auth_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_telegram_id (telegram_id),
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
        status ENUM('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
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
  
  await pool.query(
    `INSERT INTO users (id, telegram_id, first_name, last_name, username, photo_url, auth_date)
     VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))
     ON DUPLICATE KEY UPDATE
       first_name = VALUES(first_name),
       last_name = VALUES(last_name),
       username = VALUES(username),
       photo_url = VALUES(photo_url),
       auth_date = VALUES(auth_date),
       updated_at = CURRENT_TIMESTAMP`,
    [id, id, first_name, last_name || null, username || null, photo_url || null, auth_date || Math.floor(Date.now() / 1000)]
  );
  
  return { id, first_name, last_name, username, photo_url };
}

// Получить пользователя по Telegram ID
export async function getUserByTelegramId(telegramId) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE telegram_id = ?',
    [telegramId]
  );
  return rows[0] || null;
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

  await pool.query(
    `INSERT INTO orders (order_id, user_id, customer_name, customer_phone, customer_email, 
     customer_address, coordinates_lat, coordinates_lon, items, total_price, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      userId || null,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      coordinates?.lat || null,
      coordinates?.lon || null,
      JSON.stringify(items),
      totalPrice,
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
    rows[0].items = JSON.parse(rows[0].items || '[]');
  }
  return rows[0] || null;
}

// Получить все заказы пользователя
export async function getOrdersByUserId(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(row => ({
    ...row,
    items: JSON.parse(row.items || '[]')
  }));
}

// Получить все заказы (для админки)
export async function getAllOrders(limit = 100, offset = 0) {
  const [rows] = await pool.query(
    'SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  return rows.map(row => ({
    ...row,
    items: JSON.parse(row.items || '[]')
  }));
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
