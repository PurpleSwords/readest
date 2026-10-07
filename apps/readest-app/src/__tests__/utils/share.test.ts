import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { buildShareUrl, parseShareDeepLink } from '@/utils/share';

beforeEach(() => {
  vi.stubEnv('API_BASE_URL', undefined);
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', undefined);
  vi.stubEnv('SITE_URL', undefined);
});

afterEach(() => {
  delete window.__READEST_RUNTIME_CONFIG;
  vi.unstubAllEnvs();
});

describe('buildShareUrl', () => {
  it('builds the canonical https URL for a token', () => {
    expect(buildShareUrl('aBcDeFgHiJkLmNoPqRsTuV')).toBe(
      'https://web.readest.com/s/aBcDeFgHiJkLmNoPqRsTuV',
    );
  });

  it('uses browser runtime config over build-time config and trims trailing slashes', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://web.readest.com');
    window.__READEST_RUNTIME_CONFIG = { apiBaseUrl: 'https://books.example.com///' };
    expect(buildShareUrl('aBcDeFgHiJkLmNoPqRsTuV')).toBe(
      'https://books.example.com/s/aBcDeFgHiJkLmNoPqRsTuV',
    );
    window.__READEST_RUNTIME_CONFIG.apiBaseUrl = 'https://other.example.com';
    expect(buildShareUrl('aBcDeFgHiJkLmNoPqRsTuV')).toBe(
      'https://other.example.com/s/aBcDeFgHiJkLmNoPqRsTuV',
    );
  });

  it.each([
    'API_BASE_URL',
    'NEXT_PUBLIC_API_BASE_URL',
    'SITE_URL',
  ])('uses %s when no browser config is injected', (name) => {
    vi.stubEnv(name, 'http://localhost:3000/');
    expect(buildShareUrl('aBcDeFgHiJkLmNoPqRsTuV')).toBe(
      'http://localhost:3000/s/aBcDeFgHiJkLmNoPqRsTuV',
    );
  });

  it('prefers runtime server config over build-time config', () => {
    vi.stubEnv('API_BASE_URL', 'https://books.example.com');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://web.readest.com');
    expect(buildShareUrl('aBcDeFgHiJkLmNoPqRsTuV')).toBe(
      'https://books.example.com/s/aBcDeFgHiJkLmNoPqRsTuV',
    );
  });
});

describe('parseShareDeepLink', () => {
  const VALID_TOKEN = 'aBcDeFgHiJkLmNoPqRsTuV';

  it('does not throw or trust other hosts when the configured URL is malformed', () => {
    window.__READEST_RUNTIME_CONFIG = { apiBaseUrl: 'not-a-url' };
    expect(parseShareDeepLink(`https://evil.example.com/s/${VALID_TOKEN}`)).toBeNull();
    expect(parseShareDeepLink(`https://staging.readest.com/s/${VALID_TOKEN}`)).toEqual({
      token: VALID_TOKEN,
    });
  });

  it('accepts only the configured self-hosted host and port', () => {
    window.__READEST_RUNTIME_CONFIG = { apiBaseUrl: 'https://books.example.com:8443/' };
    expect(parseShareDeepLink(buildShareUrl(VALID_TOKEN))).toEqual({ token: VALID_TOKEN });
    expect(parseShareDeepLink(`https://books.example.com:8443/s/${VALID_TOKEN}`)).toEqual({
      token: VALID_TOKEN,
    });
    expect(parseShareDeepLink(`https://books.example.com/s/${VALID_TOKEN}`)).toBeNull();
    expect(
      parseShareDeepLink(`https://books.example.com.evil.test:8443/s/${VALID_TOKEN}`),
    ).toBeNull();
    expect(parseShareDeepLink(`https://other.example.com:8443/s/${VALID_TOKEN}`)).toBeNull();
  });

  it('parses readest://share/{token}', () => {
    expect(parseShareDeepLink(`readest://share/${VALID_TOKEN}`)).toEqual({ token: VALID_TOKEN });
  });

  it('parses https://web.readest.com/s/{token}', () => {
    expect(parseShareDeepLink(`https://web.readest.com/s/${VALID_TOKEN}`)).toEqual({
      token: VALID_TOKEN,
    });
  });

  it('parses *.readest.com subdomains for preview deploys', () => {
    expect(parseShareDeepLink(`https://staging.readest.com/s/${VALID_TOKEN}`)).toEqual({
      token: VALID_TOKEN,
    });
  });

  it('rejects tokens of the wrong length', () => {
    expect(parseShareDeepLink('readest://share/short')).toBeNull();
    expect(parseShareDeepLink(`readest://share/${VALID_TOKEN}extra`)).toBeNull();
  });

  it('rejects tokens with disallowed characters', () => {
    // Underscore and hyphen are explicitly NOT in the alphabet.
    const bad = 'aBcDeFgHiJkLmNoPqRsTu-';
    expect(parseShareDeepLink(`readest://share/${bad}`)).toBeNull();
  });

  it('rejects URLs from third-party hosts', () => {
    expect(parseShareDeepLink(`https://evil.example.com/s/${VALID_TOKEN}`)).toBeNull();
  });

  it('rejects readest:// URLs whose host is not "share"', () => {
    expect(parseShareDeepLink(`readest://book/${VALID_TOKEN}`)).toBeNull();
    expect(parseShareDeepLink(`readest://annotation/${VALID_TOKEN}`)).toBeNull();
  });

  it('rejects nested or extra path segments', () => {
    expect(parseShareDeepLink(`https://web.readest.com/s/${VALID_TOKEN}/extra`)).toBeNull();
    expect(parseShareDeepLink(`https://web.readest.com/extra/s/${VALID_TOKEN}`)).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseShareDeepLink('')).toBeNull();
    expect(parseShareDeepLink('not-a-url')).toBeNull();
    expect(parseShareDeepLink('ftp://web.readest.com/s/' + VALID_TOKEN)).toBeNull();
  });
});
