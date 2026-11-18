export async function onRequestGet(context) {
  try {
    const { env } = context;

    // Fetch from Hostinger
    const response = await fetch('https://iyattraltechnologies.com/save_log.php', {
      method: 'GET'
    });

    // Get the response as text first to see what it actually is
    const responseText = await response.text();

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Hostinger returned status ${response.status}`,
        rawResponse: responseText // This will show you the exact error HTML/text from Hostinger
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Save into Cloudflare KV
    const todayDate = new Date().toISOString().split('T')[0];
    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(`raw_logs_${todayDate}`, responseText);
      await env.RATE_LIMIT_KV.put("raw_logs_latest", responseText);
    }

    return new Response(JSON.stringify({ success: true, logs: responseText }), {
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