import { getCoreDictionary, getDictionary } from "../src/i18n/dictionaries";
import { appModulesByLocale, listAppModuleLeafPaths } from "../src/i18n/app-modules";

function leaves(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return leaves(value[0], `${prefix}[]`);
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

const coreKeys = leaves(getCoreDictionary("en")).length;
const moduleKeys = listAppModuleLeafPaths(appModulesByLocale.en).length;
const mergedKeys = leaves(getDictionary("en")).length;
console.log(JSON.stringify({ coreKeys, moduleKeys, mergedKeys }, null, 2));
