// Тест: проверяем правильный endpoint для остатков МойСклад
(async () => {
  const token = '1cb0d68d9242028446bd8442c63c5560a1161213';
  const base = 'https://api.moysklad.ru/api/remap/1.2';
  const headers = { 'Authorization': `Bearer ${token}` };

  // Попробуем разные варианты endpointa
  const urls = [
    `${base}/report/stock/all?limit=2&groupBy=store`,
    `${base}/report/stock/bystore?limit=2`,
    `${base}/report/stock/all?limit=2`,
    `${base}/report/stock/bystore/current?limit=2`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers });
      const d = await r.json();
      const path = url.replace(base, '');
      if (r.ok) {
        console.log(`\n=== ${path} => ${r.status}, rows: ${d.rows?.length || 0}, total: ${d.meta?.size || '?'} ===`);
        if (d.rows && d.rows[0]) {
          const row = d.rows[0];
          console.log('  Keys:', Object.keys(row));
          console.log('  name:', row.name, '| stock:', row.stock);
          console.log('  meta.href:', row.meta?.href);
          console.log('  assortment:', row.assortment?.meta?.href);
          console.log('  store:', row.store?.meta?.href);
          console.log('  stockByStore:', row.stockByStore ? `${row.stockByStore.length} entries` : 'N/A');
          if (row.stockByStore && row.stockByStore[0]) {
            const sbs = row.stockByStore[0];
            console.log('  stockByStore[0] keys:', Object.keys(sbs));
            console.log('  stockByStore[0].meta:', sbs.meta?.href);
            console.log('  stockByStore[0].name:', sbs.name, '| stock:', sbs.stock);
          }
        }
      } else {
        console.log(`X ${path} => ${r.status}: ${d.errors?.[0]?.error || 'unknown error'}`);
      }
    } catch (e) {
      console.log(`! ${url} => ${e.message}`);
    }
  }
})();
