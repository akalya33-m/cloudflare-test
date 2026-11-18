export async function onRequestGet(context) {
  try {
    const { env } = context;

    // 1. Fetch raw data server-to-server (No browser CORS restrictions here)
    const response = await fetch('https://iyattraltechnologies.com/save_log.php', {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Hostinger returned status ${response.status}`);
    }

    const rawLogs = await response.text();

    // 2. Save into Cloudflare KV storage automatically
    const todayDate = new Date().toISOString().split('T')[0];
    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(`raw_logs_${todayDate}`, rawLogs);
      await env.RATE_LIMIT_KV.put("raw_logs_latest", rawLogs);
    }

    // 3. Return the logs safely to your frontend dashboard
    return new Response(JSON.stringify({ success: true, logs: rawLogs }), {
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