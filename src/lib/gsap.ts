/**
 * RÈGLES D'UTILISATION DE GSAP DANS DR CHOCO L'INCOMPRIS :
 * 1. Ce fichier est le SEUL endroit où les plugins GSAP sont enregistrés.
 * 2. Il n'est importé QUE par des composants chargés à la demande (pages ou sections lazy).
 *    Il ne doit JAMAIS faire partie du chargement initial (vérifié avec `npm run analyze`).
 * 3. Dans un composant : TOUJOURS `useGSAP(() => { … }, { scope: ref })`.
 *    Jamais de sélecteur global, jamais `useEffect` pour GSAP.
 * 4. Toute animation déclenchée par un événement (appui, clic) passe par `contextSafe`.
 * 5. Chaque effet commence par `if (prefersReducedMotion()) return;` ou affiche directement l'état final.
 * 6. Utiliser `autoAlpha` plutôt que `opacity` pour les apparitions et disparitions.
 * 7. `ScrollTrigger.refresh()` uniquement après un vrai changement de mise en page (images chargées),
 *    jamais à chaque redimensionnement.
 * 8. `gsap.matchMedia()` pour réserver les effets lourds aux grands écrans.
 * 9. `markers: true` seulement pendant le réglage, jamais en production.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin);
gsap.defaults({ ease: 'power3.out', duration: 0.6 });

export { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, useGSAP };
