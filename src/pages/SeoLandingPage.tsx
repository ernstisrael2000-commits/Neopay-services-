import { ArrowRight, CheckCircle2, Mail, MessageCircle, PackageSearch, ShieldCheck } from 'lucide-react';
import { SEO_PAGES, SeoLandingPath } from '../lib/seo';

type LandingContent = {
  eyebrow: string;
  intro: string;
  sections: { title: string; body: string }[];
  primaryHref: string;
  primaryLabel: string;
};

const CONTENT: Record<SeoLandingPath, LandingContent> = {
  '/recharge-free-fire': {
    eyebrow: 'Jeux et crédits numériques',
    intro: 'Rena Services propose un catalogue de recharges de jeux. Consultez la disponibilité de Free Fire et des autres offres avant de passer votre commande.',
    sections: [
      { title: 'Comment trouver une recharge', body: 'Ouvrez le catalogue de produits, recherchez Free Fire, puis choisissez l’offre disponible qui correspond à votre compte de jeu.' },
      { title: 'Avant de confirmer', body: 'Vérifiez soigneusement votre identifiant de joueur et le montant choisi. Les données saisies servent au traitement de votre demande.' },
    ],
    primaryHref: '/produits',
    primaryLabel: 'Voir les recharges disponibles',
  },
  '/abonnements': {
    eyebrow: 'Streaming et services numériques',
    intro: 'Le catalogue Rena Services réunit des abonnements numériques et services de streaming selon les disponibilités affichées au moment de la commande.',
    sections: [
      { title: 'Un catalogue mis à jour', body: 'Les offres peuvent évoluer. Consultez le catalogue pour voir les abonnements actuellement proposés et leurs informations.' },
      { title: 'Une commande plus claire', body: 'Avant de finaliser une commande, prenez le temps de vérifier le service sélectionné et les informations demandées dans l’application.' },
    ],
    primaryHref: '/produits',
    primaryLabel: 'Explorer les abonnements',
  },
  '/paiements': {
    eyebrow: 'Recharges et services en ligne',
    intro: 'Rena Services regroupe des recharges de cartes, des services numériques et des options de paiement disponibles pour les utilisateurs en Haïti.',
    sections: [
      { title: 'Choisir le bon service', body: 'Le catalogue indique les produits et services actifs. Sélectionnez uniquement une offre dont les conditions correspondent à votre besoin.' },
      { title: 'Suivre votre demande', body: 'Connectez-vous à votre espace Rena pour consulter les informations relatives à vos opérations et recevoir les mises à jour utiles.' },
    ],
    primaryHref: '/produits',
    primaryLabel: 'Consulter le catalogue',
  },
  '/contact': {
    eyebrow: 'Support Rena Services',
    intro: 'L’équipe Rena Services est disponible pour répondre aux questions concernant les recharges, services numériques, colis et expéditions.',
    sections: [
      { title: 'Assistance WhatsApp', body: 'Utilisez WhatsApp pour demander de l’aide concernant une commande, un suivi de colis ou une offre disponible.' },
      { title: 'Support par e-mail', body: 'Vous pouvez également écrire à l’équipe support. Incluez les détails utiles de votre demande afin de faciliter son traitement.' },
    ],
    primaryHref: 'https://wa.me/50944813185?text=Bonjour%20Rena%20Services%2C%20j%27ai%20besoin%20d%27aide.',
    primaryLabel: 'Contacter sur WhatsApp',
  },
  '/a-propos': {
    eyebrow: 'Rena Services en Haïti',
    intro: 'Rena Services est une plateforme qui rassemble des services numériques, des recharges, le suivi de colis, des solutions d’expédition et des formations en ligne.',
    sections: [
      { title: 'Des services utiles au quotidien', body: 'Le site permet de découvrir les offres actives, de suivre des colis et d’accéder à des solutions adaptées aux besoins des utilisateurs en Haïti.' },
      { title: 'Une navigation centralisée', body: 'Produits, services, formations et suivi sont accessibles depuis une même plateforme afin de simplifier vos démarches.' },
    ],
    primaryHref: '/services',
    primaryLabel: 'Découvrir les services',
  },
};

export default function SeoLandingPage({ path }: { path: SeoLandingPath }) {
  const page = SEO_PAGES[path];
  const content = CONTENT[path];
  const external = content.primaryHref.startsWith('http');

  return (
    <article className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
      <header className="rounded-[2rem] bg-[#102a43] px-6 py-10 text-white shadow-xl shadow-[#102a43]/10 sm:px-10">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">{content.eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">{page.h1}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">{content.intro}</p>
        <a
          href={content.primaryHref}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-[#102a43] transition-transform hover:-translate-y-0.5"
        >
          {content.primaryLabel}<ArrowRight className="h-4 w-4" />
        </a>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Informations utiles">
        {content.sections.map((section, index) => (
          <section key={section.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            {index === 0 ? <PackageSearch className="h-5 w-5 text-primary" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
            <h2 className="mt-4 text-lg font-black text-slate-900">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
          </section>
        ))}
      </section>

      {path === '/contact' && (
        <section className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-6">
          <h2 className="text-lg font-black text-slate-900">Coordonnées de support</h2>
          <div className="mt-4 flex flex-col gap-3 text-sm font-bold text-slate-700 sm:flex-row">
            <a className="inline-flex items-center gap-2 hover:text-primary" href="https://wa.me/50944813185" target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /> WhatsApp : +509 44 81 3185</a>
            <a className="inline-flex items-center gap-2 hover:text-primary" href="mailto:renaservices509@gmail.com"><Mail className="h-4 w-4" /> renaservices509@gmail.com</a>
          </div>
        </section>
      )}

      <nav className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-primary" aria-label="Liens vers les services Rena">
        <a href="/services" className="inline-flex items-center gap-1 hover:underline"><CheckCircle2 className="h-4 w-4" /> Services</a>
        <a href="/suivi-colis" className="inline-flex items-center gap-1 hover:underline"><CheckCircle2 className="h-4 w-4" /> Suivi de colis</a>
        <a href="/expedition" className="inline-flex items-center gap-1 hover:underline"><CheckCircle2 className="h-4 w-4" /> Expédition</a>
        <a href="/formations" className="inline-flex items-center gap-1 hover:underline"><CheckCircle2 className="h-4 w-4" /> Formations</a>
      </nav>
    </article>
  );
}