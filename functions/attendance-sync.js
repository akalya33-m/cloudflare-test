export async function onRequestGet(context) {
  try {
    const { env } = context;

    // 1. Fetch the raw data directly from save_log.php
    const response = await fetch('https://iyattraltechnologies.com/save_log.php', {
      headers: {
        'User-Agent': 'Cloudflare-Sync/1.0',
        'Accept': 'application/json, text/plain, */*'
      },
      cf: { cacheTtl: 0 }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from save_log.php: HTTP ${response.status}`);
    }

    const rawText = await response.text();

    // 2. Store the raw text directly into Cloudflare KV
    const todayDate = new Date().toISOString().split('T')[0];
    const storageKey = `raw_logs_${todayDate}`;

    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(storageKey, rawText);
      await env.RATE_LIMIT_KV.put("raw_logs_latest", rawText);
    }

    // 3. Return the extracted data to confirm success
    return new Response(JSON.stringify({
      success: true,
      message: "Successfully extracted data from save_log.php and stored in Cloudflare KV!",
      key: storageKey,
      data: rawText
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}