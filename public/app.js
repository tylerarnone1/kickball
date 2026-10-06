const $ = (id) => document.getElementById(id);
const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");

let EVENTS = [];
const now = new Date();
let view = new Date(now.getFullYear(), now.getMonth(), 1);

async function loadNews() {
  try {
    const news = await (await fetch("/api/news")).json();
    $("newsList").innerHTML = news
      .map((n) => `<article class="card"><time>${fmtDate(n.date)}</time><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`)
      .join("") || "<p>No news yet.</p>";
  } catch { $("newsList").innerHTML = "<p>Couldn't load news.</p>"; }
}

function renderCalendar() {
  const y = view.getFullYear(), m = view.getMonth();
  $("monthLabel").textContent = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  let html = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="cal-head">${d}</div>`).join("");
  for (let i = 0; i < first; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    const isToday = y === now.getFullYear() && m === now.getMonth() && d === now.getDate();
    const chips = EVENTS.filter((e) => e.date === iso)
      .map((e) => `<span class="chip ${esc(e.type)}" title="${esc(e.title)} – ${esc(e.time)}">${esc(e.title)}</span>`).join("");
    html += `<div class="cal-day${isToday ? " today" : ""}"><span class="n">${d}</span>${chips}</div>`;
  }
  $("calGrid").innerHTML = html;
}
$("prevMonth").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCalendar(); };
$("nextMonth").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCalendar(); };

async function loadEvents() {
  try { EVENTS = await (await fetch("/api/events")).json(); } catch { EVENTS = []; }
  renderCalendar();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const upcoming = EVENTS.filter((e) => e.date >= today);
  $("eventList").innerHTML = upcoming.length
    ? upcoming.map((e) => `<li class="${esc(e.type)}"><strong>${esc(e.title)}</strong><small>${fmtDate(e.date)} · ${esc(e.time)} · ${esc(e.location)}</small>${e.details ? `<span>${esc(e.details)}</span>` : ""}</li>`).join("")
    : "<li>No upcoming events scheduled.</li>";
}

const form = $("signupForm"), msg = $("formMsg");
const setMsg = (t, ok) => { msg.textContent = t; msg.className = "msg " + (ok ? "ok" : "err"); };
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  data.waiver = true;
  try {
    const res = await fetch("/api/signups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Something went wrong.");
    form.reset();
    setMsg("You're signed up! We'll email you details soon.", true);
  } catch (e) { setMsg(e.message, false); }
});

$("year").textContent = now.getFullYear();
loadNews();
loadEvents();
