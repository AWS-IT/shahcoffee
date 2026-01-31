// Простой тест API Т-Банк
import crypto from 'crypto';

const TERMINAL = '1769767428862DEMO';
const PASSWORD = '8u1$JL&lGpawqbMf';

// Возможные URLs для тестового API
const URLS_TO_TEST = [
  'https://securepayments.tinkoff.ru/v2/Init',
  'https://rest-api-test.tinkoff.ru/v2/Init',
  'https://securepay.tinkoff.ru/v2/Init'
];

function buildToken(params, password) {
  const pairs = [];
  for (const key of Object.keys(params)) {
    const v = params[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') continue;
    pairs.push({ k: key, v: String(v) });
  }
  pairs.push({ k: 'Password', v: String(password) });
  pairs.sort((a, b) => a.k.localeCompare(b.k));
  const concat = pairs.map(p => p.v).join('');
  return crypto.createHash('sha256').update(concat, 'utf8').digest('hex');
}

async function testUrl(url) {
  const params = {
    TerminalKey: TERMINAL,
    Amount: 10000, // 100 рублей
    OrderId: 'test-' + Date.now(),
    Description: 'Тестовый платеж'
  };
  
  params.Token = buildToken(params, PASSWORD);
  
  console.log(`\n🔍 Тестируем URL: ${url}`);
  console.log('Параметры:', JSON.stringify(params, null, 2));
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    const contentType = response.headers.get('content-type');
    console.log(`Content-Type: ${contentType}`);
    
    const text = await response.text();
    
    if (contentType && contentType.includes('application/json')) {
      const json = JSON.parse(text);
      console.log('✅ Ответ (JSON):', JSON.stringify(json, null, 2));
      
      if (json.PaymentURL) {
        console.log(`\n🎉 УСПЕХ! Этот URL работает: ${url}`);
        console.log(`PaymentURL: ${json.PaymentURL}`);
        return true;
      } else if (json.ErrorCode) {
        console.log(`❌ Ошибка: ${json.ErrorCode} - ${json.Message || json.Details}`);
      }
    } else {
      console.log(`❌ Неверный Content-Type. Первые 200 символов ответа:`);
      console.log(text.substring(0, 200));
    }
  } catch (error) {
    console.log(`❌ Ошибка запроса: ${error.message}`);
  }
  
  return false;
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 Тестирование API endpoints Т-Банк');
  console.log('='.repeat(60));
  console.log(`Terminal: ${TERMINAL}`);
  console.log(`Password: ${PASSWORD.substring(0, 4)}***`);
  
  for (const url of URLS_TO_TEST) {
    const success = await testUrl(url);
    if (success) {
      console.log(`\n✅ Используйте этот URL в .env: TBANK_INIT_URL=${url}`);
      break;
    }
    // Подождем немного между запросами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Тест завершен');
  console.log('='.repeat(60));
}

main().catch(console.error);
