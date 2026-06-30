// Extends app.json. Injects a base URL for subpath hosting (GitHub Pages) from
// the EXPO_BASE_URL env var, so local dev stays at the root and CI builds under
// /WeeklyMeals. Everything else comes straight from app.json.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments ?? {}),
    baseUrl: process.env.EXPO_BASE_URL ?? config.experiments?.baseUrl,
  },
});
