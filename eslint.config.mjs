import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships native flat configs, so these are spread
 * directly. Routing them through FlatCompat (the Next 15 pattern) throws a
 * "Converting circular structure to JSON" error on this version.
 */
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      // Staging copies of the original three food-delivery projects, kept for
      // reference during the port. Not part of the app.
      "_admin_src/**",
      "_backend_src/**",
    ],
  },
];

export default eslintConfig;
