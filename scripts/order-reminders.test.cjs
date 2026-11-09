const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, mocks = {}) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, mocks);
    return require(name);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

const tokens = load('lib/orderFulfillmentToken.ts');
const orderId = '11111111-1111-4111-8111-111111111111';
const secret = 'test-signing-secret-at-least-32-characters';
const now = 1800000000000;

test('fulfillment tokens are order-specific, expire, and reject tampering and wrong secrets', () => {
  const token = tokens.createFulfillmentToken(orderId, secret, now);
  assert.equal(tokens.verifyFulfillmentToken(token, secret, now), orderId);
  assert.equal(tokens.verifyFulfillmentToken(token, secret, now + 7 * 86400000), null);
  assert.equal(tokens.verifyFulfillmentToken(token, secret + 'wrong', now), null);
  const [payload, signature] = token.split('.');
  const altered = JSON.parse(Buffer.from(payload, 'base64url').toString());
  altered.orderId = '22222222-2222-4222-8222-222222222222';
  assert.equal(tokens.verifyFulfillmentToken(`${Buffer.from(JSON.stringify(altered)).toString('base64url')}.${signature}`, secret, now), null);
  for (const bad of ['', 'broken', token + '.extra', 'x'.repeat(2000)]) assert.equal(tokens.verifyFulfillmentToken(bad, secret, now), null);
  assert.equal(tokens.verifyFulfillmentToken(token, '', now), null);
});

test('reminder email includes escaped customer details and a signed confirmation link per order', () => {
  const { buildOrderReminderEmail } = load('lib/orderReminderEmail.ts');
  const email = buildOrderReminderEmail([{ id: orderId, created_at: '2026-01-01T12:00:00Z', customer_name: '<Customer>', items: 'Print & frame x2' }], 'https://eric-fong.ca', secret);
  assert.ok(email.html.includes('&lt;Customer&gt;'));
  assert.ok(email.html.includes('Print &amp; frame x2'));
  const match = email.text.match(/Confirm fulfillment: (\S+)/);
  const link = new URL(match[1]);
  assert.equal(link.pathname, '/orders/fulfill');
  assert.equal(tokens.verifyFulfillmentToken(link.searchParams.get('token'), secret), orderId);
});

test('fulfillment is idempotent and changes only paid orders without touching inventory', async () => {
  let status = 'paid';
  let updates = 0;
  const { markOrderFulfilled } = load('lib/fulfillOrder.ts', {
    'next/cache': { revalidatePath() {} },
    '@vercel/postgres': { sql: async (strings) => {
      const query = strings.join('?');
      if (query.includes('UPDATE orders')) {
        assert.match(query, /status = 'paid'/);
        if (status !== 'paid') return { rowCount: 0 };
        status = 'fulfilled'; updates++;
        return { rowCount: 1 };
      }
      if (query.includes('SELECT status')) return { rows: status ? [{ status }] : [] };
      throw new Error('Unexpected inventory or other query');
    } },
  });
  assert.equal((await markOrderFulfilled(orderId)).alreadyFulfilled, false);
  assert.equal((await markOrderFulfilled(orderId)).alreadyFulfilled, true);
  assert.equal(updates, 1);
  status = 'cancelled';
  await assert.rejects(() => markOrderFulfilled(orderId), /not awaiting/);
  status = null;
  await assert.rejects(() => markOrderFulfilled(orderId), /not found/);
});

test('email fulfillment action rejects invalid tokens before accessing orders', async () => {
  process.env.ORDER_ACTION_SECRET = secret;
  let called = false;
  const actions = load('app/actions/orders.ts', {
    'next/headers': {}, 'next/cache': {}, '@vercel/postgres': {}, '@/lib/locationStock': {},
    '@/lib/fulfillOrder': { markOrderFulfilled: async (id) => { called = true; return { id }; } },
  });
  await assert.rejects(() => actions.fulfillOrderFromEmail('bad'), /invalid or expired/);
  assert.equal(called, false);
  assert.deepEqual(await actions.fulfillOrderFromEmail(tokens.createFulfillmentToken(orderId, secret)), { id: orderId });
});

function cronFixture({ empty = false, failMail = false, failRecord = false } = {}) {
  let state = null;
  let sends = 0;
  let queries = 0;
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.ORDER_ACTION_SECRET = secret;
  process.env.SITE_URL = 'https://eric-fong.ca';
  const { GET } = load('app/api/cron/unfulfilled-orders/route.ts', {
    '@/lib/mailer': {
      getMailerConfig: () => ({ user: 'admin@example.com' }),
      createMailer: () => ({ sendMail: async (mail) => {
        sends++;
        assert.equal(mail.to, 'admin@example.com');
        if (failMail) throw new Error('SMTP failure');
        return { accepted: ['admin@example.com'] };
      } }),
    },
    '@vercel/postgres': { sql: async (strings) => {
      queries++;
      const query = strings.join('?');
      if (query.includes('INSERT INTO order_reminder_runs')) {
        assert.match(query, /ON CONFLICT/);
        if (state && state !== 'failed') return { rows: [] };
        state = 'running'; return { rows: [{ run_date: '2026-11-09' }] };
      }
      if (query.includes('FROM orders o')) {
        assert.match(query, /o.status = 'paid'/);
        assert.match(query, /o.created_at < NOW\(\) - INTERVAL '7 days'/);
        return { rows: empty ? [] : [{ id: orderId, created_at: '2026-01-01T00:00:00Z', customer_name: 'Joe', items: 'Painting x1' }] };
      }
      if (query.includes("status = 'sent'")) {
        if (failRecord) throw new Error('Database failure after send');
        state = 'sent'; return {};
      }
      if (query.includes("status = 'empty'")) { state = 'empty'; return {}; }
      if (query.includes("status = 'failed'")) { state = 'failed'; return {}; }
      throw new Error('Unexpected query');
    } },
  });
  return { GET, sends: () => sends, queries: () => queries, state: () => state };
}

const request = (authorized = true) => new Request('https://eric-fong.ca/api/cron/unfulfilled-orders', {
  headers: authorized ? { authorization: 'Bearer test-cron-secret' } : {},
});

test('cron rejects unauthenticated requests and sends no empty reminders', async () => {
  const cron = cronFixture({ empty: true });
  assert.equal((await cron.GET(request(false))).status, 401);
  assert.equal(cron.queries(), 0);
  assert.deepEqual(await (await cron.GET(request())).json(), { sent: false, orders: 0 });
  assert.equal(cron.sends(), 0);
});

test('cron sends one daily digest and suppresses duplicate invocations', async () => {
  const cron = cronFixture();
  assert.deepEqual(await (await cron.GET(request())).json(), { sent: true, orders: 1 });
  assert.equal((await (await cron.GET(request())).json()).skipped, true);
  assert.equal(cron.sends(), 1);
});

test('failed email is retryable, but accepted email is not resent on a database bookkeeping failure', async () => {
  const failed = cronFixture({ failMail: true });
  assert.equal((await failed.GET(request())).status, 500);
  assert.equal(failed.state(), 'failed');
  const accepted = cronFixture({ failRecord: true });
  assert.equal((await accepted.GET(request())).status, 500);
  assert.equal(accepted.state(), 'running');
  assert.equal((await (await accepted.GET(request())).json()).skipped, true);
  assert.equal(accepted.sends(), 1);
});
