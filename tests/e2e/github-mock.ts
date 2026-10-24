import type { Page, Request } from '@playwright/test';

/** A fake fine-grained token. The specs assert it never reaches a URL, the console, or the DOM. */
export const TOKEN = 'github_pat_E2E0000000000000000000_mock';

export interface MockReply {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface Scenario {
  readonly user: MockReply | 'abort';
  readonly repo: MockReply | 'abort';
}

const REPO_BODY = {
  full_name: 'ericthayer/ethayer-design-timeline',
  permissions: { admin: true, push: true, pull: true },
};

export const SCENARIOS = {
  ok: {
    user: { status: 200, body: { login: 'ericthayer' } },
    repo: { status: 200, body: REPO_BODY },
  },
  badToken: { user: { status: 401 }, repo: { status: 401 } },
  wrongAccount: {
    user: { status: 200, body: { login: 'someone-else' } },
    repo: { status: 200, body: { ...REPO_BODY, permissions: { push: false, pull: true } } },
  },
  wrongRepo: { user: { status: 200, body: { login: 'ericthayer' } }, repo: { status: 404 } },
  readOnly: {
    user: { status: 200, body: { login: 'ericthayer' } },
    repo: { status: 200, body: { ...REPO_BODY, permissions: { push: false, pull: true } } },
  },
  rateLimited: {
    user: { status: 403, headers: { 'x-ratelimit-remaining': '0', 'retry-after': '120' } },
    repo: { status: 200, body: REPO_BODY },
  },
  network: { user: 'abort', repo: 'abort' },
  githubError: { user: { status: 500 }, repo: { status: 200, body: REPO_BODY } },
} satisfies Record<string, Scenario>;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type, X-GitHub-Api-Version',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE',
  'access-control-expose-headers': 'Retry-After, X-RateLimit-Remaining, X-RateLimit-Reset',
};

export interface GitHubMock {
  /** Every request the page sent to api.github.com, in order. */
  readonly requests: Request[];
  use(scenario: Scenario): void;
}

/**
 * Intercepts https://api.github.com (registered after the fixture's offline route, so it wins).
 * Answers preflights and replies per the current scenario.
 */
export async function mockGitHub(
  page: Page,
  initial: Scenario = SCENARIOS.ok,
): Promise<GitHubMock> {
  let scenario: Scenario = initial;
  const requests: Request[] = [];
  await page.route('https://api.github.com/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    requests.push(request);
    const path = new URL(request.url()).pathname;
    const reply = path === '/user' ? scenario.user : scenario.repo;
    if (reply === 'abort') {
      await route.abort('internetdisconnected');
      return;
    }
    await route.fulfill({
      status: reply.status,
      headers: { ...CORS, 'content-type': 'application/json', ...reply.headers },
      body: JSON.stringify(reply.body ?? { message: 'mock' }),
    });
  });
  return {
    requests,
    use(next) {
      scenario = next;
    },
  };
}

/** Exposes the session from `admin:signed-in` so a spec can drive `authorizedFetch` (US-A5). */
export async function captureSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener('admin:signed-in', (event) => {
      (window as unknown as { __adminSession: unknown }).__adminSession = event.detail;
    });
  });
}
