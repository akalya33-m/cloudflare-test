export async function onRequestGet(context) {
  const { env } = context;
  const SOURCE_URL = "https://iyattid.iyattraltechnologies.com/";

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache"
  };

  const cleanText = (val) =>
    String(val ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();

  const hasPunch = (val) => {
    const v = cleanText(val).toLowerCase();
    return v !== "" && v !== "-" && v !== "null" && v !== "n/a" && v !== "none";
  };

  const computeLatestStatus = (row, rawStatus) => {
    if (hasPunch(row.check_out_2)) return "Check-Out 2";
    if (hasPunch(row.check_in_2)) return "Check-In 2";
    if (hasPunch(row.check_out_1)) return "Check-Out 1";
    if (hasPunch(row.check_in_1)) return `Check-In: ${row.check_in_1}`;
    return rawStatus && hasPunch(rawStatus) ? rawStatus : "No Punch";
  };

  try {
    const response = await fetch(SOURCE_URL, { headers });
    if (!response.ok) {
      throw new Error(`Source fetch failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

    const dedupedByName = new Map();
    let tableMatch;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const parsedRows = [];
      let rowMatch;

      while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
        const cells = [];
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          cells.push(cleanText(cellMatch[1]));
        }
        if (cells.length > 0) {
          parsedRows.push(cells);
        }
      }

      if (parsedRows.length === 0) continue;

      const headerJoined = parsedRows[0].join(" ").toLowerCase().replace(/[^a-z0-9 ]/g, " ");
      const isTodayPunchTable =
        (headerJoined.includes("employee name") || headerJoined.includes("emp name")) &&
        (headerJoined.includes("check in 1") || headerJoined.includes("checkin 1")) &&
        !headerJoined.includes("9 hr compliance");

      if (!isTodayPunchTable) continue;

      for (let i = 1; i < parsedRows.length; i++) {
        const c = parsedRows[i];
        const first = (c[0] || "").toLowerCase();
        const second = (c[1] || "").toLowerCase();

        if (!c[0] || !c[1] || first === "id" || second === "employee name") continue;
        if (c.join(" ").toLowerCase().includes("loading")) continue;

        const base = {
          id: c[0],
          name: c[1],
          check_in_1: hasPunch(c[2]) ? c[2] : "-",
          check_out_1: hasPunch(c[3]) ? c[3] : "-",
          check_in_2: hasPunch(c[4]) ? c[4] : "-",
          check_out_2: hasPunch(c[5]) ? c[5] : "-"
        };

        const record = {
          id: base.id,
          name: base.name,
          check_in_1: base.check_in_1,
          check_out_1: base.check_out_1,
          check_in_2: base.check_in_2,
          check_out_2: base.check_out_2,
          latest_status: computeLatestStatus(base, c[9] || c[6] || "")
        };

        dedupedByName.set(record.name.toUpperCase(), record);
      }
    }

    const records = Array.from(dedupedByName.values());
    let storedCount = 0;

    if (env.DB && records.length > 0) {
      const stmt = env.DB.prepare(`
        INSERT INTO attendance_logs (
          id, name, check_in_1, check_out_1, check_in_2, check_out_2, latest_status, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          check_in_1 = excluded.check_in_1,
          check_out_1 = excluded.check_out_1,
          check_in_2 = excluded.check_in_2,
          check_out_2 = excluded.check_out_2,
          latest_status = excluded.latest_status,
          updated_at = datetime('now')
      `);

      const batch = records.map((r) =>
        stmt.bind(
          r.id,
          r.name,
          r.check_in_1,
          r.check_out_1,
          r.check_in_2,
          r.check_out_2,
          r.latest_status
        )
      );

      await env.DB.batch(batch);
      storedCount = batch.length;
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          source: SOURCE_URL,
          columns_order: [
            "id",
            "name",
            "check_in_1",
            "check_out_1",
            "check_in_2",
            "check_out_2",
            "latest_status"
          ],
          count: records.length,
          stored_in_d1: storedCount,
          db_bound: Boolean(env.DB),
          data: records
        },
        null,
        2
      ),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify(
        {
          success: false,
          error: err.message
        },
        null,
        2
      ),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}