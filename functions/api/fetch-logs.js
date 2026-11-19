export async function onRequestGet(context) {
  const { env } = context;

  try {
    // 1. Fetch HTML directly from the new subdomain (Server-to-Server bypasses CORS)
    const response = await fetch("https://iyattid.iyattraltechnologies.com/", {
      headers: {
        "User-Agent": "Cloudflare-Pages-Sync/1.0",
        "Accept": "text/html"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // 2. Parse the HTML table rows (matches standard <tr>...</tr> structure)
    const rows = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        // Strip inner HTML tags and trim whitespace
        const cleanText = cellMatch[1].replace(/<[^>]*>/g, "").trim();
        cells.push(cleanText);
      }

      // Skip empty rows or header rows (adjust column count check based on your table)
      if (cells.length >= 4 && cells[0].toLowerCase() !== "id" && cells[0].toLowerCase() !== "emp id") {
        rows.push(cells);
      }
    }

    // 3. Return extracted data first to verify structure before D1 insertion
    return new Response(JSON.stringify({
      success: true,
      source: "https://iyattid.iyattraltechnologies.com/",
      total_extracted: rows.length,
      data: rows
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