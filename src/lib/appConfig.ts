const normalizeBasePath = (value?: string | null): string => {
  if (!value)
    return '';

  const trimmed = value.trim();
  if (!trimmed || trimmed === '/')
    return '';

  const normalized = `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '' : normalized;
};

export const appBasePath = normalizeBasePath(
  process.env.NEXT_PUBLIC_BASE_PATH || process.env.APP_BASE_PATH
);

export const withBasePath = (pathname: string): string => {
  if (!pathname)
    return appBasePath || '/';

  if (/^https?:\/\//i.test(pathname))
    return pathname;

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return appBasePath ? `${appBasePath}${normalizedPath}` : normalizedPath;
};
