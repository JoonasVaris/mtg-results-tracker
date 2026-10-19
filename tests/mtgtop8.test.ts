import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDate, parseEventPage, parseFormatPage } from '../shared/sources/mtgtop8';

// Fixtures are saved mtgtop8 pages (ISO-8859-1) with player names replaced by "Player N".
const fixture = (name: string) =>
  new TextDecoder('iso-8859-1').decode(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

test('parseDate converts dd/mm/yy to ISO', () => {
  assert.equal(parseDate('19/10/26'), '2026-10-19');
  assert.equal(parseDate(' 8/3/26 '), '2026-03-08');
  assert.equal(parseDate('nope'), '');
});

test('parseFormatPage lists Duel Commander events newest first', () => {
  const events = parseFormatPage(fixture('format_EDH.html'), 'EDH');
  assert.ok(events.length >= 20, `expected >= 20 events, got ${events.length}`);

  const danish = events.find((e) => e.id === '92514');
  assert.ok(danish, 'Danish Nationals present');
  assert.equal(danish.name, 'Danish Nationals i2026');
  assert.equal(danish.location, 'Denmark');
  assert.equal(danish.date, '2026-10-19');
  assert.equal(danish.url, 'https://www.mtgtop8.com/event?e=92514&f=EDH');
  assert.equal(danish.formatId, 'EDH');

  for (let i = 1; i < events.length; i++) assert.ok(events[i - 1].date >= events[i].date, 'sorted desc');
  assert.equal(new Set(events.map((e) => e.id)).size, events.length, 'no duplicates');
});

test('parseEventPage extracts header and ranked decks', () => {
  const ev = parseEventPage(fixture('event_92514_EDH.html'), 'EDH', '92514');
  assert.equal(ev.name, 'Danish Nationals i2026');
  assert.equal(ev.location, 'Denmark');
  assert.equal(ev.players, 29);
  assert.equal(ev.date, '2026-10-19');
  assert.equal(ev.platform, 'Paper');
  assert.equal(ev.stars, 2);

  assert.equal(ev.decks.length, 8);
  assert.deepEqual(ev.decks[0], {
    id: '902786',
    rank: '1',
    name: 'Aragorn, King of Gondor',
    player: 'Player 1',
    url: 'https://www.mtgtop8.com/event?e=92514&f=EDH&d=902786',
  });
  assert.equal(ev.decks[1].name, 'Slimefoot and Squee');
  assert.deepEqual(ev.decks.map((d) => d.rank), ['1', '2', '3-4', '3-4', '5-8', '5-8', '5-8', '5-8']);
  assert.deepEqual(ev.decks.map((d) => d.player), [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `Player ${n}`));
});

test('parseEventPage keeps non-ASCII names when the page is decoded as ISO-8859-1', () => {
  // mtgtop8 serves Latin-1; mimic the fetch path: raw bytes -> TextDecoder -> parser.
  const snippet = `
    <div class=event_title>Café Open @ Malmö</div>
    <div>12 players - 01/02/26</div>
    <div class=hover_tr><div style="width:42px;">1</div>
      <div class=S14><a href=?e=1&d=2&f=EDH>Lórien Pile</a></div>
      <a class=player href=search?player=x>Søren Ångström</a></div>`;
  const html = new TextDecoder('iso-8859-1').decode(Buffer.from(snippet, 'latin1'));
  const ev = parseEventPage(html, 'EDH', '1');
  assert.equal(ev.name, 'Café Open');
  assert.equal(ev.location, 'Malmö');
  assert.equal(ev.decks[0].name, 'Lórien Pile');
  assert.equal(ev.decks[0].player, 'Søren Ångström');
});

test('parseEventPage handles a large MTGO event', () => {
  const ev = parseEventPage(fixture('event_92484_MO.html'), 'MO', '92484');
  assert.equal(ev.name, 'MTGO Showcase Challenge');
  assert.equal(ev.location, undefined);
  assert.equal(ev.players, 286);
  assert.equal(ev.decks.length, 16);
  assert.equal(ev.decks[0].name, 'Jeskai Aggro');
  assert.equal(ev.decks[15].rank, '16');
});
