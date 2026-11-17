export async function onRequest(context) {
  const { request } = context;
  const cf = request.cf || {};

  // 1. Geo-Filter: Restrict access to India (IN)
  if (cf.country && cf.country !== "IN") {
    return new Response(JSON.stringify({ error: "Access Denied: Region restricted." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 2. Payload Inspection: Block malicious SQLi/XSS signatures in the URL path
  const url = decodeURIComponent(request.url).toLowerCase();
  const maliciousPatterns = ["<script>", "union select", "drop table", "eval("];
  if (maliciousPatterns.some(pattern => url.includes(pattern))) {
    return new Response(JSON.stringify({ error: "Blocked by Edge Security Filter." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  return context.next();
}