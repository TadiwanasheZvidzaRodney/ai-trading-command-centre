import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';

// The repository keeps one .env at the root. Load it when running from apps/web.
loadDotenv({ path: path.resolve(process.cwd(), '../../.env'), quiet: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@atc/shared'],
  agentRules: false,
  async rewrites() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return [
      { source: '/health/:path*', destination: `${apiOrigin}/health/:path*` },
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
    ];
  },
};

export default nextConfig;
