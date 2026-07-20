/**
 * haitiFilter.ts
 * Filtres de région partagés : jeux top-up FazerCards et gift cards.
 * Seuls les tags entre parenthèses sont testés (ex. "(ID)", "(JP)").
 * Tout ce qui est Global / US / LATAM / sans tag reste visible.
 */

// ── Jeux (top-ups FazerCards) ─────────────────────────────────────────────────
export const GAMES_EXCLUDED: string[] = [
  '(EU)', '(Europe)', '(CIS)',
  '(ID)', '(Indonesia)',
  '(TH)', '(Thailand)',
  '(MY)', '(Malaysia)', '(SG/MY)', '(MY/SG)',
  '(SG)', '(Singapore)',
  '(SEA)',
  '(PH)', '(Philippines)',
  '(VN)', '(Vietnam)',
  '(TW)', '(Taiwan)', '(HK)', '(HK/MO)', '(TW/HK/MO)',
  '(MENA)',
  '(BD)', '(PK)', '(IN)', '(India)',
  '(SA)', '(KZ)',
  '(RU)', '(Russia)', '(Turkey)',
  '(Asia)', '(Black Clover M (Asia))',
  ' (KH)', ' VNG',
  '(JP)', '(Japan)',
  '(KR)', '(Korea)',
  '(CN)', '(China)',
  '(AU)', '(Australia)',
  '(BR)', '(Brazil)',
  '(TR)',
  '(ZA)',
];

export function isGameAvailableInHaiti(name: string): boolean {
  return !GAMES_EXCLUDED.some(tag => name.includes(tag));
}

// ── Gift Cards ────────────────────────────────────────────────────────────────
export const GIFT_EXCLUDED: string[] = [
  // Asie Pacifique
  '(JP)', '(Japan)', '(JPN)',
  '(KR)', '(Korea)',
  '(CN)', '(China)',
  '(TW)', '(Taiwan)', '(HK)', '(HK/MO)', '(TW/HK/MO)',
  '(ID)', '(Indonesia)',
  '(MY)', '(Malaysia)', '(MY/SG)', '(SG/MY)',
  '(SG)', '(Singapore)',
  '(PH)', '(Philippines)',
  '(TH)', '(Thailand)',
  '(VN)', '(Vietnam)',
  '(SEA)',
  '(AU)', '(Australia)', '(NZ)',
  // Europe
  '(EU)', '(Europe)',
  '(UK)', '(GB)', '(IE)',
  '(DE)', '(AT)', '(CH)',
  '(FR)',
  '(NL)', '(BE)',
  '(IT)',
  '(ES)', '(PT)',
  '(PL)', '(CZ)', '(HU)', '(RO)', '(SK)',
  '(SE)', '(NO)', '(DK)', '(FI)',
  '(RU)', '(Russia)', '(CIS)',
  // Moyen-Orient / Afrique
  '(MENA)', '(SA)', '(AE)', '(IL)', '(TR)', '(Turkey)',
  '(ZA)', '(Africa)',
  // Asie du Sud
  '(IN)', '(India)', '(BD)', '(PK)', '(KZ)',
  // Amérique du Sud (devises locales uniquement)
  '(BR)', '(Brazil)', '(AR)', '(CL)', '(CO)', '(PE)',
];

export function isGiftCardAvailableInHaiti(name: string): boolean {
  return !GIFT_EXCLUDED.some(tag => name.includes(tag));
}
