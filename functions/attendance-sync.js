export async function onRequestGet(context) {
  try {
    const { env } = context;

    // 1. Fetch raw logs strictly from the external source
    const rawResponse = await fetch('https://iyattaltechnologies.com/save_log.php', {
      headers: {
        'User-Agent': 'Cloudflare-Worker-Attendance-Sync/1.0',
        'Accept': 'application/json'
      },
      cf: { cacheTtl: 0 }
    });

    if (!rawResponse.ok) {
      throw new Error(`Failed to fetch raw logs from save_log.php: HTTP ${rawResponse.status}`);
    }

    const text = await rawResponse.text();
    let rawData = [];

    try {
      const parsed = JSON.parse(text);
      rawData = Array.isArray(parsed) ? parsed : (parsed.logs || parsed.data || []);
    } catch (parseErr) {
      throw new Error(`Failed to parse JSON from save_log.php: ${text.substring(0, 150)}`);
    }

    // 2. Process all attendance logic dynamically based on fetched records
    const standardStartTime = "10:00:00";
    const standardShiftHours = 9.0;
    const processedMap = {};

    rawData.forEach(log => {
      const empId = String(log.employee_id || log.emp_id || log.id || "Unknown");
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
        if (log.check_in_1 || log.checkIn1) processedMap[empId].checkIn1 = log.check_in_1 || log.checkIn1;
        if (log.check_out_1 || log.checkOut1) processedMap[empId].checkOut1 = log.check_out_1 || log.checkOut1;
        if (log.check_in_2 || log.checkIn2) processedMap[empId].checkIn2 = log.check_in_2 || log.checkIn2;
        if (log.check_out_2 || log.checkOut2) processedMap[empId].checkOut2 = log.check_out_2 || log.checkOut2;
        if (log.status) processedMap[empId].currentStatus = log.status;
      }
    });

    const processedStaff = Object.values(processedMap).map(emp => {
      let session1Hours = 0;
      let session2Hours = 0;

      if (isValidTime(emp.checkIn1) && isValidTime(emp.checkOut1)) {
        session1Hours = calculateHoursDifference(emp.checkIn1, emp.checkOut1);
      }
      if (isValidTime(emp.checkIn2) && isValidTime(emp.checkOut2)) {
        session2Hours = calculateHoursDifference(emp.checkIn2, emp.checkOut2);
      }

      let lunchBreakStr = "45 mins";
      if (isValidTime(emp.checkOut1) && isValidTime(emp.checkIn2)) {
        const breakHours = calculateHoursDifference(emp.checkOut1, emp.checkIn2);
        const breakMins = Math.round(breakHours * 60);
        lunchBreakStr = breakMins > 0 ? `${breakMins} mins` : "0 mins";
      }

      const totalHoursNum = session1Hours + session2Hours;
      const extraHoursNum = totalHoursNum > standardShiftHours ? (totalHoursNum - standardShiftHours) : 0;

      let punctualityStatus = "On Time";
      if (isValidTime(emp.checkIn1)) {
        punctualityStatus = normalizeTime(emp.checkIn1) > standardStartTime ? "Late Arrival" : "On Time";
      }

      const isCheckedOut2 = isValidTime(emp.checkOut2);

      return {
        id: emp.id,
        employeeName: emp.employeeName,
        checkIn1: emp.checkIn1,
        checkOut1: emp.checkOut1,
        checkIn2: emp.checkIn2,
        checkOut2: emp.checkOut2,
        lunchBreak: lunchBreakStr,
        totalHours: `${totalHoursNum.toFixed(2)} hrs`,
        extraHours: `${extraHoursNum.toFixed(2)} hrs`,
        punctuality: punctualityStatus,
        currentStatus: isCheckedOut2 ? "Shift Completed" : emp.currentStatus
      };
    });

    // 3. Store processed master data directly into Cloudflare KV (`RATE_LIMIT_KV`)
    const todayDate = new Date().toISOString().split('T')[0];
    const snapshotKey = `attendance_master_${todayDate}`;
    
    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(snapshotKey, JSON.stringify(processedStaff));
      await env.RATE_LIMIT_KV.put("attendance_latest", JSON.stringify(processedStaff));
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Data fetched live from save_log.php, processed, and stored in KV.",
      date: todayDate,
      data: processedStaff
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

function isValidTime(timeStr) {
  return Boolean(timeStr && timeStr !== "--" && timeStr !== "00:00:00" && timeStr !== "null");
}

function normalizeTime(timeStr) {
  const parts = timeStr.trim().split(':');
  const h = parts[0].padStart(2, '0');
  const m = (parts[1] || '00').padStart(2, '0');
  const s = (parts[2] || '00').padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function calculateHoursDifference(timeStart, timeEnd) {
  try {
    const [h1, m1, s1] = normalizeTime(timeStart).split(':').map(Number);
    const [h2, m2, s2] = normalizeTime(timeEnd).split(':').map(Number);

    const totalSecondsStart = h1 * 3600 + m1 * 60 + s1;
    const totalSecondsEnd = h2 * 3600 + m2 * 60 + s2;

    const diffSeconds = totalSecondsEnd - totalSecondsStart;
    return diffSeconds > 0 ? diffSeconds / 3600 : 0;
  } catch (e) {
    return 0;
  }
}