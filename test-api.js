import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.MY_SKLAD_API_TOKEN;  // Токен из .env
const URL = 'https://api.moysklad.ru/api/remap/1.2/entity/product';  // URL для получения товаров

const getProducts = async () => {
  try {
    const response = await fetch(URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json;charset=utf-8',  // Заголовок для получения JSON
      },
    });

    if (!response.ok) {
      throw new Error(`Ошибка: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Товары получены:', data);  // Логируем товары
  } catch (error) {
    console.error('Ошибка при запросе к API:', error);
  }
};

getProducts();