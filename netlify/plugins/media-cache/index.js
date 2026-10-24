// Netlify local build plugin: persists .cache/media between deploys (spec 004 media-pipeline,
// FR-333). No npm dependency. The cache is an optimization only, so every call is wrapped in
// try/catch and a failure logs a warning instead of failing the build (a miss re-encodes).
//
// API checked 2026-10-24 against:
//   https://docs.netlify.com/extend/develop-and-share/develop-build-plugins/
//     (local plugin: [[plugins]] package = "./…", manifest.yml with `name`, ESM `export const`,
//      onPreBuild runs before the build command, onPostBuild after it and before deploy)
//   https://github.com/netlify/build/blob/main/packages/cache-utils/README.md
//     (utils.cache.restore(path) / save(path) → Promise<boolean>, paths relative to cwd)
// TO VERIFY on a deploy preview (T327): that Netlify loads this local plugin as ESM via the
// sibling package.json, and that cwd is the repo root so '.cache/media' resolves there.

const CACHE_DIR = '.cache/media';

export const onPreBuild = async ({ utils }) => {
  try {
    const restored = await utils.cache.restore(CACHE_DIR);
    console.log(
      restored ? `media cache: restored ${CACHE_DIR}` : 'media cache: empty (cold build)',
    );
  } catch (error) {
    console.warn(`media cache: restore failed, continuing cold (${String(error)})`);
  }
};

export const onPostBuild = async ({ utils }) => {
  try {
    const saved = await utils.cache.save(CACHE_DIR);
    console.log(
      saved ? `media cache: saved ${CACHE_DIR}` : `media cache: ${CACHE_DIR} missing, not saved`,
    );
  } catch (error) {
    console.warn(`media cache: save failed (${String(error)})`);
  }
};
