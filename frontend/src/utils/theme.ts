export interface ResolvedAccentPalette {
  token: string;
  hex: string;
  ink: string;
  rgb: string;
}

export const KNOWN_ACCENT_PALETTES: Record<string, ResolvedAccentPalette> = {
  primary: {
    token: 'primary',
    hex: '#66B8FF',
    ink: '#111722',
    rgb: '102, 184, 255',
  },
  'accent-gold': {
    token: 'accent-gold',
    hex: '#E0B45A',
    ink: '#111722',
    rgb: '224, 180, 90',
  },
  'accent-amber': {
    token: 'accent-amber',
    hex: '#F09B4B',
    ink: '#111722',
    rgb: '240, 155, 75',
  },
  'accent-blue': {
    token: 'accent-blue',
    hex: '#5BA8FF',
    ink: '#111722',
    rgb: '91, 168, 255',
  },
  'accent-yellow': {
    token: 'accent-yellow',
    hex: '#F5DF4D',
    ink: '#111722',
    rgb: '245, 223, 77',
  },
};

export function resolveKnownGameAccent(
  title?: string | null,
  backendToken?: string | null,
): ResolvedAccentPalette | null {
  if (backendToken && backendToken !== 'primary') {
    const preset = KNOWN_ACCENT_PALETTES[backendToken];
    if (preset) return preset;
  }
  const t = (title || '').toLowerCase();
  if (
    t.includes('elden ring') ||
    t.includes('dark souls') ||
    t.includes("demon's souls") ||
    t.includes('souls') ||
    t.includes('witcher') ||
    t.includes('zelda') ||
    t.includes('sekiro') ||
    t.includes('final fantasy')
  ) {
    return KNOWN_ACCENT_PALETTES['accent-gold'] ?? KNOWN_ACCENT_PALETTES.primary!;
  }
  if (
    t.includes('metro') ||
    t.includes('fallout') ||
    t.includes('stalker') ||
    t.includes('s.t.a.l.k.e.r.') ||
    t.includes('doom') ||
    t.includes('god of war') ||
    t.includes('hades') ||
    t.includes('red dead') ||
    t.includes('rdr') ||
    t.includes('horizon') ||
    t.includes('resident evil') ||
    t.includes('dead space')
  ) {
    return KNOWN_ACCENT_PALETTES['accent-amber'] ?? KNOWN_ACCENT_PALETTES.primary!;
  }
  if (
    t.includes('watch dogs') ||
    t.includes('watch_dogs') ||
    t.includes('deus ex') ||
    t.includes('death stranding') ||
    t.includes('spider-man') ||
    t.includes('spiderman') ||
    t.includes('batman') ||
    t.includes('halo') ||
    t.includes('control') ||
    t.includes('destiny') ||
    t.includes('portal') ||
    t.includes('half-life')
  ) {
    return KNOWN_ACCENT_PALETTES['accent-blue'] ?? KNOWN_ACCENT_PALETTES.primary!;
  }
  if (
    t.includes('cyberpunk') ||
    t.includes('phantom liberty') ||
    t.includes('neon') ||
    t.includes('borderlands') ||
    t.includes("mirror's edge") ||
    t.includes('persona') ||
    t.includes('last of us') ||
    t.includes('ghost of tsushima') ||
    t.includes('starfield')
  ) {
    return KNOWN_ACCENT_PALETTES['accent-yellow'] ?? KNOWN_ACCENT_PALETTES.primary!;
  }
  return null;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function rgbToHex(r: number, g: number, b: number): string {
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

const extractedPaletteCache = new Map<string, ResolvedAccentPalette>();

/**
 * Samples vibrant dominant color from a game artwork image using an offscreen canvas,
 * brightening if needed so accents maintain crisp readability over #111722.
 */
export async function extractAccentFromArtwork(src: string): Promise<ResolvedAccentPalette> {
  const cached = extractedPaletteCache.get(src);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 24;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(KNOWN_ACCENT_PALETTES.primary!);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let bestScore = -1;
        let bestR = 102;
        let bestG = 184;
        let bestB = 255;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const a = data[i + 3] ?? 0;
          if (a < 200) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const sat = max === 0 ? 0 : delta / max;
          const lum = relativeLuminance(r, g, b);

          if (lum < 0.08 || lum > 0.88 || sat < 0.28) continue;

          const score = sat * 2.0 + (0.55 - Math.abs(lum - 0.45));
          if (score > bestScore) {
            bestScore = score;
            bestR = r;
            bestG = g;
            bestB = b;
          }
        }

        if (bestScore < 0) {
          resolve(KNOWN_ACCENT_PALETTES.primary!);
          return;
        }

        // Lift brightness slightly if accent is too dark for dark-UI contrast
        let lum = relativeLuminance(bestR, bestG, bestB);
        if (lum < 0.25) {
          const lift = 1.45;
          bestR = Math.min(255, Math.round(bestR * lift + 28));
          bestG = Math.min(255, Math.round(bestG * lift + 28));
          bestB = Math.min(255, Math.round(bestB * lift + 28));
          lum = relativeLuminance(bestR, bestG, bestB);
        }

        const ink = lum > 0.32 ? '#111722' : '#F4F7FC';
        const palette: ResolvedAccentPalette = {
          token: 'dynamic',
          hex: rgbToHex(bestR, bestG, bestB),
          ink,
          rgb: `${bestR}, ${bestG}, ${bestB}`,
        };

        if (extractedPaletteCache.size > 48) {
          const firstKey = extractedPaletteCache.keys().next().value;
          if (firstKey) extractedPaletteCache.delete(firstKey);
        }
        extractedPaletteCache.set(src, palette);
        resolve(palette);
      } catch {
        resolve(KNOWN_ACCENT_PALETTES.primary!);
      }
    };
    img.onerror = () => resolve(KNOWN_ACCENT_PALETTES.primary!);
    img.src = src;
  });
}

export function applyCssAccentVariables(palette: ResolvedAccentPalette): void {
  const root = document.documentElement;
  root.style.setProperty('--accent-active', palette.hex);
  root.style.setProperty('--accent-active-ink', palette.ink);
  root.style.setProperty('--accent-active-rgb', palette.rgb);
}
