import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import * as github from '../../../src/core/github/index.ts';

describe('public surface (FR-360)', () => {
  it('exports the FR-360 functions plus the FR-364 limits and the D3 link', () => {
    expect(Object.keys(github).sort()).toEqual([
      'DEPLOYS_URL',
      'MEDIA_EXTENSIONS',
      'PUBLISH_LIMITS',
      'commitMessage',
      'publish',
      'readFile',
      'readHead',
      'watchDeploy',
    ]);
  });
});

describe('isolation lint (FR-376, FR-377)', () => {
  const eslint = new ESLint();
  const restricted = async (filePath: string, source: string): Promise<string[]> => {
    const [result] = await eslint.lintText(source, { filePath });
    return (result?.messages ?? [])
      .filter((m) => m.ruleId === 'no-restricted-imports')
      .map((m) => m.message);
  };

  it.each([
    ['src/components/project-card/project-card.ts', '../../core/github/index.ts'],
    ['src/core/order.ts', './github/publish.ts'],
    ['src/main.ts', './core/github/index.ts'],
  ])(
    'blocks %s from importing %s',
    async (file, specifier) => {
      const messages = await restricted(
        file,
        `import { publish } from '${specifier}';\nvoid publish;\n`,
      );
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('admin-only');
    },
    30_000,
  );

  it('lets admin code import it', async () => {
    const source = "import { publish } from '../core/github/index.ts';\nvoid publish;\n";
    expect(await restricted('src/admin/entry.ts', source)).toEqual([]);
  }, 30_000);

  it('makes console an error inside the module', async () => {
    const config = (await eslint.calculateConfigForFile('src/core/github/publish.ts')) as {
      rules: Record<string, unknown[]>;
    };
    expect(config.rules['no-console']?.[0]).toBe(2);
  }, 30_000);
});
