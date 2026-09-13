// ============================================================
// DON-ANN SCHOOLS PORTAL — FRONTEND LOGIC
// ============================================================
// IMPORTANT: set SERVER_URL to your deployed backend's address
// once it's hosted on Render / Railway / Google Cloud Run.
// Example: "https://donann-portal-server.onrender.com"

const SERVER_URL = "https://donann-portal-server.onrender.com";

let token = null;
let currentUser = null;
let activeAssignment = null;
let activeView = "scoreEntry"; // "scoreEntry" | "classTeacher"
let currentStudents = [];
let currentMode = "test_exam";

const loginScreen = document.getElementById("loginScreen");
const dashScreen = document.getElementById("dashScreen");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const configWarning = document.getElementById("configWarning");

if (SERVER_URL.includes("PASTE_YOUR")) {
  configWarning.classList.remove("hidden");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  loginError.classList.add("hidden");

  try {
    const res = await fetch(`${SERVER_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      loginError.textContent = data.error || "Login failed.";
      loginError.classList.remove("hidden");
      return;
    }

    token = data.token;
    currentUser = data;

    loginScreen.classList.add("hidden");
    dashScreen.classList.remove("hidden");

    if (currentUser.isClassTeacher && currentUser.classTeacherOf) {
      activeView = "classTeacher";
      activeAssignment = null;
      renderDashboardShell();
      loadClassTeacherView(currentUser.classTeacherOf);
    } else {
      activeView = "scoreEntry";
      activeAssignment = data.assignments[0];
      renderDashboardShell();
      loadAssignment(activeAssignment);
    }
  } catch (err) {
    loginError.textContent = "Could not reach the server. Check your connection or try again shortly.";
    loginError.classList.remove("hidden");
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  token = null;
  currentUser = null;
  activeAssignment = null;
  dashScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
});

function renderDashboardShell() {
  document.getElementById("userLabel").textContent =
    currentUser.name + (currentUser.isClassTeacher ? " · Class Teacher" : "");

  const list = document.getElementById("assignmentList");
  list.innerHTML = "";

  // Class teacher section (view-only master sheet + report card) — shown first if applicable
  if (currentUser.isClassTeacher && currentUser.classTeacherOf) {
    const classTeacherBtn = document.createElement("button");
    classTeacherBtn.className = "assign-btn" + (activeView === "classTeacher" ? " active" : "");
    classTeacherBtn.innerHTML = `<div><div style="font-weight:600;">📋 Master Sheet & Report Cards</div><div class="sub">${currentUser.classTeacherOf}</div></div>`;
    classTeacherBtn.addEventListener("click", () => {
      activeView = "classTeacher";
      activeAssignment = null;
      renderDashboardShell();
      loadClassTeacherView(currentUser.classTeacherOf);
    });
    list.appendChild(classTeacherBtn);

    const divider = document.createElement("div");
    divider.style.cssText = "border-top:1px solid var(--line); margin: 12px 0;";
    list.appendChild(divider);

    const subjLabel = document.createElement("div");
    subjLabel.className = "sidebar-label";
    subjLabel.style.marginTop = "4px";
    subjLabel.textContent = "YOUR SUBJECTS TO SUBMIT";
    list.appendChild(subjLabel);
  }

  currentUser.assignments.forEach((a) => {
    const btn = document.createElement("button");
    btn.className = "assign-btn" + (activeView === "scoreEntry" && a === activeAssignment ? " active" : "");
    btn.innerHTML = `<div><div style="font-weight:600;">${a.subject}</div><div class="sub">${a.class}</div></div>`;
    btn.addEventListener("click", () => {
      activeView = "scoreEntry";
      activeAssignment = a;
      renderDashboardShell();
      loadAssignment(a);
    });
    list.appendChild(btn);
  });
}

async function loadClassTeacherView(className) {
  document.getElementById("scoreEntryPanel").classList.add("hidden");
  document.getElementById("classTeacherPanel").classList.remove("hidden");
  document.getElementById("ctClassName").textContent = className;
  document.getElementById("ctLoading").classList.remove("hidden");
  document.getElementById("ctContent").classList.add("hidden");
  document.getElementById("ctReportCardResult").classList.add("hidden");

  if (SERVER_URL.includes("PASTE_YOUR")) {
    document.getElementById("ctLoading").textContent = "Demo mode: connect a real server to see live master sheet data.";
    return;
  }

  try {
    const res = await fetch(
      `${SERVER_URL}/api/master-sheet?className=${encodeURIComponent(className)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    renderMasterSheetTable(data);
    populateReportCardStudentPicker(data.students);
    document.getElementById("ctLoading").classList.add("hidden");
    document.getElementById("ctContent").classList.remove("hidden");
  } catch (err) {
    document.getElementById("ctLoading").textContent = "Could not load master sheet: " + err.message;
  }
}

function renderMasterSheetTable(data) {
  const table = document.getElementById("ctMasterTable");
  const subjects = data.subjects || [];
  const perSubject = data.mode === "score100" ? 1 : 3;

  let headerHtml = "<tr><th>#</th><th>Student</th>";
  subjects.forEach((s) => {
    headerHtml += `<th style="text-align:center;">${s}</th>`;
  });
  headerHtml += "<th style='text-align:center;'>Missing</th></tr>";
  table.querySelector("thead").innerHTML = headerHtml;

  let bodyHtml = "";
  (data.students || []).forEach((row, i) => {
    const sn = row[0] || i + 1;
    const name = row[1] || "";
    bodyHtml += `<tr><td>${sn}</td><td>${name}</td>`;
    const missingSubjects = [];
    subjects.forEach((subj, si) => {
      const colStart = 2 + si * perSubject; // offset from A/B columns
      const totalColOffset = perSubject === 1 ? colStart : colStart + 2;
      const val = row[totalColOffset];
      if (!val || val === "") missingSubjects.push(subj);
      bodyHtml += `<td style="text-align:center;">${val || "—"}</td>`;
    });
    const missingCell = missingSubjects.length
      ? `<span style="color:#8C3A2E; font-size:12px;">${missingSubjects.length} missing</span>`
      : `<span style="color:#2F6B4F; font-size:12px;">✓ complete</span>`;
    bodyHtml += `<td style="text-align:center;">${missingCell}</td></tr>`;
  });
  table.querySelector("tbody").innerHTML = bodyHtml;
}

function populateReportCardStudentPicker(students) {
  const select = document.getElementById("ctStudentPicker");
  select.innerHTML = "";
  (students || []).forEach((row, i) => {
    const sn = row[0] || i + 1;
    const name = row[1] || "";
    if (!name) return;
    const opt = document.createElement("option");
    opt.value = sn;
    opt.textContent = `${sn}. ${name}`;
    select.appendChild(opt);
  });
}

document.getElementById("ctGenerateReportBtn")?.addEventListener("click", async () => {
  const sn = document.getElementById("ctStudentPicker").value;
  const className = currentUser.classTeacherOf;
  const resultBox = document.getElementById("ctReportCardResult");
  resultBox.classList.remove("hidden");
  resultBox.innerHTML = "Generating report card…";

  try {
    const res = await fetch(
      `${SERVER_URL}/api/report-card?className=${encodeURIComponent(className)}&sn=${encodeURIComponent(sn)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    renderReportCard(data.rows);
  } catch (err) {
    resultBox.innerHTML = `<span style="color:#8C3A2E;">Could not generate report card: ${err.message}</span>`;
  }
});

function renderReportCard(rows) {
  const resultBox = document.getElementById("ctReportCardResult");

  // rows[] mirrors the Report Card sheet layout: row indices match our xlsx template
  // Row 0: [selector label, "", "", "SELECT STUDENT S/N:", sn, ...]
  // Row 5 (index 5): student name row  -> ["Student Name:", name, "", "", "Term/Session:", term]
  // Row 6 (index 6): class row -> ["Class:", class, "", "", "Position:", position]
  // Row 8 (index 8): table header -> ["S/N","SUBJECT","TEST (40)","EXAM (60)","TOTAL (100)","GRADE","REMARK"]
  // rows 9.. : subject rows until a blank row, then Total/Average/Percentage/comments

  const studentName = rows[5]?.[1] || "";
  const term = rows[5]?.[5] || "";
  const className = rows[6]?.[1] || "";
  const position = rows[6]?.[5] || "";

  const headerRowIdx = rows.findIndex((r) => r[0] === "S/N");
  const subjectRows = [];
  let i = headerRowIdx + 1;
  while (i < rows.length && rows[i][0] && rows[i][0] !== "") {
    subjectRows.push(rows[i]);
    i++;
  }

  // find Total/Average/Percentage/comments after the subject rows
  let totalScore = "", average = "", percentage = "", teacherComment = "", principalComment = "";
  for (let j = i; j < rows.length; j++) {
    const label = (rows[j][0] || "").toLowerCase();
    if (label.includes("total score")) totalScore = rows[j][2] || "";
    if (label.includes("average")) average = rows[j][2] || "";
    if (label.includes("percentage")) percentage = rows[j][2] || "";
    if (label.includes("class teacher")) teacherComment = rows[j + 1]?.[0] || "";
    if (label.includes("principal")) principalComment = rows[j + 1]?.[0] || "";
  }

  let html = `
    <div id="printableReportCard" style="background:#fff; border:1px solid var(--line); border-radius:4px; padding:24px; margin-top:16px;">
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:16px;">
        <div class="crest-sm" style="width:48px;height:48px;">🎓</div>
        <div>
          <div style="font-family:Georgia,serif; font-size:20px;">Don-Ann Schools</div>
          <div style="font-size:13px; color:#8A8477;">Student Report Card — ${currentUser.classTeacherOf}</div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:4px;">
        <div><b>Student Name:</b> ${studentName}</div>
        <div><b>Term/Session:</b> ${term || "—"}</div>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13.5px; margin-bottom:14px;">
        <div><b>Class:</b> ${className}</div>
        <div><b>Position:</b> ${position}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:var(--navy); color:#fff;">
            <th style="padding:6px 8px; text-align:left;">S/N</th>
            <th style="padding:6px 8px; text-align:left;">SUBJECT</th>
            <th style="padding:6px 8px;">TEST (40)</th>
            <th style="padding:6px 8px;">EXAM (60)</th>
            <th style="padding:6px 8px;">TOTAL (100)</th>
            <th style="padding:6px 8px;">GRADE</th>
            <th style="padding:6px 8px;">REMARK</th>
          </tr>
        </thead>
        <tbody>
  `;

  subjectRows.forEach((row, idx) => {
    const bg = idx % 2 === 0 ? "#fff" : "#FAF8F3";
    html += `
      <tr style="background:${bg}; border-bottom:1px solid var(--line);">
        <td style="padding:5px 8px;">${row[0] ?? ""}</td>
        <td style="padding:5px 8px;">${row[1] ?? ""}</td>
        <td style="padding:5px 8px; text-align:center;">${row[2] ?? ""}</td>
        <td style="padding:5px 8px; text-align:center;">${row[3] ?? ""}</td>
        <td style="padding:5px 8px; text-align:center; font-weight:600;">${row[4] ?? ""}</td>
        <td style="padding:5px 8px; text-align:center;">${row[5] ?? ""}</td>
        <td style="padding:5px 8px; text-align:center;">${row[6] ?? ""}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>

      <div style="margin-top:14px; font-size:13.5px;">
        <div><b>Total Score:</b> ${totalScore}</div>
        <div><b>Average:</b> ${average}</div>
        <div><b>Percentage:</b> ${percentage}</div>
      </div>

      <div style="margin-top:14px; font-size:13.5px;">
        <b>Class Teacher's Comment:</b>
        <div style="border:1px solid var(--line); padding:8px; margin-top:4px; min-height:20px;">${teacherComment}</div>
      </div>

      <div style="margin-top:10px; font-size:13.5px;">
        <b>Principal's Comment:</b>
        <div style="border:1px solid var(--line); padding:8px; margin-top:4px; min-height:20px;">${principalComment}</div>
      </div>
    </div>

    <button id="printReportCardBtn" onclick="window.print()" class="submit-btn" style="margin-top:16px;">🖨️ Print this report card</button>
  `;

  resultBox.innerHTML = html;
}

async function loadAssignment(assignment) {
  document.getElementById("classTeacherPanel").classList.add("hidden");
  document.getElementById("scoreEntryPanel").classList.remove("hidden");
  document.getElementById("activeClass").textContent = assignment.class;
  document.getElementById("activeSubject").textContent = assignment.subject;
  document.getElementById("scoreTable").classList.add("hidden");
  document.getElementById("loadingRow").classList.remove("hidden");
  document.getElementById("savedFlash").classList.add("hidden");

  document.getElementById("liveNote").textContent =
    `Submitting here writes directly into the ${assignment.class} Google Sheet — only the ${assignment.subject} columns.`;

  if (SERVER_URL.includes("PASTE_YOUR")) {
    // Demo mode fallback so the page is still explorable before deployment
    currentStudents = ["Chidinma Eze", "Tunde Bakare", "Amara Nwosu"].map((name, i) => ({
      sn: i + 1, name, test: "", exam: "", score: "",
    }));
    currentMode = "test_exam";
    renderScoreTable();
    return;
  }

  try {
    const res = await fetch(
      `${SERVER_URL}/api/scores?className=${encodeURIComponent(assignment.class)}&subject=${encodeURIComponent(assignment.subject)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    currentStudents = data.students;
    currentMode = data.mode;
    renderScoreTable();
  } catch (err) {
    document.getElementById("loadingRow").textContent = "Could not load students: " + err.message;
  }
}

function renderScoreTable() {
  document.getElementById("loadingRow").classList.add("hidden");
  const table = document.getElementById("scoreTable");
  table.classList.remove("hidden");

  const col1Header = document.getElementById("col1Header");
  const col2Header = document.getElementById("col2Header");
  if (currentMode === "score100") {
    col1Header.textContent = "Score (100)";
    col2Header.style.display = "none";
  } else {
    col1Header.textContent = "Test (40)";
    col2Header.textContent = "Exam (60)";
    col2Header.style.display = "";
  }

  const body = document.getElementById("scoreBody");
  body.innerHTML = "";
  currentStudents.forEach((s, i) => {
    const tr = document.createElement("tr");
    if (currentMode === "score100") {
      tr.innerHTML = `
        <td>${s.name}</td>
        <td style="text-align:center;"><input class="score-input" type="number" min="0" max="100" data-idx="${i}" data-field="score" value="${s.score || ""}" /></td>
        <td></td>
        <td style="text-align:center;" class="total-cell">${s.score || "—"}</td>
      `;
    } else {
      tr.innerHTML = `
        <td>${s.name}</td>
        <td style="text-align:center;"><input class="score-input" type="number" min="0" max="40" data-idx="${i}" data-field="test" value="${s.test || ""}" /></td>
        <td style="text-align:center;"><input class="score-input" type="number" min="0" max="60" data-idx="${i}" data-field="exam" value="${s.exam || ""}" /></td>
        <td style="text-align:center;" class="total-cell">${computeTotal(s)}</td>
      `;
    }
    body.appendChild(tr);
  });

  body.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      currentStudents[idx][field] = e.target.value === "" ? "" : Number(e.target.value);
      const row = e.target.closest("tr");
      row.querySelector(".total-cell").textContent = computeTotal(currentStudents[idx]);
    });
  });
}

function computeTotal(s) {
  if (currentMode === "score100") return s.score === "" ? "—" : s.score;
  const t = s.test === "" || s.test === undefined ? 0 : Number(s.test);
  const e = s.exam === "" || s.exam === undefined ? 0 : Number(s.exam);
  if ((s.test === "" || s.test === undefined) && (s.exam === "" || s.exam === undefined)) return "—";
  return t + e;
}

document.getElementById("submitBtn").addEventListener("click", async () => {
  const savedFlash = document.getElementById("savedFlash");

  if (SERVER_URL.includes("PASTE_YOUR")) {
    savedFlash.textContent = "✓ (Demo mode — not actually saved. Deploy the server to enable real saving.)";
    savedFlash.classList.remove("hidden");
    setTimeout(() => savedFlash.classList.add("hidden"), 3000);
    return;
  }

  const scores = currentStudents.map((s, i) => ({
    row: 8 + i,
    test: s.test === "" ? "" : s.test,
    exam: s.exam === "" ? "" : s.exam,
    score: s.score === "" ? "" : s.score,
  }));

  try {
    const res = await fetch(`${SERVER_URL}/api/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ className: activeAssignment.class, subject: activeAssignment.subject, scores }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    savedFlash.textContent = "✓ " + data.message;
    savedFlash.classList.remove("hidden");
    setTimeout(() => savedFlash.classList.add("hidden"), 3000);
  } catch (err) {
    alert("Could not save scores: " + err.message);
  }
});
