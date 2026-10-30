import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { afterEach, beforeEach, vi } from 'vitest';

// Simulation de window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Simulation de navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  configurable: true,
  value: vi.fn().mockReturnValue(true),
});

// Simulation de window.scrollTo pour ScrollRestoration et Element.prototype.scrollIntoView
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  configurable: true,
  value: vi.fn(),
});

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  configurable: true,
  value: vi.fn(),
});

// Simulation de IntersectionObserver pour Motion whileInView
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Simulation de ResizeObserver
class MockResizeObserver implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

// Garantit requestAnimationFrame / cancelAnimationFrame sur globalThis (GSAP ScrollTrigger)
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16) as unknown as number;
}
if (typeof globalThis.cancelAnimationFrame !== 'function') {
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  ScrollTrigger.getAll().forEach((st) => st.kill());
  ScrollTrigger.clearMatchMedia();
});

