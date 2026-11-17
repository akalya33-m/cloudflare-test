document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.querySelector("#attendanceTable tbody") || document.querySelector("table tbody");
  
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px;">Fetching data from save_log.php...</td></tr>`;

  try {
    const response = await fetch('/api/attendance-sync');
    const result = await response.json();

    if (!result.success) {
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red; padding: 20px;">${result.error}</td></tr>`;
      return;
    }

    // Display the exact raw extracted text directly in the table
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="padding: 20px; font-family: monospace; background: #f8fafc; white-space: pre-wrap; word-break: break-all;">
          <strong>Successfully Extracted Raw Data:</strong><br><br>
          ${escapeHtml(result.data)}
        </td>
      </tr>
    `;

  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red; padding: 20px;">Extraction failed: ${error.message}</td></tr>`;
  }
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}