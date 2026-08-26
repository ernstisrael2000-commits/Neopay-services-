// ─── Paym Plop Plop payment gateway client ─────────────────────────────────
// Docs: https://plopplop.solutionip.app/paiement-doc
//
// Paym Plop Plop is a Haitian payment aggregator. A single "create payment"
// call lets us accept MonCash, MonCash USSD, NatCash, Kashpaw or Carte
// (Visa/Mastercard via Square) under one merchant account. We expose each of
// these as its own native-feeling payment method in the app, using Plop Plop
// only as the backend rail (never mentioned to the end user).
//
// Important: the API has NO return_url/callback/webhook mechanism — the only
// way to know a payment succeeded is to poll `api/paiement-verify` with the
// same (client_id, refference_id) used at creation. This is why formation
// purchases are reconciled server-side (see verifyAndFinalizePlopPlopPayment
// in router.ts) instead of trusting the browser to still be around.

const PLOPPLOP_BASE = 'https://plopplop.solutionip.app';

export type PlopPlopMethod = 'moncash' | 'moncash_ussd' | 'natcash' | 'carte' | 'kashpaw';

export const PLOPPLOP_METHODS: PlopPlopMethod[] = ['moncash', 'moncash_ussd', 'natcash', 'carte', 'kashpaw'];

function getClientId(): string {
  const clientId = process.env.PLOPPLOP_CLIENT_ID;
  if (!clientId) throw new Error('PLOPPLOP_CLIENT_ID non configuré.');
  return clientId;
}

export interface PlopPlopCreateResult {
  status: boolean;
  message?: string;
  url: string | null;
  transaction_id?: string;
}

export async function createPlopPlopPayment(params: {
  referenceId: string;
  amountHTG: number;
  method: PlopPlopMethod;
  phoneNumber?: string;
}): Promise<PlopPlopCreateResult> {
  const body: Record<string, any> = {
    client_id: getClientId(),
    refference_id: params.referenceId,
    montant: params.amountHTG,
    payment_method: params.method,
  };
  if (params.method === 'moncash_ussd') {
    if (!params.phoneNumber) throw new Error('Numéro de téléphone requis pour MonCash USSD.');
    body.phone_number = params.phoneNumber;
  }

  const res = await fetch(`${PLOPPLOP_BASE}/api/paiement-marchand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status !== true) {
    throw new Error(data?.message || `Paym Plop Plop a refusé la transaction (HTTP ${res.status}).`);
  }
  return data;
}

export interface PlopPlopVerifyResult {
  status: boolean;
  trans_status?: 'ok' | 'no';
  montant?: number;
  method?: string;
  id_transaction?: string;
}

export async function verifyPlopPlopPayment(referenceId: string): Promise<PlopPlopVerifyResult> {
  const res = await fetch(`${PLOPPLOP_BASE}/api/paiement-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: getClientId(), refference_id: referenceId }),
  });
  const data = await res.json().catch(() => ({}));
  return data;
}
