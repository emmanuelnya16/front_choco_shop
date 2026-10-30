/**
 * Calcul en direct du ratio de contraste WCAG 2.1 entre deux couleurs (RGB ou Hex).
 * Aucune couleur en dur n'est stockée dans ce fichier.
 */

export interface RgbTuple {
  r: number;
  g: number;
  b: number;
}

export function parseColorToRgb(input: string): RgbTuple {
  const cleaned = input.trim();

  const rgbMatch = cleaned.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  const hex = cleaned.replace(/^[^0-9a-fA-F]+/, '');
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length >= 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  return { r: 0, g: 0, b: 0 };
}

function channelLuminance(value255: number): number {
  const sRGB = value255 / 255;
  return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: RgbTuple): number {
  const r = channelLuminance(rgb.r);
  const g = channelLuminance(rgb.g);
  const b = channelLuminance(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function calculateWcagContrast(colorA: string, colorB: string): number {
  const lumA = relativeLuminance(parseColorToRgb(colorA));
  const lumB = relativeLuminance(parseColorToRgb(colorB));
  const brightest = Math.max(lumA, lumB);
  const darkest = Math.min(lumA, lumB);
  const ratio = (brightest + 0.05) / (darkest + 0.05);
  return Math.round(ratio * 100) / 100;
}
