import assert from 'node:assert/strict';
import test from 'node:test';
import { submitHeyQOCustomerKyc } from '../src/services/cardsService.ts';

test('converts a selected JPG into base64 before submitting KYC', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: any;
  let requestHeaders: Headers | undefined;

  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body || '{}'));
    requestHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({
      success: true,
      customer: { id: 'customer-test', localId: 'local-test', status: 'pending' },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const jpg = new File([
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]),
    ], '1000037317.jpg', { type: 'image/jpeg' });

    await submitHeyQOCustomerKyc({
      dateOfBirth: '1990-01-01',
      gender: 'other',
      documentType: 'NATIONAL_ID',
      documentNumber: 'TEST-123',
      taxIdNumber: 'TAX-123',
      documentFrontFile: jpg,
      addressStreet: 'Rue test',
      addressCity: 'Port-au-Prince',
      addressState: 'Ouest',
      addressPostalCode: 'HT6110',
      addressCountry: 'HT',
      proofOfAddressFile: null,
      employmentStatus: 'employed',
      occupation: '151252',
      primaryPurpose: 'personal_or_living_expenses',
      sourceOfFunds: 'salary',
      expectedMonthlyPay: '0_4999',
      consent: true,
    }, 'kyc-test-idempotency-key');

    assert.equal(requestHeaders?.get('Idempotency-Key'), 'kyc-test-idempotency-key');
    assert.equal(requestBody.kyc.documentFrontBase64, '/9j/4AAQSkZJRv/Z');
    assert.equal(requestBody.kyc.documentBackBase64, undefined);
    assert.equal(requestBody.kyc.proofOfAddressBase64, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});