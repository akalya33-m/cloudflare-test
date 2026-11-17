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
};