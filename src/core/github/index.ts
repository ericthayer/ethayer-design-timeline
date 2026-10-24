// github-publish public surface (spec 004 github-publish FR-360). Admin-only: public code never
// imports this module (FR-377, enforced by lint and `npm run budgets`).
export { readFile, readHead } from './client.ts';
export { watchDeploy } from './deploy.ts';
export { DEPLOYS_URL } from './deploy-state.ts';
export { commitMessage } from './message.ts';
export { MEDIA_EXTENSIONS, PUBLISH_LIMITS } from './paths.ts';
export { publish } from './publish.ts';
export type {
  ConflictReason,
  DeployState,
  FileChange,
  GitHubError,
  HeadResult,
  InvalidReason,
  PublishRequest,
  PublishResult,
  ReadFileResult,
  WatchOptions,
} from './types.ts';
