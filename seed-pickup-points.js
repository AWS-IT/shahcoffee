/**
 * Скрипт добавления пунктов выдачи в БД.
 * Запуск: node seed-pickup-points.js
 * Требуется .env с DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (или будут использованы значения по умолчанию).
 */
import db, { initDatabase, createPickupPoint } from './db.js';

async function seed() {
  try {
    console.log('Инициализация БД...');
    await initDatabase();
    console.log('Добавление пунктов выдачи...');
    for (const point of PICKUP_POINTS) {
      await createPickupPoint({
        name: point.name,
        address: point.address,
        lat: point.lat,
        lon: point.lon,
        description: null,
        working_hours: null,
        is_active: true,
      });
      console.log('  ✓', point.name);
    }
    console.log('Готово. Добавлено пунктов:', PICKUP_POINTS.length);
    process.exit(0);
  } catch (err) {
    console.error('Ошибка:', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

seed();
