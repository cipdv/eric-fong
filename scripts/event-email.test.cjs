const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, '../lib/eventEmail.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { buildEventEmail, deliverEventEmails } = loaded.exports;

const event = {
  name: 'Toronto paintings', eventType: 'exhibition', date: '2026-11-09', endDate: '2026-11-20',
  startTime: '10:00', endTime: '17:30', location: 'Gallery', address: '123 Main St, Toronto',
  details: 'New paintings on display.',
  subEvents: [{ id: 'talk', title: 'Artist talk', event_date: '2026-11-12', start_time: '14:00', end_time: '', location: 'Studio', details: 'Meet the artist.' }],
};

test('personalizes the greeting and includes the event and sub-event details', () => {
  const message = buildEventEmail(event, ' Joe ');
  assert.ok(message.text.startsWith('Hi Joe,\n\n'));
  for (const expected of ['Toronto paintings', 'November 9, 2026', 'November 20, 2026', '10:00 am', '5:30 pm', '123 Main St, Toronto', 'New paintings on display.', 'Artist talk', 'November 12, 2026', '2:00 pm', 'Studio', 'Meet the artist.']) {
    assert.ok(message.text.includes(expected), expected);
  }
});

test('omits the greeting when no first name is available', () => {
  for (const name of [null, '', '   ']) {
    assert.ok(buildEventEmail(event, name).text.startsWith('Upcoming exhibition: Toronto paintings'));
  }
});

test('announcement wording and visible website link match the event category', () => {
  for (const eventType of ['exhibition', 'group_exhibition', 'single_day']) {
    const message = buildEventEmail({ ...event, eventType }, null);
    const heading = `${eventType === 'single_day' ? 'Upcoming event' : 'Upcoming exhibition'}: Toronto paintings`;
    assert.equal(message.subject, heading);
    assert.ok(message.text.startsWith(heading));
    assert.ok(!message.text.includes('Toronto time'));
    assert.ok(!message.html.includes('Toronto time'));
    assert.ok(message.text.includes('Visit eric-fong.ca for event information.'));
    assert.ok(message.html.includes('<a href="https://eric-fong.ca">eric-fong.ca</a>'));
  }
});

test('escapes names and event text in HTML and strips subject newlines', () => {
  const message = buildEventEmail({ ...event, name: '<script>\r\nInjected</script>', details: '<b>Text</b>' }, '<Joe>');
  assert.ok(message.html.includes('Hi &lt;Joe&gt;,'));
  assert.ok(message.html.includes('&lt;b&gt;Text&lt;/b&gt;'));
  assert.ok(!message.html.includes('<script>'));
  assert.ok(!/[\r\n]/.test(message.subject));
});

test('selected images appear after the heading with an accessible title and plain-text link', () => {
  const message = buildEventEmail({ ...event, name: 'Art & Light', imageUrl: 'https://example.com/exhibition.jpg?a=1&b=2' }, 'Joe');
  assert.ok(message.html.includes('src="https://example.com/exhibition.jpg?a=1&amp;b=2"'));
  assert.ok(message.html.includes('alt="Art &amp; Light"'));
  assert.ok(message.html.indexOf('Upcoming exhibition:') < message.html.indexOf('<img'));
  assert.ok(message.html.indexOf('<img') < message.html.indexOf('Date:'));
  assert.ok(message.text.includes('Event image: https://example.com/exhibition.jpg?a=1&b=2'));
  assert.ok(buildEventEmail({ ...event, imageUrl: '/gallery.jpg' }, null).html.includes('src="https://eric-fong.ca/gallery.jpg"'));
});

test('missing or unsafe image URLs do not render an image', () => {
  for (const imageUrl of [null, '', 'javascript:alert(1)', 'data:image/png;base64,abc']) {
    assert.ok(!buildEventEmail({ ...event, imageUrl }, null).html.includes('<img'));
  }
});

test('sends private individual messages, deduplicates addresses, and continues after failures', async () => {
  const calls = [];
  const report = await deliverEventEmails(event, [
    { subscribed: true, first_name: 'Joe', email_address: 'joe@example.com' },
    { subscribed: true, first_name: 'Joe', email_address: 'JOE@example.com' },
    { subscribed: true, first_name: null, email_address: 'no-name@example.com' },
    { subscribed: true, first_name: 'Failure', email_address: 'failure@example.com' },
    { subscribed: true, first_name: null, email_address: 'two@example.com,other@example.com' },
  ], async (to, message) => {
    calls.push({ to, message });
    if (to === 'failure@example.com') throw new Error('SMTP failure');
    return true;
  });
  assert.deepEqual(report, { total: 4, sent: 2, failed: 2 });
  assert.equal(calls.length, 3);
  assert.ok(calls.find((call) => call.to.toLowerCase() === 'joe@example.com').message.text.startsWith('Hi Joe,'));
  assert.ok(!calls.find((call) => call.to === 'no-name@example.com').message.text.startsWith('Hi '));
});

test('empty lists send nothing and SMTP rejections count as failures', async () => {
  assert.deepEqual(await deliverEventEmails(event, [], async () => { throw new Error('Must not send'); }), { total: 0, sent: 0, failed: 0 });
  assert.deepEqual(await deliverEventEmails(event, [{ subscribed: true, first_name: null, email_address: 'rejected@example.com' }], async () => false), { total: 1, sent: 0, failed: 1 });
});

test('only explicitly subscribed recipients are emailed', async () => {
  const sent = [];
  const report = await deliverEventEmails(event, [
    { first_name: 'Yes', email_address: 'yes@example.com', subscribed: true },
    { first_name: 'No', email_address: 'no@example.com', subscribed: false },
    { first_name: 'Unknown', email_address: 'unknown@example.com', subscribed: null },
    { first_name: 'Missing', email_address: 'missing@example.com' },
  ], async (to) => { sent.push(to); return true; });
  assert.deepEqual(sent, ['yes@example.com']);
  assert.deepEqual(report, { total: 1, sent: 1, failed: 0 });
});

function loadActions({ failInsert = false, failEmail = false } = {}) {
  const calls = [];
  const schedulePath = path.join(__dirname, '../lib/eventSchedule.ts');
  const schedule = new Module(schedulePath, module);
  schedule._compile(ts.transpileModule(fs.readFileSync(schedulePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, schedulePath);
  const actionPath = path.join(__dirname, '../app/actions/events.ts');
  const actions = new Module(actionPath, module);
  actions.require = (name) => {
    if (name === 'next/headers') return { cookies: async () => ({ get: () => ({ value: 'test-session' }) }) };
    if (name === 'next/cache') return { revalidatePath() {} };
    if (name === '@vercel/blob') return { put: async () => { throw new Error('Unexpected upload'); } };
    if (name === '@/lib/eventSchedule') return schedule.exports;
    if (name === '@/lib/eventEmail') return loaded.exports;
    if (name === '@/lib/mailer') return {
      getMailerConfig: () => ({ user: 'sender@example.com' }),
      createMailer: () => ({ sendMail: async (message) => {
        calls.push('send');
        assert.ok(calls.indexOf('insert') < calls.indexOf('send'));
        assert.equal(message.to.address, 'joe@example.com');
        if (failEmail) throw new Error('SMTP unavailable');
        return { accepted: ['joe@example.com'] };
      } }),
    };
    if (name === '@vercel/postgres') return { sql: async (strings) => {
      const query = strings.join('?');
      if (query.includes('FROM sessions')) return { rows: [{ id: 'owner' }] };
      if (query.includes('FROM email_list')) {
        assert.match(query, /WHERE subscribed IS TRUE/);
        calls.push('list');
        return { rows: [{ subscribed: true, first_name: 'Joe', email_address: 'joe@example.com' }] };
      }
      if (query.includes('INSERT INTO events')) {
        calls.push('insert');
        if (failInsert) throw new Error('Database failure');
        return { rowCount: 1, rows: [{ id: 'saved-event' }] };
      }
      throw new Error('Unexpected query');
    } };
    return require(name);
  };
  actions._compile(ts.transpileModule(fs.readFileSync(actionPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, actionPath);
  return { actions: actions.exports, calls };
}

function eventForm(send) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: 'Test event', event_date: '2026-11-09', event_type: 'single_day', send_to_email_list: String(send) })) form.set(key, value);
  return form;
}

test('create action sends only after saving and only when requested', async () => {
  const enabled = loadActions();
  assert.equal((await enabled.actions.createEventAction(eventForm(true))).delivery.sent, 1);
  assert.deepEqual(enabled.calls, ['list', 'insert', 'send']);
  const disabled = loadActions();
  assert.equal((await disabled.actions.createEventAction(eventForm(false))).delivery, null);
  assert.deepEqual(disabled.calls, ['insert']);
});

test('failed event creation sends nothing; failed email still returns the saved event', async () => {
  const failedSave = loadActions({ failInsert: true });
  await assert.rejects(() => failedSave.actions.createEventAction(eventForm(true)), /Database failure/);
  assert.ok(!failedSave.calls.includes('send'));
  const failedSend = loadActions({ failEmail: true });
  const result = await failedSend.actions.createEventAction(eventForm(true));
  assert.equal(result.id, 'saved-event');
  assert.equal(result.delivery.failed, 1);
  assert.equal(failedSend.calls.filter((call) => call === 'insert').length, 1);
});
