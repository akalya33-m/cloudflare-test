/**
 * public/app.js
 * Client-side direct extraction and cloud sync script
 */

document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.querySelector("#attendanceTable tbody") || document.querySelector("table tbody");
  
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px;">Fetching raw data from save_log.php...</td></tr>`;

  try {
    // 1. Direct browser fetch from your external PHP data endpoint
    const response = await fetch('https://iyattraltechnologies.com/save_log.php', {
      method: 'GET',
      mode: 'cors' // Allows browser to query cross-origin if CORS headers are present
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const rawText = await response.text();

    if (!rawText || rawText.trim() === "") {
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: orange; padding: 20px;">Extraction warning: save_log.php returned empty data.</td></tr>`;
      return;
    }

    // 2. Display the successfully extracted raw text directly on your webpage table
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="padding: 20px; font-family: monospace; background: #f8fafc; white-space: pre-wrap; word-break: break-all;">
          <strong>Successfully Extracted Raw Data from save_log.php:</strong><br><br>
          ${escapeHtml(rawText)}
        </td>
      </tr>
    `;

    // 3. Automatically sync the extracted data to Cloudflare KV via our backend function
    await fetch('/api/store-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: rawText })
    });

  } catch (error) {
    console.error("Extraction Error:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; color: #ef4444; padding: 20px;">
          Direct fetch blocked or failed: ${error.message}.<br><small>Note: If this is a CORS error, ensure your PHP host has appropriate CORS headers enabled.</small>
        </td>
      </tr>
    `;
  }
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}