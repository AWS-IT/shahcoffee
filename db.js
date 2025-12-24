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

export default pool;
