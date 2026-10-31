import logo128 from '@/assets/brand/logo-choco-128.webp';
import logo192 from '@/assets/brand/logo-choco-192.webp';
import logo64 from '@/assets/brand/logo-choco-64.webp';

/** Emblème officiel du client (public/images/logo_choco.jpg), préparé par scripts/prepare-logo.mjs. */
export const LOGO_EMBLEM_SRC = logo192;
export const LOGO_EMBLEM_SRC_SMALL = logo128;
export const LOGO_EMBLEM_SRCSET = `${logo64} 64w, ${logo128} 128w, ${logo192} 192w`;
