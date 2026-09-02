import { useState } from 'react';
import { Check, KeyRound, Loader2, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  requestCardsEmailTwoFactor,
  setCardsSecurityPin,
  unlockCards,
  verifyCardsEmailTwoFactor,
  type CardsSecuritySnapshot,
} from '../../services/cardsService';

interface CardsSecurityGateProps {
  security: CardsSecuritySnapshot;
  onSecurityChange: (security: CardsSecuritySnapshot) => void;
  externalError?: string | null;
  diditChallengeId: string;
}

function SecurityInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-left">
      <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#60798a]">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-[#d7e4eb] bg-[#f8fbfd] px-4 py-3 text-center text-xl font-black tracking-[.45em] text-[#18384d] outline-none placeholder:text-[#9db1bd] focus:border-[#4ba4cf] focus:ring-2 focus:ring-[#4ba4cf]/15"
      />
    </label>
  );
}

export default function CardsSecurityGate({ security, onSecurityChange, externalError, diditChallengeId }: CardsSecurityGateProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [code, setCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState(security.maskedEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pinReady = security.pinConfigured;
  const twoFactorReady = security.emailTwoFactorEnabled;
  const setupMode = !pinReady || !twoFactorReady;

  const handleCreatePin = async () => {
    if (!/^\d{6}$/.test(pin) || !/^\d{6}$/.test(confirmPin)) {
      setError('Votre code Cartes doit contenir exactement 6 chiffres.');
      return;
    }
    if (pin !== confirmPin) {
      setError('Les deux codes Cartes ne correspondent pas.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await setCardsSecurityPin(pin, confirmPin);
      onSecurityChange(result.security);
      setPin('');
      setConfirmPin('');
    } catch (cause: any) {
      setError(cause?.message || 'Impossible d’enregistrer votre code Cartes.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestCardsEmailTwoFactor();
      setSessionId(result.sessionId);
      setMaskedEmail(result.maskedEmail);
      setCode('');
    } catch (cause: any) {
      setError(cause?.message || 'Impossible d’envoyer le code de vérification.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetupVerification = async () => {
    if (!sessionId || !/^\d{6}$/.test(code)) {
      setError('Saisissez le code à 6 chiffres reçu par e-mail.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await verifyCardsEmailTwoFactor(sessionId, code, diditChallengeId);
      onSecurityChange(result.security);
      setSessionId('');
      setCode('');
    } catch (cause: any) {
      setError(cause?.message || 'Le code e-mail est incorrect ou expiré.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (!sessionId || !/^\d{6}$/.test(pin) || !/^\d{6}$/.test(code)) {
      setError('Saisissez votre PIN et le code e-mail à 6 chiffres.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await unlockCards(sessionId, pin, code, diditChallengeId);
      onSecurityChange(result.security);
      setSessionId('');
      setPin('');
      setCode('');
    } catch (cause: any) {
      setError(cause?.message || 'Le PIN ou le code e-mail est incorrect.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="cards-security-gate" className="mt-8 rounded-[1.75rem] border border-[#dce8ee] bg-white p-5 text-[#18384d] shadow-[0_22px_60px_rgba(47,89,112,.12)] sm:p-7">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#b9dfef] bg-[#eaf7fc] text-[#1979a8]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-[#1979a8]">Protection obligatoire</p>
        <h1 className="mt-2 text-2xl font-black tracking-[-.035em]">{setupMode ? 'Sécurisez votre espace Cartes' : 'Déverrouillez votre espace Cartes'}</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[#60798a]">
          {setupMode
            ? 'Un code personnel et la vérification en deux étapes par e-mail sont obligatoires avant tout accès aux informations de votre carte.'
            : 'Pour protéger les informations sensibles, confirmez votre code Cartes et le code envoyé à votre adresse e-mail.'}
        </p>
      </div>

      <div className="mt-7 space-y-3">
        <div className={`rounded-2xl border p-4 ${pinReady ? 'border-[#a9ddc4] bg-[#effaf4]' : 'border-[#dce8ee] bg-[#f8fbfd]'}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${pinReady ? 'bg-[#d9f4e5] text-[#16805a]' : 'bg-[#eaf7fc] text-[#1979a8]'}`}>
              {pinReady ? <Check className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{pinReady ? 'Code Cartes configuré' : 'Créer votre code Cartes à 6 chiffres'}</p>
              {!pinReady && (
                <>
                  <p className="mt-1 text-xs leading-5 text-[#718898]">Ce code est différent de votre mot de passe. Il sera conservé uniquement sous forme protégée.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <SecurityInput label="Votre code" value={pin} onChange={setPin} placeholder="••••••" autoComplete="new-password" />
                    <SecurityInput label="Confirmer le code" value={confirmPin} onChange={setConfirmPin} placeholder="••••••" autoComplete="new-password" />
                  </div>
                  <button type="button" onClick={() => void handleCreatePin()} disabled={busy} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1979a8] px-4 text-sm font-black text-white transition hover:bg-[#12678f] disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Enregistrer mon code
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${twoFactorReady ? 'border-[#a9ddc4] bg-[#effaf4]' : 'border-[#dce8ee] bg-[#f8fbfd]'}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${twoFactorReady ? 'bg-[#d9f4e5] text-[#16805a]' : 'bg-[#eaf7fc] text-[#1979a8]'}`}>
              {twoFactorReady ? <Check className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{twoFactorReady ? 'Vérification e-mail activée' : 'Activer la vérification en deux étapes par e-mail'}</p>
              {!twoFactorReady && (
                <>
                  <p className="mt-1 text-xs leading-5 text-[#718898]">Un code à 6 chiffres sera envoyé à {maskedEmail || 'votre adresse e-mail enregistrée'}.</p>
                  {!sessionId ? (
                    <button type="button" onClick={() => void handleSendCode()} disabled={busy || !pinReady} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#b9dfef] bg-[#eaf7fc] px-4 text-sm font-black text-[#1979a8] transition hover:bg-[#ddf2fa] disabled:opacity-40">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Envoyer le code par e-mail
                    </button>
                  ) : (
                    <>
                      <SecurityInput label={`Code reçu sur ${maskedEmail}`} value={code} onChange={setCode} placeholder="••••••" autoComplete="one-time-code" />
                      <button type="button" onClick={() => void handleSetupVerification()} disabled={busy} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1979a8] px-4 text-sm font-black text-white transition hover:bg-[#12678f] disabled:opacity-50">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Activer la 2FA e-mail
                      </button>
                      <button type="button" onClick={() => void handleSendCode()} disabled={busy} className="mt-3 w-full text-xs font-bold text-[#1979a8] hover:text-[#12678f] disabled:opacity-40">Renvoyer un code</button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {!setupMode && !security.unlocked && (
        <div className="mt-3 rounded-2xl border border-[#dce8ee] bg-[#f8fbfd] p-4">
          <p className="text-sm font-bold">Confirmation d’accès</p>
          <p className="mt-1 text-xs leading-5 text-[#718898]">Demandez un code e-mail, puis saisissez les deux codes pour ouvrir la zone protégée.</p>
          {!sessionId ? (
            <button type="button" onClick={() => void handleSendCode()} disabled={busy} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#b9dfef] bg-[#eaf7fc] px-4 text-sm font-black text-[#1979a8] transition hover:bg-[#ddf2fa] disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Envoyer un code d’accès
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <SecurityInput label="PIN Cartes" value={pin} onChange={setPin} placeholder="••••••" autoComplete="current-password" />
              <SecurityInput label={`Code e-mail reçu sur ${maskedEmail}`} value={code} onChange={setCode} placeholder="••••••" autoComplete="one-time-code" />
              <button type="button" onClick={() => void handleUnlock()} disabled={busy} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1979a8] px-4 text-sm font-black text-white transition hover:bg-[#12678f] disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Déverrouiller l’espace Cartes
              </button>
              <button type="button" onClick={() => void handleSendCode()} disabled={busy} className="w-full text-xs font-bold text-[#1979a8] hover:text-[#12678f] disabled:opacity-40">Renvoyer un code</button>
            </div>
          )}
        </div>
      )}

      {(error || externalError) && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#f3b7b0] bg-[#fff1f0] p-3 text-xs leading-5 text-[#b42318]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#d5534a]" />
          {error || externalError}
        </div>
      )}
      <p className="mt-5 text-center text-[10px] leading-4 text-[#8196a3]">Ne communiquez jamais votre PIN ou votre code e-mail à une autre personne.</p>
    </section>
  );
}