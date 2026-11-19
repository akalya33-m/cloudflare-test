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

    const html = await response.text();

    // Find script tags or API/PHP URLs referenced in the page
    const scriptMatches = [...html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
    const endpointMatches = [...new Set(
      [...html.matchAll(/["']([^"']*?\.(?:php|json)(?:\?[^"']*)?)["']/gi)].map(m => m[1])
    )];

    const cleanCell = (raw) =>
      raw
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();

    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

    const allTables = [];
    const todayRows = [];
    let tableMatch;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const parsedRows = [];
      let rowMatch;
      while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
        const cells = [];
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          cells.push(cleanCell(cellMatch[1]));
        }
        if (cells.length > 0) parsedRows.push(cells);
      }

      allTables.push({
        rowCount: parsedRows.length,
        firstRow: parsedRows[0] || [],
        sampleRow: parsedRows[1] || []
      });

      if (parsedRows.length === 0) continue;
      const headerJoined = parsedRows[0].join(" ").toLowerCase().replace(/[^a-z0-9 ]/g, " ");

      if (
        (headerJoined.includes("employee name") || headerJoined.includes("emp name")) &&
        (headerJoined.includes("check in 1") || headerJoined.includes("checkin 1")) &&
        !headerJoined.includes("9 hr compliance") &&
        !headerJoined.includes("compliance")
      ) {
        for (let i = 1; i < parsedRows.length; i++) {
          const c = parsedRows[i];
          const first = (c[0] || "").toLowerCase();
          const second = (c[1] || "").toLowerCase();
          if (!c[0] || !c[1] || first === "id" || second === "employee name") continue;
          if (c.join(" ").toLowerCase().includes("loading")) continue;

          todayRows.push({
            id: c[0],
            name: c[1],
            check_in_1: c[2] || "-",
            check_out_1: c[3] || "-",
            check_in_2: c[4] || "-",
            check_out_2: c[5] || "-",
            lunch_break: c[6] || "-",
            punctuality: c[7] || "-",
            extra_hours: c[8] || "-",
            status: c[9] || "Active"
          });
        }
      }
    }

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      count: todayRows.length,
      data: todayRows,
      debug: {
        tablesFound: allTables,
        scripts: scriptMatches,
        detectedEndpoints: endpointMatches,
        htmlPreview: html.slice(0, 600)
      }
    }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}