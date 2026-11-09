const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, '../lib/eventSchedule.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const { parseEventSchedule } = loaded.exports;

function data(values = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ event_date: '2026-11-09', event_type: 'single_day', ...values })) {
    form.set(key, value);
  }
  return form;
}

test('single-day events discard a stale end date', () => {
  assert.equal(parseEventSchedule(data({ event_type: 'single_day', end_date: '2026-11-30' })).endDate, null);
});
test('multi-day events retain the end date and require a valid range', () => {
  assert.equal(parseEventSchedule(data({ event_type: 'exhibition', end_date: '2026-11-30' })).endDate, '2026-11-30');
  for (const end_date of ['', '2026-11-08', '2026-11-31']) {
    assert.throws(() => parseEventSchedule(data({ event_type: 'exhibition', end_date })));
  }
});
test('invalid or absent start dates are rejected', () => {
  for (const event_date of ['', '2026-02-30', 'not-a-date']) {
    assert.throws(() => parseEventSchedule(data({ event_date })));
  }
});
test('sub-events require only title and date and survive round-trip serialization', () => {
  const minimal = { title: ' Artist talk ', event_date: '2026-11-10' };
  const result = parseEventSchedule(data({ sub_events: JSON.stringify([minimal]) }));
  assert.equal(result.subEvents[0].title, 'Artist talk');
  assert.equal(result.subEvents[0].location, '');
  assert.equal(result.subEvents[0].start_time, '');
  assert.deepEqual(parseEventSchedule(data({ sub_events: JSON.stringify(result.subEvents) })).subEvents, result.subEvents);
});
test('invalid sub-events are rejected', () => {
  for (const sub_events of ['bad json', '{}', '[null]', '[{}]', JSON.stringify([{ title: 'Talk', event_date: '2026-11-31' }]), JSON.stringify([{ title: 'Talk', event_date: '2026-11-10', start_time: '25:00' }])]) {
    assert.throws(() => parseEventSchedule(data({ sub_events })));
  }
});
test('removing all sub-events saves an empty list', () => {
  assert.deepEqual(parseEventSchedule(data({ sub_events: '[]' })).subEvents, []);
});

test('exhibitions allow identical start and end dates and retain their explicit type', () => {
  const result = parseEventSchedule(data({ event_type: 'exhibition', end_date: '2026-11-09' }));
  assert.equal(result.eventType, 'exhibition');
  assert.equal(result.endDate, result.date);
});

test('missing and unknown event types are rejected', () => {
  for (const event_type of ['', 'conference']) {
    assert.throws(() => parseEventSchedule(data({ event_type })));
  }
  const form = data();
  form.delete('event_type');
  assert.throws(() => parseEventSchedule(form));
});

test('both exhibition types accept same-day dates and explicit CV opt-in', () => {
  for (const event_type of ['exhibition', 'group_exhibition']) {
    const result = parseEventSchedule(data({ event_type, end_date: '2026-11-09', add_to_cv: 'true' }));
    assert.equal(result.eventType, event_type);
    assert.equal(result.endDate, result.date);
    assert.equal(result.addToCv, true);
    assert.equal(parseEventSchedule(data({ event_type, end_date: '2026-11-09' })).addToCv, false);
    assert.equal(parseEventSchedule(data({ event_type, end_date: '2026-11-09', add_to_cv: 'false' })).addToCv, false);
  }
});

test('single-day events cannot add to CV even with a stale checkbox value', () => {
  assert.equal(parseEventSchedule(data({ event_type: 'single_day', add_to_cv: 'true' })).addToCv, false);
});

const homeFilename = path.join(__dirname, '../lib/homeEvents.ts');
const homeModule = new Module(homeFilename, module);
homeModule._compile(ts.transpileModule(fs.readFileSync(homeFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, homeFilename);
const { groupHomeEvents } = homeModule.exports;

test('solo and group exhibitions share the correct public exhibition headings', () => {
  const groups = groupHomeEvents([
    { event_type: 'group_exhibition', event_date: '2026-11-09', end_date: '2026-11-09' },
    { event_type: 'exhibition', event_date: '2026-11-01', end_date: '2026-11-10' },
    { event_type: 'group_exhibition', event_date: '2026-11-11', end_date: '2026-11-12' },
  ], '2026-11-09');
  assert.deepEqual(groups.map(({ title, events }) => [title, events.length]), [
    ['Current exhibitions', 2], ['Upcoming exhibition', 1],
  ]);
});

test('same-day exhibitions use exhibition headings before and on their date, then disappear', () => {
  const events = [{ event_type: 'exhibition', event_date: '2026-11-09', end_date: '2026-11-09' }];
  assert.equal(groupHomeEvents(events, '2026-11-08')[0].title, 'Upcoming exhibition');
  assert.equal(groupHomeEvents(events, '2026-11-09')[0].title, 'Current exhibition');
  assert.deepEqual(groupHomeEvents(events, '2026-11-10'), []);
});

test('homepage headings classify inclusive current dates, future exhibitions and single-day events', () => {
  const groups = groupHomeEvents([
    { event_type: 'exhibition', event_date: '2026-11-01', end_date: '2026-11-09' },
    { event_type: 'exhibition', event_date: '2026-11-09', end_date: '2026-11-12' },
    { event_type: 'exhibition', event_date: '2026-11-10', end_date: '2026-11-20' },
    { event_type: 'single_day', event_date: '2026-11-09', end_date: null },
    { event_type: 'exhibition', event_date: '2026-11-01', end_date: '2026-11-08' },
  ], '2026-11-09');
  assert.deepEqual(groups.map(({ title, events }) => [title, events.length]), [
    ['Current exhibitions', 2], ['Upcoming event', 1], ['Upcoming exhibition', 1],
  ]);
});
test('homepage headings pluralize each category independently and omit empty groups', () => {
  const groups = groupHomeEvents([
    { event_type: 'exhibition', event_date: '2026-11-01', end_date: '2026-11-10' },
    { event_type: 'single_day', event_date: '2026-11-10', end_date: '2026-11-10' },
    { event_type: 'single_day', event_date: '2026-11-11', end_date: null },
    { event_type: 'exhibition', event_date: '2026-11-12', end_date: '2026-11-20' },
    { event_type: 'exhibition', event_date: '2026-11-13', end_date: '2026-11-20' },
  ], '2026-11-09');
  assert.deepEqual(groups.map(({ title }) => title), ['Current exhibition', 'Upcoming events', 'Upcoming exhibitions']);
  assert.deepEqual(groupHomeEvents([{ event_type: 'single_day', event_date: '2026-11-08', end_date: null }], '2026-11-09'), []);
});
