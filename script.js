const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Back-end URL (Python FastAPI)
const API_BASE = 'http://127.0.0.1:8000';

// legacy localStorage key (not used anymore)
const storageKey = 'clinic_bookings_v1';

const state = {
  services: [
    { id: 'general', name: 'كشف عام', icon: '🩺', desc: 'فحص شامل وتشخيص مبدئي وخطة علاج.' },
    { id: 'pediatrics', name: 'طب أطفال', icon: '🧒', desc: 'متابعة نمو الأطفال وإرشادات الوالدين.' },
    { id: 'dermatology', name: 'جلدية', icon: '✨', desc: 'علاج الحبوب والالتهابات وأمراض الجلد.' },
    { id: 'cardio', name: 'قلب', icon: '❤️', desc: 'متابعة ضغط الدم وفحوصات القلب.' },
    { id: 'dentistry', name: 'أسنان', icon: '🦷', desc: 'تنظيف وفحوصات وتشخيص مشاكل اللثة.' },
    { id: 'women', name: 'نساء وولادة', icon: '🌸', desc: 'متابعة دورية واستشارات شاملة.' },
  ],
  doctors: [
    { id: 'dr_ahmed', name: 'د. أحمد علي', specialty: 'كشف عام', rating: 4.8 },
    { id: 'dr_sara', name: 'د. سارة محمد', specialty: 'طب أطفال', rating: 4.7 },
    { id: 'dr_omar', name: 'د. عمر حسن', specialty: 'جلدية', rating: 4.9 },
    { id: 'dr_lina', name: 'د. لينا يوسف', specialty: 'أسنان', rating: 4.6 },
    { id: 'dr_rafi', name: 'د. رافي', specialty: 'قلب', rating: 4.8 },
    { id: 'dr_nour', name: 'د. نور', specialty: 'نساء وولادة', rating: 4.9 },
  ],
  timeSlots: [
    '10:00', '10:30', '11:00', '11:30',
    '16:00', '16:30', '17:00', '17:30',
    '19:00', '19:30'
  ],
};

function formatDateAr(d){
  const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${days[d.getDay()]}، ${d.getDate()} ${months[d.getMonth()]}`;
}

function pad(n){ return String(n).padStart(2,'0'); }
function toInputDate(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

async function apiGetBookings(){
  const res = await fetch(`${API_BASE}/api/bookings`);
  if(!res.ok) throw new Error(`GET /api/bookings failed: ${res.status}`);
  const data = await res.json();
  return data?.items ?? [];
}

async function apiCreateBooking(payload){
  const res = await fetch(`${API_BASE}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if(res.status === 409){
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || err?.detail || 'Time already booked');
  }
  if(!res.ok) throw new Error(`POST /api/bookings failed: ${res.status}`);
  return await res.json();
}

async function apiDeleteBooking(id){
  const res = await fetch(`${API_BASE}/api/bookings/${id}`, { method: 'DELETE' });
  if(!res.ok) throw new Error(`DELETE /api/bookings/${id} failed: ${res.status}`);
  return await res.json().catch(() => ({ ok:true }));
}

async function apiClearBookings(){
  const res = await fetch(`${API_BASE}/api/bookings`, { method: 'DELETE' });
  if(!res.ok) throw new Error(`DELETE /api/bookings failed: ${res.status}`);
  return await res.json().catch(() => ({ ok:true }));
}

async function bookingCount(){
  const items = await apiGetBookings();
  return items.length;
}

function setAlert(el, kind, text){
  if(!el) return;
  el.hidden = false;
  el.className = 'alert';
  if(kind === 'ok') el.classList.add('alert--ok');
  if(kind === 'warn') el.classList.add('alert--warn');
  if(kind === 'danger') el.classList.add('alert--danger');
  el.textContent = text;
}


function clearAlert(el){
  if(!el) return;
  el.hidden = true;
  el.className = 'alert';
  el.textContent = '';
}


// ===== UI Rendering =====
function renderServices(){
  const wrap = $('#servicesCards');
  wrap.innerHTML = state.services.map(s => `
    <article class="card">
      <div class="card__top">
        <div class="card__icon">${s.icon}</div>
        <div class="badge" style="border-color:rgba(99,208,255,.35);background:rgba(99,208,255,.08);color:rgba(199,239,255,.95)">${s.name}</div>
      </div>
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
      <div class="card__foot">
        <button class="btn btn--ghost" type="button" data-pick="${s.id}">اختيار</button>
        <span class="muted">متوسط الوقت: 30-45 دقيقة</span>
      </div>
    </article>
  `).join('');

  $$('.card [data-pick]').forEach(btn => {
    btn.addEventListener('click', () => {
      $('#serviceSelect').value = btn.getAttribute('data-pick');
      updateDoctorOptions();
      scrollToId('book');
      updateAvailability();
    });
  });
}

function doctorMatchesService(doctorId, serviceId){
  const d = state.doctors.find(x => x.id === doctorId);
  const s = state.services.find(x => x.id === serviceId);
  if(!d || !s) return false;
  const map = {
    general: 'كشف عام',
    pediatrics: 'طب أطفال',
    dermatology: 'جلدية',
    cardio: 'قلب',
    dentistry: 'أسنان',
    women: 'نساء وولادة'
  };
  return d.specialty === map[serviceId];
}

function updateDoctorOptions(){
  const serviceId = $('#serviceSelect').value;
  const doctorSelect = $('#doctorSelect');
  const options = state.doctors
    .filter(d => doctorMatchesService(d.id, serviceId))
    .map(d => `<option value="${d.id}">${d.name} • ${d.specialty} (★ ${d.rating})</option>`);

  doctorSelect.innerHTML = options.join('');

  // fallback if none
  if(!doctorSelect.value && options.length){
    doctorSelect.value = options[0].match(/value="([^"]+)"/)[1];
  }
}

function renderDoctors(){
  const wrap = $('#doctorsCards');
  wrap.innerHTML = state.doctors.map(d => `
    <article class="card">
      <div class="card__top">
        <div class="card__icon">👨‍⚕️</div>
        <div class="badge" style="border-color:rgba(46,229,157,.45);background:rgba(46,229,157,.10);color:rgba(178,255,220,.95)">★ ${d.rating}</div>
      </div>
      <h3>${d.name}</h3>
      <p><b>${d.specialty}</b><br/>استجابة سريعة وخطة واضحة.</p>
      <div class="card__foot">
        <button class="btn btn--ghost" type="button" data-doctor="${d.id}">اختيار الطبيب</button>
        <span class="muted">خبرة: 8 سنوات</span>
      </div>
    </article>
  `).join('');

  $$('.card [data-doctor]').forEach(btn => {
    btn.addEventListener('click', () => {
      const doctorId = btn.getAttribute('data-doctor');

      // set service + doctor based on the clicked doctor
      const doctor = state.doctors.find(d => d.id === doctorId);
      const serviceId = Object.entries({
        'كشف عام': 'general',
        'طب أطفال': 'pediatrics',
        'جلدية': 'dermatology',
        'قلب': 'cardio',
        'أسنان': 'dentistry',
        'نساء وولادة': 'women',
      }).find(([_, sid]) => sid && sid);

      // map specialty text -> service id
      const specialtyToServiceId = {
        'كشف عام': 'general',
        'طب أطفال': 'pediatrics',
        'جلدية': 'dermatology',
        'قلب': 'cardio',
        'أسنان': 'dentistry',
        'نساء وولادة': 'women',
      };

      const mappedServiceId = doctor ? specialtyToServiceId[doctor.specialty] : null;
      if(mappedServiceId){
        $('#serviceSelect').value = mappedServiceId;
        updateDoctorOptions();
      }

      $('#doctorSelect').value = doctorId;
      scrollToId('book');
      updateAvailability();
    });
  });
}

function renderSchedule(){
  const scheduleList = $('#scheduleList');
  const today = new Date();
  $('#todayLabel').textContent = formatDateAr(today);

  // create fake slots: some busy
  const busyIndex = new Set([1, 3, 6]);
  const slots = state.timeSlots.slice(0, 8);
  scheduleList.innerHTML = slots.map((t, i) => {
    const busy = busyIndex.has(i);
    const label = busy ? 'مشغول' : 'متاح';
    return `
      <div class="slot">
        <div>
          <div class="slot__when">${t}</div>
          <div class="slot__meta">${busy ? 'مراجعات قائمة' : 'يمكن الحجز الآن'}</div>
        </div>
        <div class="slot__tag ${busy ? 'slot__tag--busy' : 'slot__tag--free'}">${label}</div>
      </div>
    `;
  }).join('');

  $('#nextBadge').textContent = (() => {
    const next = slots.find((_, i) => !busyIndex.has(i));
    return next ? `التالي: ${next}` : 'لا يوجد وقت متاح';
  })();
}

function scrollToId(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initBookForm(){
  const serviceSelect = $('#serviceSelect');
  serviceSelect.innerHTML = state.services.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  // default doctor options
  updateDoctorOptions();

  // date default: today
  const today = new Date();
  $('#dateInput').value = toInputDate(today);

  // time slots
  $('#timeSelect').innerHTML = state.timeSlots.map(t => `<option value="${t}">${t}</option>`).join('');

  // update availability on changes
  ['serviceSelect','doctorSelect','dateInput','timeSelect'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', updateAvailability);
    el.addEventListener('input', updateAvailability);
  });

  updateAvailability();
}

function updateAvailability(){
  const serviceId = $('#serviceSelect').value;
  const doctorId = $('#doctorSelect').value;
  const date = $('#dateInput').value;
  const time = $('#timeSelect').value;

  // simple availability logic: if same doctor/time already booked -> busy
  const bookings = loadBookings();
  const exists = bookings.some(b => b.doctorId === doctorId && b.date === date && b.time === time);

  const availabilityValue = $('#availabilityValue');
  const suggestTime = $('#suggestTime');

  if(exists){
    availabilityValue.textContent = 'غير متاح (محجوز)';
    const alt = state.timeSlots.find(t => !bookings.some(b => b.doctorId === doctorId && b.date === date && b.time === t));
    suggestTime.textContent = alt ? alt : 'لا يوجد بديل';
  } else {
    availabilityValue.textContent = 'متاح';
    suggestTime.textContent = time || '--';
  }
}

function animateStat(){
  const el = $('#statAppointments');
  const target = bookingCount();
  let cur = 0;
  const step = Math.max(1, Math.floor(target / 40));
  const iv = setInterval(() => {
    cur += step;
    if(cur >= target){ cur = target; clearInterval(iv); }
    el.textContent = cur;
  }, 20);
}

function renderBookings(){
  const tbody = $('#bookingsTbody');
  const items = loadBookings();

  if(!items.length){
    tbody.innerHTML = `<tr><td colspan="6" class="muted">لا توجد حجوزات بعد.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((b, idx) => `
    <tr>
      <td>${b.date}</td>
      <td>${b.time}</td>
      <td>${b.serviceName}</td>
      <td>${b.doctorName}</td>
      <td>${b.name}</td>
      <td>
        <button class="btn btn--danger" type="button" data-del="${idx}">حذف</button>
      </td>
    </tr>
  `).join('');

  $$('#bookings [data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.getAttribute('data-del'));
      const all = loadBookings();
      all.splice(i, 1);
      saveBookings(all);
      renderBookings();
      animateStat();
      updateAvailability();
    });
  });
}

// ===== Modal =====
function setModal(open){
  const modal = $('#modal');
  modal.hidden = !open;
  if(open){
    $('#consultAlert')?.setAttribute('hidden','');
  }
}

// ===== Events =====
function initEvents(){
  // burger
  $('#burger')?.addEventListener('click', () => {
    const m = $('#mobileNav');
    const isHidden = m.hasAttribute('hidden');
    if(isHidden) m.removeAttribute('hidden'); else m.setAttribute('hidden','');
  });

  // quick book
  $('#quickBook')?.addEventListener('click', () => scrollToId('book'));

  // (تم تعطيل زر طلب الاستشارة)

  $('#closeModal')?.addEventListener('click', () => setModal(false));
  $('#cancelModal')?.addEventListener('click', () => setModal(false));

  // close modal on backdrop click
  $('#modal')?.addEventListener('click', (e) => {
    if(e.target.id === 'modal') setModal(false);
  });

  // booking pick: when service changes, refresh doctors
  $('#serviceSelect').addEventListener('change', () => {
    updateDoctorOptions();
    updateAvailability();
  });

  // booking form
  $('#bookingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const alertEl = $('#formAlert');
    clearAlert(alertEl);

    const serviceId = $('#serviceSelect').value;
    const doctorId = $('#doctorSelect').value;
    const date = $('#dateInput').value;
    const time = $('#timeSelect').value;
    const name = $('#nameInput').value.trim();
    const phone = $('#phoneInput').value.trim();
    const notes = $('#notesInput').value.trim();

    // validate time availability
    const bookings = loadBookings();
    const exists = bookings.some(b => b.doctorId === doctorId && b.date === date && b.time === time);
    if(exists){
      setAlert(alertEl, 'danger', 'هذا الوقت محجوز بالفعل. جرّب وقتًا آخر.');
      updateAvailability();
      return;
    }

    const service = state.services.find(s => s.id === serviceId);
    const doctor = state.doctors.find(d => d.id === doctorId);

    const newBooking = {
      serviceId,
      serviceName: service?.name || '—',
      doctorId,
      doctorName: doctor?.name || '—',
      date,
      time,
      name,
      phone,
      notes,
      createdAt: Date.now(),
    };

    const next = [newBooking, ...bookings];
    saveBookings(next);

    setAlert(alertEl, 'ok', 'تم تأكيد الحجز ✅ سيتم عرض الحجز ضمن (حجوزاتي).');
    renderBookings();
    animateStat();
    updateAvailability();

    // reset notes but keep date/time for convenience
    $('#notesInput').value = '';

    // scroll to bookings after a tick
    setTimeout(() => scrollToId('bookings'), 350);
  });

  $('#viewBookings')?.addEventListener('click', () => scrollToId('bookings'));

  $('#clearBookings')?.addEventListener('click', () => {
    saveBookings([]);
    renderBookings();
    animateStat();
    updateAvailability();
  });

  // contact
  $('#contactForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const alertEl = $('#contactAlert');
    clearAlert(alertEl);
    const name = $('#contactName').value.trim();
    setAlert(alertEl, 'ok', `تم إرسال رسالتك (Demo) ✅ شكرًا ${name}.`);
    e.target.reset();
    setTimeout(() => { alertEl.hidden = true; }, 2500);
  });

  // consult modal
  $('#consultForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const alertEl = $('#consultAlert');
    clearAlert(alertEl);
    const n = $('#consultName').value.trim();
    setAlert(alertEl, 'ok', `تم استلام الطلب (Demo) ✅ سنراجع حالتك قريبًا, ${n}.`);
    e.target.reset();
    setTimeout(() => setModal(false), 900);
  });

  // year
  $('#year').textContent = new Date().getFullYear();
}

// ===== Init =====
function init(){
  renderSchedule();
  renderServices();
  renderDoctors();
  initBookForm();
  renderBookings();
  animateStat();
  initEvents();

  // quick fill: prefill phone with placeholder style behavior
  const phone = $('#phoneInput');
  phone.placeholder = '05xxxxxxxx';
}

init();

