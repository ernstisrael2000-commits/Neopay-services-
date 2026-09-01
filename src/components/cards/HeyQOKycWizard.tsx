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
  dateOfBirth: '', gender: '', documentType: '', documentNumber: '', taxIdNumber: '',
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
  return <label className="block text-[13px] font-medium text-[#f8edd5]/75">{label}{children}{hint && <span className="mt-1 block text-[11px] text-[#f8edd5]/35">{hint}</span>}</label>;
}

const inputClass = 'mt-2 min-h-12 w-full rounded-2xl border border-[#f8edd5]/12 bg-[#17151a]/80 px-4 text-[15px] text-[#f8edd5] outline-none transition-colors placeholder:text-[#f8edd5]/25 focus:border-[#d7b879]/75 focus:ring-2 focus:ring-[#d7b879]/10';

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
  return <div className="rounded-2xl border border-dashed border-[#d7b879]/30 bg-[#d7b879]/[.035] p-4 transition-colors hover:border-[#d7b879]/65">
    <div className="flex items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#d7b879]/10 text-[#d7b879]"><Upload className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#f8edd5]">{label} {optional && <span className="font-normal text-[#f8edd5]/35">· optionnel</span>}</p><p className="mt-1 text-[11px] text-[#f8edd5]/40">JPG ou PNG · 4 Mo maximum</p>{value ? <div data-testid={`${testId}-name`} className="mt-3 flex items-center gap-2 truncate rounded-lg bg-[#17151a]/70 px-3 py-2 text-xs text-[#d7b879]"><FileCheck2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{value.name}</span></div> : <p className="mt-3 text-xs text-[#f8edd5]/35">Aucun fichier sélectionné</p>}</div><label data-testid={testId} className="cursor-pointer rounded-xl border border-[#f8edd5]/15 px-3 py-2 text-xs font-semibold text-[#f8edd5]/75 transition-colors hover:border-[#d7b879]/60 hover:text-[#d7b879]"><span>{value ? 'Remplacer' : 'Choisir'}</span><input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={handleChange} /></label></div>
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
    if (stepToValidate === 0 && (!value.dateOfBirth || !value.gender || !value.documentType || !value.documentNumber || !value.taxIdNumber)) return 'Complétez tous les champs d’identité pour continuer.';
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
      <Field label="Genre"><select data-testid="select-gender" className={inputClass} value={value.gender} onChange={(event) => valueFor(event, setValue, 'gender')}><option value="">Sélectionner</option>{selectOptions.gender.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Type de document"><select data-testid="select-documentType" className={inputClass} value={value.documentType} onChange={(event) => valueFor(event, setValue, 'documentType')}><option value="">Sélectionner</option>{selectOptions.documentType.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Numéro du document"><input data-testid="input-documentNumber" className={inputClass} value={value.documentNumber} onChange={(event) => update('documentNumber', event.target.value)} placeholder="Ex. 123456789" /></Field>
      <Field label="NIF / numéro fiscal" hint="Utilisé pour confirmer votre identité fiscale."><input data-testid="input-taxIdNumber" className={inputClass} value={value.taxIdNumber} onChange={(event) => update('taxIdNumber', event.target.value)} placeholder="Votre numéro fiscal" /></Field>
    </div>,
    <div className="space-y-4"><UploadField label="Recto du document" value={value.documentFrontFile} onChange={(file) => { setFileError(''); return cacheFile('documentFrontFile', 'documentFrontBase64', file); }} onInvalidFile={() => setFileError('Ce fichier doit être au format JPG ou PNG et ne pas dépasser 4 Mo.')} testId="input-documentFrontFile" /><UploadField label="Verso du document" value={value.documentBackFile} onChange={(file) => { setFileError(''); return cacheFile('documentBackFile', 'documentBackBase64', file); }} onInvalidFile={() => setFileError('Ce fichier doit être au format JPG ou PNG et ne pas dépasser 4 Mo.')} optional testId="input-documentBackFile" /><div className="flex gap-3 rounded-2xl border border-[#f8edd5]/8 bg-[#f8edd5]/[.035] p-4 text-xs leading-5 text-[#f8edd5]/48"><FileText className="h-4 w-4 shrink-0 text-[#d7b879]" /> Gardez les quatre coins visibles. Les photos floues peuvent retarder la vérification.</div></div>,
    <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Adresse"><input data-testid="input-addressStreet" className={inputClass} value={value.addressStreet} onChange={(event) => update('addressStreet', event.target.value)} placeholder="Rue et numéro" /></Field><Field label="Ville"><input data-testid="input-addressCity" className={inputClass} value={value.addressCity} onChange={(event) => update('addressCity', event.target.value)} placeholder="Port-au-Prince" /></Field><Field label="Département / État"><input data-testid="input-addressState" className={inputClass} value={value.addressState} onChange={(event) => update('addressState', event.target.value)} placeholder="Ouest" /></Field><Field label="Code postal"><input data-testid="input-addressPostalCode" className={inputClass} value={value.addressPostalCode} onChange={(event) => update('addressPostalCode', event.target.value)} placeholder="HT6110" /></Field><Field label="Pays"><input data-testid="input-addressCountry" className={inputClass} value={value.addressCountry} onChange={(event) => update('addressCountry', event.target.value)} placeholder="HT" /></Field></div><UploadField label="Justificatif de domicile" value={value.proofOfAddressFile} onChange={(file) => { setFileError(''); return cacheFile('proofOfAddressFile', 'proofOfAddressBase64', file); }} onInvalidFile={() => setFileError('Ce fichier doit être au format JPG ou PNG et ne pas dépasser 4 Mo.')} testId="input-proofOfAddressFile" /></div>,
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Situation professionnelle"><select data-testid="select-employmentStatus" className={inputClass} value={value.employmentStatus} onChange={(event) => valueFor(event, setValue, 'employmentStatus')}><option value="">Sélectionner</option>{selectOptions.employmentStatus.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Code profession"><input data-testid="input-occupation" className={inputClass} inputMode="numeric" value={value.occupation} onChange={(event) => update('occupation', event.target.value)} placeholder="Ex. 151252" /></Field><Field label="Objectif principal"><select data-testid="select-primaryPurpose" className={inputClass} value={value.primaryPurpose} onChange={(event) => valueFor(event, setValue, 'primaryPurpose')}><option value="">Sélectionner</option><option value="personal_or_living_expenses">Dépenses personnelles</option><option value="payments_to_friends_or_family_abroad">Paiements à des proches à l’étranger</option></select></Field><Field label="Source des fonds"><select data-testid="select-sourceOfFunds" className={inputClass} value={value.sourceOfFunds} onChange={(event) => valueFor(event, setValue, 'sourceOfFunds')}><option value="">Sélectionner</option><option value="salary">Salaire</option><option value="savings">Épargne</option><option value="company_funds">Fonds d’entreprise</option></select></Field><Field label="Revenus mensuels attendus"><select data-testid="select-expectedMonthlyPay" className={inputClass} value={value.expectedMonthlyPay} onChange={(event) => valueFor(event, setValue, 'expectedMonthlyPay')}><option value="">Sélectionner</option><option value="0_4999">0 à 4 999</option><option value="5000_9999">5 000 à 9 999</option></select></Field></div>,
    <div className="space-y-5"><div className="rounded-2xl border border-[#d7b879]/20 bg-[#d7b879]/[.06] p-5"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-[#d7b879]" /><div><p className="font-semibold text-[#f8edd5]">Vos données restent protégées</p><p className="mt-2 text-sm leading-6 text-[#f8edd5]/50">Solutionpam transmet ces informations à HeyQO uniquement pour vérifier votre identité et évaluer votre demande de carte.</p></div></div></div><label data-testid="label-consent" className="flex cursor-pointer gap-3 text-sm leading-6 text-[#f8edd5]/70"><input data-testid="input-consent" type="checkbox" checked={value.consent} onChange={(event) => update('consent', event.target.checked)} className="mt-1 h-4 w-4 accent-[#d7b879]" /><span>J’autorise la vérification de mon identité et confirme que les informations fournies sont exactes.</span></label><div className="grid grid-cols-2 gap-3 border-t border-[#f8edd5]/8 pt-4 text-xs text-[#f8edd5]/45"><span>Date de naissance<br /><strong className="text-[#f8edd5]/75">{value.dateOfBirth || '—'}</strong></span><span>Document<br /><strong className="text-[#f8edd5]/75">{value.documentNumber || '—'}</strong></span><span>Adresse<br /><strong className="text-[#f8edd5]/75">{value.addressCity || '—'}</strong></span><span>Recto reçu<br /><strong className="text-[#d7b879]">{value.documentFrontFile ? 'Oui' : '—'}</strong></span></div></div>,
  ][step];

  return createPortal(<div data-testid="heyqo-kyc-wizard" role="dialog" aria-modal="true" aria-labelledby="heyqo-wizard-title" className="fixed inset-0 z-[1100] flex items-end justify-center bg-[#0b0a0d]/88 p-0 backdrop-blur-md sm:items-center sm:p-4">
    <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} className="flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden border border-[#f8edd5]/10 bg-[#211d22] text-[#f8edd5] shadow-[0_28px_100px_rgba(0,0,0,.45)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[30px]">
      <div className="flex items-center justify-between border-b border-[#f8edd5]/8 px-5 py-4 sm:px-7"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#d7b879]"><LockKeyhole className="h-3.5 w-3.5" /> Vérification sécurisée</div><button type="button" data-testid="button-close-kyc-wizard" aria-label="Fermer la vérification" onClick={onClose} className="rounded-xl p-2 text-[#f8edd5]/50 transition-colors hover:bg-[#f8edd5]/8 hover:text-[#f8edd5]"><X className="h-5 w-5" /></button></div>
      <div className="px-5 pb-5 pt-6 sm:px-7"><div className="mb-5 flex items-center justify-between"><span data-testid="text-kyc-step" className="text-xs font-semibold text-[#f8edd5]/45">{current.eyebrow} <span className="text-[#f8edd5]/20">/</span> 05</span><span className="text-xs font-mono text-[#d7b879]">{Math.round(progress)}%</span></div><div className="h-1 overflow-hidden rounded-full bg-[#f8edd5]/10"><motion.div className="h-full rounded-full bg-[#d7b879]" animate={{ width: `${progress}%` }} transition={{ duration: .35 }} /></div><div className="mt-7"><h2 id="heyqo-wizard-title" data-testid="heading-kyc-step" className="text-[29px] font-semibold leading-tight tracking-[-.04em]">{current.title}</h2><p className="mt-2 text-sm text-[#f8edd5]/48">{current.detail}</p></div></div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-7"><AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .2 }}>{content}</motion.div></AnimatePresence>{(validation || fileError || error) && <div data-testid="error-kyc-wizard" role="alert" className="mt-5 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{validation || fileError || error}</div>}</div>
      <div className="border-t border-[#f8edd5]/8 bg-[#211d22] px-5 py-4 sm:px-7"><div className="flex gap-3"><button type="button" data-testid="button-kyc-back" onClick={back} disabled={step === 0 || busy} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#f8edd5]/12 px-4 text-sm font-semibold text-[#f8edd5]/65 transition-colors hover:border-[#f8edd5]/30 hover:text-[#f8edd5] disabled:invisible"><ArrowLeft className="h-4 w-4" /> Retour</button><button type="button" data-testid={step === 4 ? 'button-submit-kyc-wizard' : 'button-kyc-next'} onClick={next} disabled={busy} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#d7b879] px-5 text-sm font-bold text-[#17151a] transition-all hover:bg-[#e4c78d] active:scale-[.985] disabled:cursor-wait disabled:opacity-60">{busy ? 'Envoi sécurisé…' : step === 4 ? <><Check className="h-4 w-4" /> Envoyer ma demande</> : <>Continuer <ArrowRight className="h-4 w-4" /></>}</button></div>{sandboxPreview && step === 2 && <button type="button" data-testid="button-sandbox-preview-step-4" onClick={() => { setValidation(''); setStep(3); }} disabled={busy} className="mt-3 w-full text-center text-xs font-semibold text-[#d7b879]/80 underline decoration-[#d7b879]/30 underline-offset-4 transition-colors hover:text-[#d7b879]">Voir la section 4 pour le test Sandbox sans justificatif</button>}</div>
    </motion.div>
  </div>, document.body);
}