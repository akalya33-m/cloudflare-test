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

    // 3. Save into Cloudflare KV (keeping your existing KV backup)
    const todayDate = new Date().toISOString().split('T')[0];
    const jsonString = JSON.stringify(records);

    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(`attendance_json_${todayDate}`, jsonString);
      await env.RATE_LIMIT_KV.put("attendance_json_latest", jsonString);
    }

    // 4. Save/Upsert into Cloudflare D1 SQL Database
    if (env.DB) {
      for (const rec of records) {
        await env.DB.prepare(`
          INSERT INTO attendance (
            employee_id, employee_name, date, 
            check_in_1, check_out_1, check_in_2, check_out_2, latest_status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(employee_id, date) DO UPDATE SET
            check_in_1 = excluded.check_in_1,
            check_out_1 = excluded.check_out_1,
            check_in_2 = excluded.check_in_2,
            check_out_2 = excluded.check_out_2,
            latest_status = excluded.latest_status
        `).bind(
          rec.employeeId,
          rec.employeeName,
          rec.date,
          rec.checkIn1,
          rec.checkOut1,
          rec.checkIn2,
          rec.checkOut2,
          rec.latestStatus
        ).run();
      }
    }

    // 5. Return structured JSON with 'data' key
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