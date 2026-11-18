export async function onRequestGet(context) {
  try {
    const { env } = context;

    // 1. Fetch raw HTML from Hostinger
    const response = await fetch('https://iyattraltechnologies.com/save_log.php', {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Hostinger returned status ${response.status}`);
    }

    const htmlText = await response.text();

    // 2. Parse HTML table rows into clean JSON objects
    const records = [];
    const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let isHeader = true;

    while ((rowMatch = rowRegex.exec(htmlText)) !== null) {
      if (isHeader) {
        isHeader = false;
        continue;
      }

      const rowContent = rowMatch[1];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cleanText = cellMatch[1].replace(/<[^>]+>/g, '').trim();
        cells.push(cleanText);
      }

      if (cells.length >= 8) {
        records.push({
          employeeId: cells[0],
          employeeName: cells[1],
          date: cells[2],
          checkIn1: cells[3] || null,
          checkOut1: cells[4] || null,
          checkIn2: cells[5] || null,
          checkOut2: cells[6] || null,
          latestStatus: cells[7]
        });
      }
    }

    // 3. Save into Cloudflare KV
    const todayDate = new Date().toISOString().split('T')[0];
    const jsonString = JSON.stringify(records);

    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(`attendance_json_${todayDate}`, jsonString);
      await env.RATE_LIMIT_KV.put("attendance_json_latest", jsonString);
    }

    // 4. Return structured JSON with 'data' key
    return new Response(JSON.stringify({ 
      success: true, 
      count: records.length,
      data: records 
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