import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bharatclap.in';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/user/billing', '/provider/earnings'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
