import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractCard,
  extractCardList,
  extractCustomer,
  normalizeHeyQOPhone,
  providerMessage,
  sanitizeHeyQOCard,
} from '../src/api/heyqo.ts';

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

test('normalizes safe card details from the official nested card info response', () => {
  const raw = extractCard({
    data: {
      card: {
        id: 'card-456',
        local_id: 17,
        status: 'active',
        amount: '15.90',
        currency: 'usd',
        info: {
          masked_pan: '411111******1111',
          last4: '1111',
          name_on_card: 'Private Name',
          brand: 'visa',
          cvv: '999',
          expiry_month: '08',
        },
      },
    },
  });
  const safe = sanitizeHeyQOCard(raw);
  assert.equal(safe.id, 'card-456');
  assert.equal(safe.last4, '1111');
  assert.equal(safe.masked_pan, '411111******1111');
  assert.equal(safe.amount, '15.90');
  assert.equal(safe.name_on_card, 'Private Name');
  assert.equal('cvv' in safe, false);
  assert.equal('expiry_month' in safe, false);
});

test('extracts a customer from the official response envelope', () => {
  const customer = extractCustomer({ data: { customer: { id: 'uuid', local_id: 42, kyc_status: 'approved' } } });
  assert.deepEqual(customer, { id: 'uuid', local_id: 42, kyc_status: 'approved' });
});

test('surfaces nested HeyQO validation errors without exposing the raw payload', () => {
  assert.equal(
    providerMessage({
      message: {
        code: 422,
        error: [
          { phone: ['The phone must be in E.164 format.'] },
          'The document number is invalid.',
        ],
      },
    }, 422),
    'phone : The phone must be in E.164 format. · The document number is invalid.',
  );
  assert.equal(
    providerMessage({ message: { error: [{ field: 'phone', message: 'Use E.164 format.' }] } }, 422),
    'phone : Use E.164 format.',
  );
});

test('normalizes Haitian profile phone numbers to E.164', () => {
  assert.equal(normalizeHeyQOPhone('49 32 49 32'), '+50949324932');
  assert.equal(normalizeHeyQOPhone('049324932'), '+50949324932');
  assert.equal(normalizeHeyQOPhone('00509 4932-4932'), '+50949324932');
  assert.equal(normalizeHeyQOPhone('+50949324932'), '+50949324932');
  assert.equal(normalizeHeyQOPhone('1234'), '');
});
