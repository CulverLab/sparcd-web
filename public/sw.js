/**
 * SPARCd Service Worker
 *
 * Responsibilities:
 *   - Cache the app shell for fast load and offline availability
 *   - Serve cached static assets when offline
 *   - Notify the page when connectivity is lost or restored during an upload
 *
 * Explicitly NOT responsible for:
 *   - Upload retries (owned by useChunkUpload in the React layer)
 *   - Queuing or replaying FormData/File requests across sessions
 */

const CACHE_NAME = 'sparcd-shell-v2';

// Static assets that form the app shell - these are cached on install
// Next.js hashes JS/CSS filenames on build so we cache by pattern at runtime
// rather than listing specific filenames here
const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
];

// API route prefixes that should never be served from cache
const API_PREFIXES = [
  '/sandboxFile',
  '/sandboxNew',
  '/sandboxPrev',
  '/sandboxReset',
  '/sandboxAbandon',
  '/sandboxCheckContinueUpload',
  '/sandboxUnloadedFiles',
  '/sandboxCounts',
  '/sandboxCompleted',
  '/sandboxStats',
  '/sandboxRecoveryUpdate',
  '/setUploadComplete',
  '/login',
  '/logout',
];

/**
 * Returns true if the request URL matches a known API route that must
 * always go to the network and must never be cached.
 */
function isApiRequest(url) {
  const pathname = new URL(url).pathname;
  return API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Returns true if the request looks like a Next.js hashed static asset
 * (JS, CSS, fonts, images in /_next/static/) that is safe to cache
 * aggressively because the filename changes whenever the content changes.
 */
function isHashedStaticAsset(url) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
  //const u = new URL(url);
  //if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return false;
  //return u.pathname.startsWith('/_next/static/');
}

// ─── Install ────────────────────────────────────────────────────────────────
// Cache the shell URLs immediately. skipWaiting() activates the new service
// worker as soon as it finishes installing rather than waiting for all tabs
// running the old version to close.

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────
// Delete any caches from previous versions of this service worker.
// clients.claim() lets the newly activated SW take control of open tabs
// immediately without requiring a page reload.

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
// Three strategies depending on request type:
//
//   API requests      → network only, never cache, never intercept retry logic
//   Hashed assets     → cache first (filename guarantees freshness)
//   Everything else   → network first, fall back to cache (shell routes, icons)

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests - POST/PUT uploads go straight to network
  if (request.method !== 'GET') {
    return;
  }

  // API routes: network only, no caching
  if (isApiRequest(request.url)) {
    return;
  }

  // Hashed Next.js static assets: cache first
  if (isHashedStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Only cache valid responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
          return response;
        });
      })
    );
    return;
  }

  // Shell routes and everything else: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful shell responses for offline fallback
        if (response && response.status === 200 && response.type === 'basic') {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
        }
        return response;
      })
      .catch(() => {
        // Network failed - serve from cache if available
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // For navigation requests with no cache, return the cached root
          // so the app shell loads and can show an offline message
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
