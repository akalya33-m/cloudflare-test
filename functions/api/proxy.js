export async function onRequestGet(context) {
  const { request, env } = context;
  
  // Extract client IP provided by Cloudflare
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateLimitKey = `rate_${ip}`;

  // Check Cloudflare KV rate limiting (Max 40 requests per minute)
  if (env.RATE_LIMIT_KV) {
    const currentCount = parseInt((await env.RATE_LIMIT_KV.get(rateLimitKey)) || "0");
    if (currentCount >= 40) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Too many requests." }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }
    await env.RATE_LIMIT_KV.put(rateLimitKey, (currentCount + 1).toString(), { expirationTtl: 60 });
  }

  // Fetch data securely from your Hostinger subdomain endpoint
  const hostingerApiUrl = "https://iyattid.iyattraltechnologies.com/api/get_attendance.php";
  
  try {
    const response = await fetch(hostingerApiUrl, {
      headers: {
        "User-Agent": "Cloudflare-Pages-Secure-Edge-Proxy"
      }
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: "error", message: "Failed to communicate with Hostinger backend." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}