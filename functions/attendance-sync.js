export async function onRequestGet(context) {
  try {
    const { env } = context;

    // 1. Fetch raw logs from the source endpoint
    const rawResponse = await fetch('https://iyattaltechnologies.com/save_log.php');
    
    if (!rawResponse.ok) {
      throw new Error(`Failed to fetch raw logs: HTTP status ${rawResponse.status}`);
    }

    const rawData = await rawResponse.json();
    // Ensure rawData is treated as an array of log entries
    const logs = Array.isArray(rawData) ? rawData : (rawData.logs || rawData.data || []);

    // 2. Process all attendance logic server-side
    // Standard shift: 10:00 AM to 07:00 PM (9 Hours total)
    const standardStartTime = "10:00:00";
    const standardShiftHours = 9.0;

    const processedMap = {};

    logs.forEach(log => {
      const empId = log.employee_id || log.id || "Unknown";
      const empName = log.employee_name || log.name || `Employee ${empId}`;
      
      if (!processedMap[empId]) {
        processedMap[empId] = {
          id: empId,
          employeeName: empName,
          checkIn1: log.check_in_1 || log.checkIn1 || "--",
          checkOut1: log.check_out_1 || log.checkOut1 || "--",
          checkIn2: log.check_in_2 || log.checkIn2 || "--",
          checkOut2: log.check_out_2 || log.checkOut2 || "--",
          currentStatus: log.status || "Active"
        };
      } else {
        // Update fields if subsequent logs contain newer entries
        if (log.check_in_1) processedMap[empId].checkIn1 = log.check_in_1;
        if (log.check_out_1) processedMap[empId].checkOut1 = log.check_out_1;
        if (log.check_in_2) processedMap[empId].checkIn2 = log.check_in_2;
        if (log.check_out_2) processedMap[empId].checkOut2 = log.check_out_2;
      }
    });

    const processedStaff = Object.values(processedMap).map(emp => {
      // Calculate work durations
      let session1Hours = 0;
      let session2Hours = 0;

      if (emp.checkIn1 !== "--" && emp.checkOut1 !== "--") {
        session1Hours = calculateHoursDifference(emp.checkIn1, emp.checkOut1);
      }
      if (emp.checkIn2 !== "--" && emp.checkOut2 !== "--") {
        session2Hours = calculateHoursDifference(emp.checkIn2, emp.checkOut2);
      }

      const totalHoursNum = session1Hours + session2Hours;
      const extraHoursNum = totalHoursNum > standardShiftHours ? (totalHoursNum - standardShiftHours) : 0;

      // Punctuality Check (Late if Check-In 1 is after 10:00:00 AM)
      let punctualityStatus = "On Time";
      if (emp.checkIn1 !== "--") {
        punctualityStatus = emp.checkIn1 > standardStartTime ? "Late Arrival" : "On Time";
      }

      // Check-Out 2 status check for UI highlighting logic
      const isCheckedOut2 = emp.checkOut2 !== "--" && emp.checkOut2 !== "00:00:00";

      return {
        id: emp.id,
        employeeName: emp.employeeName,
        checkIn1: emp.checkIn1,
        checkOut1: emp.checkOut1,
        checkIn2: emp.checkIn2,
        checkOut2: emp.checkOut2,
        lunchBreak: "45 mins", // Standard structured break
        totalHours: totalHoursNum.toFixed(2) + " hrs",
        extraHours: extraHoursNum.toFixed(2) + " hrs",
        punctuality: punctualityStatus,
        currentStatus: isCheckedOut2 ? "Shift Completed" : emp.currentStatus
      };
    });

    // 3. Store the processed master summary into Cloudflare KV Database
    const todayKey = `attendance_master_${new Date().toISOString().split('T')[0]}`;
    await env.RATE_LIMIT_KV.put(todayKey, JSON.stringify(processedStaff));

    return new Response(JSON.stringify({
      success: true,
      message: "Raw logs successfully fetched, fully processed, and saved to Cloudflare KV!",
      date: todayKey,
      data: processedStaff
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Helper function to calculate hours between two "HH:MM:SS" time strings
 */
function calculateHoursDifference(timeStart, timeEnd) {
  try {
    const [h1, m1, s1] = timeStart.split(':').map(Number);
    const [h2, m2, s2] = timeEnd.split(':').map(Number);
    
    const totalSecondsStart = h1 * 3600 + m1 * 60 + (s1 || 0);
    const totalSecondsEnd = h2 * 3600 + m2 * 60 + (s2 || 0);
    
    const diffSeconds = totalSecondsEnd - totalSecondsStart;
    return diffSeconds > 0 ? diffSeconds / 3600 : 0;
  } catch (e) {
    return 0;
  }
}