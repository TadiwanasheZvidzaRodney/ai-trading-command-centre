import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'AI Trading Command Centre',
    short_name: 'ATC',
    description: 'Personal trading research and paper-trading workspace.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#07131a',
    theme_color: '#07131a',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
