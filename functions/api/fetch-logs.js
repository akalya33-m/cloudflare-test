export async function onRequestGet(context) {
  // Point directly to the subdomain or its underlying PHP data endpoint (e.g., /get_logs.php or /fetch.php)
  const TARGET_URL = "https://iyattid.iyattraltechnologies.com/";

  try {
    // Server-to-Server request with standard browser headers to pass Hostinger's security filter
    const response = await fetch(TARGET_URL, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://iyattid.iyattraltechnologies.com/",
        "Cache-Control": "no-cache"
      }
    });

    if (!response.ok) {
      throw new Error(`Hostinger origin returned ${response.status}: ${response.statusText}`);
    }

    const rawBody = await response.text();
    const contentType = response.headers.get("content-type") || "";

    // Case 1: If Hostinger returns JSON directly
    if (contentType.includes("application/json") || rawBody.trim().startsWith("[") || rawBody.trim().startsWith("{")) {
      const jsonData = JSON.parse(rawBody);
      return new Response(JSON.stringify({
        success: true,
        mode: "server-to-server-json",
        data: jsonData
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Case 2: Extract rows from HTML table
    const records = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

    let rowMatch;
    while ((rowMatch = rowRegex.exec(rawBody)) !== null) {
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        const cleanText = cellMatch[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
        cells.push(cleanText);
      }

      if (cells.length >= 4 && cells[0].toLowerCase() !== "id" && cells[0].toLowerCase() !== "emp id") {
        records.push({
          id: cells[0],
          employee_id: cells[0],
          name: cells[1],
          employee_name: cells[1],
          date: cells[2],
          check_in_1: cells[3] || "-",
          check_out_1: cells[4] || "-",
          check_in_2: cells[5] || "-",
          check_out_2: cells[6] || "-",
          status: cells[7] || "N/A",
          current_status: cells[7] || "N/A"
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      mode: "server-to-server-html",
      total_extracted: records.length,
      data: records,
      // Diagnostic preview: shows if Hostinger returned a JS challenge or empty shell when 0 rows found
      debug_snippet: records.length === 0 ? rawBody.slice(0, 500) : undefined
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