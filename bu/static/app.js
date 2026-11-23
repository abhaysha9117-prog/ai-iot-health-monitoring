const $ = (id) => document.getElementById(id);
let rows = [], alerts = [], demoOn = true, tick = 0;
const date = new Date();
$("today").textContent = date.toLocaleDateString(undefined, {weekday:"short", month:"short", day:"numeric"});

function statusFor(key, value) {
  if (key === "hr") return value < 50 || value > 120 ? ["Outside range", true] : value < 60 || value > 100 ? ["Check reading", true] : ["In range", false];
  if (key === "spo2") return value < 90 ? ["Low", true] : value < 95 ? ["Below reference", true] : ["In range", false];
  return value < 35 || value >= 39 ? ["Outside range", true] : value < 36 || value >= 38 ? ["Check reading", true] : ["In range", false];
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
  $("source-status").textContent = r.source === "demo" ? (demoOn ? "Demo stream active" : "Last reading from demo") : "Device reading received";
  $("last-updated").textContent = `Updated ${new Date(r.timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
  drawChart(); updateAlerts();
}
function drawChart() {
  const canvas = $("trend-chart"), box = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (!box.width || !box.height) return;
  canvas.width = box.width*dpr; canvas.height = box.height*dpr;
  const c = canvas.getContext("2d"); c.scale(dpr,dpr);
  const w=box.width,h=box.height,p={l:28,r:8,t:10,b:22}, cw=w-p.l-p.r,ch=h-p.t-p.b;
  c.clearRect(0,0,w,h); c.font="10px DM Sans"; c.fillStyle="#a4acb8"; c.strokeStyle="#edf0f4"; c.lineWidth=1;
  for(let i=0;i<4;i++){let y=p.t+ch*i/3;c.beginPath();c.moveTo(p.l,y);c.lineTo(w-p.r,y);c.stroke();c.fillText([120,100,80,60][i],0,y+3)}
  const points=rows.slice(-24); if(points.length<2)return;
  const draw=(key,color,min,max)=>{c.beginPath();points.forEach((r,i)=>{const x=p.l+cw*i/(points.length-1),v=Number(r[key]),y=p.t+ch*(1-(v-min)/(max-min));i?c.lineTo(x,y):c.moveTo(x,y)});c.strokeStyle=color;c.lineWidth=2;c.lineJoin="round";c.stroke()};
  draw("heart_rate","#e9798a",50,130);draw("spo2","#7894eb",85,105);
  c.fillStyle="#9ba4b1";[[0,"Now"],[Math.floor((points.length-1)/2),"Earlier"],[points.length-1,"Latest"]].forEach(([i,t])=>{const x=p.l+cw*i/(points.length-1);c.fillText(t,Math.max(0,Math.min(w-38,x-12)),h-4)});
}
function updateAlerts() {
  const fresh=[];
  rows.slice(-40).forEach(r=>{
    const checks=[["Heart rate",r.heart_rate,"hr"],["SpO₂",r.spo2,"spo2"],["Temperature",r.temperature,"temp"]];
    checks.forEach(([name,value,key])=>{const [label,warn]=statusFor(key,Number(value));if(warn)fresh.push({name,label,value,time:r.timestamp})});
  });
  alerts=fresh.slice(-6).reverse();
  const high=alerts.length; $("alert-badge").textContent=high; $("alert-badge").style.display=high?"inline":"none";
  $("bell-dot").style.display=high?"block":"none";
  $("alert-status").textContent=high?`${high} recent threshold alert${high===1?"":"s"}`:"No active alerts";
  const list=$("alert-list");
  if(!alerts.length){list.innerHTML='<div class="empty-alert"><span>✓</span><b>All clear</b><small>No threshold alerts in recent readings.</small></div>';return}
  list.innerHTML=alerts.map(a=>`<div class="alert-item"><span class="alert-icon">!</span><div><b>${a.name}: ${a.label}</b><small>${a.value} · Prototype threshold notification</small></div><time>${new Date(a.time).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time></div>`).join("");
}
async function refresh(){try{const r=await fetch("/api/readings?limit=100");if(!r.ok)throw Error();render(await r.json())}catch{$("last-updated").textContent="Waiting for server connection"}}
async function demoTick(){if(!demoOn)return;tick++;
  const last=rows.at(-1)||{heart_rate:74,spo2:98,temperature:36.7};
  const body={heart_rate:Math.max(62,Math.min(103,Math.round(Number(last.heart_rate)+(Math.random()-.52)*8))),spo2:Math.max(95,Math.min(100,Number((Number(last.spo2)+(Math.random()-.52)*.8).toFixed(1)))),temperature:Number((Number(last.temperature)+(Math.random()-.5)*.12).toFixed(1)),source:"demo"};
  try{await fetch("/api/readings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});await refresh()}catch{}
}
$("demo-toggle").addEventListener("change",e=>{demoOn=e.target.checked;$("demo-state").textContent=demoOn?"On":"Off";$("source-status").textContent=demoOn?"Demo stream active":"Waiting for device data";document.querySelector(".demo-pill").style.opacity=demoOn?"1":".55"});
const scenarios={normal:{heart_rate:76,spo2:98,temperature:36.7},watch:{heart_rate:108,spo2:93,temperature:37.4},high:{heart_rate:134,spo2:88,temperature:39.2}};
document.querySelectorAll("[data-scenario]").forEach(button=>button.addEventListener("click",async()=>{
  demoOn=false;$("demo-toggle").checked=false;$("demo-state").textContent="Paused";document.querySelector(".demo-pill").style.opacity=".55";
  $("demo-hint").textContent="Loading simulated scenario…";
  try{await fetch("/api/readings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...scenarios[button.dataset.scenario],source:"demo"})});await refresh();
    const labels={normal:"Normal scenario loaded",watch:"Needs attention scenario loaded",high:"High-risk scenario loaded"};$("demo-hint").textContent=`${labels[button.dataset.scenario]} · simulated data`;
  }catch{$("demo-hint").textContent="Could not reach the local demo server"}
}));
$("clear-alerts").addEventListener("click",()=>{alerts=[];$("alert-badge").style.display="none";$("bell-dot").style.display="none";$("alert-status").textContent="No active alerts";$("alert-list").innerHTML='<div class="empty-alert"><span>✓</span><b>History cleared</b><small>New threshold alerts will appear here.</small></div>'});
window.addEventListener("resize",drawChart);refresh();setInterval(demoTick,8000);setInterval(refresh,20000);
