/* =========================================================
   Chrono Ultra — Stopwatch & Timer
   Sections: State, Persistence, Formatting, Rendering,
   Timing engine, Controls, Laps, Export, Settings, Toasts,
   Modal, Keyboard shortcuts, Init
   ========================================================= */

/* ---------- State ---------- */
const state = {
  mode: 'stopwatch',
  pomodoroPhase: "focus",

pomodoroCycle: 1,

pomodoroSettings:{

    focus:25*60*1000,

    shortBreak:5*60*1000,

    longBreak:15*60*1000

},        // 'stopwatch' | 'timer'
  running: false,
  startTime: 0,             // Date.now() at last (re)start
  elapsed: 0,               // ms accumulated while not running
  laps: [],                 // { total, split } newest first
  timerDuration: 30000,     // ms, timer mode target
  alarmFired: false,
  soundOn: true,
  theme: null,              // 'dark' | 'light'
  accent: 'violet'
};

const ACCENTS = {
  violet: ['#7c6bff', '#22d3ee'],
  rose:   ['#fb6b9c', '#ff9f68'],
  lime:   ['#34e0a1', '#a7e639'],
  amber:  ['#ffb454', '#ff7a59'],
  ocean:  ['#22d3ee', '#3b82f6']
};

const SESSION_KEY = 'chronoUltraSession';
const SETTINGS_KEY = 'chronoUltraSettings';
const HISTORY_KEY = "chronoHistory";

/* ---------- Elements ---------- */
const hrsEl = document.getElementById('hrs');
const minsEl = document.getElementById('mins');
const secsEl = document.getElementById('secs');
const msEl = document.getElementById('ms');
const statusLabel = document.getElementById('statusLabel');

const modeStopwatchBtn = document.getElementById('modeStopwatchBtn');
const modeTimerBtn = document.getElementById('modeTimerBtn');
const modePomodoroBtn = document.getElementById("modePomodoroBtn");
const modeThumb = document.getElementById('modeThumb');
const timerSetup = document.getElementById('timerSetup');
const pomodoroSetup = document.getElementById("pomodoroSetup");
const focusCard = document.getElementById("focusCard");
const shortBreakCard = document.getElementById("shortBreakCard");
const longBreakCard = document.getElementById("longBreakCard");
const presetBtns = Array.from(document.querySelectorAll('.preset-btn'));
const customHour = document.getElementById("customHour");
const customMin = document.getElementById('customMin');
const customSec = document.getElementById('customSec');
const setTimerBtn = document.getElementById('setTimerBtn');



const startBtn = document.getElementById('startBtn');
const startLabel = document.getElementById('startLabel');
const lapBtn = document.getElementById('lapBtn');
const resetBtn = document.getElementById('resetBtn');

const undoBtn = document.getElementById('undoBtn');
const copyBtn = document.getElementById('copyBtn');
const csvBtn = document.getElementById('csvBtn');
const jsonBtn = document.getElementById('jsonBtn');

const lapsEl = document.getElementById('laps');
const lapsEmpty = document.getElementById('lapsEmpty');
const lapsBadge = document.getElementById('lapsBadge');
const chartBars = document.getElementById('chartBars');

const stat1Value = document.getElementById('stat1Value');
const stat2Value = document.getElementById('stat2Value');
const stat3Value = document.getElementById('stat3Value');
const stat4Value = document.getElementById('stat4Value');

const sessionTime = document.getElementById("sessionTime");
const longestLap = document.getElementById("longestLap");
const shortestLap = document.getElementById("shortestLap");
const consistencyScore = document.getElementById("consistencyScore");

const ringProgress = document.getElementById('ringProgress');
const ringCircumference = 2 * Math.PI * 138;
ringProgress.style.strokeDasharray = String(ringCircumference);

const themeBtn = document.getElementById('themeBtn');
const soundBtn = document.getElementById('soundBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeHelpBtn = document.getElementById('closeHelpBtn');

const swatchesEl = document.getElementById('swatches');
const toastContainer = document.getElementById('toastContainer');

const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

let rafId = null;
const lapChartCanvas = document.getElementById("lapChart");

let lapChart = null;

/* ---------- Audio ---------- */
let audioCtx = null;
function beep(freq, duration, volume) {
  if (!state.soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { /* audio unsupported */ }
}

function alarmSequence() {
  let count = 0;
  const ring = () => {
    beep(1046, 0.18, 0.12);
    count += 1;
    if (count < 4) setTimeout(ring, 320);
  };
  ring();
  if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 250]);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Time is up!', { body: 'Your Chrono Ultra timer has finished.' }); } catch (e) {}
  }
}

/* ---------- Formatting ---------- */
function formatParts(ms) {
  const clamped = Math.max(0, ms);
  const centiseconds = Math.floor((clamped % 1000) / 10);
  const seconds = Math.floor(clamped / 1000) % 60;
  const minutes = Math.floor(clamped / 60000) % 60;
  const hours = Math.floor(clamped / 3600000);
  return {
    h: String(hours).padStart(2, '0'),
    m: String(minutes).padStart(2, '0'),
    s: String(seconds).padStart(2, '0'),
    cs: String(centiseconds).padStart(2, '0'),
    showHours: hours > 0
  };
}

function formatFull(ms) {
  const p = formatParts(ms);
  return p.showHours ? `${p.h}:${p.m}:${p.s}.${p.cs}` : `${p.m}:${p.s}.${p.cs}`;
}

/* ---------- Current elapsed / remaining ---------- */
function currentElapsed() {
  return state.running ? (Date.now() - state.startTime + state.elapsed) : state.elapsed;
}

/* ---------- Render loop ---------- */
function renderTime() {
  let displayMs;

  if (state.mode === 'timer' || state.mode === 'pomodoro') {
    let duration;

if (state.mode === "timer") {
    duration = state.timerDuration;
} else {
    duration = state.pomodoroSettings[state.pomodoroPhase];
}

const remaining = duration - currentElapsed();
displayMs = remaining;
displayMs = Math.max(0, duration - currentElapsed());

    if (remaining <= 0 && state.running && !state.alarmFired) {
      state.alarmFired = true;
      state.running = false;
      cancelAnimationFrame(rafId);
      displayMs = 0;
      onTimerFinished();
    }
  } else {
    displayMs = currentElapsed();
  }

  const p = formatParts(displayMs);
  hrsEl.hidden = !p.showHours;
  if (p.showHours) hrsEl.firstChild.textContent = p.h;
  minsEl.textContent = p.m;
  secsEl.textContent = p.s;
  msEl.textContent = '.' + p.cs;

  // Ring
  let fraction;

if (state.mode === "timer" || state.mode === "pomodoro") {

    const totalDuration =
        state.mode === "timer"
            ? state.timerDuration
            : state.pomodoroSettings[state.pomodoroPhase];

    fraction = totalDuration > 0
        ? Math.max(0, Math.min(1, displayMs / totalDuration))
        : 0;

} else {

    fraction = (currentElapsed() % 60000) / 60000;

}
ringProgress.style.strokeDashoffset =
    String(ringCircumference * (1 - fraction));

sessionTime.textContent = formatFull(currentElapsed());

if (state.running) {
    rafId = requestAnimationFrame(renderTime);
}

}

function onTimerFinished() {

    ringProgress.classList.remove("running");
    ringProgress.classList.add("alarm");

    statusLabel.textContent = "Time up";
    statusLabel.className = "status is-alarm";

    startLabel.textContent = "Start";
    startBtn.classList.remove("is-running");
    lapBtn.disabled = true;

    alarmSequence();

    showToast("Timer finished");

    saveSession();

    if (state.mode === "pomodoro") {
        nextPomodoroPhase();
    }
}
/* ---------- Controls ---------- */
function startPause() {
 if (
    state.mode === "timer" &&
    !state.running &&
    state.timerDuration <= 0
) {
    showToast("Set a duration first");
    return;
}
  if (!state.running) {
    if (state.mode === "timer" && state.alarmFired) {
    state.elapsed = 0;
    state.alarmFired = false;
    ringProgress.classList.remove("alarm");
}
    if (
    "Notification" in window &&
    Notification.permission === "default" &&
    state.mode === "timer"
) {
    Notification.requestPermission().catch(() => {});
}
    state.running = true;
    state.startTime = Date.now();
    startLabel.textContent = 'Pause';
    startBtn.classList.add('is-running');
    ringProgress.classList.remove('alarm');
    ringProgress.classList.add('running');
    lapBtn.disabled = false;
    statusLabel.textContent = 'Running';
    statusLabel.className = 'status is-running';
    beep(880, 0.09, 0.06);
    renderTime();
  } else {
    state.running = false;
    state.elapsed += Date.now() - state.startTime;
    cancelAnimationFrame(rafId);
    startLabel.textContent = 'Resume';
    startBtn.classList.remove('is-running');
    ringProgress.classList.remove('running');
    statusLabel.textContent = 'Paused';
    statusLabel.className = 'status is-paused';
    beep(440, 0.12, 0.06);
  }
  saveSession();
}

function recordLap() {
  const total = currentElapsed();
  const previousTotal = state.laps.length ? state.laps[0].total : 0;
  const split = total - previousTotal;
  state.laps.unshift({ total, split });
  beep(1200, 0.06, 0.05);
  if (navigator.vibrate) navigator.vibrate(30);
  renderLaps();
  renderStats();
  renderChartAnalytics();
  saveSession();
}  

function undoLap() {
  if (state.laps.length === 0) return;
  state.laps.shift();
  renderLaps();
  renderStats();
  renderChartAnalytics();
  saveSession();
  renderHistory();
  showToast('Last lap undone');
}

function resetAll() {
  if ((state.laps.length > 0 || currentElapsed() > 0) &&
      !window.confirm('Reset will clear the current time and all laps. Continue?')) {
    return;
  }
  if(currentElapsed()>0){

const history=loadHistory();

history.unshift({

time:formatFull(currentElapsed()),

date:new Date().toLocaleString(),

laps:state.laps.length

});

saveHistory(history);
renderHistory();

}
  state.running = false;
  cancelAnimationFrame(rafId);
  state.elapsed = 0;
  state.laps = [];
  state.alarmFired = false;

  hrsEl.hidden = true;
  minsEl.textContent = '00';
  secsEl.textContent = '00';
  msEl.textContent = '.00';
  ringProgress.style.strokeDashoffset = String(ringCircumference);
  ringProgress.classList.remove('running', 'alarm');
  startLabel.textContent = 'Start';
  startBtn.classList.remove('is-running');
  lapBtn.disabled = true;
  statusLabel.textContent = 'Ready';
  statusLabel.className = 'status';

  if (state.mode === 'timer') {
    renderTime();
  }

  renderLaps();
  renderStats();
  renderChartAnalytics();
  saveSession();
}

/* ---------- Mode switching ---------- */
function switchMode(mode) {
  if (mode === state.mode) return;
  if (state.running || state.laps.length > 0 || state.elapsed > 0) {
    if (!window.confirm('Switching modes will reset the current session. Continue?')) return;
  }

  state.mode = mode;
  state.running = false;
  cancelAnimationFrame(rafId);
  state.elapsed = 0;
  state.laps = [];
  state.alarmFired = false;

  const isTimer = mode==="timer";

  const isPomodoro = mode==="pomodoro";
  modeStopwatchBtn.classList.toggle(
    "is-active",
    mode === "stopwatch"
);

modeTimerBtn.classList.toggle(
    "is-active",
    mode === "timer"
);

modePomodoroBtn.classList.toggle(
    "is-active",
    mode === "pomodoro"
);

modeStopwatchBtn.setAttribute(
    "aria-selected",
    String(mode === "stopwatch")
);

modeTimerBtn.setAttribute(
    "aria-selected",
    String(mode === "timer")
);

modePomodoroBtn.setAttribute(
    "aria-selected",
    String(mode === "pomodoro")
);

// Abhi thumb sirf Timer ke liye hi move karega
modeThumb.classList.remove("pos-1", "pos-2");

if (mode === "timer") {
    modeThumb.classList.add("pos-1");
}
else if (mode === "pomodoro") {
    state.elapsed = 0;
    state.pomodoroPhase = "focus";
    state.alarmFired = false;

    modeThumb.classList.add("pos-2");

    renderTime();   // <-- add this
}
  // Timer section
timerSetup.hidden = !isTimer;

// Pomodoro section
pomodoroSetup.hidden = !isPomodoro;
  hrsEl.hidden = true;
  if (!isPomodoro) {
    hrsEl.hidden = true;
    minsEl.textContent = "00";
    secsEl.textContent = "00";
    msEl.textContent = ".00";
}
  ringProgress.classList.remove('running', 'alarm');
  startLabel.textContent = 'Start';
  startBtn.classList.remove('is-running');
  lapBtn.disabled = true;
  statusLabel.textContent = 'Ready';
  statusLabel.className = 'status';

  if (isTimer) {
    renderTime();
  } else {
    ringProgress.style.strokeDashoffset = String(ringCircumference);
  }

  renderLaps();
  renderStats();
  renderChartAnalytics();
  saveSession();
}
function setPomodoroPhase(phase) {

    state.running = false;
    cancelAnimationFrame(rafId);

    state.elapsed = 0;
    state.alarmFired = false;

    state.pomodoroPhase = phase;

    focusCard.classList.remove("active");
    shortBreakCard.classList.remove("active");
    longBreakCard.classList.remove("active");

    if (phase === "focus")
        focusCard.classList.add("active");

    if (phase === "shortBreak")
        shortBreakCard.classList.add("active");

    if (phase === "longBreak")
        longBreakCard.classList.add("active");

    startLabel.textContent = "Start";
    statusLabel.textContent = "Ready";

    renderTime();

    pomodoroCycleLabel.textContent =
    `Cycle ${state.pomodoroCycle} / 4`;
}
function nextPomodoroPhase() {

    if (state.pomodoroPhase === "focus") {

        if (state.pomodoroCycle < 4) {
            setPomodoroPhase("shortBreak");
        } else {
            setPomodoroPhase("longBreak");
        }

    }
    else if (state.pomodoroPhase === "shortBreak") {

        state.pomodoroCycle++;
        setPomodoroPhase("focus");

    }
    else if (state.pomodoroPhase === "longBreak") {

        state.pomodoroCycle = 1;
        setPomodoroPhase("focus");

    }

    pomodoroCycleLabel.textContent =
        `Cycle ${state.pomodoroCycle}/4`;
}
/* ---------- Timer duration setup ---------- */
function setTimerDuration(ms, sourceBtn) {
  state.timerDuration = ms;
  presetBtns.forEach(b => b.classList.remove('is-selected'));
  if (sourceBtn) sourceBtn.classList.add('is-selected');
  if (!state.running) {
    ringProgress.style.strokeDashoffset = '0';
  }
  saveSession();
}

presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const secs = Number(btn.dataset.secs);
    setTimerDuration(secs * 1000, btn);
  });
});

setTimerBtn.addEventListener("click", () => {

    const hrs = Math.max(0, Number(customHour.value) || 0);
    const mins = Math.max(0, Number(customMin.value) || 0);
    const secs = Math.max(0, Math.min(59, Number(customSec.value) || 0));

    const total =
        hrs * 3600000 +
        mins * 60000 +
        secs * 1000;

    if (total <= 0) {
        showToast("Enter valid time");
        return;
    }

    setTimerDuration(total, null);

    renderTime();

    showToast(`Timer set to ${formatFull(total)}`);

});

/* ---------- Rendering: laps, chart, stats ---------- */
function renderLaps() {
  lapsEl.innerHTML = '';
  lapsBadge.textContent = String(state.laps.length);

  const hasLaps = state.laps.length > 0;
  undoBtn.disabled = !hasLaps;
  copyBtn.disabled = !hasLaps;
  csvBtn.disabled = !hasLaps;
  jsonBtn.disabled = !hasLaps;

  if (!hasLaps) {
    lapsEl.appendChild(lapsEmpty);
    chartBars.innerHTML = '';
    return;
  }

  const splits = state.laps.map(l => l.split);
  const bestSplit = Math.min(...splits);
  const worstSplit = Math.max(...splits);
  const hasVariance = splits.length > 1 && bestSplit !== worstSplit;

  state.laps.forEach((lap, index) => {
    const lapNumber = state.laps.length - index;
    const li = document.createElement('li');
    if (hasVariance && lap.split === bestSplit) li.classList.add('best');
    else if (hasVariance && lap.split === worstSplit) li.classList.add('worst');
    li.innerHTML =
      `<span class="lap-num">Lap ${lapNumber}</span>` +
      `<span class="lap-split">${formatFull(lap.split)}</span>` +
      `<span class="lap-total">${formatFull(lap.total)}</span>`;
    lapsEl.appendChild(li);
  });

  renderChart(splits, bestSplit, worstSplit, hasVariance);
}

function renderChart(splits, best, worst, hasVariance) {
  chartBars.innerHTML = '';
  const ordered = splits.slice().reverse(); // oldest first, left to right
  const max = Math.max(...ordered);
  ordered.forEach(split => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    const heightPct = max > 0 ? Math.max(6, (split / max) * 100) : 6;
    bar.style.height = heightPct + '%';
    if (hasVariance && split === best) bar.classList.add('best');
    else if (hasVariance && split === worst) bar.classList.add('worst');
    chartBars.appendChild(bar);
  });
}

function renderStats() {

    stat1Value.textContent = String(state.laps.length);

    // Session Time always updates
    sessionTime.textContent = formatFull(currentElapsed());

    if(state.laps.length===0){

        stat2Value.textContent="—";
        stat3Value.textContent="—";
        stat4Value.textContent="—";

        longestLap.textContent="—";
        shortestLap.textContent="—";
        consistencyScore.textContent="100%";
         lapChart?.destroy();
        return;

    }
    const splits = state.laps.map(l=>l.split);

    const best = Math.min(...splits);

    const worst = Math.max(...splits);

    const avg = splits.reduce((a,b)=>a+b,0)/splits.length;

    stat2Value.textContent = formatFull(best);
    stat3Value.textContent = formatFull(avg);
    stat4Value.textContent = formatFull(worst);

    longestLap.textContent = formatFull(worst);
    shortestLap.textContent = formatFull(best);

    const variance = splits.reduce((sum,val)=>sum+Math.pow(val-avg,2),0)/splits.length;

    const deviation = Math.sqrt(variance);

    const score = Math.max(0,100-Math.round((deviation/avg)*100));

    consistencyScore.textContent = score + "%";

} 
function renderChartAnalytics(){

    if(!lapChartCanvas) return;

    const labels = state.laps
        .slice()
        .reverse()
        .map((_,i)=>`Lap ${i+1}`);

    const data = state.laps
        .slice()
        .reverse()
        .map(l=>+(l.split/1000).toFixed(2));

    if(lapChart){
        lapChart.destroy();
    }

    const ctx = lapChartCanvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0,0,0,320);

    gradient.addColorStop(0,"rgba(124,107,255,.9)");
    gradient.addColorStop(.5,"rgba(34,211,238,.5)");
    gradient.addColorStop(1,"rgba(34,211,238,.05)");

    lapChart = new Chart(ctx,{

        type:"line",

        data:{
            labels,
            datasets:[{
                label:"Lap Time (sec)",
                data,
                fill:true,
                backgroundColor:gradient,
                borderColor:"#4fd1ff",
                borderWidth:3,
                tension:.35,
                pointRadius:5,
                pointHoverRadius:8
            }]
        },

        options:{
            responsive:true,
            maintainAspectRatio:false,

            plugins:{
                legend:{
                    display:false
                }
            },

            scales:{

                y:{
                    beginAtZero:true,
                    grid:{
                        color:"rgba(255,255,255,.08)"
                    }
                },

                x:{
                    grid:{
                        display:false
                    }
                }

            }

        }

    });

}
    
/* ---------- Export & copy ---------- */
function buildSummaryText() {
  const modeLabel = state.mode === 'timer' ? 'Timer' : 'Stopwatch';
  const lines = [`Chrono Ultra — ${modeLabel} session`, `Total: ${formatFull(currentElapsed())}`, ''];
  state.laps.slice().reverse().forEach((lap, i) => {
    lines.push(`Lap ${i + 1}: split ${formatFull(lap.split)} · total ${formatFull(lap.total)}`);
  });
  return lines.join('\n');
}

function copySummary() {
  const text = buildSummaryText();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => showToast('Copied to clipboard'),
      () => showToast('Could not copy')
    );
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('Copied to clipboard'); }
    catch (e) { showToast('Could not copy'); }
    document.body.removeChild(ta);
  }
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCsv() {
  if (state.laps.length === 0) return;
  const rows = [['Lap', 'Split time', 'Total time']];
  state.laps.slice().reverse().forEach((lap, i) => {
    rows.push([String(i + 1), formatFull(lap.split), formatFull(lap.total)]);
  });
  downloadBlob(rows.map(r => r.join(',')).join('\n'), 'text/csv', 'chrono-laps.csv');
  showToast('CSV exported');
}

function exportJson() {
  if (state.laps.length === 0) return;
  const data = {
    mode: state.mode,
    total: formatFull(currentElapsed()),
    laps: state.laps.slice().reverse().map((lap, i) => ({
      lap: i + 1,
      splitMs: lap.split,
      totalMs: lap.total,
      split: formatFull(lap.split),
      total: formatFull(lap.total)
    }))
  };
  downloadBlob(JSON.stringify(data, null, 2), 'application/json', 'chrono-laps.json');
  showToast('JSON exported');
}

/* ---------- Toasts ---------- */
function showToast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

/* ---------- Help modal ---------- */
function openHelp() {
  helpModal.hidden = false;
  closeHelpBtn.focus();
}
function closeHelp() {
  helpModal.hidden = true;
}

/* ---------- Theme, sound, accent, fullscreen ---------- */
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  saveSettings();
}

function toggleTheme() {
  applyTheme(state.theme === 'light' ? 'dark' : 'light');
}

function applyAccent(name) {

  const pair = ACCENTS[name] || ACCENTS.violet;

  state.accent = name;

  document.documentElement.style.setProperty('--accent', pair[0]);
  document.documentElement.style.setProperty('--accent-2', pair[1]);

  /* Cursor Glow Colors */

  const glowColors = {

    violet: [
      "rgba(124,107,255,.30)",
      "rgba(34,211,238,.18)"
    ],

    rose: [
      "rgba(251,107,156,.30)",
      "rgba(255,159,104,.18)"
    ],

    lime: [
      "rgba(52,224,161,.30)",
      "rgba(167,230,57,.18)"
    ],

    amber: [
      "rgba(255,180,84,.30)",
      "rgba(255,122,89,.18)"
    ],

    ocean: [
      "rgba(34,211,238,.30)",
      "rgba(59,130,246,.18)"
    ]

  };

  document.documentElement.style.setProperty(
    "--cursor-glow-1",
    glowColors[name][0]
  );

  document.documentElement.style.setProperty(
    "--cursor-glow-2",
    glowColors[name][1]
  );

  Array.from(swatchesEl.children).forEach(sw => {
    sw.classList.toggle('is-active', sw.dataset.accent === name);
  });

  saveSettings();

}

function toggleSound() {
  state.soundOn = !state.soundOn;
  soundBtn.classList.toggle('muted', !state.soundOn);
  saveSettings();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => showToast('Fullscreen unavailable'));
  } else {
    document.exitFullscreen().catch(() => {});
  }
}
function loadHistory(){
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
}

function saveHistory(data){
    localStorage.setItem(HISTORY_KEY, JSON.stringify(data));
}

function renderHistory(){

    const history = loadHistory();

    historyList.innerHTML = "";

    historyEmpty.style.display = history.length ? "none" : "block";

    history.forEach((item,index)=>{

        const div=document.createElement("div");

        div.className="history-card";

        div.innerHTML=`
<div class="history-info">

    <div class="history-time">${item.time}</div>

    <div class="history-date">${item.date}</div>

</div>

<button class="text-btn deleteHistory">

    Delete

</button>
`;

        div.querySelector("button").onclick=()=>{

            history.splice(index,1);

            saveHistory(history);

            renderHistory();

        };

        historyList.appendChild(div);

    });

}

/* ---------- Persistence ---------- */
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      theme: state.theme,
      accent: state.accent,
      soundOn: state.soundOn
    }));
  } catch (e) {}
}

function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      mode: state.mode,
      running: state.running,
      startTime: state.startTime,
      elapsed: state.elapsed,
      laps: state.laps,
      timerDuration: state.timerDuration,
      alarmFired: state.alarmFired
    }));
  } catch (e) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

/* ---------- Event listeners ---------- */
startBtn.addEventListener('click', startPause);
lapBtn.addEventListener('click', recordLap);
resetBtn.addEventListener('click', resetAll);
clearHistoryBtn.addEventListener("click",()=>{

if(confirm("Clear all session history?")){

localStorage.removeItem(HISTORY_KEY);

renderHistory();

}

});
undoBtn.addEventListener('click', undoLap);
copyBtn.addEventListener('click', copySummary);
csvBtn.addEventListener('click', exportCsv);
jsonBtn.addEventListener('click', exportJson);

modeStopwatchBtn.addEventListener('click', () => switchMode('stopwatch'));
modeTimerBtn.addEventListener('click', () => switchMode('timer'));
modePomodoroBtn.addEventListener(
    "click",
    ()=>switchMode("pomodoro")
);
focusCard.addEventListener("click", () => {
    setPomodoroPhase("focus");
});

shortBreakCard.addEventListener("click", () => {
    setPomodoroPhase("shortBreak");
});

longBreakCard.addEventListener("click", () => {
    setPomodoroPhase("longBreak");
});

themeBtn.addEventListener('click', toggleTheme);
soundBtn.addEventListener('click', toggleSound);
fullscreenBtn.addEventListener('click', toggleFullscreen);
helpBtn.addEventListener('click', openHelp);
closeHelpBtn.addEventListener('click', closeHelp);
helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

swatchesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.swatch');
  if (btn) applyAccent(btn.dataset.accent);
});

document.addEventListener('keydown', (e) => {
  const inField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

  if (e.key === 'Escape') {
    if (!helpModal.hidden) closeHelp();
    return;
  }
  if (inField) return;

  if (e.code === 'Space') { e.preventDefault(); startPause(); }
  else if (e.key.toLowerCase() === 'l' && !lapBtn.disabled) recordLap();
  else if (e.key.toLowerCase() === 'r') resetAll();
  else if (e.key.toLowerCase() === 'u' && !undoBtn.disabled) undoLap();
  else if (e.key.toLowerCase() === 'c' && !copyBtn.disabled) copySummary();
  else if (e.key.toLowerCase() === 'e' && !csvBtn.disabled) exportCsv();
  else if (e.key.toLowerCase() === 't') toggleTheme();
  else if (e.key.toLowerCase() === 'm') toggleSound();
  else if (e.key.toLowerCase() === 'f') toggleFullscreen();
  else if (e.key === '?') openHelp();
});

/* ---------- Init ---------- */
(function init() {
  // Settings
  const settings = loadSettings();
  if (settings) {
    applyTheme(settings.theme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
    applyAccent(settings.accent || 'violet');
    state.soundOn = settings.soundOn !== undefined ? settings.soundOn : true;
    soundBtn.classList.toggle('muted', !state.soundOn);
  } else {
    applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    applyAccent('violet');
  }

  // Session
  const session = loadSession();
  if (session) {
    state.mode = session.mode || 'stopwatch';
    state.laps = session.laps || [];
    state.timerDuration = session.timerDuration || 30000;
    state.alarmFired = !!session.alarmFired;

    if (session.running) {
      state.elapsed = session.elapsed + (Date.now() - session.startTime);
      state.running = false; // require explicit resume tap to re-arm audio/vibration
    } else {
      state.elapsed = session.elapsed || 0;
    }

    const isTimer = state.mode === 'timer';
    const isPomodoro = state.mode === "pomodoro";

modeStopwatchBtn.classList.toggle(
    "is-active",
    !isTimer && !isPomodoro
);

modeTimerBtn.classList.toggle(
    "is-active",
    isTimer
);

modePomodoroBtn.classList.toggle(
    "is-active",
    isPomodoro
);
    modeStopwatchBtn.setAttribute('aria-selected', String(!isTimer));
    modeTimerBtn.setAttribute('aria-selected', String(isTimer));
  modeThumb.classList.remove("pos-1", "pos-2");

if (state.mode === "timer") {
    modeThumb.classList.add("pos-1");
}
else if (state.mode === "pomodoro") {
    modeThumb.classList.add("pos-2");
}
    timerSetup.hidden = !isTimer;
    pomodoroSetup.hidden = !isPomodoro;

    if (state.elapsed > 0 || state.laps.length > 0) {
      startLabel.textContent = 'Resume';
      lapBtn.disabled = false;
      statusLabel.textContent = 'Paused';
      statusLabel.className = 'status is-paused';
    }
  }

 renderTime();

renderLaps();

renderStats();

renderChartAnalytics();

renderHistory();
})();
/*============================================
        PREMIUM LOADER
============================================*/

window.addEventListener("load",()=>{

const loader=document.getElementById("loader");

const main=document.getElementById("mainContent");

setTimeout(()=>{

loader.classList.add("hide");

main.classList.add("show");

},2400);

});
/*==========================================
CURSOR GLOW
==========================================*/

const cursorGlow = document.getElementById("cursorGlow");

document.addEventListener("mousemove", (e) => {

    cursorGlow.style.left = e.clientX + "px";
    cursorGlow.style.top = e.clientY + "px";

});
/*==========================================
BUTTON RIPPLE EFFECT
==========================================*/

const rippleButtons = document.querySelectorAll(
".ctrl-btn, .text-btn, .mode-btn, .icon-btn, .preset-btn, .swatch"
);

rippleButtons.forEach(button=>{

button.addEventListener("click",function(e){

const ripple=document.createElement("span");

ripple.classList.add("ripple");

const rect=this.getBoundingClientRect();

const size=Math.max(rect.width,rect.height);

ripple.style.width=size+"px";
ripple.style.height=size+"px";

ripple.style.left=(e.clientX-rect.left-size/2)+"px";
ripple.style.top=(e.clientY-rect.top-size/2)+"px";

this.appendChild(ripple);

setTimeout(()=>{

ripple.remove();

},600);

});

});
/*==========================================
3D CARD EFFECT
==========================================*/

const statCards=document.querySelectorAll(".stat-card");

statCards.forEach(card=>{

card.addEventListener("mousemove",(e)=>{

const rect=card.getBoundingClientRect();

const x=e.clientX-rect.left;

const y=e.clientY-rect.top;

const centerX=rect.width/2;

const centerY=rect.height/2;

const rotateX=((centerY-y)/12);

const rotateY=((x-centerX)/12);

card.style.transform=
`perspective(900px)
rotateX(${rotateX}deg)
rotateY(${rotateY}deg)
translateY(-8px)
scale(1.03)`;

});

card.addEventListener("mouseleave",()=>{

card.style.transform=
"perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)";

});

});