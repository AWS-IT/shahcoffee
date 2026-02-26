/**
 * Скрипт добавления пунктов выдачи в БД.
 * Запуск: node seed-pickup-points.js
 * Требуется .env с DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (или будут использованы значения по умолчанию).
 */
import db, { initDatabase, createPickupPoint } from './db.js';

const PICKUP_POINTS = [
  { name: 'Москва, Лосевская 6', address: '129347, Россия, г Москва, ул Лосевская, 6', lat: 55.873637, lon: 37.711949 },
  { name: 'Урус-Мартан, пер. Чехова 21', address: '366522, Россия, Чеченская Респ, Урус-Мартановский р-н, г Урус-Мартан, пер 1-й Чехова, 21', lat: 43.131677, lon: 45.537147 },
  { name: 'Грозный, ул. Яндарова 20А', address: '364020, Россия, Чеченская Респ, г Грозный, улица Шейха Абдул-Хамида Солсаевича Яндарова, 20А', lat: 43.323797, lon: 45.694496 },
];

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
