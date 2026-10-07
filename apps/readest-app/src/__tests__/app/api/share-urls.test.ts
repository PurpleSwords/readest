// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, resolveActiveShareMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  resolveActiveShareMock: vi.fn(),
}));

vi.mock('@/utils/supabase', () => ({
  createSupabaseAdminClient: () => ({ from: fromMock }),
}));
vi.mock('@/utils/access', () => ({
  validateUserAndToken: async () => ({ user: { id: 'test-user' }, token: 'auth-token' }),
}));
vi.mock('@/utils/object', () => ({ objectExists: async () => true }));
vi.mock('@/libs/shareServer', () => ({
  generateShareToken: async () => ({ raw: 'aBcDeFgHiJkLmNoPqRsTuV', hash: 'token-hash' }),
  resolveActiveShare: resolveActiveShareMock,
}));
vi.mock('@/app/s/ShareLanding', () => ({ default: () => null }));

import { POST } from '@/app/api/share/create/route';
import { GET } from '@/app/api/share/list/route';
import { generateMetadata } from '@/app/s/page';

const TOKEN = 'aBcDeFgHiJkLmNoPqRsTuV';
const SITE = 'https://books.example.com';

beforeEach(() => {
  vi.stubEnv('API_BASE_URL', `${SITE}/`);
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://web.readest.com');
  vi.stubEnv('NEXT_PUBLIC_APP_PLATFORM', 'web');
  fromMock.mockReset();
  resolveActiveShareMock.mockReset().mockResolvedValue({
    ok: true,
    share: { bookTitle: 'Example book', bookAuthor: 'Example author' },
  });
});

afterEach(() => vi.unstubAllEnvs());

describe('self-hosted share URLs', () => {
  it('returns the public URL when creating a share, ignoring the internal request host', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockResolvedValue({ count: 0, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    fromMock.mockImplementation((table: string) => {
      if (table === 'files') {
        return {
          ...query,
          is: vi.fn().mockResolvedValue({
            data: [{ file_key: 'books/example.epub', file_size: 1024 }],
            error: null,
          }),
        };
      }
      return query;
    });
    const response = await POST(
      new Request('http://client:3000/api/share/create', {
        method: 'POST',
        body: JSON.stringify({
          bookHash: 'book-hash',
          title: 'Example book',
          format: 'epub',
          expirationDays: 1,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ token: TOKEN, url: `${SITE}/s/${TOKEN}` });
  });

  it('returns the same public base for previously created shares', async () => {
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const response = await GET(new Request('http://client:3000/api/share/list'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ shareUrlBase: `${SITE}/s` });
  });

  it('uses the public site for the landing page URL and preview images', async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ token: TOKEN }) });
    expect(metadata.openGraph).toMatchObject({
      url: `${SITE}/s/${TOKEN}`,
      images: [{ url: `${SITE}/api/share/${TOKEN}/og.png` }],
    });
    expect(metadata.twitter).toMatchObject({ images: [`${SITE}/api/share/${TOKEN}/og.png`] });
  });
});
