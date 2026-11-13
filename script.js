async function runTest() {
    const resultsBox = document.getElementById('results');
    const statusText = document.getElementById('statusText');
    
    resultsBox.classList.remove('hidden');
    statusText.textContent = "Pinging public API...";

    const startTime = performance.now();
    try {
        // Fetch a lightweight public JSON endpoint
        await fetch('https://api.github.com/zen', { cache: 'no-store' });
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        statusText.innerHTML = `Status: <span style="color: #4ade80;">Online</span><br>Response Time: <b>${duration}ms</b>`;
    } catch (error) {
        statusText.innerHTML = `<span style="color: #ef4444;">Connection failed</span>`;
    }
}