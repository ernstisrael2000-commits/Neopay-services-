import assert from 'node:assert/strict';
import test from 'node:test';
import { extractCardList, sanitizeHeyQOCard } from '../src/api/heyqo.ts';

test('sanitizes every sensitive card field before browser serialization', () => {
  const card = sanitizeHeyQOCard({
    id: 'card_123',
    status: 'active',
    brand: 'visa',
    currency: 'usd',
    last4: '4242',
    pan: '4242424242424242',
    cvv: '123',
    expiry: '12/30',
    access_token: 'secret',
    unrelated: 'not allowed',
  });

  assert.deepEqual(card, {
    id: 'card_123',
    status: 'active',
    brand: 'visa',
    currency: 'usd',
    last4: '4242',
  });
  assert.equal(JSON.stringify(card).includes('4242424242424242'), false);
  assert.equal(JSON.stringify(card).includes('123'), true); // only the safe card id remains
  assert.equal('cvv' in card, false);
  assert.equal('expiry' in card, false);
});

test('extracts cards from wrapped HeyQO list responses', () => {
  const cards = extractCardList({ data: { cards: [{ id: 'one' }, { id: 'two' }] } });
  assert.deepEqual(cards.map((card) => card.id), ['one', 'two']);
});