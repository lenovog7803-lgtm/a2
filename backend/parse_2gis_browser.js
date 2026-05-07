/**
 * Запуск: вставить целиком в консоль браузера на https://2gis.ru
 * Добавляет компании из 2GIS API в CRM через POST /api/leads
 */

const CONFIG = {
  apiKey:   'cd5ee789-3e47-4efb-a536-bd437347f0b5',
  apiBase:  'https://catalog.api.2gis.com',
  crmBase:  'https://logistics-crm-backend.onrender.com/api',
  pageSize: 20,
  maxPages: 50,
  delay:    400,   // мс между запросами к 2GIS
  batch:    50,    // компаний перед отправкой в CRM
};

const CITY_IDS = {
  'Минск':   '1141',
  'Брест':   '1142',
  'Витебск': '1144',
  'Гомель':  '1146',
  'Гродно':  '1147',
  'Могилев': '1149',
};

const QUERIES = [
  'производитель',
  'оптовая торговля',
  'завод',
  'дистрибьютор',
  'продукты питания оптом',
  'строительные материалы',
  'упаковка оптом',
];

// ─── Утилиты ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiFetch(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
  return r.json();
}

// ─── 2GIS запросы ─────────────────────────────────────────────────────────────

function firstPhone(item) {
  for (const group of item.contact_groups || []) {
    for (const c of group.contacts || []) {
      if (['phone', 'mobile_phone', 'fax'].includes(c.type) && c.value) {
        return c.value.trim();
      }
    }
  }
  return '';
}

function firstEmail(item) {
  for (const group of item.contact_groups || []) {
    for (const c of group.contacts || []) {
      if (c.type === 'email' && c.value) return c.value.trim();
    }
  }
  return '';
}

function buildLead(item, cityName, query) {
  const name = (item.name || '').trim();
  if (!name) return null;

  const address = (item.address?.name || item.address?.comment || '').trim();
  const notes   = address ? `${query}: ${address}` : query;

  return {
    name,
    company:  name,
    phone:    firstPhone(item),
    email:    firstEmail(item),
    city:     cityName,
    notes:    notes.slice(0, 255),
    status:   'new',
  };
}

async function* iterItems(cityId, cityName, query) {
  const seenIds = new Set();
  let page = 1;

  while (page <= CONFIG.maxPages) {
    await sleep(CONFIG.delay);

    const params = new URLSearchParams({
      q:         query,
      city_id:   cityId,
      key:       CONFIG.apiKey,
      page:      String(page),
      page_size: String(CONFIG.pageSize),
      fields:    'items.contacts,items.address',
      locale:    'ru_RU',
      type:      'branch',
    });

    let data;
    try {
      const r = await fetch(`${CONFIG.apiBase}/3.0/items?${params}`);
      if (!r.ok) { console.warn(`  [WARN] ${r.status} — пропускаем страницу`); break; }
      data = await r.json();
    } catch (e) {
      console.warn(`  [WARN] fetch error: ${e.message}`);
      break;
    }

    const result = data.result || {};
    const items  = result.items || data.items || [];
    const total  = parseInt(result.total || data.total || '0', 10);

    if (!items.length) break;

    const pageIds = new Set(items.map(i => String(i.id)).filter(Boolean));
    if (pageIds.size && [...pageIds].every(id => seenIds.has(id))) {
      console.log(`      [${cityName}] «${query}» стр.${page}: дубликаты — стоп`);
      break;
    }
    pageIds.forEach(id => seenIds.add(id));

    const lastPage = total ? Math.ceil(total / CONFIG.pageSize) : page;
    console.log(`      [${cityName}] «${query}» стр.${page}/${lastPage}: ${items.length} компаний`);

    for (const item of items) yield { item, cityName, query };

    if (!total || page * CONFIG.pageSize >= total) break;
    page++;
  }
}

// ─── CRM запросы ──────────────────────────────────────────────────────────────

let _existingNames = null;

async function loadExistingNames() {
  if (_existingNames) return _existingNames;
  console.log('  Загружаем существующие лиды из CRM...');
  try {
    const leads = await apiFetch(`${CONFIG.crmBase}/leads`);
    _existingNames = new Set((leads || []).map(l => (l.company || l.name || '').trim().toLowerCase()));
    console.log(`  В CRM: ${_existingNames.size} записей`);
  } catch (e) {
    console.warn(`  [WARN] не удалось загрузить лиды: ${e.message}`);
    _existingNames = new Set();
  }
  return _existingNames;
}

async function postLead(lead) {
  return apiFetch(`${CONFIG.crmBase}/leads`, {
    method: 'POST',
    body:   JSON.stringify(lead),
  });
}

async function flushBatch(batch) {
  let ok = 0;
  for (const lead of batch) {
    try {
      await postLead(lead);
      ok++;
    } catch (e) {
      console.warn(`    [WARN] POST failed (${lead.name}): ${e.message}`);
    }
    await sleep(100);
  }
  return ok;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('  Парсер 2GIS -> CRM  |  ' + new Date().toLocaleTimeString());
  console.log('='.repeat(60));

  const existing    = await loadExistingNames();
  let totalAdded    = 0;
  let totalSkipped  = 0;
  let batch         = [];

  for (const [cityName, cityId] of Object.entries(CITY_IDS)) {
    for (const query of QUERIES) {
      console.log(`\n  ▸ ${cityName} / «${query}»`);

      for await (const { item, cityName: city, query: q } of iterItems(cityId, cityName, query)) {
        const lead = buildLead(item, city, q);
        if (!lead) continue;

        const key = lead.company.trim().toLowerCase();
        if (existing.has(key)) { totalSkipped++; continue; }

        existing.add(key);
        batch.push(lead);
        console.log(`      + ${lead.name.slice(0, 45).padEnd(45)} | ${lead.phone}`);

        if (batch.length >= CONFIG.batch) {
          console.log(`      → Отправляем ${batch.length} записей в CRM...`);
          const sent = await flushBatch(batch);
          totalAdded += sent;
          batch = [];
          console.log(`      → Отправлено: ${totalAdded} итого`);
        }
      }
    }
  }

  if (batch.length) {
    console.log(`\n  → Финальный flush: ${batch.length} записей...`);
    const sent = await flushBatch(batch);
    totalAdded += sent;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  Готово.  Добавлено: ${totalAdded}  |  Пропущено (дубли): ${totalSkipped}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
