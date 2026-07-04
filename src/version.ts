/**
 * Single source of truth for the tool version, kept in sync with package.json
 * by version.test.ts. Bump both together (npm version updates package.json;
 * update this constant in the same commit).
 */
export const VERSION = "0.1.0";
