export async function onRequestGet(context) {
  const BASE_URL = "https://iyattid.iyattraltechnologies.com";

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*;q=0.8",
    "Referer": BASE_URL + "/",
    "Cache-Control": "no-cache"
  };

  const cleanText = (v) =>
    String(v ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();

  const normalizeRecord = (item) => {
    if (!item || typeof item !== "object") return null;

    const id = cleanText(
      item.id ?? item.emp_id ?? item.employee_id ?? item.user_id ?? item.uid ?? ""
    );
    const name = cleanText(
      item.name ?? item.employee_name ?? item.emp_name ?? item.full_name ?? item.username ?? ""
    );

    if (!id && !name) return null;

    return {
      id: id || "-",
      name: name || "Unknown",
      check_in_1: cleanText(item.check_in_1 ?? item.checkin_1 ?? item.in1 ?? item.check_in ?? "-") || "-",
      check_out_1: cleanText(item.check_out_1 ?? item.checkout_1 ?? item.out1 ?? item.check_out ?? "-") || "-",
      check_in_2: cleanText(item.check_in_2 ?? item.checkin_2 ?? item.in2 ?? "-") || "-",
      check_out_2: cleanText(item.check_out_2 ?? item.checkout_2 ?? item.out2 ?? "-") || "-",
      lunch_break: cleanText(item.lunch_break ?? item.lunch ?? item.break_time ?? "-") || "-",
      punctuality: cleanText(item.punctuality ?? item.late_status ?? item.arrival ?? "-") || "-",
      extra_hours: cleanText(item.extra_hours ?? item.overtime ?? "-") || "-",
      status: cleanText(item.status ?? item.current_status ?? "Active") || "Active"
    };
  };

  const extractFromJson = (json) => {
    const candidates = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json?.logs)
      ? json.logs
      : Array.isArray(json?.records)
      ? json.records
      : Array.isArray(json?.employees)
      ? json.employees
      : [];

    return candidates.map(normalizeRecord).filter(Boolean);
  };

  const extractFromHtml = (html) => {
    const rows = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(cleanText(cellMatch[1]));
      }
      const first = (cells[0] || "").toLowerCase();
      if (cells.length >= 2 && first !== "id" && first !== "emp id" && first !== "date") {
        rows.push({
          id: cells[0] || "-",
          name: cells[1] || "Unknown",
          check_in_1: cells[2] || "-",
          check_out_1: cells[3] || "-",
          check_in_2: cells[4] || "-",
          check_out_2: cells[5] || "-",
          lunch_break: cells[6] || "-",
          punctuality: cells[7] || "-",
          extra_hours: cells[8] || "-",
          status: cells[9] || "Active"
        });
      }
    }
    return rows;
  };

  try {
    const pageRes = await fetch(BASE_URL + "/", { headers });
    const html = await pageRes.text();

    const scriptSrcs = [...html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi)]
      .map((m) => m[1])
      .filter((src) => !src.startsWith("http") || src.startsWith(BASE_URL));

    if (!scriptSrcs.some((s) => s.includes("app.js"))) {
      scriptSrcs.push("assets/js/app.js");
    }

    const candidateEndpoints = new Set();
    for (const rawSrc of scriptSrcs) {
      const cleanSrc = rawSrc.split("?")[0];
      const scriptUrl = cleanSrc.startsWith("http")
        ? cleanSrc
        : `${BASE_URL}/${cleanSrc.replace(/^\/+/, "")}`;

      try {
        const sRes = await fetch(scriptUrl, { headers });
        if (!sRes.ok) continue;
        const jsCode = await sRes.text();

        const matches = [
          ...jsCode.matchAll(/["'`]((?:https?:\/\/[^"'`]+)?\/?[a-zA-Z0-9_./-]*\.(?:php|json)(?:\?[^"'`]*)?)["'`]/gi)
        ];
        for (const m of matches) {
          const ep = m[1];
          if (ep.includes("firebase") || ep.includes("gstatic") || ep.includes("googleapis")) continue;
          const fullEp = ep.startsWith("http") ? ep : `${BASE_URL}/${ep.replace(/^\/+/, "")}`;
          candidateEndpoints.add(fullEp);
        }
      } catch (_) {}
    }

    let extractedRows = [];
    const endpointResults = [];

    for (const epUrl of candidateEndpoints) {
      try {
        const epRes = await fetch(epUrl, { headers });
        const bodyText = await epRes.text();
        endpointResults.push({
          url: epUrl,
          status: epRes.status,
          bodyPreview: bodyText.slice(0, 600)
        });

        if (!epRes.ok || extractedRows.length > 0) continue;

        const trimmed = bodyText.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            const parsed = JSON.parse(trimmed);
            const rows = extractFromJson(parsed);
            if (rows.length > 0) extractedRows = rows;
          } catch (_) {}
        } else if (trimmed.includes("<tr")) {
          const rows = extractFromHtml(trimmed);
          if (rows.length > 0) extractedRows = rows;
        }
      } catch (e) {
        endpointResults.push({ url: epUrl, error: e.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      count: extractedRows.length,
      data: extractedRows,
      discoveredEndpoints: [...candidateEndpoints],
      endpointResults
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