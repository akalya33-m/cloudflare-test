window.fetchDashboardData = function() {
    // Calls Cloudflare Pages Function proxy, masking Hostinger and avoiding CORS
    fetch('/api/proxy')
        .then(res => res.json())
        .then(response => {
            if (response.status === 'success' && Array.isArray(response.data)) {
                window.globalRecords = response.data;
                renderHomeView(window.globalRecords);
            } else {
                showTableError("⚠️ Unable to load database logs.");
            }
        })
        .catch(err => {
            console.error("Network Error:", err);
            showTableError("⚠️ Network Error: Unable to fetch attendance data.");
        });
        async function loadCloudflareAttendanceDashboard() {
  try {
    const response = await fetch('/api/attendance-sync');
    const result = await response.json();

    if (!result.success) {
      console.error('Failed to load attendance:', result.error);
      return;
    }

    const staffRecords = result.data;
    const tableBody = document.querySelector("table tbody");
    tableBody.innerHTML = ""; // Clear loading state

    staffRecords.forEach(emp => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${emp.id}</td>
        <td>${emp.employeeName}</td>
        <td>${emp.checkIn1}</td>
        <td>${emp.checkOut1}</td>
        <td>${emp.checkIn2}</td>
        <td>${emp.checkOut2}</td>
        <td>${emp.totalHours}</td>
        <td><span class="${emp.punctuality === 'Late Arrival' ? 'text-red-500' : 'text-green-500'}">${emp.punctuality}</span></td>
        <td>${emp.extraHours}</td>
        <td>${emp.currentStatus}</td>
      `;
      tableBody.appendChild(row);
    });

    console.log("Cloudflare Database Sync Complete & Rendered!");
  } catch (error) {
    console.error("Error connecting to Cloudflare backend function:", error);
  }
}

// Automatically load on page open
document.addEventListener("DOMContentLoaded", loadCloudflareAttendanceDashboard);
};