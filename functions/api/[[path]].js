/**
 * Cloudflare Pages Function — proxies every /api/* request to the Fly.io backend.
 *
 * This runs at the Cloudflare edge and transparently forwards API calls, so the
 * browser sees same-origin requests (no CORS preflight, no backend URL leaked).
 *
 * File-based routing: the [[path]] catch-all matches every path segment after
 * /api/ — e.g. /api/buses/vehicles?routes=22 → proxied to Fly preserving both
 * the path and the query string.
 */

const BACKEND_ORIGIN = "https://bus-tracker-zgwfga.fly.dev";

export async function onRequest(context) {
  const { request } = context;
  const incomingUrl = new URL(request.url);

  // Reconstruct the backend URL, preserving pathname + query
  const backendUrl = BACKEND_ORIGIN + incomingUrl.pathname + incomingUrl.search;

  // Clone headers and drop hop-by-hop headers that shouldn't be forwarded
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");
  headers.delete("x-forwarded-proto");

  try {
    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "follow",
    });

    // Stream the response back, preserving status + headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Backend proxy failed",
        message: err instanceof Error ? err.message : String(err),
        backend: backendUrl,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
