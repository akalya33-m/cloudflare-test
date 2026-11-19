export async function onRequestGet(context) {
  const { env } = context;
  const BASE_URL = "https://iyattid.iyattraltechnologies.com";

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: BASE_URL + "/",
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

  const isHeaderOrNoiseRow = (cells) => {
    const first = (cells[0] || "").toLowerCase();
    const second = (cells[1] || "").toLowerCase();
    const joined = cells.join(" ").toLowerCase();

    if (!cells[0] && !cells[1]) return true;
    if (first === "id" || first === "emp id" || first === "employee id" || first === "date") return true;
    if (second === "employee name" || second === "name" || second === "check-in 1") return true;
    if (
      joined.includes("loading today's biometric logs") ||
      joined.includes("loading...") ||
      joined.includes("no records") ||
      joined.includes("no punch rows")
    ) {
      return true;
    }
    return false;
  };

  const parseHtmlRows = (html) => {
    const results = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(cleanText(cellMatch[1]));
      }
      if (cells.length >= 2 && !isHeaderOrNoiseRow(cells)) {
        const base = {
          id: cells[0] || "-",
          name: cells[1] || "Unknown",
          check_in_1: hasPunch(cells[2]) ? cells[2] : "-",
          check_out_1: hasPunch(cells[3]) ? cells[3] : "-",
          check_in_2: hasPunch(cells[4]) ? cells[4] : "-",
          check_out_2: hasPunch(cells[5]) ? cells[5] : "-"
        };
        results.push({
          id: base.id,
          name: base.name,
          check_in_1: base.check_in_1,
          check_out_1: base.check_out_1,
          check_in_2: base.check_in_2,
          check_out_2: base.check_out_2,
          latest_status: computeLatestStatus(base, cells[9] || cells[6] || "")
        });
      }
    }
    return results;
  };

  const normalizeJsonItem = (item) => {
    if (!item || typeof item !== "object") return null;
    const id = cleanText(item.id ?? item.emp_id ?? item.employee_id ?? item.user_id ?? "");
    const name = cleanText(item.name ?? item.employee_name ?? item.emp_name ?? item.full_name ?? "");
    if (!id && !name) return null;

    const base = {
      id: id || "-",
      name: name || "Unknown",
      check_in_1: hasPunch(item.check_in_1 ?? item.checkin_1 ?? item.in1)
        ? cleanText(item.check_in_1 ?? item.checkin_1 ?? item.in1)
        : "-",
      check_out_1: hasPunch(item.check_out_1 ?? item.checkout_1 ?? item.out1)
        ? cleanText(item.check_out_1 ?? item.checkout_1 ?? item.out1)
        : "-",
      check_in_2: hasPunch(item.check_in_2 ?? item.checkin_2 ?? item.in2)
        ? cleanText(item.check_in_2 ?? item.checkin_2 ?? item.in2)
        : "-",
      check_out_2: hasPunch(item.check_out_2 ?? item.checkout_2 ?? item.out2)
        ? cleanText(item.check_out_2 ?? item.checkout_2 ?? item.out2)
        : "-"
    };

    const rawStatus = cleanText(item.latest_status ?? item.status ?? item.current_status ?? "");
    return {
      ...base,
      latest_status: computeLatestStatus(base, rawStatus)
    };
  };

  const extractFromJson = (json) => {
    const arr = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.logs)
      ? json.logs
      : Array.isArray(json?.records)
      ? json.records
      : [];
    return arr.map(normalizeJsonItem).filter(Boolean);
  };

  try {
    const response = await fetch(BASE_URL + "/", { headers });
    if (!response.ok) {
      throw new Error(`Source fetch failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    let rows = parseHtmlRows(html);

    const candidateEndpoints = new Set();
    const endpointChecks = [];

    // Fallback: if HTML has no rows, check scripts on iyattid for PHP/JSON endpoints
    if (rows.length === 0) {
      const scriptSrcs = [...html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi)]
        .map((m) => m[1])
        .filter((src) => !src.startsWith("http") || src.startsWith(BASE_URL));

      if (!scriptSrcs.some((s) => s.includes("app.js"))) {
        scriptSrcs.push("assets/js/app.js");
      }

      for (const rawSrc of scriptSrcs) {
        const cleanSrc = rawSrc.split("?")[0];
        const scriptUrl = cleanSrc.startsWith("http")
          ? cleanSrc
          : `${BASE_URL}/${cleanSrc.replace(/^\/+/, "")}`;
        try {
          const sRes = await fetch(scriptUrl, { headers });
          if (!sRes.ok) continue;
          const jsCode = await sRes.text();
          for (const m of jsCode.matchAll(
            /["'`]((?:https?:\/\/[^"'`]+)?\/?[a-zA-Z0-9_./-]*\.(?:php|json)(?:\?[^"'`]*)?)["'`]/gi
          )) {
            const ep = m[1];
            if (ep.includes("firebase") || ep.includes("gstatic") || ep.includes("googleapis")) continue;
            candidateEndpoints.add(ep.startsWith("http") ? ep : `${BASE_URL}/${ep.replace(/^\/+/, "")}`);
          }
        } catch (_) {}
      }

      for (const epUrl of candidateEndpoints) {
        try {
          const epRes = await fetch(epUrl, { headers });
          const body = await epRes.text();
          endpointChecks.push({ url: epUrl, status: epRes.status, preview: body.slice(0, 300) });

          if (!epRes.ok || rows.length > 0) continue;
          const trimmed = body.trim();
          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
              const parsed = JSON.parse(trimmed);
              const found = extractFromJson(parsed);
              if (found.length > 0) rows = found;
            } catch (_) {}
          } else if (trimmed.includes("<tr")) {
            const found = parseHtmlRows(trimmed);
            if (found.length > 0) rows = found;
          }
        } catch (e) {
          endpointChecks.push({ url: epUrl, error: e.message });
        }
      }
    }

    // Deduplicate by employee name so cards/rows don't repeat
    const deduped = new Map();
    for (const r of rows) {
      deduped.set(r.name.toUpperCase(), r);
    }
    const finalRecords = Array.from(deduped.values());

    let storedCount = 0;
    if (env.DB && finalRecords.length > 0) {
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

      const batch = finalRecords.map((r) =>
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
          source: BASE_URL + "/",
          count: finalRecords.length,
          stored_in_d1: storedCount,
          data: finalRecords,
          debug:
            finalRecords.length === 0
              ? {
                  htmlLength: html.length,
                  htmlSample: html.slice(0, 600),
                  discoveredEndpoints: [...candidateEndpoints],
                  endpointChecks
                }
              : undefined
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