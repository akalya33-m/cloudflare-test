export async function onRequestGet(context) {
  const SOURCE_URL = "https://iyattid.iyattraltechnologies.com/";

  try {
    const response = await fetch(SOURCE_URL, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache"
      }
    });

    if (!response.ok) {
      throw new Error(`Origin fetch failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const logs = [];

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        const cleaned = cellMatch[1]
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        cells.push(cleaned);
      }

      // Skip header rows or placeholder loading rows
      const firstCell = (cells[0] || "").toLowerCase();
      const joinedRow = cells.join(" ").toLowerCase();
      if (
        cells.length >= 2 &&
        firstCell !== "id" &&
        firstCell !== "emp id" &&
        !joinedRow.includes("loading today's biometric logs")
      ) {
        logs.push({
          id: cells[0] || "-",
          name: cells[1] || "Unknown",
          check_in_1: cells[2] || "-",
          check_out_1: cells[3] || "-",
          check_in_2: cells[4] || "-",
          check_out_2: cells[5] || "-",
          lunch_break: cells[6] || "-",
          punctuality: cells[7] || "-",
          extra_hours: cells[8] || "-",
          status: cells[9] || (cells[5] && cells[5] !== "-" ? "Checked Out 2" : "Active")
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      source: SOURCE_URL,
      count: logs.length,
      data: logs
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