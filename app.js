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
    activeAssignment = data.assignments[0];

    loginScreen.classList.add("hidden");
    dashScreen.classList.remove("hidden");
    renderDashboardShell();
    loadAssignment(activeAssignment);
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
  currentUser.assignments.forEach((a) => {
    const btn = document.createElement("button");
    btn.className = "assign-btn" + (a === activeAssignment ? " active" : "");
    btn.innerHTML = `<div><div style="font-weight:600;">${a.subject}</div><div class="sub">${a.class}</div></div>`;
    btn.addEventListener("click", () => {
      activeAssignment = a;
      renderDashboardShell();
      loadAssignment(a);
    });
    list.appendChild(btn);
  });
}

async function loadAssignment(assignment) {
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
