import { Metadata, Viewport } from 'next';
import { translations, Lang } from './i18n';

/**
 * Generate metadata with translations for a specific page
 */
export function generateMetadata(
  titleKey: keyof typeof translations.en,
  descriptionKey?: keyof typeof translations.en,
  lang: Lang = 'en'
): Metadata {
  const t = translations[lang];
  
  const title = t[titleKey] as string;
  const description = descriptionKey ? (t[descriptionKey] as string) : t.app_description;
  const appName = t.app_name;

  return {
    title: `${title} | ${appName}`,
    description,
  };
}

/**
 * Generate page-specific metadata with app name
 */
export function getPageMetadata(
  page: 'home' | 'auctions' | 'login' | 'register' | 'profile' | 'settings' | 'lots',
  lang: Lang = 'en'
): Metadata {
  const titleKey = `page_title_${page}` as keyof typeof translations.en;
  return generateMetadata(titleKey, 'app_description', lang);
}

/**
 * Default metadata for the application
 */
export function getDefaultMetadata(lang: Lang = 'en'): Metadata {
  const t = translations[lang];
  
  return {
    title: {
      default: t.app_name,
      template: `%s | ${t.app_name}`
    },
    description: t.app_description,
    manifest: "/site.webmanifest",
    icons: {
      icon: [
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
  };
}

/**
 * Default viewport configuration
 */
export function getDefaultViewport(): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#3b82f6',
  };
}
