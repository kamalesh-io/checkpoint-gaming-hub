export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export function parseSemver(v: string): SemverParts {
  const clean = v.replace(/^v/i, '').trim();
  const [core, prerelease] = clean.split('-');
  const [major = 0, minor = 0, patch = 0] = (core || '0.0.0')
    .split('.')
    .map((num) => parseInt(num, 10) || 0);

  return { major, minor, patch, prerelease };
}

export function compareSemver(v1: string, v2: string): number {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;

  // Prerelease comparison: non-prerelease > prerelease
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && !p2.prerelease) return -1;
  if (p1.prerelease && p2.prerelease) {
    return p1.prerelease.localeCompare(p2.prerelease);
  }

  return 0;
}
