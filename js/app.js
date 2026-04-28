let state = {
  exams: [], currentExam: null, numQ: 20,
  answerKey: {}, studentAnswers: {}, stream: null
};

window.addEventListener('load', () => {
  loadData();
  document.getElementById('examDate').value = new Date().toISOString().split('T')[0];
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  setTimeout(() => {
    document.getElementById('splash').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('splash').remove();
      showPage('home');
    }, 400);
  }, 800);
});

function saveData() { localStorage.setItem('omr_exams', JSON.stringify(state.exams)); }
function loadData() { try { state.exams = JSON.parse(localStorage.getItem('omr_exams') || '[]'); } catch(e) { state.exams = []; } }

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const page = document.getElementById('page-' + name);
  if (page) page.style.display = 'flex';
  const titles = { home:'Smart OMR Scanner', setup:'Peperiksaan Baru', exam: state.currentExam?.name || 'Peperiksaan', camera:'Imbas OMR' };
  document.getElementById('pageTitle').textContent = titles[name] || '';
  document.getElementById('backBtn').style.display = name === 'home' ? 'none' : 'flex';
  closeMenu();
  if (name === 'home') renderHome();
}

function goBack() {
  const visible = [...document.querySelectorAll('.page')].find(p => p.style.display !== 'none');
  if (!visible) return;
  if (visible.id === 'page-setup') showPage('home');
  else if (visible.id === 'page-exam') showPage('home');
  else if (visible.id === 'page-camera') { closeCamera(); }
  else showPage('home');
}

function toggleMenu() { document.getElementById('dropMenu').classList.toggle('hidden'); }
function closeMenu() { document.getElementById('dropMenu').classList.add('hidden'); }

function renderHome() {
  const list = document.getElementById('examList');
  if (!state.exams.length) {
    list.innerHTML = `<div class="empty-state"><div style="font-size:48px;margin-bottom:12px;">📋</div><div style="font-weight:500;">Tiada peperiksaan lagi</div><div style="font-size:13px;color:var(--muted);margin-top:4px;">Klik butang di bawah untuk tambah</div></div>`;
    return;
  }
  list.innerHTML = state.exams.map((ex, i) => `
    <div class="exam-card" onclick="openExam(${i})">
      <div class="exam-card-icon">📝</div>
      <div class="exam-card-info">
        <div class="exam-card-name">${ex.name}</div>
        <div class="exam-card-meta">${ex.kelas} · ${ex.numQ} soalan · ${ex.date || ''}</div>
      </div>
      <div class="exam-card-count">${(ex.results||[]).length} murid</div>
    </div>`).join('');
}

let currentStep = 1;
function changeQ(d) { state.numQ = Math.max(5, Math.min(60, state.numQ + d)); document.getElementById('numQDisplay').textContent = state.numQ; }
function goStep2() {
  const name = document.getElementById('examName').value.trim();
  const kelas = document.getElementById('examClass').value.trim();
  if (!name || !kelas) { showToast('Sila isi semua maklumat!'); return; }
  currentStep = 2; updateStepUI(); renderSkema();
}
function goStep1() { currentStep = 1; updateStepUI(); }
function goStep3() {
  for (let i = 1; i <= state.numQ; i++) if (!state.answerKey[i]) state.answerKey[i] = 'A';
  const exam = { id: Date.now(), name: document.getElementById('examName').value.trim(), kelas: document.getElementById('examClass').value.trim(), date: document.getElementById('examDate').value, numQ: state.numQ, answerKey: {...state.answerKey}, results: [] };
  state.exams.unshift(exam); saveData();
  currentStep = 3;
  document.getElementById('setupSummary').textContent = `${exam.name} · ${exam.kelas} · ${exam.numQ} soalan`;
  updateStepUI();
}
function updateStepUI() {
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`step${i}`).style.display = i === currentStep ? 'block' : 'none';
    const dot = document.getElementById(`step${i}dot`);
    dot.className = 'step' + (i === currentStep ? ' active' : i < currentStep ? ' done' : '');
  }
}
function renderSkema() {
  let html = '';
  for (let i = 1; i <= state.numQ; i++) {
    if (!state.answerKey[i]) state.answerKey[i] = 'A';
    html += `<div class="skema-row"><span class="skema-num">${i}.</span><div class="skema-opts">${['A','B','C','D'].map(o => `<button class="opt-btn ${state.answerKey[i]===o?'selected':''}" onclick="setKey(${i},'${o}',this)">${o}</button>`).join('')}</div></div>`;
  }
  document.getElementById('skemaGrid').innerHTML = html;
}
function setKey(q, opt, btn) { state.answerKey[q] = opt; btn.closest('.skema-opts').querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); }
function autoFillA() { for (let i = 1; i <= state.numQ; i++) state.answerKey[i] = 'A'; renderSkema(); }
function goToScan() { state.currentExam = state.exams[0]; showPage('exam'); renderExamDetail(); }

function openExam(i) { state.currentExam = state.exams[i]; showPage('exam'); renderExamDetail(); }
function renderExamDetail() {
  const ex = state.currentExam;
  document.getElementById('examDetailHeader').innerHTML = `<div style="font-size:18px;font-weight:700;margin-bottom:4px;">${ex.name}</div><div style="font-size:13px;color:#9ca3af;">${ex.kelas} · ${ex.numQ} soalan · ${ex.date||''}</div><div style="margin-top:8px;font-size:13px;">👥 ${ex.results.length} murid ${ex.results.length ? '· 📊 Min: '+getAvg(ex)+'%' : ''}</div>`;
  document.getElementById('pageTitle').textContent = ex.name;
  renderManualBubbles(); renderResults(); renderSkemaView(); switchTab('scan');
}
function getAvg(ex) { if (!ex.results.length) return 0; return Math.round(ex.results.reduce((s,r) => s+r.pct, 0) / ex.results.length); }
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', ['scan','results','skema'][i]===name));
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.getElementById('tab-'+name).style.display = 'block';
}

function toggleManual() { const p = document.getElementById('manualPanel'); const btn = document.querySelector('.manual-header .btn-sm'); const hidden = p.style.display === 'none' || !p.style.display; p.style.display = hidden ? 'block' : 'none'; btn.textContent = hidden ? 'Tutup' : 'Buka'; }
function renderManualBubbles() {
  state.studentAnswers = {};
  let html = '';
  for (let i = 1; i <= state.currentExam.numQ; i++) {
    html += `<div class="manual-row"><span class="manual-num">${i}.</span>${['A','B','C','D'].map(o => `<button class="bubble" onclick="setBubble(${i},'${o}',this)">${o}</button>`).join('')}</div>`;
  }
  document.getElementById('manualBubbles').innerHTML = html;
}
function setBubble(q, opt, btn) { state.studentAnswers[q] = opt; btn.closest('.manual-row').querySelectorAll('.bubble').forEach(b => b.classList.remove('filled')); btn.classList.add('filled'); }
function submitManual() {
  const name = document.getElementById('studentName').value.trim();
  if (!name) { showToast('Sila masukkan nama murid!'); return; }
  const result = gradeStudent(name, state.studentAnswers, state.currentExam);
  saveResult(result); showResultModal(result);
  document.getElementById('studentName').value = ''; renderManualBubbles();
}
function gradeStudent(name, answers, ex) {
  let correct = 0; const details = [];
  for (let i = 1; i <= ex.numQ; i++) { const sa = answers[i]||'-', ka = ex.answerKey[i]||'A', ok = sa===ka; if(ok) correct++; details.push({q:i,student:sa,key:ka,correct:ok}); }
  const pct = Math.round(correct/ex.numQ*100);
  return {name, correct, total:ex.numQ, pct, grade:pct>=90?'A':pct>=80?'B':pct>=70?'C':pct>=60?'D':'E', details, timestamp:Date.now()};
}
function saveResult(result) { const idx = state.exams.findIndex(e=>e.id===state.currentExam.id); state.exams[idx].results.push(result); state.currentExam = state.exams[idx]; saveData(); renderExamDetail(); }
function showResultModal(r) {
  document.getElementById('modalContent').innerHTML = `<div style="text-align:center;margin-bottom:16px;"><div style="font-size:40px;margin-bottom:8px;">${r.grade==='A'?'🏆':r.grade==='B'?'🎉':r.grade==='C'?'👍':'📚'}</div><div style="font-size:28px;font-weight:800;color:${gradeColor(r.grade)};">${r.grade}</div><div style="font-size:36px;font-weight:700;">${r.pct}%</div><div style="font-size:14px;color:#6b7280;">${r.name} · ${r.correct}/${r.total} betul</div></div><div style="background:#f5f4f0;border-radius:8px;padding:10px;max-height:200px;overflow-y:auto;">${r.details.map(d=>`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:0.5px solid #e5e7eb;"><span>Soalan ${d.q}</span><span style="color:${d.correct?'#16a34a':'#dc2626'};font-weight:600;">${d.student} ${d.correct?'✓':'✗ ('+d.key+')'}</span></div>`).join('')}</div>`;
  document.getElementById('modalConfirm').textContent = 'Tutup';
  document.getElementById('modalConfirm').onclick = closeModal;
  document.getElementById('modal').style.display = 'flex';
}
function gradeColor(g) { return {A:'#16a34a',B:'#2563eb',C:'#d97706',D:'#ea580c',E:'#dc2626'}[g]||'#1a1a1a'; }

function renderResults() {
  const ex = state.currentExam, stats = document.getElementById('resultStats'), table = document.getElementById('resultTable');
  if (!ex.results.length) { stats.innerHTML = ''; table.innerHTML = `<div class="empty-state"><div style="font-size:40px;">📊</div><div>Belum ada keputusan</div></div>`; return; }
  const avg=getAvg(ex), hi=Math.max(...ex.results.map(r=>r.pct)), lo=Math.min(...ex.results.map(r=>r.pct));
  stats.innerHTML = `<div class="stat-card"><div class="stat-num" style="color:#d97706;">${avg}%</div><div class="stat-label">Purata</div></div><div class="stat-card"><div class="stat-num" style="color:#16a34a;">${hi}%</div><div class="stat-label">Tertinggi</div></div><div class="stat-card"><div class="stat-num" style="color:#dc2626;">${lo}%</div><div class="stat-label">Terendah</div></div>`;
  table.innerHTML = [...ex.results].sort((a,b)=>b.pct-a.pct).map((r,i)=>`<div class="result-item"><div class="result-rank">${i+1}</div><div class="result-info"><div class="result-name">${r.name}</div><div class="result-detail">${r.correct}/${r.total} betul · ${r.pct}%</div></div><div class="result-grade grade-${r.grade}">${r.grade}</div></div>`).join('');
}
function clearResults() { showConfirm('Padam semua keputusan?', () => { const idx=state.exams.findIndex(e=>e.id===state.currentExam.id); state.exams[idx].results=[]; state.currentExam=state.exams[idx]; saveData(); renderExamDetail(); showToast('Keputusan dipadam'); }); }
function renderSkemaView() { const ex=state.currentExam; let html='<div class="skema-view-grid">'; for(let i=1;i<=ex.numQ;i++) html+=`<div class="skema-item"><div class="q">${i}</div><div class="a">${ex.answerKey[i]||'A'}</div></div>`; document.getElementById('skemaView').innerHTML=html+'</div>'; }
function editSkema() { showToast('Buat peperiksaan baru untuk edit skema'); }

function openCamera() { showPage('camera'); document.getElementById('pageTitle').textContent='Imbas OMR'; startCamera(); }
async function startCamera() { try { state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); document.getElementById('camVideo').srcObject=state.stream; } catch(e) { showToast('Kamera tidak dapat diakses. Guna input manual.'); showPage('exam'); } }
function closeCamera() { if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null;} showPage('exam'); }
function captureAndProcess() { const name=document.getElementById('camStudentName').value.trim(); if(!name){showToast('Sila masukkan nama murid!');return;} document.getElementById('camHint').textContent='Memproses...'; setTimeout(()=>{const detected=simulateOMRDetection(); closeCamera(); const result=gradeStudent(name,detected,state.currentExam); saveResult(result); showResultModal(result); switchTab('results'); document.getElementById('camStudentName').value=''; document.getElementById('camHint').textContent='Letakkan kertas OMR dalam bingkai';},1500); }
function simulateOMRDetection() { const answers={},ex=state.currentExam,opts=['A','B','C','D']; for(let i=1;i<=ex.numQ;i++) answers[i]=Math.random()<0.7?ex.answerKey[i]:opts[Math.floor(Math.random()*4)]; return answers; }

function exportExcel() {
  const ex=state.currentExam; if(!ex.results.length){showToast('Tiada data!');return;}
  const data=[['Nama Peperiksaan',ex.name],['Kelas',ex.kelas],['Tarikh',ex.date],['Bilangan Soalan',ex.numQ],[],['No','Nama Murid','Betul','Salah','Markah (%)','Gred',...Array.from({length:ex.numQ},(_,i)=>`S${i+1}`)], ...ex.results.sort((a,b)=>b.pct-a.pct).map((r,i)=>[i+1,r.name,r.correct,r.total-r.correct,r.pct+'%',r.grade,...(r.details||[]).map(d=>d.student)]),[], ['Purata','','','',getAvg(ex)+'%'],[],['SKEMA JAWAPAN'],['Soalan',...Array.from({length:ex.numQ},(_,i)=>i+1)],['Jawapan',...Array.from({length:ex.numQ},(_,i)=>ex.answerKey[i+1]||'A')]];
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(data);
  ws['!cols']=[{wch:5},{wch:25},{wch:8},{wch:8},{wch:12},{wch:8},...Array.from({length:ex.numQ},()=>({wch:5}))];
  XLSX.utils.book_append_sheet(wb,ws,ex.name.substring(0,31)); XLSX.writeFile(wb,`OMR_${ex.name}_${ex.kelas}.xlsx`); showToast('Excel berjaya diexport!');
}
function exportAllExcel() { if(!state.exams.length){showToast('Tiada data!');return;} const wb=XLSX.utils.book_new(); state.exams.forEach(ex=>{if(!ex.results.length)return; XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Peperiksaan',ex.name,'Kelas',ex.kelas],[],['No','Nama','Markah (%)','Gred'],...ex.results.sort((a,b)=>b.pct-a.pct).map((r,i)=>[i+1,r.name,r.pct+'%',r.grade])]),ex.name.substring(0,31));}); XLSX.writeFile(wb,'OMR_Semua_Peperiksaan.xlsx'); showToast('Berjaya export!'); closeMenu(); }

function showToast(msg) { const t=document.getElementById('toast'); t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',2500); }
function showConfirm(msg,onYes) { document.getElementById('modalContent').innerHTML=`<p style="text-align:center;font-size:15px;margin-bottom:0;">${msg}</p>`; document.getElementById('modalConfirm').textContent='Ya, Padam'; document.getElementById('modalConfirm').onclick=()=>{closeModal();onYes();}; document.getElementById('modal').style.display='flex'; }
function closeModal() { document.getElementById('modal').style.display='none'; }
function clearAllData() { showConfirm('Padam SEMUA data?',()=>{state.exams=[];saveData();renderHome();showToast('Dipadam');closeMenu();}); }

document.addEventListener('click',e=>{const menu=document.getElementById('dropMenu'); if(!menu.contains(e.target)&&!document.getElementById('menuBtn').contains(e.target))closeMenu();});
