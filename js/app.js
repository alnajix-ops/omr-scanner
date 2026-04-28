// ==================== STATE ====================
let state = {
  exams: [],
  currentExam: null,
  numQ: 20,
  answerKey: {},
  studentAnswers: {},
  stream: null
};

// ==================== INIT ====================
window.addEventListener('load', () => {
  loadData();
  setTimeout(() => {
    document.getElementById('splash').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
    }, 400);
  }, 1200);
  // Set today's date
  document.getElementById('examDate').value = new Date().toISOString().split('T')[0];
  renderHome();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// ==================== STORAGE ====================
function saveData() {
  localStorage.setItem('omr_exams', JSON.stringify(state.exams));
}

function loadData() {
  const d = localStorage.getItem('omr_exams');
  if (d) state.exams = JSON.parse(d);
}

// ==================== NAVIGATION ====================
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
  });
  const page = document.getElementById('page-' + name);
  if (page) {
    page.style.display = 'block';
    page.classList.add('active');
  }

  const titles = {
    home: 'Smart OMR Scanner',
    setup: 'Peperiksaan Baru',
    exam: state.currentExam ? state.currentExam.name : 'Peperiksaan',
    camera: 'Imbas OMR'
  };
  document.getElementById('pageTitle').textContent = titles[name] || '';

  const backBtn = document.getElementById('backBtn');
  if (name === 'home') {
    backBtn.classList.add('hidden');
  } else {
    backBtn.classList.remove('hidden');
  }
  document.getElementById('menuBtn').style.display = name === 'home' ? 'flex' : 'flex';
  closeMenu();
}

function goBack() {
  const current = document.querySelector('.page.active');
  if (!current) return;
  const id = current.id;
  if (id === 'page-setup') showPage('home');
  else if (id === 'page-exam') showPage('home');
  else if (id === 'page-camera') { closeCamera(); showPage('exam'); }
  else showPage('home');
}

function toggleMenu() {
  document.getElementById('dropMenu').classList.toggle('hidden');
}
function closeMenu() {
  document.getElementById('dropMenu').classList.add('hidden');
}

// ==================== HOME ====================
function renderHome() {
  const list = document.getElementById('examList');
  if (state.exams.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div>Tiada peperiksaan lagi</div><small>Klik butang di bawah untuk tambah peperiksaan baru</small></div>`;
    return;
  }
  list.innerHTML = state.exams.map((ex, i) => `
    <div class="exam-card" onclick="openExam(${i})">
      <div class="exam-card-icon">📝</div>
      <div class="exam-card-info">
        <div class="exam-card-name">${ex.name}</div>
        <div class="exam-card-meta">${ex.kelas} · ${ex.numQ} soalan · ${ex.date || ''}</div>
      </div>
      <div class="exam-card-count">${ex.results ? ex.results.length : 0} murid</div>
    </div>
  `).join('');
}

// ==================== SETUP ====================
let currentStep = 1;

function changeQ(delta) {
  state.numQ = Math.max(5, Math.min(60, state.numQ + delta));
  document.getElementById('numQDisplay').textContent = state.numQ;
}

function goStep1() {
  currentStep = 1;
  updateStepUI();
}

function goStep2() {
  const name = document.getElementById('examName').value.trim();
  const kelas = document.getElementById('examClass').value.trim();
  if (!name || !kelas) { showToast('Sila isi semua maklumat!'); return; }
  currentStep = 2;
  renderSkema();
  updateStepUI();
}

function goStep3() {
  // Check all keys filled
  for (let i = 1; i <= state.numQ; i++) {
    if (!state.answerKey[i]) state.answerKey[i] = 'A';
  }
  // Save exam
  const exam = {
    id: Date.now(),
    name: document.getElementById('examName').value.trim(),
    kelas: document.getElementById('examClass').value.trim(),
    date: document.getElementById('examDate').value,
    numQ: state.numQ,
    answerKey: { ...state.answerKey },
    results: []
  };
  state.exams.unshift(exam);
  saveData();
  renderHome();

  currentStep = 3;
  document.getElementById('setupSummary').textContent =
    `${exam.name} · ${exam.kelas} · ${exam.numQ} soalan`;
  updateStepUI();
}

function updateStepUI() {
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`step${i}`).classList.toggle('hidden', i !== currentStep);
    const dot = document.getElementById(`step${i}dot`);
    dot.classList.remove('active', 'done');
    if (i === currentStep) dot.classList.add('active');
    else if (i < currentStep) dot.classList.add('done');
  }
}

function renderSkema() {
  const grid = document.getElementById('skemaGrid');
  let html = '';
  for (let i = 1; i <= state.numQ; i++) {
    if (!state.answerKey[i]) state.answerKey[i] = 'A';
    html += `<div class="skema-row">
      <span class="skema-num">${i}.</span>
      <div class="skema-opts">
        ${['A','B','C','D'].map(o =>
          `<button class="opt-btn ${state.answerKey[i]===o?'selected':''}"
            onclick="setKey(${i},'${o}',this)">${o}</button>`
        ).join('')}
      </div>
    </div>`;
  }
  grid.innerHTML = html;
}

function setKey(q, opt, btn) {
  state.answerKey[q] = opt;
  btn.closest('.skema-opts').querySelectorAll('.opt-btn')
    .forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function autoFillA() {
  for (let i = 1; i <= state.numQ; i++) state.answerKey[i] = 'A';
  renderSkema();
}

function goToScan() {
  state.currentExam = state.exams[0];
  showPage('exam');
  renderExamDetail();
}

// ==================== EXAM DETAIL ====================
function openExam(index) {
  state.currentExam = state.exams[index];
  showPage('exam');
  renderExamDetail();
}

function renderExamDetail() {
  const ex = state.currentExam;
  document.getElementById('examDetailHeader').innerHTML = `
    <div style="font-size:18px;font-weight:700;margin-bottom:4px;">${ex.name}</div>
    <div style="font-size:13px;color:#9ca3af;">${ex.kelas} · ${ex.numQ} soalan · ${ex.date || ''}</div>
    <div style="margin-top:10px;display:flex;gap:12px;">
      <span style="font-size:13px;">👥 ${ex.results.length} murid discan</span>
      ${ex.results.length > 0 ? `<span style="font-size:13px;">📊 Min: ${getAvg(ex)}%</span>` : ''}
    </div>
  `;
  renderManualBubbles();
  renderResults();
  renderSkemaView();
  switchTab('scan');
}

function getAvg(ex) {
  if (!ex.results.length) return 0;
  const total = ex.results.reduce((s, r) => s + r.pct, 0);
  return Math.round(total / ex.results.length);
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    const names = ['scan','results','skema'];
    b.classList.toggle('active', names[i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
}

// ==================== MANUAL ENTRY ====================
function toggleManual() {
  const panel = document.getElementById('manualPanel');
  const btn = document.querySelector('.manual-header .btn-sm');
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !isHidden);
  btn.textContent = isHidden ? 'Tutup' : 'Buka';
}

function renderManualBubbles() {
  const ex = state.currentExam;
  state.studentAnswers = {};
  let html = '';
  for (let i = 1; i <= ex.numQ; i++) {
    html += `<div class="manual-row">
      <span class="manual-num">${i}.</span>
      ${['A','B','C','D'].map(o =>
        `<button class="bubble" onclick="setBubble(${i},'${o}',this)">${o}</button>`
      ).join('')}
    </div>`;
  }
  document.getElementById('manualBubbles').innerHTML = html;
}

function setBubble(q, opt, btn) {
  state.studentAnswers[q] = opt;
  btn.closest('.manual-row').querySelectorAll('.bubble')
    .forEach(b => b.classList.remove('filled'));
  btn.classList.add('filled');
}

function submitManual() {
  const name = document.getElementById('studentName').value.trim();
  if (!name) { showToast('Sila masukkan nama murid!'); return; }
  const ex = state.currentExam;
  const result = gradeStudent(name, state.studentAnswers, ex);
  saveResult(result);
  showResultModal(result);
  // Reset
  document.getElementById('studentName').value = '';
  renderManualBubbles();
}

function gradeStudent(name, answers, ex) {
  let correct = 0;
  const details = [];
  for (let i = 1; i <= ex.numQ; i++) {
    const sa = answers[i] || '-';
    const ka = ex.answerKey[i] || 'A';
    const ok = sa === ka;
    if (ok) correct++;
    details.push({ q: i, student: sa, key: ka, correct: ok });
  }
  const pct = Math.round(correct / ex.numQ * 100);
  const grade = pct>=90?'A':pct>=80?'B':pct>=70?'C':pct>=60?'D':'E';
  return { name, correct, total: ex.numQ, pct, grade, details, timestamp: Date.now() };
}

function saveResult(result) {
  const idx = state.exams.findIndex(e => e.id === state.currentExam.id);
  state.exams[idx].results.push(result);
  state.currentExam = state.exams[idx];
  saveData();
  renderExamDetail();
}

function showResultModal(result) {
  document.getElementById('modalContent').innerHTML = `
    <div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:40px;margin-bottom:8px;">${result.grade==='A'?'🏆':result.grade==='B'?'🎉':result.grade==='C'?'👍':'📚'}</div>
      <div style="font-size:22px;font-weight:800;color:${gradeColor(result.grade)};">${result.grade}</div>
      <div style="font-size:36px;font-weight:700;">${result.pct}%</div>
      <div style="font-size:14px;color:#6b7280;">${result.name}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">${result.correct}/${result.total} betul</div>
    </div>
    <div style="background:#f5f4f0;border-radius:8px;padding:10px;max-height:180px;overflow-y:auto;">
      ${result.details.map(d =>
        `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:0.5px solid #e5e7eb;">
          <span>Soalan ${d.q}</span>
          <span style="color:${d.correct?'#16a34a':'#dc2626'};font-weight:600;">
            ${d.student} ${d.correct ? '✓' : '✗ ('+d.key+')'}
          </span>
        </div>`
      ).join('')}
    </div>
  `;
  document.getElementById('modalConfirm').textContent = 'Tutup';
  document.getElementById('modalConfirm').onclick = closeModal;
  document.getElementById('modal').classList.remove('hidden');
}

function gradeColor(g) {
  return { A:'#16a34a', B:'#2563eb', C:'#d97706', D:'#ea580c', E:'#dc2626' }[g] || '#1a1a1a';
}

// ==================== RESULTS ====================
function renderResults() {
  const ex = state.currentExam;
  const stats = document.getElementById('resultStats');
  const table = document.getElementById('resultTable');

  if (!ex.results.length) {
    stats.innerHTML = '';
    table.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><div>Belum ada keputusan</div><small>Scan atau masukkan jawapan murid dulu</small></div>`;
    return;
  }

  const avg = getAvg(ex);
  const highest = Math.max(...ex.results.map(r => r.pct));
  const lowest = Math.min(...ex.results.map(r => r.pct));

  stats.innerHTML = `
    <div class="stat-card"><div class="stat-num" style="color:var(--yellow-dark);">${avg}%</div><div class="stat-label">Purata</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#16a34a;">${highest}%</div><div class="stat-label">Tertinggi</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#dc2626;">${lowest}%</div><div class="stat-label">Terendah</div></div>
  `;

  const sorted = [...ex.results].sort((a, b) => b.pct - a.pct);
  table.innerHTML = sorted.map((r, i) => `
    <div class="result-item">
      <div class="result-rank">${i + 1}</div>
      <div class="result-info">
        <div class="result-name">${r.name}</div>
        <div class="result-detail">${r.correct}/${r.total} betul · ${r.pct}%</div>
      </div>
      <div class="result-grade grade-${r.grade}">${r.grade}</div>
    </div>
  `).join('');
}

function clearResults() {
  showConfirm('Padam semua keputusan peperiksaan ini?', () => {
    const idx = state.exams.findIndex(e => e.id === state.currentExam.id);
    state.exams[idx].results = [];
    state.currentExam = state.exams[idx];
    saveData();
    renderExamDetail();
    showToast('Keputusan dipadam');
  });
}

// ==================== SKEMA VIEW ====================
function renderSkemaView() {
  const ex = state.currentExam;
  let html = '<div class="skema-view-grid">';
  for (let i = 1; i <= ex.numQ; i++) {
    html += `<div class="skema-item"><div class="q">${i}</div><div class="a">${ex.answerKey[i]||'A'}</div></div>`;
  }
  html += '</div>';
  document.getElementById('skemaView').innerHTML = html;
}

function editSkema() {
  showToast('Edit skema: Buat peperiksaan baru atau hubungi pembangun');
}

// ==================== CAMERA ====================
function openCamera() {
  showPage('camera');
  document.getElementById('pageTitle').textContent = 'Imbas OMR';
  startCamera();
}

async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    document.getElementById('camVideo').srcObject = state.stream;
  } catch (e) {
    showToast('Kamera tidak dapat diakses. Cuba guna input manual.');
    showPage('exam');
  }
}

function closeCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  showPage('exam');
}

function captureAndProcess() {
  const name = document.getElementById('camStudentName').value.trim();
  if (!name) { showToast('Sila masukkan nama murid!'); return; }

  const video = document.getElementById('camVideo');
  const canvas = document.getElementById('camCanvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  document.getElementById('camHint').textContent = 'Memproses...';

  // Simulate OMR detection (in production: use OpenCV.js or a backend)
  setTimeout(() => {
    const detected = simulateOMRDetection();
    closeCamera();
    const ex = state.currentExam;
    const result = gradeStudent(name, detected, ex);
    saveResult(result);
    showResultModal(result);
    switchTab('results');
    document.getElementById('camStudentName').value = '';
    document.getElementById('camHint').textContent = 'Letakkan kertas OMR dalam bingkai';
  }, 1500);
}

function simulateOMRDetection() {
  // Placeholder — returns random answers (replace with real CV logic)
  const answers = {};
  const opts = ['A','B','C','D'];
  const ex = state.currentExam;
  for (let i = 1; i <= ex.numQ; i++) {
    // 70% chance correct (for demo)
    answers[i] = Math.random() < 0.7 ? ex.answerKey[i] : opts[Math.floor(Math.random()*4)];
  }
  return answers;
}

// ==================== EXPORT EXCEL ====================
function exportExcel() {
  const ex = state.currentExam;
  if (!ex.results.length) { showToast('Tiada data untuk export!'); return; }

  const ws_data = [
    ['Nama Peperiksaan', ex.name],
    ['Kelas', ex.kelas],
    ['Tarikh', ex.date],
    ['Bilangan Soalan', ex.numQ],
    [],
    ['No', 'Nama Murid', 'Betul', 'Salah', 'Markah (%)', 'Gred',
     ...Array.from({length: ex.numQ}, (_, i) => `S${i+1}`)
    ],
    ...ex.results.sort((a,b) => b.pct - a.pct).map((r, i) => [
      i+1, r.name, r.correct, r.total-r.correct, r.pct+'%', r.grade,
      ...(r.details || []).map(d => d.student)
    ]),
    [],
    ['Purata', '', '', '', getAvg(ex)+'%'],
    [],
    ['--- SKEMA JAWAPAN ---'],
    ['Soalan', ...Array.from({length: ex.numQ}, (_, i) => i+1)],
    ['Jawapan', ...Array.from({length: ex.numQ}, (_, i) => ex.answerKey[i+1] || 'A')]
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Column widths
  ws['!cols'] = [
    {wch:5},{wch:25},{wch:8},{wch:8},{wch:12},{wch:8},
    ...Array.from({length: ex.numQ}, () => ({wch:5}))
  ];

  XLSX.utils.book_append_sheet(wb, ws, ex.name.substring(0,31));
  XLSX.writeFile(wb, `OMR_${ex.name}_${ex.kelas}.xlsx`);
  showToast('Excel berjaya diexport!');
}

function exportAllExcel() {
  if (!state.exams.length) { showToast('Tiada data!'); return; }
  const wb = XLSX.utils.book_new();
  state.exams.forEach(ex => {
    if (!ex.results.length) return;
    const ws_data = [
      ['Peperiksaan', ex.name, 'Kelas', ex.kelas],
      [],
      ['No','Nama','Markah (%)','Gred'],
      ...ex.results.sort((a,b)=>b.pct-a.pct).map((r,i)=>[i+1,r.name,r.pct+'%',r.grade])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_data), ex.name.substring(0,31));
  });
  XLSX.writeFile(wb, `OMR_Semua_Peperiksaan.xlsx`);
  showToast('Excel semua peperiksaan diexport!');
  closeMenu();
}

// ==================== UTILITIES ====================
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2600);
}

function showConfirm(msg, onYes) {
  document.getElementById('modalContent').innerHTML = `<p style="text-align:center;font-size:15px;">${msg}</p>`;
  document.getElementById('modalConfirm').textContent = 'Ya, Padam';
  document.getElementById('modalConfirm').onclick = () => { closeModal(); onYes(); };
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function clearAllData() {
  showConfirm('Padam SEMUA data peperiksaan? Tindakan ini tidak boleh diundur!', () => {
    state.exams = [];
    saveData();
    renderHome();
    showToast('Semua data dipadam');
    closeMenu();
  });
}

// Close menu on outside click
document.addEventListener('click', (e) => {
  const menu = document.getElementById('dropMenu');
  const menuBtn = document.getElementById('menuBtn');
  if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
    menu.classList.add('hidden');
  }
});
