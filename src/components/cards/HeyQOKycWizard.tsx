import { useEffect, useMemo, useState, type ChangeEvent, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, FileCheck2, FileText, LockKeyhole, ShieldCheck, Upload, X } from 'lucide-react';
import { fileToBase64 } from '../../lib/fileToBase64';

export type HeyQOGender = 'male' | 'female' | 'other' | '';
export type HeyQODocumentType = 'NATIONAL_ID' | 'PASSPORT' | 'DRIVERS_LICENSE' | '';
export type HeyQOEmploymentStatus = 'employed' | 'self_employed' | 'student' | 'unemployed' | 'retired' | 'homemaker' | '';
export type HeyQOFile = File | null;
export type HeyQOKycFormValue = HeyQOKycValue;

export interface HeyQOKycValue {
  dateOfBirth: string;
  phone: string;
  gender: HeyQOGender;
  documentType: HeyQODocumentType;
  documentNumber: string;
  taxIdNumber: string;
  documentFrontFile: HeyQOFile;
  documentFrontBase64?: string;
  documentBackFile?: HeyQOFile;
  documentBackBase64?: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
  proofOfAddressFile: HeyQOFile;
  proofOfAddressBase64?: string;
  employmentStatus: HeyQOEmploymentStatus;
  occupation: string;
  primaryPurpose: string;
  sourceOfFunds: string;
  expectedMonthlyPay: string;
  consent: boolean;
}

export interface HeyQOKycWizardProps {
  onSubmit: (value: HeyQOKycValue) => void | Promise<void>;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
  initialValue?: Partial<HeyQOKycValue>;
  sandboxPreview?: boolean;
}

const blankValue: HeyQOKycValue = {
  dateOfBirth: '', phone: '', gender: '', documentType: '', documentNumber: '', taxIdNumber: '',
  documentFrontFile: null, documentBackFile: null, addressStreet: '', addressCity: '',
  addressState: '', addressPostalCode: '', addressCountry: 'HT', proofOfAddressFile: null,
  employmentStatus: '', occupation: '', primaryPurpose: '', sourceOfFunds: '',
  expectedMonthlyPay: '', consent: false,
};

const steps = [
  { eyebrow: 'Étape 01', title: 'Votre identité', detail: 'Les informations inscrites sur votre pièce officielle.' },
  { eyebrow: 'Étape 02', title: 'Pièce d’identité', detail: 'Une photo nette, lisible et non recadrée.' },
  { eyebrow: 'Étape 03', title: 'Votre adresse', detail: 'L’adresse où vous pouvez être joint.' },
  { eyebrow: 'Étape 04', title: 'Profil financier', detail: 'Pour adapter les limites de votre carte.' },
  { eyebrow: 'Dernière étape', title: 'Confirmer', detail: 'Un dernier contrôle avant l’envoi sécurisé.' },
];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block text-[13px] font-medium text-[#29485d]">{label}{children}{hint && <span className="mt-1 block text-[11px] text-[#78909f]">{hint}</span>}</label>;
}

const inputClass = 'mt-2 min-h-12 w-full rounded-2xl border border-[#d6e2e9] bg-[#f8fbfd] px-4 text-[15px] text-[#18384d] outline-none transition-colors placeholder:text-[#9aadb8] focus:border-[#4ba4cf]/75 focus:ring-2 focus:ring-[#4ba4cf]/15';

function UploadField({ label, value, onChange, onInvalidFile, optional = false, testId }: { label: string; value: HeyQOFile | undefined; onChange: (file: File | null) => void | Promise<void>; onInvalidFile?: () => void; optional?: boolean; testId: string }) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      onChange(null);
      onInvalidFile?.();
      event.target.value = '';
      return;
    }
    void onChange(file);
  };
  return <div className="rounded-2xl border border-dashed border-[#d6b56d]/60 bg-[#fffaf0] p-4 transition-colors hover:border-[#c59b43]">
    <div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0c9] text-[#a97720]"><Upload className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#18384d]">{label} {optional && <span className="font-normal text-[#8799a4]">· optionnel</span>}</p><p className="mt-1 text-[11px] text-[#78909f]">JPG ou PNG · 4 Mo maximum</p>{value ? <div data-testid={`${testId}-name`} className="mt-3 flex items-center gap-2 truncate rounded-lg bg-white px-3 py-2 text-xs text-[#a97720]"><FileCheck2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{value.name}</span></div> : <p className="mt-3 text-xs text-[#8799a4]">Aucun fichier sélectionné</p>}</div><label data-testid={testId} className="cursor-pointer rounded-xl border border-[#cfdde5] bg-white px-3 py-2 text-xs font-semibold text-[#426176] transition-colors hover:border-[#c59b43] hover:text-[#a97720]"><span>{value ? 'Remplacer' : 'Choisir'}</span><input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={handleChange} /></label></div>
  </div>;
}

function valueFor(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>, setValue: Dispatch<SetStateAction<HeyQOKycValue>>, key: keyof HeyQOKycValue) {
  setValue((current) => ({ ...current, [key]: event.target.value }));
}

export default function HeyQOKycWizard({ onSubmit, onClose, busy = false, error = null, initialValue, sandboxPreview = false }: HeyQOKycWizardProps) {
  const [value, setValue] = useState<HeyQOKycValue>({ ...blankValue, ...initialValue });
  const [step, setStep] = useState(0);
  const [validation, setValidation] = useState('');
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', closeOnEscape); };
  }, [busy, onClose]);

  const update = (key: keyof HeyQOKycValue, next: string | boolean | File | null) => setValue((current) => ({ ...current, [key]: next }));
  const cacheFile = async (
    fileKey: 'documentFrontFile' | 'documentBackFile' | 'proofOfAddressFile',
    base64Key: 'documentFrontBase64' | 'documentBackBase64' | 'proofOfAddressBase64',
    file: File | null,
  ) => {
    update(fileKey, file);
    update(base64Key, null);
    if (!file) return;
    try {
      const encoded = await fileToBase64(file);
      update(base64Key, encoded || null);
    } catch (cause: any) {
      update(fileKey, null);
      setFileError(cause?.message || `Impossible de lire ${file.name}.`);
    }
  };
  const current = steps[step];
  const progress = ((step + 1) / steps.length) * 100;
  const validateStep = (stepToValidate: number) => {
    if (stepToValidate === 0 && (!value.dateOfBirth || !value.phone || !value.gender || !value.documentType || !value.documentNumber || !value.taxIdNumber)) return 'Complétez tous les champs d’identité pour continuer.';
    if (stepToValidate === 1 && !value.documentFrontFile) return 'Ajoutez le recto de votre pièce d’identité pour continuer.';
    if (stepToValidate === 2 && (!value.addressStreet || !value.addressCity || !value.addressState || !value.addressPostalCode || !value.addressCountry || !value.proofOfAddressFile)) return 'Complétez votre adresse et ajoutez un justificatif.';
    if (stepToValidate === 3 && (!value.employmentStatus || !value.occupation || !value.primaryPurpose || !value.sourceOfFunds || !value.expectedMonthlyPay)) return 'Complétez votre profil financier pour continuer.';
    if (stepToValidate === 4 && !value.consent) return 'Votre consentement est nécessaire pour envoyer la demande.';
    return '';
  };
  const validate = () => validateStep(step);
  const next = () => {
    if (step === 4) {
      const firstInvalidStep = [0, 1, 2, 3, 4].findIndex((stepToValidate) => Boolean(validateStep(stepToValidate)));
      if (firstInvalidStep !== -1) {
        setStep(firstInvalidStep);
        setValidation(validateStep(firstInvalidStep));
        return;
      }
    }
    const issue = validate();
    if (issue) return setValidation(issue);
    setValidation('');
    if (step < steps.length - 1) setStep((currentStep) => currentStep + 1);
    else void onSubmit(value);
  };
  const back = () => { setValidation(''); setStep((currentStep) => Math.max(0, currentStep - 1)); };
  const selectOptions = useMemo(() => ({
    gender: [['male', 'Homme'], ['female', 'Femme'], ['other', 'Autre']] as const,
    documentType: [['NATIONAL_ID', 'Carte d’identification nationale'], ['PASSPORT', 'Passeport'], ['DRIVERS_LICENSE', 'Permis de conduire']] as const,
    employmentStatus: [['employed', 'Salarié'], ['self_employed', 'Indépendant'], ['student', 'Étudiant'], ['unemployed', 'Sans emploi'], ['retired', 'Retraité'], ['homemaker', 'Au foyer']] as const,
  }), []);

  const content = [
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Date de naissance"><input data-testid="input-dateOfBirth" className={inputClass} type="date" value={value.dateOfBirth} onChange={(event) => valueFor(event, setValue, 'dateOfBirth')} /></Field>
      <Field label="Téléphone" hint="Vous pouvez corriger le numéro du profil. Ex. +50949324932"><input data-testid="input-phone" className={inputClass} type="tel" inputMode="tel" autoComplete="tel" value={value.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+509 49 32 49 32" /></Field>
      <Field label="Genre"><select data-testid="select-gender" className={inputClass} value={value.gender} onChange={(event) => valueFor(event, setValue, 'gender')}><option value="">Sélectionner</option>{selectOptions.gender.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Type de document"><select data-testid="select-documentType" className={inputClass} value={value.documentType} onChange={(event) => valueFor(event, setValue, 'documentType')}><option value="">Sélectionner</option>{selectOptions.documentType.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Numéro du document"><input data-testid="input-documentNumber" className={inputClass} value={value.documentNumber} onChange={(event) => update('documentNumber', event.target.value)} placeholder="Ex. 123456789" /></Field>
      <Field label="NIF / numéro fiscal" hint="Utilisé pour confirmer votre identité fiscale."><input data-testid="input-taxIdNumber" className={inputClass} value={value.taxIdNumber} onChange={(event) => update('taxIdNumber', event.target.value)} placeholder="Votre numéro fiscal" /></Field>
    </div>,
    <div className="space-y-4"><UploadField label="Recto du document" value={value.documentFrontFile} onChange={(file) => { setFileError(''); return cacheFile('documentFrontFile', 'documentFrontBase64', file); }} onInvalidFile={() => setFileError('Ce fichier doit être au format JPG ou PNG et ne pas dépasser 4 Mo.')} testId="input-documentFrontFile" /><UploadField label="Verso du document" value={value.documentBackFile} onChange={(file) => { setFileError(''); return cacheFile('documentBackFile', 'documentBackBase64', file); }} onInvalidFile={() => setFileError('Ce fichier doit être au format JPG ou PNG et ne pas dépasser 4 Mo.')} optional testId="input-documentBackFile" /><div className="flex gap-3 rounded-2xl border border-[#d9e6ec] bg-[#f4f9fb] p-4 text-xs leading-5 text-[#60798a]"><FileText className="h-4 w-4 shrink-0 text-[#a97720]" /> Gardez les quatre coins visibles. Les photos floues peuvent retarder la vérification.</div></div>,
    <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Adresse"><input data-testid="input-addressStreet" className={inputClass} value={value.addressStreet} onChange={(event) => update('addressStreet', event.target.value)} placeholder="Rue et numéro" /></Field><Field label="Ville"><input data-testid="input-addressCity" className={inputClass} value={value.addressCity} onChange={(event) => update('addressCity', event.target.value)} placeholder="Port-au-Prince" /></Field><Field label="Département / État"><input data-testid="input-addressState" className={inputClass} value={value.addressState} onChange={(event) => update('addressState', event.target.value)} placeholder="Ouest" /></Field><Field label="Code postal"><input data-testid="input-addressPostalCode" className={inputClass} value={value.addressPostalCode} onChange={(event) => update('addressPostalCode', event.target.value)} placeholder="HT6110" /></Field><Field label="Pays"><input data-testid="input-addressCountry" className={inputClass} value={value.addressCountry} onChange={(event) => update('addressCountry', event.target.value)} placeholder="HT" /></Field></div><UploadField label="Justificatif de domicile" value={value.proofOfAddressFile} onChange={(file) => { setFileError(''); return cacheFile('proofOfAddressFile', 'proofOfAddressBase64', file); }} onInvalidFile={() => setFileError('Ce fichier doit être au format JPG ou PNG et ne pas dépasser 4 Mo.')} testId="input-proofOfAddressFile" /></div>,
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Situation professionnelle"><select data-testid="select-employmentStatus" className={inputClass} value={value.employmentStatus} onChange={(event) => valueFor(event, setValue, 'employmentStatus')}><option value="">Sélectionner</option>{selectOptions.employmentStatus.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Code profession"><input data-testid="input-occupation" className={inputClass} inputMode="numeric" value={value.occupation} onChange={(event) => update('occupation', event.target.value)} placeholder="Ex. 151252" /></Field><Field label="Objectif principal"><select data-testid="select-primaryPurpose" className={inputClass} value={value.primaryPurpose} onChange={(event) => valueFor(event, setValue, 'primaryPurpose')}><option value="">Sélectionner</option><option value="personal_or_living_expenses">Dépenses personnelles</option><option value="payments_to_friends_or_family_abroad">Paiements à des proches à l’étranger</option></select></Field><Field label="Source des fonds"><select data-testid="select-sourceOfFunds" className={inputClass} value={value.sourceOfFunds} onChange={(event) => valueFor(event, setValue, 'sourceOfFunds')}><option value="">Sélectionner</option><option value="salary">Salaire</option><option value="savings">Épargne</option><option value="company_funds">Fonds d’entreprise</option></select></Field><Field label="Revenus mensuels attendus"><select data-testid="select-expectedMonthlyPay" className={inputClass} value={value.expectedMonthlyPay} onChange={(event) => valueFor(event, setValue, 'expectedMonthlyPay')}><option value="">Sélectionner</option><option value="0_4999">0 à 4 999</option><option value="5000_9999">5 000 à 9 999</option></select></Field></div>,
    <div className="space-y-5"><div className="rounded-2xl border border-[#ead49b] bg-[#fffaf0] p-5"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-[#a97720]" /><div><p className="font-semibold text-[#18384d]">Vos données restent protégées</p><p className="mt-2 text-sm leading-6 text-[#60798a]">Solutionpam transmet ces informations à HeyQO uniquement pour vérifier votre identité et évaluer votre demande de carte.</p></div></div></div><label data-testid="label-consent" className="flex cursor-pointer gap-3 text-sm leading-6 text-[#486477]"><input data-testid="input-consent" type="checkbox" checked={value.consent} onChange={(event) => update('consent', event.target.checked)} className="mt-1 h-4 w-4 accent-[#b98a2f]" /><span>J’autorise la vérification de mon identité et confirme que les informations fournies sont exactes.</span></label><div className="grid grid-cols-2 gap-3 border-t border-[#e2ebf0] pt-4 text-xs text-[#718898]"><span>Date de naissance<br /><strong className="text-[#29485d]">{value.dateOfBirth || '—'}</strong></span><span>Document<br /><strong className="text-[#29485d]">{value.documentNumber || '—'}</strong></span><span>Adresse<br /><strong className="text-[#29485d]">{value.addressCity || '—'}</strong></span><span>Recto reçu<br /><strong className="text-[#a97720]">{value.documentFrontFile ? 'Oui' : '—'}</strong></span></div></div>,
  ][step];

  return createPortal(<div data-testid="heyqo-kyc-wizard" role="dialog" aria-modal="true" aria-labelledby="heyqo-wizard-title" className="fixed inset-0 z-[1100] flex items-end justify-center bg-[#17384c]/35 p-0 backdrop-blur-md sm:items-center sm:p-4">
    <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} className="flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden border border-[#d8e5ec] bg-white text-[#18384d] shadow-[0_28px_100px_rgba(38,76,98,.2)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[30px]">
      <div className="flex items-center justify-between border-b border-[#e2ebf0] px-5 py-4 sm:px-7"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#a97720]"><LockKeyhole className="h-3.5 w-3.5" /> Vérification sécurisée</div><button type="button" data-testid="button-close-kyc-wizard" aria-label="Fermer la vérification" onClick={onClose} className="rounded-xl p-2 text-[#6d8492] transition-colors hover:bg-[#edf5f8] hover:text-[#18384d]"><X className="h-5 w-5" /></button></div>
      <div className="px-5 pb-5 pt-6 sm:px-7"><div className="mb-5 flex items-center justify-between"><span data-testid="text-kyc-step" className="text-xs font-semibold text-[#718898]">{current.eyebrow} <span className="text-[#b7c7d0]">/</span> 05</span><span className="text-xs font-mono text-[#a97720]">{Math.round(progress)}%</span></div><div className="h-1 overflow-hidden rounded-full bg-[#e8eff3]"><motion.div className="h-full rounded-full bg-[#d1a956]" animate={{ width: `${progress}%` }} transition={{ duration: .35 }} /></div><div className="mt-7"><h2 id="heyqo-wizard-title" data-testid="heading-kyc-step" className="text-[29px] font-semibold leading-tight tracking-[-.04em] text-[#18384d]">{current.title}</h2><p className="mt-2 text-sm text-[#718898]">{current.detail}</p></div></div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-7"><AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .2 }}>{content}</motion.div></AnimatePresence>{(validation || fileError || error) && <div data-testid="error-kyc-wizard" role="alert" className="mt-5 rounded-2xl border border-[#f3b7b0] bg-[#fff1f0] px-4 py-3 text-sm text-[#b42318]">{validation || fileError || error}</div>}</div>
      <div className="border-t border-[#e2ebf0] bg-[#fbfdfe] px-5 py-4 sm:px-7"><div className="flex gap-3"><button type="button" data-testid="button-kyc-back" onClick={back} disabled={step === 0 || busy} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#d5e2e9] px-4 text-sm font-semibold text-[#527083] transition-colors hover:border-[#a9c1cd] hover:bg-white hover:text-[#18384d] disabled:invisible"><ArrowLeft className="h-4 w-4" /> Retour</button><button type="button" data-testid={step === 4 ? 'button-submit-kyc-wizard' : 'button-kyc-next'} onClick={next} disabled={busy} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1979a8] px-5 text-sm font-bold text-white transition-all hover:bg-[#12678f] active:scale-[.985] disabled:cursor-wait disabled:opacity-60">{busy ? 'Envoi sécurisé…' : step === 4 ? <><Check className="h-4 w-4" /> Envoyer ma demande</> : <>Continuer <ArrowRight className="h-4 w-4" /></>}</button></div>{sandboxPreview && step === 2 && <button type="button" data-testid="button-sandbox-preview-step-4" onClick={() => { setValidation(''); setStep(3); }} disabled={busy} className="mt-3 w-full text-center text-xs font-semibold text-[#a97720] underline decoration-[#d1a956]/40 underline-offset-4 transition-colors hover:text-[#805d18]">Voir la section 4 pour le test Sandbox sans justificatif</button>}</div>
    </motion.div>
  </div>, document.body);
}