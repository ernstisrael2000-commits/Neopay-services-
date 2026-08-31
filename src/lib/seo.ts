export const SEO_SITE_URL = 'https://solutionpam.com';

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
    title: 'Solution Pam (Solutionpam) | Services en Haïti',
    description: 'Solution Pam, aussi appelé Solutionpam, réunit recharges de jeux, abonnements, paiements, suivi de colis, expédition et formations en Haïti.',
    h1: 'Services numériques, paiements et logistique en Haïti',
  },
  '/produits': {
    path: '/produits',
    title: 'Recharges, cartes et abonnements en Haïti | Solutionpam',
    description: 'Découvrez les recharges de jeux, cartes, abonnements numériques et services disponibles sur Solutionpam pour les clients en Haïti.',
    h1: 'Recharges, cartes et abonnements numériques',
  },
  '/services': {
    path: '/services',
    title: 'Services numériques et logistiques en Haïti | Solutionpam',
    description: 'Accédez aux services Solutionpam : cartes virtuelles, suivi de colis, expédition internationale, achat en ligne et demandes crypto traitées avec accompagnement.',
    h1: 'Services numériques et logistiques Solutionpam',
  },
  '/suivi-colis': {
    path: '/suivi-colis',
    title: 'Suivi de colis en Haïti | Solutionpam',
    description: 'Suivez l’état de votre colis Solutionpam en ligne grâce à votre numéro de suivi, de l’expédition à la livraison en Haïti.',
    h1: 'Suivi de colis Solutionpam en ligne',
  },
  '/expedition': {
    path: '/expedition',
    title: 'Expédition et achat en ligne vers Haïti | Solutionpam',
    description: 'Solutionpam accompagne vos achats en ligne et vos besoins d’expédition internationale vers Haïti avec des solutions adaptées.',
    h1: 'Expédition et achat en ligne vers Haïti',
  },
  '/formations': {
    path: '/formations',
    title: 'Formations en ligne en Haïti | Solutionpam',
    description: 'Explorez les formations en ligne Solutionpam pour développer des compétences pratiques, apprendre à votre rythme et suivre votre progression.',
    h1: 'Formations en ligne Solutionpam',
  },
  '/recharge-free-fire': {
    path: '/recharge-free-fire',
    title: 'Recharge Free Fire en Haïti | Solutionpam',
    description: 'Rechargez Free Fire depuis Haïti via Solutionpam et retrouvez aussi des recharges de jeux et cartes-cadeaux dans le catalogue.',
    h1: 'Recharge Free Fire en Haïti',
  },
  '/abonnements': {
    path: '/abonnements',
    title: 'Abonnements numériques en Haïti | Solutionpam',
    description: 'Retrouvez les abonnements numériques proposés par Solutionpam, dont des services de streaming selon la disponibilité du catalogue.',
    h1: 'Abonnements numériques disponibles en Haïti',
  },
  '/paiements': {
    path: '/paiements',
    title: 'Paiements et recharges en ligne en Haïti | Solutionpam',
    description: 'Solutionpam facilite les paiements, recharges de cartes et services numériques disponibles pour les utilisateurs en Haïti.',
    h1: 'Paiements et recharges en ligne avec Solutionpam',
  },
  '/contact': {
    path: '/contact',
    title: 'Contact et support Solutionpam | Haïti',
    description: 'Contactez l’équipe Solutionpam par WhatsApp ou e-mail pour obtenir de l’aide sur les recharges, colis, expéditions et services numériques.',
    h1: 'Contacter Solutionpam',
  },
  '/a-propos': {
    path: '/a-propos',
    title: 'À propos de Solutionpam | Haïti',
    description: 'Découvrez Solutionpam, une plateforme qui rassemble services numériques, suivi de colis, expédition et formations pour la clientèle en Haïti.',
    h1: 'À propos de Solutionpam',
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
      name: 'Solutionpam',
      alternateName: 'Solution Pam',
      url: SEO_SITE_URL,
      logo: `${SEO_SITE_URL}/solutionpam-site-logo.jpg`,
      image: `${SEO_SITE_URL}/solutionpam-site-logo.jpg`,
      description: 'Solution Pam (Solutionpam) propose des services numériques, de logistique, de suivi de colis, d’expédition et de formations en ligne en Haïti.',
      areaServed: {
        '@type': 'Country',
        name: 'Haïti',
      },
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
      name: 'Solutionpam',
      alternateName: 'Solution Pam',
      url: SEO_SITE_URL,
      inLanguage: 'fr-HT',
    },
  ];
}