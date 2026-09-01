import { ReplitConnectors } from '@replit/connectors-sdk';
export type TwoFARole = 'admin' | 'agent' | 'affiliate';

export const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL || 'noreply@solutionpam.com';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || FROM_EMAIL;
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();

console.log(`[Email] Resend activé via ${RESEND_API_KEY ? 'API directe' : 'connexion Replit'} — FROM: ${FROM_EMAIL}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return `$${Number(amount).toFixed(2)}`;
}

function dateFr(d?: Date) {
  return (d || new Date()).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function baseHtml(title: string, accentColor: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:100%;">
        <tr>
          <td style="background:${accentColor};padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.75);">SOLUTIONPAM</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:11px;color:#aaa;line-height:1.6;">
              Cet email a été envoyé automatiquement par le système Solutionpam.<br/>
              Ne répondez pas à cet email. Pour toute question, contactez le support.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: string, highlight = false): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f5f5f5;">
      <span style="font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
    </td>
    <td style="padding:10px 0;border-bottom:1px solid #f5f5f5;text-align:right;">
      <span style="font-size:14px;font-weight:${highlight ? '800' : '600'};color:${highlight ? '#1a1a2e' : '#444'};">${value}</span>
    </td>
  </tr>`;
}

function statusBadge(status: string): string {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending:   { bg: '#fff3cd', color: '#856404', label: 'En attente' },
    approved:  { bg: '#d1fae5', color: '#065f46', label: 'Approuvé' },
    rejected:  { bg: '#fee2e2', color: '#991b1b', label: 'Refusé' },
    confirmed: { bg: '#d1fae5', color: '#065f46', label: 'Confirmé' },
    completed: { bg: '#d1fae5', color: '#065f46', label: 'Complété' },
  };
  const s = map[status] || { bg: '#f3f4f6', color: '#374151', label: status };
  return `<span style="display:inline-block;padding:4px 12px;border-radius:20px;background:${s.bg};color:${s.color};font-size:12px;font-weight:700;">${s.label}</span>`;
}

// ── Core send ─────────────────────────────────────────────────────────────────

export interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

function textAsHtml(text: string): string {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br />');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#334155;">${safe}</div>`;
}

export async function send(
  to: string | string[],
  subject: string,
  html: string,
  type: string,
): Promise<SendResult> {
  const toArr = Array.isArray(to) ? to : [to];
  const validTo = toArr.filter(Boolean);
  if (!validTo.length) {
    console.warn(`[Email] Skipped (no recipient) — ${type}`);
    return { success: false, error: 'No recipient' };
  }

  try {
    const request = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RESEND_API_KEY ? { Authorization: `Bearer ${RESEND_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        from: `Solutionpam <${FROM_EMAIL}>`,
        to: validTo,
        subject,
        html,
      }),
    };
    const response = RESEND_API_KEY
      ? await fetch('https://api.resend.com/emails', request)
      : await new ReplitConnectors().proxy('resend', '/emails', request);
    const data: any = await response.json().catch(() => null);
    if (!response.ok) {
      const error = data?.message || data?.error?.message || `Resend returned HTTP ${response.status}`;
      console.error(`[Email] Resend error "${type}" → ${validTo}:`, error);
      return { success: false, error };
    }
    console.log(`[Email] ✓ Resend "${type}" → ${validTo} (id: ${data?.id || 'unknown'})`);
    return { success: true, id: data?.id };
  } catch (e: any) {
    console.error(`[Email] Resend exception "${type}" → ${validTo}:`, e?.message);
    return { success: false, error: e?.message };
  }
}

export async function sendTextEmail(
  to: string | string[],
  subject: string,
  text: string,
  type: string,
): Promise<SendResult> {
  return send(to, subject, textAsHtml(text), type);
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL FUNCTIONS — chacune envoie à admin ET utilisateur concerné
// ─────────────────────────────────────────────────────────────────────────────

// 1. Dépôt soumis → admin + client
export async function emailDepositSubmitted(opts: {
  clientName: string; clientEmail?: string; amount: number;
  method: string; txId?: string; walletId?: string;
}): Promise<void> {
  const { clientName, clientEmail, amount, method, txId, walletId } = opts;
  const date = dateFr();

  const adminHtml = baseHtml('💰 Nouveau dépôt', '#059669',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Une nouvelle demande de dépôt a été soumise.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Client', clientName, true)}
      ${walletId ? row('Wallet ID', walletId) : ''}
      ${row('Montant', fmt(amount), true)}
      ${row('Méthode', method)}
      ${txId ? row('Référence', txId) : ''}
      ${row('Date', date)}
      ${row('Statut', statusBadge('pending'))}
    </table>
    <p style="margin:24px 0 0;padding:16px;background:#f0fdf4;border-radius:10px;font-size:13px;color:#065f46;border-left:4px solid #059669;">
      ⚡ Connectez-vous au tableau de bord pour approuver ou refuser ce dépôt.
    </p>`
  );
  await send(ADMIN_EMAIL, `💰 Dépôt ${fmt(amount)} — ${clientName}`, adminHtml, 'deposit_submitted_admin');

  if (clientEmail) {
    const clientHtml = baseHtml('Dépôt en cours de traitement', '#059669',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>, votre demande de dépôt a bien été reçue et est en cours de validation.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Montant', fmt(amount), true)}
        ${row('Méthode', method)}
        ${row('Date', date)}
        ${row('Statut', statusBadge('pending'))}
      </table>
      <p style="margin:24px 0 0;padding:16px;background:#f0fdf4;border-radius:10px;font-size:13px;color:#065f46;">
        Vous serez notifié dès que votre dépôt sera traité.
      </p>`
    );
    await send(clientEmail, `💰 Votre dépôt de ${fmt(amount)} est en cours`, clientHtml, 'deposit_submitted_client');
  }
}

// 2. Dépôt approuvé → admin + client
export async function emailDepositApproved(opts: {
  clientName: string; clientEmail?: string; amount: number;
}): Promise<void> {
  const { clientName, clientEmail, amount } = opts;
  const adminHtml = baseHtml('✅ Dépôt approuvé', '#059669',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Le dépôt de <strong>${clientName}</strong> a été approuvé.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Client', clientName, true)}
      ${row('Montant crédité', fmt(amount), true)}
      ${row('Date', dateFr())}
      ${row('Statut', statusBadge('approved'))}
    </table>`
  );
  await send(ADMIN_EMAIL, `✅ Dépôt approuvé — ${clientName} ${fmt(amount)}`, adminHtml, 'deposit_approved_admin');

  if (clientEmail) {
    const clientHtml = baseHtml('✅ Dépôt approuvé', '#059669',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>, votre dépôt a été approuvé et crédité sur votre compte.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Montant crédité', fmt(amount), true)}
        ${row('Date', dateFr())}
        ${row('Statut', statusBadge('approved'))}
      </table>
      <p style="margin:24px 0 0;padding:16px;background:#f0fdf4;border-radius:10px;font-size:13px;color:#065f46;">
        🎉 Votre solde a été mis à jour. Vous pouvez l'utiliser dès maintenant.
      </p>`
    );
    await send(clientEmail, `✅ Dépôt de ${fmt(amount)} approuvé`, clientHtml, 'deposit_approved_client');
  }
}

// 3. Dépôt refusé → admin + client
export async function emailDepositRejected(opts: {
  clientName: string; clientEmail?: string; amount: number; reason?: string;
}): Promise<void> {
  const { clientName, clientEmail, amount, reason } = opts;
  const adminHtml = baseHtml('❌ Dépôt refusé', '#dc2626',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Le dépôt de <strong>${clientName}</strong> a été refusé.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Client', clientName, true)}
      ${row('Montant', fmt(amount), true)}
      ${reason ? row('Raison', reason) : ''}
      ${row('Date', dateFr())}
      ${row('Statut', statusBadge('rejected'))}
    </table>`
  );
  await send(ADMIN_EMAIL, `❌ Dépôt refusé — ${clientName} ${fmt(amount)}`, adminHtml, 'deposit_rejected_admin');

  if (clientEmail) {
    const clientHtml = baseHtml('❌ Dépôt refusé', '#dc2626',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>, votre demande de dépôt n'a pas pu être validée.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Montant', fmt(amount), true)}
        ${row('Date', dateFr())}
        ${row('Statut', statusBadge('rejected'))}
        ${reason ? row('Raison', reason) : ''}
      </table>
      <p style="margin:24px 0 0;padding:16px;background:#fef2f2;border-radius:10px;font-size:13px;color:#991b1b;border-left:4px solid #dc2626;">
        Contactez le support si vous avez des questions.
      </p>`
    );
    await send(clientEmail, `❌ Dépôt de ${fmt(amount)} refusé`, clientHtml, 'deposit_rejected_client');
  }
}

// 4. Retrait soumis → admin + client
export async function emailWithdrawalSubmitted(opts: {
  clientName: string; clientEmail?: string; amount: number;
  method: string; accountNumber: string; accountName?: string;
}): Promise<void> {
  const { clientName, clientEmail, amount, method, accountNumber, accountName } = opts;
  const date = dateFr();

  const adminHtml = baseHtml('🏧 Nouveau retrait', '#7c3aed',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Une nouvelle demande de retrait a été soumise.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Client', clientName, true)}
      ${row('Montant', fmt(amount), true)}
      ${row('Méthode', method)}
      ${row('Compte', accountNumber)}
      ${accountName ? row('Bénéficiaire', accountName) : ''}
      ${row('Date', date)}
      ${row('Statut', statusBadge('pending'))}
    </table>
    <p style="margin:24px 0 0;padding:16px;background:#faf5ff;border-radius:10px;font-size:13px;color:#6d28d9;border-left:4px solid #7c3aed;">
      ⚠️ Le solde client a été débité. Traitez ce retrait depuis le tableau de bord.
    </p>`
  );
  await send(ADMIN_EMAIL, `🏧 Retrait ${fmt(amount)} — ${clientName}`, adminHtml, 'withdrawal_submitted_admin');

  if (clientEmail) {
    const clientHtml = baseHtml('Retrait en cours de traitement', '#7c3aed',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>, votre demande de retrait a bien été reçue.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Montant', fmt(amount), true)}
        ${row('Méthode', method)}
        ${row('Compte', accountNumber)}
        ${row('Date', date)}
        ${row('Statut', statusBadge('pending'))}
      </table>
      <p style="margin:24px 0 0;padding:16px;background:#faf5ff;border-radius:10px;font-size:13px;color:#6d28d9;">
        Vous serez notifié dès que votre retrait sera traité.
      </p>`
    );
    await send(clientEmail, `🏧 Votre retrait de ${fmt(amount)} est en cours`, clientHtml, 'withdrawal_submitted_client');
  }
}

// 5. Retrait approuvé → admin + client
export async function emailWithdrawalApproved(opts: {
  clientName: string; clientEmail?: string; amount: number;
}): Promise<void> {
  const { clientName, clientEmail, amount } = opts;
  const adminHtml = baseHtml('✅ Retrait approuvé', '#7c3aed',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Le retrait de <strong>${clientName}</strong> a été approuvé.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Client', clientName, true)}
      ${row('Montant', fmt(amount), true)}
      ${row('Date', dateFr())}
      ${row('Statut', statusBadge('approved'))}
    </table>`
  );
  await send(ADMIN_EMAIL, `✅ Retrait approuvé — ${clientName} ${fmt(amount)}`, adminHtml, 'withdrawal_approved_admin');

  if (clientEmail) {
    const clientHtml = baseHtml('✅ Retrait approuvé', '#7c3aed',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>, votre retrait a été approuvé et est en cours de traitement.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Montant', fmt(amount), true)}
        ${row('Date', dateFr())}
        ${row('Statut', statusBadge('approved'))}
      </table>
      <p style="margin:24px 0 0;padding:16px;background:#faf5ff;border-radius:10px;font-size:13px;color:#6d28d9;">
        Votre argent sera disponible selon le délai de traitement habituel.
      </p>`
    );
    await send(clientEmail, `✅ Retrait de ${fmt(amount)} approuvé`, clientHtml, 'withdrawal_approved_client');
  }
}

// 6. Retrait refusé → admin + client
export async function emailWithdrawalRejected(opts: {
  clientName: string; clientEmail?: string; amount: number; reason?: string;
}): Promise<void> {
  const { clientName, clientEmail, amount, reason } = opts;
  const adminHtml = baseHtml('❌ Retrait refusé', '#dc2626',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Le retrait de <strong>${clientName}</strong> a été refusé.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Client', clientName, true)}
      ${row('Montant remboursé', fmt(amount), true)}
      ${reason ? row('Raison', reason) : ''}
      ${row('Date', dateFr())}
      ${row('Statut', statusBadge('rejected'))}
    </table>`
  );
  await send(ADMIN_EMAIL, `❌ Retrait refusé — ${clientName} ${fmt(amount)}`, adminHtml, 'withdrawal_rejected_admin');

  if (clientEmail) {
    const clientHtml = baseHtml('❌ Retrait refusé', '#dc2626',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>, votre demande de retrait a été refusée. Le montant a été remis sur votre solde.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Montant remboursé', fmt(amount), true)}
        ${row('Date', dateFr())}
        ${row('Statut', statusBadge('rejected'))}
        ${reason ? row('Raison', reason) : ''}
      </table>`
    );
    await send(clientEmail, `❌ Retrait de ${fmt(amount)} refusé`, clientHtml, 'withdrawal_rejected_client');
  }
}

// 7. OTP retrait agent → client
export async function emailWithdrawalOtp(opts: {
  clientName: string; clientEmail: string; agentName: string;
  amount: number; otpCode: string; expiresMinutes: number;
}): Promise<void> {
  const { clientName, clientEmail, agentName, amount, otpCode, expiresMinutes } = opts;
  const html = baseHtml('🔐 Code de confirmation retrait', '#dc2626',
    `<p style="margin:0 0 16px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#444;">
      L'agent <strong>${agentName}</strong> souhaite effectuer un retrait de <strong>${fmt(amount)}</strong> depuis votre compte.
      Pour autoriser cette opération, saisissez le code ci-dessous dans l'application.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background:#1a1a2e;color:#ffffff;font-size:36px;font-weight:900;letter-spacing:12px;padding:20px 36px;border-radius:16px;font-family:'Courier New',monospace;">
        ${otpCode}
      </div>
      <p style="margin:12px 0 0;font-size:12px;color:#888;">Ce code expire dans <strong>${expiresMinutes} minutes</strong></p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Agent', agentName)}
      ${row('Montant demandé', fmt(amount), true)}
      ${row('Date de la demande', dateFr())}
    </table>
    <p style="margin:24px 0 0;padding:16px;background:#fef2f2;border-radius:10px;font-size:13px;color:#991b1b;border-left:4px solid #dc2626;">
      ⚠️ <strong>Ne partagez jamais ce code par écrit.</strong> Dictez-le uniquement à voix haute à l'agent en face de vous.<br/>
      Si vous n'avez pas demandé ce retrait, refusez immédiatement depuis l'application.
    </p>`
  );
  await send(clientEmail, `🔐 Code de confirmation — Retrait de ${fmt(amount)}`, html, 'withdrawal_otp');
}

// 8. Commission affilié/agent → admin + affilié
export async function emailAffiliateCommission(opts: {
  affiliateName: string; affiliateEmail?: string;
  amount: number; sourceClientName?: string; type?: string;
}): Promise<void> {
  const { affiliateName, affiliateEmail, amount, sourceClientName, type } = opts;

  const adminHtml = baseHtml('💎 Commission créditée', '#2563eb',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Une commission a été créditée à <strong>${affiliateName}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Affilié', affiliateName, true)}
      ${row('Commission', fmt(amount), true)}
      ${sourceClientName ? row('Source', sourceClientName) : ''}
      ${type ? row('Type', type) : ''}
      ${row('Date', dateFr())}
    </table>`
  );
  await send(ADMIN_EMAIL, `💎 Commission ${fmt(amount)} — ${affiliateName}`, adminHtml, 'affiliate_commission_admin');

  if (affiliateEmail) {
    const html = baseHtml('💎 Commission reçue', '#2563eb',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${affiliateName}</strong>, une nouvelle commission a été créditée sur votre compte !</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Commission', fmt(amount), true)}
        ${sourceClientName ? row('Source', sourceClientName) : ''}
        ${type ? row('Type', type) : ''}
        ${row('Date', dateFr())}
      </table>
      <p style="margin:24px 0 0;padding:16px;background:#eff6ff;border-radius:10px;font-size:13px;color:#1e40af;border-left:4px solid #2563eb;">
        🎉 Votre solde a été mis à jour. Consultez votre tableau de bord pour les détails.
      </p>`
    );
    await send(affiliateEmail, `💎 Commission de ${fmt(amount)} créditée`, html, 'affiliate_commission_affiliate');
  }
}

// 9. Retrait agent confirmé par client → admin + client
export async function emailAgentWithdrawalConfirmed(opts: {
  clientName: string; clientEmail?: string; agentName: string; amount: number;
}): Promise<void> {
  const { clientName, clientEmail, agentName, amount } = opts;

  const adminHtml = baseHtml('✅ Retrait agent confirmé', '#059669',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Un retrait initié par un agent a été confirmé par le client.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Client', clientName, true)}
      ${row('Agent', agentName)}
      ${row('Montant', fmt(amount), true)}
      ${row('Date', dateFr())}
      ${row('Statut', statusBadge('confirmed'))}
    </table>`
  );
  await send(ADMIN_EMAIL, `✅ Retrait agent ${fmt(amount)} confirmé — ${clientName}`, adminHtml, 'agent_withdrawal_confirmed_admin');

  if (clientEmail) {
    const clientHtml = baseHtml('✅ Retrait confirmé', '#059669',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>, vous avez confirmé le retrait initié par l'agent <strong>${agentName}</strong>.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Montant débité', fmt(amount), true)}
        ${row('Agent', agentName)}
        ${row('Date', dateFr())}
        ${row('Statut', statusBadge('confirmed'))}
      </table>`
    );
    await send(clientEmail, `✅ Retrait de ${fmt(amount)} confirmé`, clientHtml, 'agent_withdrawal_confirmed_client');
  }
}

// 10. Achat produit/service → admin + client
export async function emailPurchase(opts: {
  clientName: string; clientEmail?: string;
  productName: string; amount: number;
}): Promise<void> {
  const { clientName, clientEmail, productName, amount } = opts;
  const date = dateFr();

  const adminHtml = baseHtml('🛒 Nouvel achat', '#0891b2',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Un client vient d'effectuer un achat.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Client', clientName, true)}
      ${row('Produit / Service', productName, true)}
      ${row('Montant', fmt(amount), true)}
      ${row('Date', date)}
      ${row('Statut', statusBadge('completed'))}
    </table>`
  );
  await send(ADMIN_EMAIL, `🛒 Achat ${fmt(amount)} — ${clientName} (${productName})`, adminHtml, 'purchase_admin');

  if (clientEmail) {
    const clientHtml = baseHtml('🛒 Achat confirmé', '#0891b2',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>, votre achat a bien été enregistré.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Produit / Service', productName, true)}
        ${row('Montant débité', fmt(amount), true)}
        ${row('Date', date)}
        ${row('Statut', statusBadge('completed'))}
      </table>
      <p style="margin:24px 0 0;padding:16px;background:#ecfeff;border-radius:10px;font-size:13px;color:#155e75;border-left:4px solid #0891b2;">
        Merci pour votre confiance. Consultez votre historique pour les détails.
      </p>`
    );
    await send(clientEmail, `🛒 Achat de ${productName} confirmé`, clientHtml, 'purchase_client');
  }
}

// 11. Retrait affilié soumis → admin + affilié
export async function emailAffiliateWithdrawalSubmitted(opts: {
  affiliateName: string; affiliateEmail?: string;
  amount: number; method?: string; accountNumber?: string;
}): Promise<void> {
  const { affiliateName, affiliateEmail, amount, method, accountNumber } = opts;
  const date = dateFr();

  const adminHtml = baseHtml('💸 Retrait affilié', '#d97706',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Un affilié a soumis une demande de retrait.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Affilié', affiliateName, true)}
      ${row('Montant', fmt(amount), true)}
      ${method ? row('Méthode', method) : ''}
      ${accountNumber ? row('Compte', accountNumber) : ''}
      ${row('Date', date)}
      ${row('Statut', statusBadge('pending'))}
    </table>
    <p style="margin:24px 0 0;padding:16px;background:#fffbeb;border-radius:10px;font-size:13px;color:#92400e;border-left:4px solid #d97706;">
      ⚡ Traitez cette demande depuis le tableau de bord admin.
    </p>`
  );
  await send(ADMIN_EMAIL, `💸 Retrait affilié ${fmt(amount)} — ${affiliateName}`, adminHtml, 'affiliate_withdrawal_submitted_admin');

  if (affiliateEmail) {
    const html = baseHtml('Retrait en cours de traitement', '#d97706',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${affiliateName}</strong>, votre demande de retrait a bien été reçue.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Montant', fmt(amount), true)}
        ${method ? row('Méthode', method) : ''}
        ${row('Date', date)}
        ${row('Statut', statusBadge('pending'))}
      </table>
      <p style="margin:24px 0 0;padding:16px;background:#fffbeb;border-radius:10px;font-size:13px;color:#92400e;">
        Vous serez notifié dès que votre retrait sera traité.
      </p>`
    );
    await send(affiliateEmail, `💸 Votre retrait de ${fmt(amount)} est en cours`, html, 'affiliate_withdrawal_submitted_affiliate');
  }
}

// 12. Retrait affilié approuvé → admin + affilié
export async function emailAffiliateWithdrawalApproved(opts: {
  affiliateName: string; affiliateEmail?: string; amount: number;
}): Promise<void> {
  const { affiliateName, affiliateEmail, amount } = opts;
  const adminHtml = baseHtml('✅ Retrait affilié approuvé', '#059669',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Le retrait de <strong>${affiliateName}</strong> a été approuvé.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Affilié', affiliateName, true)}
      ${row('Montant', fmt(amount), true)}
      ${row('Date', dateFr())}
      ${row('Statut', statusBadge('approved'))}
    </table>`
  );
  await send(ADMIN_EMAIL, `✅ Retrait affilié approuvé — ${affiliateName} ${fmt(amount)}`, adminHtml, 'affiliate_withdrawal_approved_admin');

  if (affiliateEmail) {
    const html = baseHtml('✅ Retrait approuvé', '#059669',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${affiliateName}</strong>, votre retrait a été approuvé !</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Montant', fmt(amount), true)}
        ${row('Date', dateFr())}
        ${row('Statut', statusBadge('approved'))}
      </table>
      <p style="margin:24px 0 0;padding:16px;background:#f0fdf4;border-radius:10px;font-size:13px;color:#065f46;border-left:4px solid #059669;">
        🎉 Votre paiement est en cours de traitement.
      </p>`
    );
    await send(affiliateEmail, `✅ Retrait de ${fmt(amount)} approuvé`, html, 'affiliate_withdrawal_approved_affiliate');
  }
}

// 13. Retrait affilié refusé → admin + affilié
export async function emailAffiliateWithdrawalRejected(opts: {
  affiliateName: string; affiliateEmail?: string; amount: number; reason?: string;
}): Promise<void> {
  const { affiliateName, affiliateEmail, amount, reason } = opts;
  const adminHtml = baseHtml('❌ Retrait affilié refusé', '#dc2626',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Le retrait de <strong>${affiliateName}</strong> a été refusé.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Affilié', affiliateName, true)}
      ${row('Montant', fmt(amount), true)}
      ${reason ? row('Raison', reason) : ''}
      ${row('Date', dateFr())}
    </table>`
  );
  await send(ADMIN_EMAIL, `❌ Retrait affilié refusé — ${affiliateName} ${fmt(amount)}`, adminHtml, 'affiliate_withdrawal_rejected_admin');

  if (affiliateEmail) {
    const html = baseHtml('❌ Retrait refusé', '#dc2626',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${affiliateName}</strong>, votre demande de retrait a été refusée.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Montant', fmt(amount), true)}
        ${reason ? row('Raison', reason) : ''}
        ${row('Date', dateFr())}
        ${row('Statut', statusBadge('rejected'))}
      </table>`
    );
    await send(affiliateEmail, `❌ Retrait de ${fmt(amount)} refusé`, html, 'affiliate_withdrawal_rejected_affiliate');
  }
}

// 15. Nouvelle demande client → agent / affilié
export async function emailAgentNewRequest(opts: {
  agentName: string; agentEmail?: string;
  clientName: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
}): Promise<void> {
  const { agentName, agentEmail, clientName, type, amount } = opts;
  if (!agentEmail) return;

  const isDeposit = type === 'deposit';
  const color   = isDeposit ? '#059669' : '#7c3aed';
  const emoji   = isDeposit ? '💰' : '🏧';
  const label   = isDeposit ? 'dépôt' : 'retrait';

  const html = baseHtml(`${emoji} Nouvelle demande de ${label}`, color,
    `<p style="margin:0 0 16px;font-size:15px;color:#444;">Bonjour <strong>${agentName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;color:#444;">
      Un client vient de soumettre une <strong>demande de ${label}</strong> chez vous via l'application Solutionpam.
      Connectez-vous à votre tableau de bord pour la traiter.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Client', clientName, true)}
      ${row('Type', isDeposit ? 'Dépôt' : 'Retrait', true)}
      ${row('Montant', fmt(amount), true)}
      ${row('Date', dateFr())}
      ${row('Statut', statusBadge('pending'))}
    </table>
    <p style="margin:24px 0 0;padding:16px;background:${isDeposit ? '#f0fdf4' : '#faf5ff'};border-radius:10px;font-size:13px;color:${isDeposit ? '#065f46' : '#6d28d9'};border-left:4px solid ${color};">
      ⚡ Ouvrez votre application Solutionpam — section <strong>Demandes</strong> — pour approuver ou rejeter cette opération.
    </p>`
  );
  await send(agentEmail, `${emoji} Demande de ${label} — ${clientName} (${fmt(amount)})`, html, `agent_new_${type}_request`);
}

// 16. Agent / affilié a traité une demande → admin + client
export async function emailAgentProcessed(opts: {
  agentName: string;
  clientName: string; clientEmail?: string;
  type: 'deposit' | 'withdrawal';
  action: 'confirmed' | 'rejected';
  amount: number;
  reason?: string;
}): Promise<void> {
  const { agentName, clientName, clientEmail, type, action, amount, reason } = opts;

  const isDeposit   = type === 'deposit';
  const isConfirmed = action === 'confirmed';
  const color  = isConfirmed ? '#059669' : '#dc2626';
  const emoji  = isConfirmed ? '✅' : '❌';
  const label  = isDeposit ? 'dépôt' : 'retrait';
  const verb   = isConfirmed ? 'confirmé' : 'refusé';

  // ── Admin notification ────────────────────────────────────────────────────
  const adminHtml = baseHtml(`${emoji} ${isDeposit ? 'Dépôt' : 'Retrait'} ${verb} par agent`, color,
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">
      L'agent / affilié <strong>${agentName}</strong> a <strong>${verb}</strong> une demande de ${label}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Agent / Affilié', agentName, true)}
      ${row('Client', clientName, true)}
      ${row('Type', isDeposit ? 'Dépôt' : 'Retrait')}
      ${row('Montant', fmt(amount), true)}
      ${reason ? row('Raison du refus', reason) : ''}
      ${row('Date', dateFr())}
      ${row('Statut', statusBadge(isConfirmed ? 'approved' : 'rejected'))}
    </table>`
  );
  await send(
    ADMIN_EMAIL,
    `${emoji} ${label.charAt(0).toUpperCase() + label.slice(1)} ${verb} — Agent: ${agentName} / Client: ${clientName}`,
    adminHtml,
    `agent_${type}_${action}_admin`,
  );

  // ── Client notification ───────────────────────────────────────────────────
  if (clientEmail) {
    const clientHtml = isConfirmed
      ? baseHtml(`${emoji} Votre demande de ${label} a été traitée`, color,
          `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#444;">
            Votre demande de <strong>${label}</strong> a été <strong>traitée avec succès</strong> par l'agent <strong>${agentName}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${row('Type', isDeposit ? 'Dépôt' : 'Retrait', true)}
            ${row('Montant', fmt(amount), true)}
            ${row('Agent', agentName)}
            ${row('Date', dateFr())}
            ${row('Statut', statusBadge('approved'))}
          </table>
          <p style="margin:24px 0 0;padding:16px;background:#f0fdf4;border-radius:10px;font-size:13px;color:#065f46;border-left:4px solid #059669;">
            🎉 Votre solde a été mis à jour. Consultez votre tableau de bord pour les détails.
          </p>`
        )
      : baseHtml(`${emoji} Votre demande de ${label} a été refusée`, color,
          `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#444;">
            Malheureusement, votre demande de <strong>${label}</strong> a été <strong>refusée</strong> par l'agent <strong>${agentName}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${row('Type', isDeposit ? 'Dépôt' : 'Retrait', true)}
            ${row('Montant', fmt(amount), true)}
            ${row('Agent', agentName)}
            ${reason ? row('Raison', reason) : ''}
            ${row('Date', dateFr())}
            ${row('Statut', statusBadge('rejected'))}
          </table>
          <p style="margin:24px 0 0;padding:16px;background:#fef2f2;border-radius:10px;font-size:13px;color:#991b1b;border-left:4px solid #dc2626;">
            Si vous avez des questions, contactez le support Solutionpam.
          </p>`
        );
    await send(clientEmail, `${emoji} Demande de ${label} ${verb} — ${fmt(amount)}`, clientHtml, `agent_${type}_${action}_client`);
  }
}

// 14. Achat formation → admin + client
export async function emailFormationPurchase(opts: {
  clientName: string; clientEmail?: string;
  formationTitle: string; amount: number;
}): Promise<void> {
  const { clientName, clientEmail, formationTitle, amount } = opts;
  const date = dateFr();

  const adminHtml = baseHtml('🎓 Achat formation', '#7c3aed',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Un client vient d'acheter une formation.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Client', clientName, true)}
      ${row('Formation', formationTitle, true)}
      ${row('Montant', fmt(amount), true)}
      ${row('Date', date)}
      ${row('Statut', statusBadge('completed'))}
    </table>`
  );
  await send(ADMIN_EMAIL, `🎓 Formation achetée — ${clientName} (${formationTitle})`, adminHtml, 'formation_purchase_admin');

  if (clientEmail) {
    const html = baseHtml('🎓 Formation achetée', '#7c3aed',
      `<p style="margin:0 0 20px;font-size:15px;color:#444;">Bonjour <strong>${clientName}</strong>, votre accès à la formation a été activé !</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Formation', formationTitle, true)}
        ${row('Montant', fmt(amount), true)}
        ${row('Date', date)}
        ${row('Statut', statusBadge('completed'))}
      </table>
      <p style="margin:24px 0 0;padding:16px;background:#faf5ff;border-radius:10px;font-size:13px;color:#6d28d9;border-left:4px solid #7c3aed;">
        🚀 Vous pouvez accéder à votre formation depuis votre tableau de bord dès maintenant.
      </p>`
    );
    await send(clientEmail, `🎓 Accès à "${formationTitle}" activé`, html, 'formation_purchase_client');
  }
}

// 16. Identifiants de service → client
export async function emailServiceCredentials(opts: {
  clientEmail: string;
  productName: string;
  credentialEmail: string;
  credentialPassword: string;
}): Promise<void> {
  const { clientEmail, productName, credentialEmail, credentialPassword } = opts;
  const date = dateFr();
  const html = baseHtml(`🔑 Accès ${productName}`, '#7c3aed',
    `<p style="margin:0 0 20px;font-size:15px;color:#444;">Voici vos identifiants de connexion pour <strong>${productName}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${row('Service', productName, true)}
      ${row('Email / Identifiant', credentialEmail, true)}
      ${row('Mot de passe', credentialPassword, true)}
      ${row('Date d\'activation', date)}
    </table>
    <p style="margin:24px 0 0;padding:16px;background:#faf5ff;border-radius:10px;font-size:13px;color:#6d28d9;border-left:4px solid #7c3aed;">
      🔒 Gardez ces identifiants en lieu sûr. Ne les partagez avec personne.
    </p>
    <p style="margin:16px 0 0;padding:16px;background:#fef9c3;border-radius:10px;font-size:13px;color:#713f12;border-left:4px solid #eab308;">
      ⚠️ Si vous n'êtes pas à l'origine de cet achat, contactez notre support immédiatement.
    </p>`
  );
  await send(clientEmail, `🔑 Vos identifiants ${productName} — Solutionpam`, html, 'service_credentials');
}

// ── 2FA OTP ───────────────────────────────────────────────────────────────────
export async function send2FAOtp(opts: {
  email: string;
  name: string;
  role: TwoFARole;
  otpCode: string;
  expiresMinutes: number;
}): Promise<void> {
  const { email, name, role, otpCode, expiresMinutes } = opts;
  const roleLabel = role === 'admin' ? 'Administrateur' : role === 'agent' ? 'Agent' : 'Affilié';
  const accentColor = role === 'admin' ? '#1e40af' : role === 'agent' ? '#0f172a' : '#7c3aed';

  const html = baseHtml(`Code de vérification — ${roleLabel}`, accentColor, `
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Bonjour <strong>${name}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Votre code de vérification à deux étapes est :
    </p>
    <div style="margin:0 auto 24px;text-align:center;background:#f8fafc;border:2px dashed #e2e8f0;border-radius:16px;padding:24px 32px;">
      <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:${accentColor};font-family:monospace;">${otpCode}</span>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-align:center;">
      Ce code expire dans <strong>${expiresMinutes} minutes</strong> et ne peut être utilisé qu'une seule fois.
    </p>
    <div style="margin:24px 0 0;padding:12px 16px;background:#fef2f2;border-radius:12px;border-left:4px solid #ef4444;">
      <p style="margin:0;font-size:12px;color:#991b1b;line-height:1.6;">
        ⚠️ Si vous n'avez pas tenté de vous connecter à l'espace <strong>${roleLabel}</strong> Solutionpam,
        ignorez ce message et changez votre mot de passe immédiatement.
      </p>
    </div>
  `);

  const result = await send(email, `🔐 Code de vérification — Connexion ${roleLabel}`, html, '2fa_otp');
  if (!result.success) {
    throw new Error(result.error || 'L’envoi du code 2FA a échoué.');
  }
}
