const normalizeBasePath = (value) => {
  if (!value)
    return '';

  const trimmed = value.trim();
  if (!trimmed || trimmed === '/')
    return '';

  const normalized = `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '' : normalized;
};

const basePath = normalizeBasePath(process.env.APP_BASE_PATH);

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(ttf|html)$/i,
      type: 'asset/resource'
    });
    return config;
  },
  experimental: {
    serverMinification: false, // the server minification unfortunately breaks the selector class names
  },
};  

export default nextConfig;
