export async function onRequestGet(context) {
  const BASE_URL = "https://iyattid.iyattraltechnologies.com";

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml,application/json,*/*;q=0.8",
    "Referer": BASE_URL + "/",
    "Cache-Control": "no-cache"
  };

  try {
    // 1. Fetch main HTML
    const pageRes = await fetch(BASE_URL + "/", { headers });
    const html = await pageRes.text();

    // 2. Collect script URLs (fallback to /assets/js/app.js)
    const scriptSrcs = [...html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi)]
      .map(m => m[1])
      .filter(src => !src.startsWith("http") || src.startsWith(BASE_URL));

    if (!scriptSrcs.some(s => s.includes("app.js"))) {
      scriptSrcs.push("assets/js/app.js");
    }

    // 3. Scan scripts for API / PHP / JSON endpoints
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

        const urlMatches = [
          ...jsCode.matchAll(/["'`]((?:https?:\/\/[^"'`]+)?\/?[a-zA-Z0-9_./-]*\.(?:php|json)(?:\?[^"'`]*)?)["'`]/gi)
        ];
        for (const m of urlMatches) {
          const ep = m[1];
          if (ep.includes("firebase") || ep.includes("gstatic") || ep.includes("googleapis")) continue;
          const fullEp = ep.startsWith("http") ? ep : `${BASE_URL}/${ep.replace(/^\/+/, "")}`;
          candidateEndpoints.add(fullEp);
        }
      } catch (_) {
        // Ignore single script fetch errors
      }
    }

    // 4. Query discovered endpoints server-to-server
    const endpointResults = [];
    for (const epUrl of candidateEndpoints) {
      try {
        const epRes = await fetch(epUrl, { headers });
        const text = await epRes.text();
        endpointResults.push({
          url: epUrl,
          status: epRes.status,
          bodyPreview: text.slice(0, 1500)
        });
      } catch (e) {
        endpointResults.push({
          url: epUrl,
          error: e.message
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      count: 0,
      data: [],
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