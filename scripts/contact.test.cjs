const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, mocks) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, mocks);
    return require(name);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return loaded.exports;
}

function fixture({ dbFailure = false } = {}) {
  const queries = [];
  const deliveries = [];
  const revalidated = [];
  const { sendContactMessage } = load('app/actions/contact.ts', {
    '@vercel/postgres': { sql: async (strings, ...values) => {
      queries.push({ query: strings.join('?'), values });
      if (dbFailure) throw new Error('Database unavailable');
      return { rows: [] };
    } },
    'next/cache': { revalidatePath: (route) => revalidated.push(route) },
    '@/lib/mailer': {
      getMailerConfig: () => ({ user: 'sender@example.com' }),
      createMailer: () => ({ sendMail: async (mail) => { deliveries.push(mail); } }),
    },
  });
  return { sendContactMessage, queries, deliveries, revalidated };
}

function form({ newsletter = true, name = '  Jane   Mary Doe ', phone = '+1 555 123 4567', email = ' JANE@example.com ' } = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name, email, phone, message: 'Hello Eric' })) data.set(key, value);
  if (newsletter) data.set('newsletter', 'on');
  return data;
}

// Keep the mail destination scoped to each test; all delivery and SQL calls are mocked.
async function submit(fixture, data) {
  const previous = process.env.CONTACT_EMAIL_TO;
  process.env.CONTACT_EMAIL_TO = 'contact@example.com';
  try { return await fixture.sendContactMessage({ status: 'idle' }, data); }
  finally {
    if (previous === undefined) delete process.env.CONTACT_EMAIL_TO;
    else process.env.CONTACT_EMAIL_TO = previous;
  }
}

test('newsletter opt-in saves normalized contact details and supports existing email addresses', async () => {
  const f = fixture();
  assert.equal((await submit(f, form())).status, 'success');
  assert.deepEqual(f.queries[0].values, ['Jane', 'Mary Doe', 'jane@example.com', '+1 555 123 4567']);
  assert.match(f.queries[0].query, /ON CONFLICT \(LOWER\(email_address\)\) DO UPDATE/);
  assert.match(f.queries[0].query, /subscribed = TRUE/);
  assert.deepEqual(f.revalidated, ['/app/dashboard/email-list']);
  assert.equal(f.deliveries.length, 1);
});

test('single names are stored as first names and an omitted phone is optional', async () => {
  const f = fixture();
  assert.equal((await submit(f, form({ name: 'Cher', phone: '' }))).status, 'success');
  assert.deepEqual(f.queries[0].values, ['Cher', null, 'jane@example.com', null]);
});

test('unchecked newsletter sends the message without modifying subscriptions', async () => {
  const f = fixture();
  assert.equal((await submit(f, form({ newsletter: false }))).status, 'success');
  assert.equal(f.queries.length, 0);
  assert.equal(f.deliveries.length, 1);
});

test('invalid subscriber details are rejected before sending or saving', async () => {
  const f = fixture();
  assert.equal((await submit(f, form({ email: 'invalid' }))).status, 'error');
  assert.equal(f.queries.length, 0);
  assert.equal(f.deliveries.length, 0);
});

test('database failure reports an error without sending the contact message', async () => {
  const f = fixture({ dbFailure: true });
  assert.equal((await submit(f, form())).status, 'error');
  assert.equal(f.deliveries.length, 0);
});
