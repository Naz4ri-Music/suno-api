import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/utils';

export const MISSING_SUNO_COOKIE_ERROR =
  'Missing suno_cookie. Provide `suno_cookie` in the request or configure SUNO_COOKIE in the environment.';

function decodeCookieValue(value: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(value))
    return value;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeCookieValue(value: unknown): string | null {
  if (typeof value !== 'string')
    return null;

  const normalized = decodeCookieValue(value.trim());
  return normalized.length > 0 ? normalized : null;
}

export function resolveSunoCookie(
  req: NextRequest,
  payload?: Record<string, any> | FormData | null
): string | null {
  let payloadCookie: string | null = null;

  if (payload instanceof FormData) {
    payloadCookie = normalizeCookieValue(payload.get('suno_cookie'));
  } else if (payload && typeof payload === 'object') {
    payloadCookie = normalizeCookieValue(payload.suno_cookie);
  }

  const url = new URL(req.url);
  const queryCookie = normalizeCookieValue(url.searchParams.get('suno_cookie'));
  const headerCookie =
    normalizeCookieValue(req.headers.get('x-suno-cookie')) ||
    normalizeCookieValue(req.headers.get('suno-cookie'));

  return (
    payloadCookie ||
    queryCookie ||
    headerCookie ||
    normalizeCookieValue(process.env.SUNO_COOKIE) ||
    null
  );
}

export function missingSunoCookieResponse() {
  return new NextResponse(JSON.stringify({ error: MISSING_SUNO_COOKIE_ERROR }), {
    status: 400,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
