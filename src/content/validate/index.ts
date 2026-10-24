// The content validator's public interface (spec 004 content-json, FR-305). Other modules import
// only this file. Never import it from public-site code (FR-304): it ships in tests, the build
// gate, and the admin chunk only.
export { validateContent, type ContentBundle } from './composition.ts';
export { validateProject } from './project.ts';
export {
  JsonParseFailure,
  RULE_IDS,
  parseJson,
  severityOf,
  type Issue,
  type RawContent,
  type RuleId,
  type Severity,
  type Validated,
  type ValidationContext,
} from './issue.ts';
