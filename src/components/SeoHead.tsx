import { useEffect } from 'react';
import { getCanonicalUrl, getSeoPage, getStructuredData, SEO_SITE_URL } from '../lib/seo';

function setMeta(selector: string, value: string) {
  const element = document.head.querySelector<HTMLMetaElement>(selector);
  if (element) element.content = value;
}

export default function SeoHead({ pathname, indexable = true }: { pathname: string; indexable?: boolean }) {
  useEffect(() => {
    const page = getSeoPage(pathname);
    const canonical = page ? getCanonicalUrl(page.path) : SEO_SITE_URL;
    const title = page?.title || 'Espace sécurisé | Rena Services';
    const description = page?.description || 'Espace sécurisé de Rena Services.';

    document.title = title;
    document.documentElement.lang = 'fr';
    setMeta('meta[name="description"]', description);
    setMeta('meta[name="robots"]', indexable && page ? 'index, follow' : 'noindex, nofollow');
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:url"]', canonical);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);

    const canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalLink) canonicalLink.href = canonical;

    const schema = document.getElementById('seo-structured-data');
    if (schema) schema.textContent = JSON.stringify(getStructuredData()).replace(/</g, '\\u003c');
  }, [pathname, indexable]);

  return null;
}