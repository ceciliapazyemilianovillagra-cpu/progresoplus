import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return { name: 'PROGRESO+', short_name: 'PROGRESO+', description: 'Tu espacio para organizar lo importante.', start_url: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#063b2a', orientation: 'portrait-primary', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] };
}

