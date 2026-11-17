export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    // Validate incoming payload
    if (!body || !body.key || !body.value) {
      return new Response(JSON.stringify({ error: "Invalid payload: 'key' and 'value' are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Store data inside Cloudflare KV Namespace
    await env.RATE_LIMIT_KV.put(body.key, JSON.stringify(body.value));

    return new Response(JSON.stringify({ success: true, message: "Data stored successfully in Cloudflare KV" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}