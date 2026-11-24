const TIME_ZONE = 'Asia/Tokyo';
const SERVICE_KEYS = {
  trial45: {
    envId: 'TRIAL45_VARIATION_ID',
    name: '初回ドライヘッドスパ 45分',
    price: 4000,
    duration: 45
  },
  spa60: {
    envId: 'SPA60_VARIATION_ID',
    name: 'ドライヘッドスパ 60分',
    price: 6200,
    duration: 60
  },
  foot90: {
    envId: 'FOOT90_VARIATION_ID',
    name: '足つぼ＋ドライヘッドスパ 90分',
    price: 8200,
    duration: 90
  },
  foot80: {
    envId: 'FOOT80_VARIATION_ID',
    name: '【新規★人気No.1】足むくみ◇足つぼ20分+ヘッド60分（80分）',
    price: 8200,
    duration: 80,
    bookingDurationLabel: '1時間50分（施術80分）',
    description: '足つぼ20分とドライヘッドスパ60分のセットコースです。'
  }
};
const ACTIVE_SERVICE_KEYS = ['foot80'];

function jsonResponse(body, status = 200, corsOrigin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function corsOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGIN || 'https://toyotsuspa-coder.github.io').trim();
  return origin === allowed ? origin : '';
}

function isPlaceholder(value) {
  return !value || /^(YOUR_|PLACEHOLDER)/i.test(value);
}

function squareConfigError(env) {
  const missing = [];
  const apiBase = env.SQUARE_API_BASE_URL || 'https://connect.squareup.com';
  if (!['https://connect.squareup.com', 'https://connect.squareupsandbox.com'].includes(apiBase)) {
    missing.push('SQUARE_API_BASE_URL');
  }
  if (isPlaceholder(env.SQUARE_ACCESS_TOKEN)) missing.push('SQUARE_ACCESS_TOKEN');
  if (isPlaceholder(env.SQUARE_API_VERSION)) missing.push('SQUARE_API_VERSION');
  if (isPlaceholder(env.LOCATION_ID)) missing.push('LOCATION_ID');
  for (const key of ACTIVE_SERVICE_KEYS) {
    const service = SERVICE_KEYS[key];
    if (isPlaceholder(env[service.envId])) missing.push(service.envId);
  }
  return missing;
}

function nextJstDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + 1);
  return [
    utc.getUTCFullYear(),
    String(utc.getUTCMonth() + 1).padStart(2, '0'),
    String(utc.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const [year, month, day] = value.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
}

function todayJst() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = {};
  for (const part of parts) values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}

async function squareFetch(env, path, options = {}) {
  const apiBase = env.SQUARE_API_BASE_URL || 'https://connect.squareup.com';
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      'Square-Version': env.SQUARE_API_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) {}
  if (!response.ok) {
    const detail = data.errors && data.errors[0] ? data.errors[0].detail : '';
    throw Object.assign(new Error(detail || 'Square API request failed'), {
      status: response.status,
      squareData: data
    });
  }
  return data;
}

async function getCatalogService(env, key) {
  const definition = SERVICE_KEYS[key];
  if (!definition) return null;
  const variationId = env[definition.envId];
  if (isPlaceholder(variationId)) return null;

  const data = await squareFetch(env, `/v2/catalog/object/${encodeURIComponent(variationId)}?include_related_objects=true`);
  const object = data.object;
  const info = object && object.item_variation_data;
  const name = info && info.name ? info.name : definition.name;
  const amount = info && info.price_money && typeof info.price_money.amount === 'number'
    ? info.price_money.amount
    : definition.price;
  return {
    key,
    name,
    price: amount,
    duration: definition.duration,
    bookingDurationLabel: definition.bookingDurationLabel,
    description: definition.description,
    serviceVariationId: variationId,
    serviceVariationVersion: object && object.version
  };
}

async function getServices(env) {
  const missing = squareConfigError(env);
  if (missing.length) {
    throw Object.assign(new Error('Square設定が未完了です'), { status: 503, missing });
  }
  const services = [];
  for (const key of ACTIVE_SERVICE_KEYS) {
    services.push(await getCatalogService(env, key));
  }
  return services.filter(Boolean);
}

async function searchAvailability(env, serviceKey, date) {
  const definition = SERVICE_KEYS[serviceKey];
  if (!definition) throw Object.assign(new Error('コースが不正です'), { status: 400 });
  const variationId = env[definition.envId];
  if (isPlaceholder(env.LOCATION_ID) || isPlaceholder(variationId)) {
    throw Object.assign(new Error('Square設定が未完了です'), { status: 503 });
  }

  const startAt = `${date}T00:00:00+09:00`;
  const endAt = `${nextJstDate(date)}T00:00:00+09:00`;
  const segmentFilter = { service_variation_id: variationId };
  if (!isPlaceholder(env.TEAM_MEMBER_ID)) {
    segmentFilter.team_member_id_filter = { all: [env.TEAM_MEMBER_ID] };
  }

  const body = {
    query: {
      filter: {
        location_id: env.LOCATION_ID,
        segment_filters: [segmentFilter],
        start_at_range: { start_at: startAt, end_at: endAt }
      }
    }
  };

  const data = await squareFetch(env, '/v2/bookings/availability/search', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  const slots = [];
  for (const availability of data.availabilities || []) {
    const startAtValue = availability.start_at;
    if (!startAtValue) continue;
    const segment = availability.appointment_segments && availability.appointment_segments[0];
    const teamMemberId = segment && segment.team_member_id;
    let label;
    try {
      label = new Intl.DateTimeFormat('ja-JP', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(startAtValue));
    } catch (_) {
      label = startAtValue.slice(11, 16);
    }
    if (!slots.some((slot) => slot.startAt === startAtValue && slot.teamMemberId === teamMemberId)) {
      slots.push({ startAt: startAtValue, label, teamMemberId: teamMemberId || '' });
    }
  }
  slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return slots;
}

async function findOrCreateCustomer(env, name, phone, email) {
  let customerId = null;
  if (phone) {
    const search = await squareFetch(env, '/v2/customers/search', {
      method: 'POST',
      body: JSON.stringify({ query: { filter: { phone_number: { exact: phone } } } })
    });
    if (search.customers && search.customers[0]) customerId = search.customers[0].id;
  }
  if (!customerId) {
    const names = name.trim().split(/\s+/);
    const familyName = names.length > 1 ? names[0] : name;
    const givenName = names.length > 1 ? names.slice(1).join(' ') : undefined;
    const customerBody = {
      idempotency_key: crypto.randomUUID(),
      given_name: givenName,
      family_name: familyName,
      phone_number: phone
    };
    if (email) customerBody.email_address = email;
    const created = await squareFetch(env, '/v2/customers', {
      method: 'POST',
      body: JSON.stringify(customerBody)
    });
    customerId = created.customer && created.customer.id;
  }
  if (!customerId) throw new Error('顧客情報を登録できませんでした');
  return customerId;
}

async function rateLimit(request, env) {
  if (!env.RATE_LIMIT_KV) return true;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const key = `booking:${ip}:${minute}`;
  const count = Number(await env.RATE_LIMIT_KV.get(key) || 0);
  if (count >= 20) return false;
  await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: 120 });
  return true;
}

export default {
  async fetch(request, env) {
    const origin = corsOrigin(request, env);
    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        }
      });
    }
    if (!origin) return jsonResponse({ ok: false, message: 'Originが許可されていません' }, 403, origin);

    const url = new URL(request.url);
    try {
      if (!await rateLimit(request, env) && url.pathname.startsWith('/api/')) {
        return jsonResponse({ ok: false, message: 'リクエストが多すぎます。しばらくしてからお試しください。' }, 429, origin);
      }

      if (request.method === 'GET' && url.pathname === '/api/services') {
        const services = await getServices(env);
        return jsonResponse({ services }, 200, origin);
      }

      if (request.method === 'POST' && url.pathname === '/api/availability') {
        let body;
        try { body = await request.json(); } catch (_) {
          return jsonResponse({ ok: false, message: 'JSONリクエストが不正です' }, 400, origin);
        }
        if (!SERVICE_KEYS[body.serviceKey]) {
          return jsonResponse({ ok: false, message: 'コースが不正です' }, 400, origin);
        }
        if (!isValidDate(body.date) || body.date < todayJst()) {
          return jsonResponse({ ok: false, message: '予約日が不正です' }, 400, origin);
        }
        const slots = await searchAvailability(env, body.serviceKey, body.date);
        return jsonResponse({ slots }, 200, origin);
      }

      if (request.method === 'POST' && url.pathname === '/api/bookings') {
        let body;
        try { body = await request.json(); } catch (_) {
          return jsonResponse({ ok: false, message: 'JSONリクエストが不正です' }, 400, origin);
        }
        const name = String(body.name || '').trim();
        const phone = String(body.phone || '').trim();
        const email = String(body.email || '').trim();
        if (!name || name.length > 100 || !phone || phone.length > 30) {
          return jsonResponse({ ok: false, message: 'お名前と電話番号を確認してください' }, 400, origin);
        }
        if (!/^[0-9+\-()\s]{8,30}$/.test(phone)) {
          return jsonResponse({ ok: false, message: '電話番号の形式が不正です' }, 400, origin);
        }
        if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
          return jsonResponse({ ok: false, message: 'メールアドレスの形式が不正です' }, 400, origin);
        }
        if (!SERVICE_KEYS[body.serviceKey]) {
          return jsonResponse({ ok: false, message: 'コースが不正です' }, 400, origin);
        }
        if (!body.startAt || typeof body.startAt !== 'string') {
          return jsonResponse({ ok: false, message: '予約日時が不正です' }, 400, origin);
        }
        if (!body.idempotencyKey || typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length > 100) {
          return jsonResponse({ ok: false, message: '二重送信キーが不正です' }, 400, origin);
        }

        let startDate;
        try {
          const start = new Date(body.startAt);
          if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
            throw new Error('past');
          }
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).formatToParts(start);
          const values = {};
          for (const part of parts) values[part.type] = part.value;
          startDate = `${values.year}-${values.month}-${values.day}`;
        } catch (_) {
          return jsonResponse({ ok: false, message: '予約日時が不正です' }, 400, origin);
        }

        const slots = await searchAvailability(env, body.serviceKey, startDate);
        const exact = slots.find((slot) => {
          return slot.startAt === body.startAt &&
            (!body.teamMemberId || !slot.teamMemberId || slot.teamMemberId === body.teamMemberId);
        });
        if (!exact) {
          return jsonResponse({ ok: false, message: '選択した時間枠は利用できません' }, 409, origin);
        }

        if (env.BOOKING_KV) {
          const prior = await env.BOOKING_KV.get(`booking:${body.idempotencyKey}`);
          if (prior) {
            return jsonResponse({ ...JSON.parse(prior), ok: true, duplicate: true }, 200, origin);
          }
        }

        const customerId = await findOrCreateCustomer(env, name, phone, email);
        const definition = SERVICE_KEYS[body.serviceKey];
        const catalogService = await getCatalogService(env, body.serviceKey);
        if (!catalogService || !catalogService.serviceVariationVersion || !exact.teamMemberId) {
          throw Object.assign(new Error('予約コースまたはスタッフのSquare設定を確認してください'), { status: 503 });
        }
        const bookingBody = {
          idempotency_key: body.idempotencyKey,
          booking: {
            location_id: env.LOCATION_ID,
            customer_id: customerId,
            customer_note: '癒sisオンライン予約',
            start_at: exact.startAt,
            appointment_segments: [{
              team_member_id: exact.teamMemberId,
              service_variation_id: env[definition.envId],
              service_variation_version: catalogService.serviceVariationVersion,
              duration_minutes: definition.duration
            }]
          }
        };

        const created = await squareFetch(env, '/v2/bookings', {
          method: 'POST',
          body: JSON.stringify(bookingBody)
        });
        const result = {
          bookingId: created.booking && created.booking.id,
          status: created.booking && created.booking.status
        };
        if (env.BOOKING_KV) {
          await env.BOOKING_KV.put(`booking:${body.idempotencyKey}`, JSON.stringify(result), { expirationTtl: 86400 });
        }
        return jsonResponse({ ok: true, ...result }, 200, origin);
      }

      return jsonResponse({ ok: false, message: 'Not Found' }, 404, origin);
    } catch (error) {
      if (error.status === 409) {
        return jsonResponse({ ok: false, message: '選択した時間枠は予約されました' }, 409, origin);
      }
      if (error.status === 400) {
        return jsonResponse({ ok: false, message: error.message || '入力が不正です' }, 400, origin);
      }
      if (error.status === 503 || error.message === 'Square設定が未完了です') {
        return jsonResponse({ ok: false, message: '予約システムが設定途中です', code: 'CONFIGURATION_REQUIRED', missing: error.missing }, 503, origin);
      }
      if (error.status === 401 || error.status === 403) {
        return jsonResponse({ ok: false, message: '予約サービスへの認証に失敗しました' }, 502, origin);
      }
      return jsonResponse({ ok: false, message: '予約サービスで障害が発生しました' }, 502, origin);
    }
  }
};
