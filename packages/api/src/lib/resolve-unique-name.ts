const SUFFIX_PATTERN = / \((\d+)\)$/;

function splitExtension(name: string, isFile: boolean): [string, string] {
  if (!isFile) {
    return [name, ""];
  }
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return [name, ""];
  }
  return [name.slice(0, dot), name.slice(dot)];
}

/**
 * Returns `desired` if it does not collide (case-insensitively) with any name
 * in `existing`, otherwise appends the smallest free ` (n)` suffix. For files
 * the suffix is inserted before the extension: `report.pdf` -> `report (1).pdf`.
 */
export function resolveUniqueName(
  existing: string[],
  desired: string,
  isFile: boolean
): string {
  const taken = new Set(existing.map((name) => name.toLowerCase()));
  if (!taken.has(desired.toLowerCase())) {
    return desired;
  }
  const [base, ext] = splitExtension(desired, isFile);
  const baseWithoutSuffix = base.replace(SUFFIX_PATTERN, "");
  let counter = 1;
  let candidate = `${baseWithoutSuffix} (${counter})${ext}`;
  while (taken.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${baseWithoutSuffix} (${counter})${ext}`;
  }
  return candidate;
}
