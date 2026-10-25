// Content file paths and the one serializer every write goes through (spec 004 content-json, FR-308).

export const CONTENT_DIR = 'src/content/data';
export const PROJECTS_DIR = `${CONTENT_DIR}/projects`;

/** The repo path of a project's file. The file name is the slug (FR-300). */
export const projectFile = (slug: string): string => `${PROJECTS_DIR}/${slug}.json`;

export const CONTENT_FILES = {
  order: `${CONTENT_DIR}/order.json`,
  eras: `${CONTENT_DIR}/eras.json`,
  site: `${CONTENT_DIR}/site.json`,
  resume: `${CONTENT_DIR}/resume.json`,
} as const;

const PROJECT_FILE = /^src\/content\/data\/projects\/([^/]+)\.json$/;

/** The slug a project path names, or `null` when `path` is not a project file. */
export function slugOfFile(path: string): string | null {
  return PROJECT_FILE.exec(path)?.[1] ?? null;
}

/** Two-space JSON with a trailing newline. Every content write uses this (FR-308). */
export function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
