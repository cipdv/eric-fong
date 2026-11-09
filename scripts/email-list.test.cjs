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

const { validateContact, validateListMessage, buildListEmail, deliverListEmail } = load('lib/emailList.ts');
const input = { first_name: '', last_name: '', email_address: ' JOE@example.com ', phone_number: '', address: '', subscribed: true };
const id = '11111111-1111-4111-8111-111111111111';

test('email is the only required contact detail and is normalized', () => {
  assert.deepEqual(validateContact(input), { first_name: null, last_name: null, email_address: 'joe@example.com', phone_number: null, address: null, subscribed: true });
  assert.equal(validateContact({ ...input, subscribed: false }).subscribed, false);
  for (const email_address of ['', 'invalid', 'one@example.com,two@example.com']) assert.throws(() => validateContact({ ...input, email_address }));
});

test('messages require subject and body and reject header injection', () => {
  assert.deepEqual(validateListMessage(' Hello ', ' News '), { subject: 'Hello', body: 'News' });
  for (const [subject, body] of [['', 'body'], ['subject', ''], ['Hello\r\nBcc: x@example.com', 'body']]) assert.throws(() => validateListMessage(subject, body));
});

test('messages personalize greetings and render user text safely', () => {
  const named = buildListEmail('News', '<script>Hello</script>\nNext line', 'Joe');
  assert.ok(named.text.startsWith('Hi Joe,\n\n'));
  assert.ok(named.html.includes('&lt;script&gt;Hello&lt;/script&gt;<br />Next line'));
  assert.equal(buildListEmail('News', 'Hello', null).text, 'Hello');
});

test('sending excludes unsubscribed contacts, deduplicates recipients, and handles partial failures', async () => {
  const sent = [];
  const result = await deliverListEmail([
    { email_address: 'joe@example.com', first_name: 'Joe', subscribed: true },
    { email_address: 'JOE@example.com', first_name: 'Joe', subscribed: true },
    { email_address: 'optout@example.com', first_name: null, subscribed: false },
    { email_address: 'failed@example.com', first_name: null, subscribed: true },
  ], 'Subject', 'Body', async (to) => {
    sent.push(to.toLowerCase());
    if (to === 'failed@example.com') throw new Error('SMTP failure');
    return true;
  });
  assert.deepEqual(result, { total: 2, sent: 1, failed: 1 });
  assert.ok(!sent.includes('optout@example.com'));
});

function actionsFixture({ authenticated = true, duplicate = false } = {}) {
  let contacts = [];
  const deliveries = [];
  let dataQueries = 0;
  const actions = load('app/actions/emailList.ts', {
    'next/headers': { cookies: async () => ({ get: () => authenticated ? { value: 'session' } : undefined }) },
    'next/cache': { revalidatePath() {} },
    '@/lib/mailer': {
      getMailerConfig: () => ({ user: 'sender@example.com' }),
      createMailer: () => ({ sendMail: async (message) => { deliveries.push(message); return { accepted: [message.to.address] }; } }),
    },
    '@vercel/postgres': { sql: async (strings, ...values) => {
      const query = strings.join('?');
      if (query.includes('FROM sessions')) return { rows: [{ id: 'admin' }] };
      dataQueries++;
      if (query.includes('INSERT INTO email_list') || query.includes('UPDATE email_list')) {
        if (duplicate) throw Object.assign(new Error('unique violation'), { code: '23505' });
        const contact = { id, first_name: values[0], last_name: values[1], email_address: values[2], phone_number: values[3], address: values[4], subscribed: values[5], created_at: '2026-11-09T12:00:00Z' };
        contacts = [contact]; return { rows: [contact] };
      }
      if (query.includes('DELETE FROM email_list')) { contacts = []; return {}; }
      if (query.includes('FROM email_list')) return { rows: query.includes('WHERE subscribed IS TRUE') ? contacts.filter((contact) => contact.subscribed) : contacts };
      throw new Error('Unexpected query');
    } },
  });
  return { actions, deliveries, dataQueries: () => dataQueries };
}

test('all server actions reject unauthenticated requests before accessing the list', async () => {
  const fixture = actionsFixture({ authenticated: false });
  const a = fixture.actions;
  for (const call of [() => a.getEmailContacts(), () => a.createEmailContact(input), () => a.updateEmailContact(id, input), () => a.deleteEmailContact(id), () => a.sendEmailToList({ subject: 'News', body: 'Hello' })]) {
    await assert.rejects(call, /sign in/);
  }
  assert.equal(fixture.dataQueries(), 0);
});

test('contact CRUD preserves optional information and subscription changes affect sending', async () => {
  const fixture = actionsFixture();
  const a = fixture.actions;
  const contact = await a.createEmailContact({ ...input, first_name: 'Joe', phone_number: '+1 555 123 4567', address: 'Toronto' });
  assert.equal(contact.email_address, 'joe@example.com');
  assert.equal(contact.phone_number, '+1 555 123 4567');
  assert.equal((await a.getEmailContacts()).length, 1);
  assert.equal((await a.sendEmailToList({ subject: 'News', body: 'Hello' })).sent, 1);
  assert.equal(fixture.deliveries[0].to.address, 'joe@example.com');
  assert.ok(fixture.deliveries[0].text.startsWith('Hi Joe,'));
  await a.updateEmailContact(id, { ...input, subscribed: false });
  assert.deepEqual(await a.sendEmailToList({ subject: 'News', body: 'Hello' }), { total: 0, sent: 0, failed: 0 });
  assert.equal((await a.getEmailContacts())[0].subscribed, false);
  await a.deleteEmailContact(id);
  assert.deepEqual(await a.getEmailContacts(), []);
});

test('duplicate contact addresses produce a clear error', async () => {
  const { actions } = actionsFixture({ duplicate: true });
  await assert.rejects(() => actions.createEmailContact(input), /already on the list/);
  await assert.rejects(() => actions.updateEmailContact(id, input), /already on the list/);
});
