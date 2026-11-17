export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const rawLogs = body.logs;
    if (!rawLogs) {
      return new Response(JSON.stringify({ success: false, error: "No logs provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const storageKey = `raw_logs_${todayDate}`;

    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(storageKey, rawLogs);
      await env.RATE_LIMIT_KV.put("raw_logs_latest", rawLogs);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Logs successfully saved to Cloudflare KV!" 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}