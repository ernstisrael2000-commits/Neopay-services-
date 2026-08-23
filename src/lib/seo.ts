export const SEO_SITE_URL = 'https://renaservices.shop';

export type SeoPath =
  | '/'
  | '/produits'
  | '/services'
  | '/suivi-colis'
  | '/expedition'
  | '/formations'
  | '/recharge-free-fire'
  | '/abonnements'
  | '/paiements'
  | '/contact'
  | '/a-propos';

export interface SeoPage {
  path: SeoPath;
  title: string;
  description: string;
  h1: string;
}

export const SEO_PAGES: Record<SeoPath, SeoPage> = {
  '/': {
    path: '/',
    title: 'Rena Services | Services numériques en Haïti',
    description: 'Rena Services réunit recharges de jeux, abonnements, paiements, suivi de colis, expédition et formations en ligne pour la clientèle en Haïti.',
    h1: 'Services numériques, paiements et logistique en Haïti',
  },
  '/produits': {
    path: '/produits',
    title: 'Recharges, cartes et abonnements en Haïti | Rena',
    description: 'Découvrez les recharges de jeux, cartes, abonnements numériques et services disponibles sur Rena Services pour les clients en Haïti.',
    h1: 'Recharges, cartes et abonnements numériques',
  },
  '/services': {
    path: '/services',
    title: 'Services numériques et logistiques en Haïti | Rena',
    description: 'Accédez aux services Rena : suivi de colis, expédition internationale, achat en ligne et demandes crypto traitées avec accompagnement.',
    h1: 'Services numériques et logistiques Rena',
  },
  '/suivi-colis': {
    path: '/suivi-colis',
    title: 'Suivi de colis en Haïti | Rena Services',
    description: 'Suivez l’état de votre colis Rena en ligne grâce à votre numéro de suivi, de l’expédition à la livraison en Haïti.',
    h1: 'Suivi de colis Rena en ligne',
  },
  '/expedition': {
    path: '/expedition',
    title: 'Expédition et achat en ligne vers Haïti | Rena',
    description: 'Rena accompagne vos achats en ligne et vos besoins d’expédition internationale vers Haïti avec des solutions adaptées.',
    h1: 'Expédition et achat en ligne vers Haïti',
  },
  '/formations': {
    path: '/formations',
    title: 'Formations en ligne en Haïti | Rena Services',
    description: 'Explorez les formations en ligne Rena pour développer des compétences pratiques, apprendre à votre rythme et suivre votre progression.',
    h1: 'Formations en ligne Rena',
  },
  '/recharge-free-fire': {
    path: '/recharge-free-fire',
    title: 'Recharge Free Fire en Haïti | Rena Services',
    description: 'Rechargez Free Fire depuis Haïti via Rena Services et retrouvez aussi des recharges de jeux et cartes-cadeaux dans le catalogue.',
    h1: 'Recharge Free Fire en Haïti',
  },
  '/abonnements': {
    path: '/abonnements',
    title: 'Abonnements numériques en Haïti | Rena Services',
    description: 'Retrouvez les abonnements numériques proposés par Rena Services, dont des services de streaming selon la disponibilité du catalogue.',
    h1: 'Abonnements numériques disponibles en Haïti',
  },
  '/paiements': {
    path: '/paiements',
    title: 'Paiements et recharges en ligne en Haïti | Rena',
    description: 'Rena Services facilite les paiements, recharges de cartes et services numériques disponibles pour les utilisateurs en Haïti.',
    h1: 'Paiements et recharges en ligne avec Rena',
  },
  '/contact': {
    path: '/contact',
    title: 'Contact et support Rena Services | Haïti',
    description: 'Contactez l’équipe Rena Services par WhatsApp ou e-mail pour obtenir de l’aide sur les recharges, colis, expéditions et services numériques.',
    h1: 'Contacter Rena Services',
  },
  '/a-propos': {
    path: '/a-propos',
    title: 'À propos de Rena Services | Haïti',
    description: 'Découvrez Rena Services, une plateforme qui rassemble services numériques, suivi de colis, expédition et formations pour la clientèle en Haïti.',
    h1: 'À propos de Rena Services',
  },
};

export const SEO_LANDING_PATHS = [
  '/recharge-free-fire',
  '/abonnements',
  '/paiements',
  '/contact',
  '/a-propos',
] as const;

export type SeoLandingPath = typeof SEO_LANDING_PATHS[number];

export function normalizeSeoPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

export function getSeoPage(pathname: string): SeoPage | null {
  return SEO_PAGES[normalizeSeoPath(pathname) as SeoPath] || null;
}

export function getCanonicalUrl(pathname: string): string {
  const path = normalizeSeoPath(pathname);
  return path === '/' ? `${SEO_SITE_URL}/` : `${SEO_SITE_URL}${path}`;
}

export function getStructuredData() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Rena Services',
      url: SEO_SITE_URL,
      logo: `${SEO_SITE_URL}/logo.png`,
      description: 'Services numériques, logistique, suivi de colis, expédition et formations en ligne en Haïti.',
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+50944813185',
        contactType: 'customer service',
        availableLanguage: ['fr', 'ht'],
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Rena Services',
      url: SEO_SITE_URL,
      inLanguage: 'fr-HT',
    },
  ];
}