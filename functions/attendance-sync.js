export async function onRequestGet(context) {
  try {
    const { env } = context;

    // Fetch raw data strictly from save_log.php
    const response = await fetch('https://iyattraltechnologies.com/save_log.php', {
      headers: {
        'User-Agent': 'Cloudflare-Worker/1.0',
        'Accept': 'application/json, text/plain, */*'
      },
      cf: { cacheTtl: 0 }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to extract data: HTTP status ${response.status}`
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const rawText = await response.text();

    if (!rawText || rawText.trim() === "") {
      return new Response(JSON.stringify({
        success: false,
        error: "Extraction failed: save_log.php returned empty data."
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Store raw text in Cloudflare KV
    const todayDate = new Date().toISOString().split('T')[0];
    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(`raw_logs_${todayDate}`, rawText);
    }

    return new Response(JSON.stringify({
      success: true,
      data: rawText
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: `Extraction error: ${err.message}`
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}