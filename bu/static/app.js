const $ = (id) => document.getElementById(id);
let rows = [], alerts = [], dispatchLogs = [], demoOn = true, tick = 0, emergencyAcked = false;
const date = new Date();
$("today").textContent = date.toLocaleDateString(undefined, {weekday:"short", month:"short", day:"numeric"});

function statusFor(key, value) {
  if (key === "hr") return value < 50 || value > 120 ? ["Outside Range", true] : value < 60 || value > 100 ? ["Check Reading", true] : ["In Range", false];
  if (key === "spo2") return value < 90 ? ["Low Oxygen", true] : value < 95 ? ["Below Reference", true] : ["In Range", false];
  return value < 35 || value >= 39 ? ["Outside Range", true] : value < 36 || value >= 37.6 ? ["Check Reading", true] : ["In Range", false];
}

function render(data) {
  rows = data.readings || [];
  const r = data.latest;
  if (!r) return;
  const vals = {hr:r.heart_rate, spo2:r.spo2, temp:r.temperature};
  $("hr").textContent = Math.round(vals.hr);
  $("spo2").textContent = Number(vals.spo2).toFixed(1);
  $("temp").textContent = Number(vals.temp).toFixed(1);
  for (const [key, value] of Object.entries(vals)) {
    const [label, warn] = statusFor(key, value), el = $(key + "-state");
    el.textContent = label; el.classList.toggle("warn", warn);
  }
  const risk = data.risk || {score:0, level:"Low", reasons:["No reading"]};
  $("risk-level").textContent = risk.level;
  $("risk-score").textContent = `${risk.score} / 100`;
  $("risk-note").textContent = risk.reasons.join(" · ");
  const meter = $("risk-meter"); meter.style.width = `${Math.max(3,risk.score)}%`;
  const colors = {Low:"#55bf91", Moderate:"#e7ad58", High:"#e97879"};
  meter.style.background = colors[risk.level] || colors.Low;
  $("risk-card").style.background = risk.level === "High" ? "#fff5f4" : risk.level === "Moderate" ? "#fffaf0" : "#f1faf6";
  $("source-status").textContent = r.source === "demo" ? (demoOn ? "Demo Stream Active" : "Last Reading From Demo") : "Device Reading Received";
  $("last-updated").textContent = `Updated ${new Date(r.timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;

  // Trigger or hide Emergency Hospital Escalation Banner
  const banner = $("emergency-banner");
  if (risk.level === "High") {
    if (!emergencyAcked && banner) {
      const current = profiles.find(p => p.id === activeId) || { id: activeId, name: "Patient" };
      $("emergency-details").textContent = `Patient: ${current.name} (${current.id}) · Vitals: HR ${Math.round(vals.hr)} bpm, SpO₂ ${Number(vals.spo2).toFixed(1)}%, Temp ${Number(vals.temp).toFixed(1)}°C — Automated SMS & triage packet dispatched to City General Hospital Desk.`;
      banner.style.display = "flex";
    }
  } else {
    emergencyAcked = false;
    if (banner) banner.style.display = "none";
  }

  drawChart(); updateAlerts();
}

function drawChart() {
  const canvas = $("trend-chart"), box = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (!box.width || !box.height) return;
  canvas.width = box.width * dpr;
  canvas.height = box.height * dpr;
  const c = canvas.getContext("2d");
  c.scale(dpr, dpr);

  const w = box.width, h = box.height;
  const p = {l: 28, r: 30, t: 10, b: 22};
  const cw = w - p.l - p.r, ch = h - p.t - p.b;

  c.clearRect(0, 0, w, h);
  c.font = "10px DM Sans";
  c.fillStyle = "#a4acb8";
  c.strokeStyle = "#edf0f4";
  c.lineWidth = 1;

  const leftLabels = [120, 100, 80, 60];
  const rightLabels = ["40°", "38.5°", "37°", "35.5°"];
  for (let i = 0; i < 4; i++) {
    const y = p.t + (ch * i) / 3;
    c.beginPath();
    c.moveTo(p.l, y);
    c.lineTo(w - p.r, y);
    c.stroke();
    c.fillStyle = "#a4acb8";
    c.fillText(leftLabels[i], 0, y + 3);
    c.fillStyle = "#d97706";
    c.fillText(rightLabels[i], w - p.r + 4, y + 3);
  }

  const points = rows.slice(-24);
  if (points.length < 2) return;

  const draw = (key, color, min, max, dashed = false) => {
    c.save();
    c.beginPath();
    if (dashed) c.setLineDash([4, 3]);
    points.forEach((r, i) => {
      const x = p.l + (cw * i) / (points.length - 1);
      const v = Number(r[key]);
      const clamped = Math.max(min, Math.min(max, v));
      const y = p.t + ch * (1 - (clamped - min) / (max - min));
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    });
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.lineJoin = "round";
    c.stroke();
    c.restore();
  };

  draw("heart_rate", "#e9798a", 50, 130);
  draw("spo2", "#7894eb", 85, 105);
  draw("temperature", "#f59e0b", 35.0, 40.5);

  c.fillStyle = "#9ba4b1";
  [
    [0, "Earlier"],
    [Math.floor((points.length - 1) / 2), "Recent"],
    [points.length - 1, "Latest"]
  ].forEach(([i, t]) => {
    const x = p.l + (cw * i) / (points.length - 1);
    c.fillText(t, Math.max(0, Math.min(w - 38, x - 12)), h - 4);
  });
}

function updateAlerts() {
  const fresh=[];
  rows.slice(-40).forEach(r=>{
    const checks=[["Heart Rate",r.heart_rate,"hr"],["SpO₂",r.spo2,"spo2"],["Temperature",r.temperature,"temp"]];
    checks.forEach(([name,value,key])=>{const [label,warn]=statusFor(key,Number(value));if(warn)fresh.push({name,label,value,time:r.timestamp})});
  });
  alerts=[...dispatchLogs, ...fresh.slice(-6).reverse()].slice(0, 8);
  const high=alerts.length; $("alert-badge").textContent=high; $("alert-badge").style.display=high?"inline":"none";
  $("bell-dot").style.display=high?"block":"none";
  $("alert-status").textContent=high?`${high} Recent Alert${high===1?"":"s"}`:"No Active Alerts";
  const list=$("alert-list");
  if(!alerts.length){list.innerHTML='<div class="empty-alert"><span>✓</span><b>All Clear</b><small>No threshold alerts in recent readings.</small></div>';return}
  list.innerHTML=alerts.map(a=>`<div class="alert-item"><span class="alert-icon">${a.isDispatch ? "📞" : "!"}</span><div><b>${a.name}: ${a.label}</b><small>${a.value} · ${a.isDispatch ? "Hospital Escalation Log" : "ML & Threshold Alert"}</small></div><time>${new Date(a.time).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time></div>`).join("");
}

// Patient Profile Switcher, Creator & Delete
const defaultProfiles = [
  { id: "PT-101", name: "Abhay Kumar" },
  { id: "PT-102", name: "Abhijeet Singh" },
  { id: "PT-103", name: "Amrita Sharma" },
  { id: "PT-104", name: "Anand Verma" }
];
let profiles = JSON.parse(localStorage.getItem("pulsepoint_profiles") || "null") || defaultProfiles;
if (!Array.isArray(profiles) || profiles.length === 0) profiles = defaultProfiles;
let activeId = localStorage.getItem("pulsepoint_active_id") || profiles[0].id;

async function refresh(){
  try{
    const r = await fetch(`/api/readings?limit=100&patient_id=${encodeURIComponent(activeId)}`);
    if(!r.ok) throw Error();
    render(await r.json());
  }catch{
    $("last-updated").textContent="Waiting for server connection";
  }
}

async function demoTick(){
  if(!demoOn) return;
  tick++;
  const last = rows.at(-1) || {heart_rate:74, spo2:98, temperature:36.7};
  const body = {
    patient_id: activeId,
    heart_rate: Math.max(62, Math.min(103, Math.round(Number(last.heart_rate) + (Math.random() - .52) * 8))),
    spo2: Math.max(95, Math.min(100, Number((Number(last.spo2) + (Math.random() - .52) * .8).toFixed(1)))),
    temperature: Number((Number(last.temperature) + (Math.random() - .5) * .12).toFixed(1)),
    source: "demo"
  };
  try{
    await fetch("/api/readings", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    await refresh();
  }catch{}
}

$("demo-toggle").addEventListener("change",e=>{demoOn=e.target.checked;$("demo-state").textContent=demoOn?"On":"Off";$("source-status").textContent=demoOn?"Demo Stream Active":"Waiting for Device Data";document.querySelector(".demo-pill").style.opacity=demoOn?"1":".55"});

const scenarios={normal:{heart_rate:76,spo2:98,temperature:36.7},watch:{heart_rate:108,spo2:93,temperature:37.4},high:{heart_rate:134,spo2:88,temperature:39.2}};
document.querySelectorAll("[data-scenario]").forEach(button=>button.addEventListener("click",async()=>{
  demoOn=false;$("demo-toggle").checked=false;$("demo-state").textContent="Paused";document.querySelector(".demo-pill").style.opacity=".55";
  if (button.dataset.scenario === "high") emergencyAcked = false;
  $("demo-hint").textContent="Loading simulated scenario…";
  try{
    await fetch("/api/readings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...scenarios[button.dataset.scenario], patient_id:activeId, source:"demo"})});
    await refresh();
    const labels={normal:"Normal Scenario Loaded",watch:"Needs Attention Scenario Loaded",high:"High Risk Scenario Loaded"};
    $("demo-hint").textContent=`${labels[button.dataset.scenario]} · Simulated Data`;
  }catch{$("demo-hint").textContent="Could not reach the local demo server"}
}));

// Emergency Banner Actions
$("call-hospital-btn")?.addEventListener("click", () => {
  const current = profiles.find(p => p.id === activeId) || { id: activeId, name: "Patient" };
  dispatchLogs.unshift({
    name: "Hospital Triage Call Initiated",
    label: `${current.name} (${current.id})`,
    value: "Simulated Call to City General Triage Desk (+91-3224-252000)",
    time: new Date().toISOString(),
    isDispatch: true
  });
  updateAlerts();
  $("call-hospital-btn").textContent = "✓ Triage Call Logged";
  setTimeout(() => { $("call-hospital-btn").textContent = "📞 Call Hospital Desk"; }, 3000);
});

$("ack-emergency-btn")?.addEventListener("click", () => {
  emergencyAcked = true;
  $("emergency-banner").style.display = "none";
});

$("clear-alerts").addEventListener("click",()=>{alerts=[];dispatchLogs=[];$("alert-badge").style.display="none";$("bell-dot").style.display="none";$("alert-status").textContent="No Active Alerts";$("alert-list").innerHTML='<div class="empty-alert"><span>✓</span><b>History Cleared</b><small>New threshold alerts will appear here.</small></div>'});
window.addEventListener("resize",drawChart);
setInterval(demoTick,8000);
setInterval(refresh,20000);

// Sidebar smooth scroll & active highlight
document.querySelectorAll(".nav-item").forEach(link => {
  link.addEventListener("click", (e) => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
    const targetId = link.getAttribute("href");
    if (targetId && targetId.startsWith("#") && targetId.length > 1) {
      e.preventDefault();
      document.querySelector(targetId)?.scrollIntoView({ behavior: "smooth" });
    }
  });
});

document.querySelector(".icon-btn")?.addEventListener("click", () => {
  document.getElementById("alerts")?.scrollIntoView({ behavior: "smooth" });
});

function getInitials(name) {
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase() || "PT";
}

function applyActiveProfile() {
  const current = profiles.find(p => p.id === activeId) || profiles[0];
  activeId = current.id;
  emergencyAcked = false;
  const initials = getInitials(current.name);
  const firstName = current.name.trim().split(/\s+/)[0];
  $("side-avatar").textContent = initials;
  $("top-avatar").textContent = initials;
  $("side-name").textContent = current.name;
  $("side-role").textContent = `Patient Profile · ${current.id}`;
  $("welcome-name").textContent = firstName;
  refresh();
}

function renderProfileList() {
  $("profile-list").innerHTML = profiles.map(p => `
    <div style="display:flex; gap:6px; align-items:stretch;">
      <button type="button" data-select-id="${p.id}" style="flex:1; display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border:1px solid ${p.id === activeId ? "#10b981" : "#e2e8f0"}; background:${p.id === activeId ? "#ecfdf5" : "#f8fafc"}; border-radius:10px; cursor:pointer; text-align:left;">
        <div>
          <strong style="display:block; font-size:14px; color:#0f172a;">${p.name}</strong>
          <small style="color:#64748b;">ID: ${p.id}</small>
        </div>
        <span style="font-size:12px; font-weight:700; color:${p.id === activeId ? "#059669" : "#94a3b8"};">${p.id === activeId ? "Active ✓" : "Select"}</span>
      </button>
      ${profiles.length > 1 ? `<button type="button" data-delete-id="${p.id}" title="Delete Profile" style="padding:0 12px; border:1px solid #fecaca; background:#fef2f2; color:#dc2626; border-radius:10px; cursor:pointer; font-weight:700;">✕</button>` : ""}
    </div>
  `).join("");

  document.querySelectorAll("[data-select-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeId = btn.dataset.selectId;
      localStorage.setItem("pulsepoint_active_id", activeId);
      applyActiveProfile();
      renderProfileList();
      $("profile-modal").style.display = "none";
    });
  });

  document.querySelectorAll("[data-delete-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (profiles.length <= 1) return;
      const delId = btn.dataset.deleteId;
      profiles = profiles.filter(p => p.id !== delId);
      if (activeId === delId) {
        activeId = profiles[0].id;
        localStorage.setItem("pulsepoint_active_id", activeId);
        applyActiveProfile();
      }
      localStorage.setItem("pulsepoint_profiles", JSON.stringify(profiles));
      renderProfileList();
    });
  });
}

["profile-trigger", "top-avatar"].forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener("click", () => {
      renderProfileList();
      $("profile-modal").style.display = "flex";
    });
  }
});

$("close-profile-modal")?.addEventListener("click", () => {
  $("profile-modal").style.display = "none";
});

$("profile-modal")?.addEventListener("click", (e) => {
  if (e.target === $("profile-modal")) $("profile-modal").style.display = "none";
});

$("create-profile-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("new-patient-name").value.trim();
  const id = $("new-patient-id").value.trim().toUpperCase();
  if (!name || !id) return;
  profiles = profiles.filter(p => p.id !== id);
  profiles.push({ id, name });
  activeId = id;
  localStorage.setItem("pulsepoint_profiles", JSON.stringify(profiles));
  localStorage.setItem("pulsepoint_active_id", activeId);
  $("new-patient-name").value = "";
  $("new-patient-id").value = "";
  applyActiveProfile();
  renderProfileList();
  $("profile-modal").style.display = "none";
});

// Export Active Patient Vitals Report as CSV
$("export-csv")?.addEventListener("click", () => {
  if (!rows || rows.length === 0) return;
  const current = profiles.find(p => p.id === activeId) || { id: activeId, name: "Patient" };
  const header = ["Patient_ID", "Patient_Name", "Timestamp", "Heart_Rate_bpm", "SpO2_Percent", "Temperature_C", "Source"];
  const csvLines = [
    header.join(","),
    ...rows.map(r => [
      `"${current.id}"`,
      `"${current.name.replace(/"/g, '""')}"`,
      `"${r.timestamp}"`,
      Math.round(Number(r.heart_rate)),
      Number(r.spo2).toFixed(1),
      Number(r.temperature).toFixed(1),
      `"${r.source}"`
    ].join(","))
  ];
  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${current.id}_${current.name.replace(/\s+/g, "_")}_Vitals_Report.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

applyActiveProfile();