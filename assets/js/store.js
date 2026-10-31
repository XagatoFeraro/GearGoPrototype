/* ==========================================================================
   Gear Go Automobiles — store
   LocalStorage persistence, schema normalisation, session/auth state,
   inventory reservations, seed data and shared UI primitives.
   ========================================================================== */
'use strict';

const STORAGE_OK = sessionStorageGuard();
let db = null;
let toastSeq = 0;
let pendingConfirm = null;
let routeCleanup = null;
let activeModalCleanup = null;
let tourIndex = 0;
let tourSteps = [];
let tourAuto = false;

function freshSession() {
  return {kind:'guest',staffId:null,customerId:null};
}

function defaultUI() {
  return {bookingDraft:null,estimateDraft:null,lastRoute:'/site',filters:{},tourDone:false,toursSeen:{}};
}

function normalizeSession(session, data, previousSchema) {
  const s = session && typeof session === 'object' ? session : {};
  if (previousSchema < SCHEMA_VERSION && s.kind === 'staff' && s.staffId === 'st_owner') return freshSession();
  if (s.kind === 'customer' && data.customers.some(c => c.id === s.customerId)) return {kind:'customer',staffId:null,customerId:s.customerId};
  if (s.kind === 'staff' && data.staff.some(st => st.id === s.staffId && st.active)) return {kind:'staff',staffId:s.staffId,customerId:null};
  return freshSession();
}

function rebuildReservations(data) {
  if (!Array.isArray(data.reservations)) data.reservations = [];
  if (data.reservations.length) {
    data.parts.forEach(p => {
      p.reserved = round2(data.reservations.filter(r => r.partId === p.id && r.status === 'active').reduce((sum, r) => sum + Number(r.qty || 0), 0));
    });
    return;
  }
  data.parts.forEach(p => { p.reserved = 0; });
  data.estimates.slice().sort(by('createdAt', 1)).forEach(est => {
    if (!['APPROVED','PARTIALLY_APPROVED'].includes(est.status)) return;
    const job = data.jobs.find(j => j.id === est.jobId);
    if (!job || ['DELIVERED','CANCELLED'].includes(job.status)) return;
    const approved = approvedLineIds(est);
    est.lines.forEach(line => {
      if (!line.partId || !approved.has(line.id)) return;
      const part = data.parts.find(p => p.id === line.partId);
      if (!part) return;
      const qty = Math.max(0, Number(line.qty) || 0);
      const available = Math.max(0, Number(part.stock || 0) - Number(part.reserved || 0));
      const reserveQty = Math.min(qty, available);
      if (reserveQty > 0) {
        data.reservations.push({id:uid('res'),partId:part.id,jobId:job.id,estimateId:est.id,lineId:line.id,qty:reserveQty,status:'active',createdAt:new Date().toISOString()});
        part.reserved = round2(Number(part.reserved || 0) + reserveQty);
      }
      if (qty > reserveQty) data.reservations.push({id:uid('res'),partId:part.id,jobId:job.id,estimateId:est.id,lineId:line.id,qty:qty-reserveQty,status:'shortage',createdAt:new Date().toISOString()});
    });
  });
  data.parts.forEach(p => {
    p.reserved = round2(data.reservations.filter(r => r.partId === p.id && r.status === 'active').reduce((sum, r) => sum + Number(r.qty || 0), 0));
  });
}

function normalizeDB(data) {
  if (!data || typeof data !== 'object') return normalizeDB(buildSeed());
  const previousSchema = Number(data.schemaVersion) || 0;
  const seed = buildSeed();
  const incomingSettings = data.settings && typeof data.settings === 'object' ? data.settings : {};
  data.version = APP_VERSION;
  data.schemaVersion = SCHEMA_VERSION;
  data.settings = {...clone(seed.settings), ...incomingSettings};
  data.settings.business = {...clone(seed.settings.business), ...(incomingSettings.business || {})};
  data.settings.tax = {...clone(seed.settings.tax), ...(incomingSettings.tax || {})};
  data.settings.booking = {...clone(seed.settings.booking), ...(incomingSettings.booking || {})};
  data.settings.numbering = {...clone(seed.settings.numbering), ...(incomingSettings.numbering || {})};
  data.settings.approval = {...clone(seed.settings.approval), ...(incomingSettings.approval || {})};
  data.settings.templates = {...clone(seed.settings.templates), ...(incomingSettings.templates || {})};
  data.settings.services = Array.isArray(incomingSettings.services) && incomingSettings.services.length ? incomingSettings.services : clone(seed.settings.services);
  data.settings.statusLabels = {...clone(seed.settings.statusLabels || {}), ...(incomingSettings.statusLabels || {})};
  data.settings.invoice = {terms:'Due on collection', prefix:'GG-INV', ...(incomingSettings.invoice || {})};
  data.settings.business.gstin = data.settings.business.gstin || 'DEMO-GSTIN-NOT-VALID';

  ['staff','customers','vehicles','bookings','jobs','inspections','estimates','invoices','parts','movements','reservations','communications','reminders','feedback','audit','notifications'].forEach(key => { if (!Array.isArray(data[key])) data[key] = []; });

  (data.jobs || []).forEach(j => {
    j.number = j.number || j.ref || '—';
    j.ref = j.ref || j.number;
    j.concerns = Array.isArray(j.concerns) ? j.concerns : (j.concern ? [j.concern] : []);
    j.techIds = Array.isArray(j.techIds) ? j.techIds : (j.technicianId ? [j.technicianId] : []);
    j.odometer = Number.isFinite(Number(j.odometer)) ? Number(j.odometer) : (Number(j.checkInOdometer) || 0);
    j.expectedAt = j.expectedAt || j.expectedCompletion || null;
    j.customerUpdates = Array.isArray(j.customerUpdates) ? j.customerUpdates : (Array.isArray(j.history) ? j.history : []);
    j.internalNotes = Array.isArray(j.internalNotes) ? j.internalNotes : [];
    j.tasks = Array.isArray(j.tasks) ? j.tasks : [];
    j.qualityChecks = Array.isArray(j.qualityChecks) ? j.qualityChecks : [];
    j.estimateIds = Array.isArray(j.estimateIds) ? j.estimateIds : [];
  });
  (data.estimates || []).forEach(e => {
    e.ref = e.ref || e.number || '—';
    e.number = e.number || e.ref;
    e.lines = Array.isArray(e.lines) ? e.lines : [];
    e.decisions = Array.isArray(e.decisions) ? e.decisions : [];
    if (!e.vehicleId) e.vehicleId = data.jobs.find(j => j.id === e.jobId)?.vehicleId || null;
    e.validUntil = e.validUntil || addDays(todayKey(), Number(data.settings.approval.validityDays) || 5);
  });
  (data.invoices || []).forEach(i => {
    i.ref = i.ref || i.number || '—';
    i.number = i.number || i.ref;
    i.lines = Array.isArray(i.lines) ? i.lines : [];
    i.payments = Array.isArray(i.payments) ? i.payments : [];
    const job = data.jobs.find(j => j.id === i.jobId);
    if (!i.vehicleId) i.vehicleId = job?.vehicleId || null;
    if (!i.customerId) i.customerId = job?.customerId || null;
    if (!i.estimateId) i.estimateId = job?.estimateIds?.[0] || null;
  });
  (data.parts || []).forEach(p => {
    p.stock = Math.max(0, Number(p.stock) || 0);
    p.reserved = Math.max(0, Number(p.reserved) || 0);
    p.reorder = Math.max(0, Number(p.reorder) || 0);
    p.active = p.active !== false;
    p.movements = Array.isArray(p.movements) ? p.movements : [];
  });
  (data.movements || []).forEach(m => {
    if (m.stockDelta == null) m.stockDelta = ['receive','consume','adjust'].includes(m.type) ? Number(m.qty) || 0 : 0;
    if (m.reservedDelta == null) m.reservedDelta = 0;
  });
  data.ui = {...defaultUI(), ...(data.ui && typeof data.ui === 'object' ? data.ui : {})};
  data.ui.filters = {...(data.ui.filters || {})};
  data.session = normalizeSession(data.session, data, previousSchema);
  data.demoDate = data.demoDate || todayKey();
  data.seededAt = data.seededAt || new Date().toISOString();
  rebuildReservations(data);

  const nextAfter = (items, getter, current) => {
    const highest = items.reduce((max, item) => Math.max(max, Number((String(getter(item) || '').match(/(\d+)$/) || [])[1]) || 0), 0);
    return Math.max(Number(current) || 1, highest + 1);
  };
  const numbering = data.settings.numbering;
  numbering.booking = nextAfter(data.bookings || [], b => b.ref, numbering.booking);
  numbering.job = nextAfter(data.jobs || [], j => j.ref || j.number, numbering.job);
  numbering.estimate = nextAfter(data.estimates || [], e => e.ref || e.number, numbering.estimate);
  numbering.invoice = nextAfter(data.invoices || [], i => i.ref || i.number, numbering.invoice);
  numbering.customer = nextAfter(data.customers || [], c => c.ref, numbering.customer);
  numbering.vehicle = nextAfter(data.vehicles || [], v => v.ref, numbering.vehicle);
  return data;
}

function loadDB() {
  let raw = null;
  try {
    raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.customers)) throw new Error('Stored demo data is missing required records.');
      if (parsed.version && !['1.0.0', APP_VERSION].includes(parsed.version)) throw new Error(`Unsupported demo data version: ${parsed.version}`);
      if (!parsed.schemaVersion || parsed.version !== APP_VERSION) {
        try { localStorage.setItem(LS_BACKUP_KEY, raw); } catch (e) { console.warn('Demo backup could not be saved.', e); }
      }
      const normalized = normalizeDB(parsed);
      try { localStorage.setItem(LS_KEY, JSON.stringify(normalized)); } catch (e) { console.warn('Migrated demo data could not be saved.', e); }
      return normalized;
    }
  } catch (e) {
    console.warn('Stored demo data could not be read; a fresh demo will be created.', e);
    if (raw) { try { localStorage.setItem(LS_BACKUP_KEY, raw); } catch (backupError) { console.warn('Demo backup could not be saved.', backupError); } }
  }
  return normalizeDB(buildSeed());
}

function saveDB(options = {}) {
  if (!db) return false;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    console.error('Demo persistence failure', e);
    if (!options.silent) toast('Changes are not saved', 'Browser storage is unavailable or full. This screen will work for the current session, but refreshing may lose new changes.', 'error');
    return false;
  }
}

function persist(msg = 'Changes saved', type = 'success', options = {}) {
  const ok = saveDB();
  if (!options.skipToast) {
    if (ok && msg) toast(options.title || 'Saved', msg, type);
    if (!ok) toast('Could not persist changes', 'The demo is continuing in memory. Check browser storage permissions before relying on this state.', 'error');
  }
  return ok;
}

function toast(title, message = '', type = 'success') {
  const root = $('#toast-root');
  if (!root) return;
  const id = ++toastSeq;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.dataset.toastId = id;
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'checkCircle')}<div><strong>${esc(title)}</strong>${message ? `<span>${esc(message)}</span>` : ''}</div>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, type === 'error' ? 5200 : 3600);
}

function closeModal() {
  const root = $('#modal-root');
  if (!root) return;
  if (activeModalCleanup) { try { activeModalCleanup(); } catch (e) {} activeModalCleanup = null; }
  root.innerHTML = '';
  document.body.style.overflow = '';
}

function openModal({title, body, footer = '', size = '', onMount = null, dismissible = true}) {
  closeModal();
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-modal-backdrop>
    <section class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head">
        <div><h2 class="modal-title" id="modal-title">${esc(title)}</h2></div>
        <button class="modal-close" data-action="modal.close" aria-label="Close dialog">${icon('close','icon-sm')}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </section>
  </div>`;
  document.body.style.overflow = 'hidden';
  const backdrop = $('[data-modal-backdrop]', root);
  if (dismissible) {
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  }
  const focusables = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', root).filter(el => !el.disabled && el.offsetParent !== null);
  (focusables[0] || $('.modal-close', root))?.focus();
  function trap(e) {
    if (e.key === 'Escape' && dismissible) { e.preventDefault(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    const els = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', root).filter(el => !el.disabled && el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', trap);
  activeModalCleanup = () => document.removeEventListener('keydown', trap);
  if (onMount) onMount(root);
  return root;
}

function confirmDialog({title = 'Confirm action', message, confirmLabel = 'Confirm', danger = false, onConfirm, requireReason = false, reasonLabel = 'Reason'}) {
  const body = `<p style="font-size:13.5px;line-height:1.65;color:var(--ink-soft)">${message}</p>
    ${requireReason ? `<div class="field mt-4"><label for="confirm-reason">${esc(reasonLabel)}</label><textarea class="textarea" id="confirm-reason" rows="3" placeholder="Record a short reason for the audit history"></textarea><span class="error" data-confirm-error></span></div>` : ''}`;
  openModal({
    title, body, size:'', dismissible:true,
    footer:`<button class="btn btn-outline" data-action="modal.close">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-dark'}" data-action="confirm.accept">${esc(confirmLabel)}</button>`,
    onMount(root) {
      $('[data-action="confirm.accept"]', root).addEventListener('click', async e => {
        const reasonEl = $('#confirm-reason', root);
        if (requireReason && reasonEl && isBlank(reasonEl.value)) {
          $('[data-confirm-error]', root).textContent = 'Please record a reason to continue.';
          reasonEl.focus();
          return;
        }
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Working…`;
        try {
          const result = await onConfirm(reasonEl ? reasonEl.value.trim() : '');
          if (result === false) return;
          closeModal();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = confirmLabel;
          toast('Action failed', err.message || 'Please try again.', 'error');
        }
      });
    }
  });
}

function setBusy(btn, label = 'Working…') {
  if (!btn) return () => {};
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${esc(label)}`;
  return () => { btn.disabled = false; btn.innerHTML = original; };
}

function toastDemo(label = 'Simulated') {
  toast(label, 'This action is simulated inside the prototype. No real message, payment or backend request is sent.', 'info');
}

function fieldError(form, name, message) {
  const field = form.querySelector(`[name="${name}"]`) || form.querySelector(`#${name}`);
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    const wrap = field.closest('.field');
    if (wrap) {
      let err = wrap.querySelector('.error');
      if (!err) { err = document.createElement('span'); err.className = 'error'; wrap.appendChild(err); }
      err.textContent = message;
      field.focus();
    }
  }
}

function clearErrors(form) {
  $$('[aria-invalid="true"]', form).forEach(el => el.removeAttribute('aria-invalid'));
  $$('.error', form).forEach(el => { if (el.closest('.field')) el.textContent = ''; });
}

function formValues(form) {
  const data = {};
  new FormData(form).forEach((v, k) => { data[k] = typeof v === 'string' ? v.trim() : v; });
  return data;
}

function setFormLoading(form, loading) {
  $$('button[type="submit"]', form).forEach(btn => {
    if (loading) { btn.dataset.original = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Please wait…`; }
    else { btn.disabled = false; if (btn.dataset.original) btn.innerHTML = btn.dataset.original; }
  });
}

function makeCSV(rows, filename) {
  if (!rows.length) { toast('Nothing to export', 'No records matched the current filters.', 'info'); return; }
  const headers = Object.keys(rows[0]);
  const escapeCSV = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escapeCSV).join(','), ...rows.map(row => headers.map(h => escapeCSV(row[h])).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 400);
  toast('Export ready', `${rows.length} records exported as ${filename}.`);
}

function scrollToTop() { window.scrollTo({top:0, behavior:'instant'}); }

function go(path) {
  if (!path) return;
  if (location.hash === '#' + path) { render(); return; }
  location.hash = '#' + path;
}

function link(path) { return `#${path}`; }

function pageFocus(id = 'main-content') {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el) el.focus({preventScroll:true});
  });
}

const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); } });
}, {threshold:.08, rootMargin:'0px 0px -40px 0px'}) : null;

function initReveals(root = document) {
  $$('.reveal, .stagger', root).forEach(el => {
    if (revealObserver) revealObserver.observe(el);
    else el.classList.add('in');
  });
}

function buildSeed() {
  const now = new Date().toISOString();
  const settings = {
    business:{
      name:'Gear Go Automobiles',
      tagline:'Transparent car care for Delhi NCR',
      address:'Phase 4, H Block, Aya Nagar, behind Fitness Club Gym, New Delhi, Delhi 110047',
      locality:'Aya Nagar', city:'New Delhi', state:'Delhi', pincode:'110047',
      phone:'+91 90000 00100', whatsapp:'+91 90000 00100', email:'hello@geargo.demo',
      ownerName:'Hammad Alam', ownerPhone:'+91 95576 08654', ownerWhatsApp:'+91 95576 08654',
      gstin:'DEMO-GSTIN-NOT-VALID',
      hours:{mon:'09:00 – 19:00',tue:'09:00 – 19:00',wed:'09:00 – 19:00',thu:'09:00 – 19:00',fri:'09:00 – 19:00',sat:'09:00 – 17:00',sun:'Closed'},
      weeklyClosed:['Sun'],
      holidays:[{date:addDays(todayKey(), 9), label:'Configured demo holiday'}],
      serviceAreas:['Aya Nagar','Chhatarpur','Mehrauli','Saket','Malviya Nagar','Vasant Kunj','Gurugram Sector 14','Gurugram Sector 29','Gurugram Sector 45','Gurugram Sector 56','DLF Phase 1–5','Faridabad','South Delhi'],
      capabilities:{pickupDrop:true,towing:'Subject to availability',insuranceCoordination:'Subject to availability',courtesyVehicle:'Subject to availability',roadside:'Subject to availability'},
      parkingNote:'Customer parking available in the workshop lane. Please call on arrival.',
      publicPhoneLabel:'Demo contact number'
    },
    tax:{enabled:true, rate:18, label:'GST · demo configuration', note:'Illustrative only. Actual tax treatment and rates must be confirmed for the business. Do not treat these demo values as a tax opinion.'},
    booking:{slotMinutes:60, capacity:2, open:'09:00', close:'19:00', horizon:21, leadDays:1, terms:'Appointment requests are subject to confirmation by the garage. The requested slot reserves capacity only after confirmation.'},
    numbering:{booking:1042, job:2087, estimate:3074, invoice:4061, customer:1007, vehicle:2009, payment:5004},
    approval:{validityDays:5, collectionPolicy:'The demo collection policy allows handover only when the invoice balance is settled, unless an authorised override with a recorded reason is used.', safetyPolicy:'When a customer declines a safety-critical recommendation, staff must review the risk and record an operational decision before release.'},
    templates:{
      booking_confirmation:{subject:'Your Gear Go service request is confirmed',body:'Hi {{name}}, your appointment for {{vehicle}} on {{date}} at {{time}} is confirmed. Reference: {{ref}}. You can track updates in your customer portal. — Gear Go Automobiles (demo message)'},
      appointment_reminder:{subject:'Reminder: your Gear Go appointment',body:'Hi {{name}}, a reminder for your {{vehicle}} appointment on {{date}} at {{time}}. Please call us if you need to reschedule. — Gear Go Automobiles (demo message)'},
      inspection_ready:{subject:'Your vehicle inspection report is ready',body:'Hi {{name}}, we have documented the inspection for {{vehicle}}. Review the findings and estimate in your portal: {{ref}}. — Gear Go Automobiles (demo message)'},
      estimate_ready:{subject:'Estimate ready for your approval',body:'Hi {{name}}, estimate {{ref}} for {{vehicle}} is ready. No additional paid work starts until you approve it. — Gear Go Automobiles (demo message)'},
      approval_reminder:{subject:'A decision is needed on your estimate',body:'Hi {{name}}, we are waiting for your decision on estimate {{ref}}. Open your portal to review the items. — Gear Go Automobiles (demo message)'},
      additional_work:{subject:'Additional work found during service',body:'Hi {{name}}, our technician found an additional issue on {{vehicle}}. A supplementary estimate {{ref}} is ready for your decision. The previously approved work is unchanged. — Gear Go Automobiles (demo message)'},
      progress_update:{subject:'Service update: {{status}}',body:'Hi {{name}}, your {{vehicle}} is now “{{status}}”. Expected completion: {{eta}}. — Gear Go Automobiles (demo message)'},
      delay_notice:{subject:'An update on your vehicle',body:'Hi {{name}}, the expected completion for {{vehicle}} has changed to {{eta}}. Reason: {{reason}}. We will update you again when work resumes. — Gear Go Automobiles (demo message)'},
      completion:{subject:'Your vehicle is ready for collection',body:'Hi {{name}}, {{vehicle}} is ready for collection. Job {{ref}}. Please review your invoice in the portal. — Gear Go Automobiles (demo message)'},
      payment_reminder:{subject:'Invoice balance reminder',body:'Hi {{name}}, invoice {{ref}} has an outstanding balance of {{amount}}. Please contact the garage if you need a copy of the invoice. — Gear Go Automobiles (demo message)'},
      feedback_request:{subject:'How was your Gear Go experience?',body:'Hi {{name}}, thank you for choosing us. If you would like, share feedback for job {{ref}} in your portal. — Gear Go Automobiles (demo message)'},
      service_reminder:{subject:'A service reminder for {{vehicle}}',body:'Hi {{name}}, this is a configurable reminder for {{vehicle}}: {{reason}}. Book when it suits you. — Gear Go Automobiles (demo message)'}
    },
    services:SERVICE_SEED,
    statusLabels:{}
  };
  const staff = [
    {id:'st_owner',name:'Rakesh Ahuja',role:'owner',phone:'9000000101',email:'rakesh@geargo.demo',active:true,title:'Founder',colour:'#d9ff4f',joinedAt:isoAt(-900,10,0)},
    {id:'st_manager',name:'Meera Sethi',role:'manager',phone:'9000000102',email:'meera@geargo.demo',active:true,title:'Service Manager',colour:'#9bc9ff',joinedAt:isoAt(-620,10,0)},
    {id:'st_front',name:'Imran Qureshi',role:'front_desk',phone:'9000000103',email:'imran@geargo.demo',active:true,title:'Service Advisor',colour:'#b8e7c5',joinedAt:isoAt(-410,10,0)},
    {id:'st_tech1',name:'Rohit Nair',role:'technician',phone:'9000000104',email:'rohit@geargo.demo',active:true,title:'Senior Technician',colour:'#ffd88c',joinedAt:isoAt(-380,10,0)},
    {id:'st_tech2',name:'Gagandeep Singh',role:'technician',phone:'9000000105',email:'gagan@geargo.demo',active:true,title:'Technician',colour:'#ffc1b5',joinedAt:isoAt(-250,10,0)},
    {id:'st_tech3',name:'Deepak Kumar',role:'technician',phone:'9000000106',email:'deepak@geargo.demo',active:true,title:'Technician',colour:'#d8c8ff',joinedAt:isoAt(-160,10,0)},
    {id:'st_finance',name:'Kavita Chauhan',role:'finance',phone:'9000000107',email:'kavita@geargo.demo',active:true,title:'Finance Executive',colour:'#ffc7e1',joinedAt:isoAt(-520,10,0)}
  ];
  const customerSeed = [
    ['cus_aarav','Aarav Sharma','9000000001','aarav.sharma@example.demo','Aya Nagar','New Delhi','110047',true,true],
    ['cus_priya','Priya Verma','9000000002','priya.verma@example.demo','Vasant Kunj','New Delhi','110070',true,true],
    ['cus_rahul','Rahul Yadav','9000000003','rahul.yadav@example.demo','Chhatarpur','New Delhi','110074',true,false],
    ['cus_neha','Neha Gupta','9000000004','neha.gupta@example.demo','Saket','New Delhi','110017',true,true],
    ['cus_arjun','Arjun Mehta','9000000005','arjun.mehta@example.demo','Gurugram Sector 45','Gurugram','122003',true,true],
    ['cus_simran','Simran Kaur','9000000006','simran.kaur@example.demo','Malviya Nagar','New Delhi','110017',true,true],
    ['cus_faizan','Mohammed Faizan','9000000007','faizan@example.demo','Jamia Nagar','New Delhi','110025',true,false],
    ['cus_aditi','Aditi Singh','9000000008','aditi.singh@example.demo','Faridabad','Faridabad','121001',true,true],
    ['cus_karan','Karan Bhatia','9000000009','karan.bhatia@example.demo','Gurugram Sector 56','Gurugram','122011',true,true],
    ['cus_pooja','Pooja Mishra','9000000010','pooja.mishra@example.demo','Mehrauli','New Delhi','110030',true,false],
    ['cus_vikram','Vikram Saini','9000000011','vikram.saini@example.demo','Aya Nagar','New Delhi','110047',true,true],
    ['cus_sana','Sana Khan','9000000012','sana.khan@example.demo','Vasant Kunj','New Delhi','110070',true,true],
    ['cus_rohan','Rohan Malhotra','9000000013','rohan.malhotra@example.demo','Gurugram Sector 14','Gurugram','122001',true,false],
    ['cus_ananya','Ananya Kapoor','9000000014','ananya.kapoor@example.demo','Saket','New Delhi','110017',true,true],
    ['cus_tanya','Tanya Sethi','9000000015','tanya.sethi@example.demo','Chhatarpur','New Delhi','110074',false,true],
    ['cus_manav','Manav Bansal','9000000016','manav.bansal@example.demo','DLF Phase 3','Gurugram','122002',true,true]
  ];
  const customers = customerSeed.map((c, i) => ({
    id:c[0], ref:`GG-C-${1001 + i}`, name:c[1], mobile:c[2], email:c[3], channel:i % 3 === 0 ? 'whatsapp' : i % 4 === 0 ? 'email' : 'sms',
    address:{locality:c[4], city:c[5], pincode:c[6], line:`${c[4]}, ${c[5]}`}, type:'Individual',
    consents:{service:true,marketing:c[7]}, marketingOptOut:!c[7], status:'active', guest:c[8] === false,
    notes:i === 3 ? 'Reports a recurring AC cooling concern during summer months. Previous service records retained.' : i === 6 ? 'Prefers a phone call before any additional work is approved.' : '',
    createdAt:isoAt(-(300 - i * 13), 11, 15)
  }));
  const vehicleSeed = [
    ['veh_swift','DL 3C AB 1234','Maruti Suzuki','Swift','VXi',2021,'Petrol','Manual',28450,'cus_aarav','Pearl white','', 'active'],
    ['veh_creta','DL 3C CD 5678','Hyundai','Creta','SX',2020,'Petrol','Automatic',47220,'cus_priya','Polar white','Family car','active'],
    ['veh_i20','DL 3C EF 9012','Hyundai','i20','Asta',2018,'Petrol','Manual',68110,'cus_priya','Fiery red','Second car','active'],
    ['veh_baleno','HR 26 AB 1234','Maruti Suzuki','Baleno','Zeta',2022,'Petrol','Manual',31140,'cus_rahul','Nexa blue','','active'],
    ['veh_city','DL 8C XY 5678','Honda','City','VX',2019,'Petrol','Automatic',52380,'cus_neha','Radiant red','','active'],
    ['veh_seltos','HR 55 CD 2345','Kia','Seltos','HTX',2023,'Petrol','Automatic',18960,'cus_arjun','Gravity grey','','active'],
    ['veh_nexon','DL 3C GH 3456','Tata','Nexon','XZ+',2022,'Diesel','Manual',35600,'cus_simran','Daytona grey','','active'],
    ['veh_xuv','UP 16 EF 3456','Mahindra','XUV700','AX7',2023,'Diesel','Automatic',22010,'cus_faizan','Midnight black','','active'],
    ['veh_innova','HR 51 KL 7890','Toyota','Innova Crysta','GX',2018,'Diesel','Manual',104480,'cus_aditi','Silver','','active'],
    ['veh_scorpio','HR 26 MN 4567','Mahindra','Scorpio-N','Z8',2024,'Diesel','Automatic',9840,'cus_karan','Napoli black','','active'],
    ['veh_punch','DL 3C PQ 1122','Tata','Punch','Adventure',2023,'Petrol','Manual',16200,'cus_pooja','Tropical mist','','active'],
    ['veh_wagonr','DL 3C RS 3344','Maruti Suzuki','WagonR','VXi',2017,'CNG','Manual',86500,'cus_vikram','White','','active'],
    ['veh_venue','DL 8C TU 5566','Hyundai','Venue','S',2021,'Petrol','Manual',27800,'cus_sana','Denim blue','','active'],
    ['veh_amaze','HR 26 VW 7788','Honda','Amaze','VX',2019,'Petrol','Manual',54300,'cus_rohan','Golden brown','','active'],
    ['veh_creta2','DL 3C YZ 9900','Hyundai','Creta','SX',2022,'Diesel','Automatic',21400,'cus_ananya','Titan grey','','active'],
    ['veh_baleno2','DL 3C LM 2233','Maruti Suzuki','Baleno','Delta',2020,'Petrol','Manual',39700,'cus_tanya','Opulent red','','active'],
    ['veh_xuv2','HR 26 QQ 4455','Mahindra','XUV700','AX5',2022,'Diesel','Manual',31800,'cus_manav','Everest white','','active'],
    ['veh_creta3','DL 3C NO 7788','Hyundai','Creta','EX',2019,'Petrol','Manual',61200,'cus_neha','Phantom black','Sold vehicle record','inactive']
  ];
  const vehicles = vehicleSeed.map((v, i) => ({
    id:v[0], ref:`GG-V-${2001 + i}`, reg:normaliseReg(v[1]), make:v[2], model:v[3], variant:v[4], year:v[5], fuel:v[6], transmission:v[7],
    odometer:v[8], customerId:v[9], color:v[10], nickname:v[11], status:v[12], createdAt:isoAt(-(220 - i * 7), 10, 30),
    notes:i === 4 ? 'Recurring dashboard AC vent noise reported in the last two visits.' : i === 13 ? 'Customer has asked not to receive promotional messages.' : ''
  }));
  const booking = (id, ref, cid, vid, svc, concern, date, slot, status, source, jobId = null, extra = {}) => ({
    id, ref, customerId:cid, vehicleId:vid, services:svc, concerns:concern, addons:extra.addons || [],
    inspectionRequested:extra.inspectionRequested ?? false, appointmentType:extra.appointmentType || 'drop_off',
    date, slot, altPreference:extra.altPreference || '', status, source, notes:extra.notes || '', internalNotes:extra.internalNotes || '',
    jobId, createdAt:extra.createdAt || isoAt(-4, 10, 0), updatedAt:extra.updatedAt || now,
    history:extra.history || [{at:extra.createdAt || isoAt(-4, 10, 0), label:'Booking request received', detail:`Source: ${source}`}]
  });
  const bookings = [
    booking('bk_aarav','GG-BK-1041','cus_aarav','veh_swift',['svc_periodic'],['Routine maintenance'],dayOffsetKey(2),'10:00','new_request','Website',null,{notes:'First service with Gear Go. Prefers a WhatsApp update.', createdAt:isoAt(-1, 18, 40), history:[{at:isoAt(-1, 18, 40), label:'Request received from website', detail:'Awaiting front-desk confirmation'}]}),
    booking('bk_tanya','GG-BK-1042','cus_tanya','veh_baleno2',['svc_brakes'],['Brake noise or soft pedal'],todayKey(),'11:00','confirmed','Phone',null,{notes:'Customer reports a squeal when braking at low speed.', createdAt:isoAt(-2, 12, 10), history:[{at:isoAt(-2, 12, 10), label:'Request received', detail:'Phone booking'},{at:isoAt(-1, 9, 20), label:'Booking confirmed', detail:'Confirmed by Imran Qureshi'}]}),
    booking('bk_manav','GG-BK-1043','cus_manav','veh_xuv2',['svc_diagnostics'],['Warning light on dashboard'],todayKey(),'11:30','confirmed','Walk-in',null,{notes:'Walk-in waiting for check-in. Engine warning light appeared yesterday.', createdAt:isoAt(0, 9, 5), history:[{at:isoAt(0, 9, 5), label:'Walk-in added', detail:'Awaiting check-in'}]}),
    booking('bk_priya','GG-BK-1038','cus_priya','veh_creta',['svc_brakes','svc_diagnostics'],['Brake noise','Warning light on dashboard'],dayOffsetKey(-4),'10:00','converted','Website','job_priya',{createdAt:isoAt(-6, 16, 0), history:[{at:isoAt(-6, 16, 0), label:'Request received', detail:'Website booking'},{at:isoAt(-5, 9, 10), label:'Confirmed', detail:'Confirmed by front desk'},{at:isoAt(-4, 10, 5), label:'Checked in · job card created', detail:'GG-JC-2081'}]}),
    booking('bk_rahul','GG-BK-1037','cus_rahul','veh_baleno',['svc_mechanical'],['Unusual engine noise'],dayOffsetKey(-2),'09:00','converted','WhatsApp','job_rahul',{createdAt:isoAt(-3, 11, 20), history:[{at:isoAt(-3, 11, 20), label:'Request received', detail:'WhatsApp request'},{at:isoAt(-2, 9, 0), label:'Checked in', detail:'Job card GG-JC-2082'}]}),
    booking('bk_simran','GG-BK-1036','cus_simran','veh_nexon',['svc_periodic','svc_ac'],['AC not cooling','Routine maintenance'],dayOffsetKey(-5),'09:00','converted','Website','job_simran',{createdAt:isoAt(-7, 14, 5), history:[{at:isoAt(-7, 14, 5), label:'Request received', detail:'Website booking'},{at:isoAt(-5, 9, 5), label:'Checked in', detail:'Job card GG-JC-2083'}]}),
    booking('bk_faizan','GG-BK-1035','cus_faizan','veh_xuv',['svc_mechanical'],['Vehicle vibration'],dayOffsetKey(-7),'12:00','converted','Phone','job_faizan',{createdAt:isoAt(-9, 10, 20), history:[{at:isoAt(-9, 10, 20), label:'Request received', detail:'Phone booking'},{at:isoAt(-7, 12, 0), label:'Checked in', detail:'Job card GG-JC-2084'}]}),
    booking('bk_aditi','GG-BK-1034','cus_aditi','veh_innova',['svc_mechanical','svc_ac'],['AC not cooling','General inspection'],dayOffsetKey(-8),'09:30','converted','Website','job_aditi',{createdAt:isoAt(-10, 19, 30), history:[{at:isoAt(-10, 19, 30), label:'Request received', detail:'Website booking'},{at:isoAt(-8, 9, 30), label:'Checked in', detail:'Job card GG-JC-2085'}]}),
    booking('bk_arjun','GG-BK-1030','cus_arjun','veh_seltos',['svc_periodic'],['Routine maintenance'],dayOffsetKey(-14),'10:00','converted','Website','job_arjun',{createdAt:isoAt(-16, 10, 0), history:[{at:isoAt(-16, 10, 0), label:'Request received', detail:'Website booking'},{at:isoAt(-14, 10, 0), label:'Checked in', detail:'Job card GG-JC-2086'}]}),
    booking('bk_neha','GG-BK-1028','cus_neha','veh_city',['svc_ac'],['AC not cooling'],dayOffsetKey(-20),'10:00','converted','Phone','job_neha',{createdAt:isoAt(-22, 15, 10), history:[{at:isoAt(-22, 15, 10), label:'Request received', detail:'Phone booking'},{at:isoAt(-20, 10, 0), label:'Checked in', detail:'Job card GG-JC-2087'}]}),
    booking('bk_sana','GG-BK-1022','cus_sana','veh_venue',['svc_wash','svc_interior'],['Routine maintenance'],dayOffsetKey(-28),'11:00','converted','Walk-in','job_sana',{createdAt:isoAt(-28, 11, 0), history:[{at:isoAt(-28, 11, 0), label:'Walk-in checked in', detail:'Job card GG-JC-2088'}]}),
    booking('bk_ananya','GG-BK-1040','cus_ananya','veh_creta2',['svc_diagnostics','svc_electrical'],['Warning light on dashboard'],todayKey(),'09:00','converted','Website','job_ananya',{createdAt:isoAt(-2, 20, 10), history:[{at:isoAt(-2, 20, 10), label:'Request received', detail:'Website booking'},{at:isoAt(0, 8, 55), label:'Checked in', detail:'Inspection in progress'}]}),
    booking('bk_karan','GG-BK-1032','cus_karan','veh_scorpio',['svc_brakes','svc_mechanical'],['Brake noise'],dayOffsetKey(-10),'13:00','converted','Website','job_karan',{createdAt:isoAt(-12, 10, 10), history:[{at:isoAt(-12, 10, 10), label:'Request received', detail:'Website booking'},{at:isoAt(-10, 13, 0), label:'Checked in', detail:'Job card GG-JC-2089'}]}),
    booking('bk_rohan','GG-BK-1033','cus_rohan','veh_amaze',['svc_periodic'],['Reduced mileage'],dayOffsetKey(-3),'10:00','converted','Phone','job_rohan',{createdAt:isoAt(-5, 9, 45), history:[{at:isoAt(-5, 9, 45), label:'Request received', detail:'Phone booking'},{at:isoAt(-3, 10, 0), label:'Checked in', detail:'Job card GG-JC-2090'}]}),
    booking('bk_pooja','GG-BK-1039','cus_pooja','veh_punch',['svc_ac'],['AC not cooling'],dayOffsetKey(-1),'14:00','no_show','Website',null,{createdAt:isoAt(-4, 13, 20), history:[{at:isoAt(-4, 13, 20), label:'Request received', detail:'Website booking'},{at:isoAt(-1, 14, 45), label:'Marked no-show', detail:'Customer did not arrive or respond'}]}),
    booking('bk_vikram','GG-BK-1044','cus_vikram','veh_wagonr',['svc_wash'],['Routine maintenance'],dayOffsetKey(3),'15:00','cancelled','Website',null,{createdAt:isoAt(-1, 8, 10), notes:'Customer cancelled due to travel.', history:[{at:isoAt(-1, 8, 10), label:'Request received', detail:'Website booking'},{at:isoAt(0, 8, 30), label:'Cancelled by customer', detail:'Reason: travel plans changed'}]}),
    booking('bk_reschedule','GG-BK-1045','cus_neha','veh_city',['svc_brakes'],['Brake noise or soft pedal'],dayOffsetKey(4),'12:00','reschedule_requested','Portal',null,{createdAt:isoAt(-1, 16, 20), notes:'Customer asked whether a later afternoon slot is available.', history:[{at:isoAt(-1, 16, 20), label:'Reschedule requested', detail:'Requested a later slot'}]})
  ];
  const mkTask = (id, title, status, assigneeId, extra = {}) => ({id, title, status, assigneeId, estimateLineId:extra.estimateLineId || null, startedAt:extra.startedAt || null, completedAt:extra.completedAt || null, note:extra.note || '', minutes:extra.minutes || 0, blockedBy:extra.blockedBy || null, partId:extra.partId || null});
  const jobs = [
    {id:'job_priya',number:'GG-JC-2081',bookingId:'bk_priya',customerId:'cus_priya',vehicleId:'veh_creta',status:'AWAITING_APPROVAL',priority:'Normal',concerns:['Brake noise','Warning light on dashboard'],services:['svc_brakes','svc_diagnostics'],advisorId:'st_front',techIds:['st_tech1'],checkInAt:isoAt(-4,10,5),expectedAt:isoAt(0,17,0),actualCompletedAt:null,odometer:47220,fuel:'60%',condition:{exterior:'Minor scuff on rear bumper',interior:'Clean, child seat present',belongings:'Phone charger, toll tag',keys:'1 key received'},notes:'Customer has requested a WhatsApp approval link.',internalNotes:[{at:isoAt(-3,11,20),text:'Front pads measured at 2.5 mm. Discs show light scoring. Recommend replacement.',by:'Rohit Nair'}],customerUpdates:[{at:isoAt(-3,14,10),text:'Inspection complete. Estimate ready for your review — no extra work will start before approval.',by:'Gear Go Automobiles'}],tasks:[mkTask('task_priya_1','Replace front brake pads','pending','st_tech1'),mkTask('task_priya_2','Road test and brake bedding','pending','st_tech1')],inspectionId:'insp_priya',estimateIds:['est_priya'],invoiceId:null,qualityChecks:[],delayReason:'',createdAt:isoAt(-4,10,5)},
    {id:'job_rahul',number:'GG-JC-2082',bookingId:'bk_rahul',customerId:'cus_rahul',vehicleId:'veh_baleno',status:'IN_PROGRESS',priority:'High',concerns:['Unusual engine noise'],services:['svc_mechanical'],advisorId:'st_manager',techIds:['st_tech2'],checkInAt:isoAt(-2,9,10),expectedAt:isoAt(1,16,0),actualCompletedAt:null,odometer:31140,fuel:'45%',condition:{exterior:'Good',interior:'Good',belongings:'None declared',keys:'1 key received'},notes:'Noise appears above 2,000 rpm. Customer needs the car by tomorrow evening.',internalNotes:[{at:isoAt(-1,10,15),text:'Inspection suggests a worn engine mount. Approved replacement after customer approval.',by:'Gagandeep Singh'}],customerUpdates:[{at:isoAt(-1,12,0),text:'We found a worn engine mount. Your approved repair is now in progress.',by:'Gear Go Automobiles'}],tasks:[mkTask('task_rahul_1','Replace engine mount','in_progress','st_tech2'),mkTask('task_rahul_2','Road test and noise verification','pending','st_tech2')],inspectionId:'insp_rahul',estimateIds:['est_rahul'],invoiceId:null,qualityChecks:[],delayReason:'',createdAt:isoAt(-2,9,10)},
    {id:'job_simran',number:'GG-JC-2083',bookingId:'bk_simran',customerId:'cus_simran',vehicleId:'veh_nexon',status:'IN_PROGRESS',priority:'Normal',concerns:['AC not cooling','Routine maintenance'],services:['svc_periodic','svc_ac'],advisorId:'st_front',techIds:['st_tech3'],checkInAt:isoAt(-5,9,5),expectedAt:isoAt(1,18,0),actualCompletedAt:null,odometer:35600,fuel:'70%',condition:{exterior:'Good',interior:'Clean',belongings:'Child seat',keys:'1 key received'},notes:'Primary service approved. Additional AC condenser leak found during inspection.',internalNotes:[{at:isoAt(-2,16,30),text:'Condenser leak confirmed. Supplementary estimate raised; original work scope remains approved.',by:'Rohit Nair'}],customerUpdates:[{at:isoAt(-2,17,0),text:'Routine service is approved. We found an additional AC condenser issue and have sent a separate supplementary estimate for your decision.',by:'Gear Go Automobiles'}],tasks:[mkTask('task_simran_1','Periodic service','completed','st_tech3',{startedAt:isoAt(-4,10,0),completedAt:isoAt(-4,12,20),minutes:140}),mkTask('task_simran_2','AC condenser replacement','blocked','st_tech3',{note:'Awaiting supplementary approval'})],inspectionId:'insp_simran',estimateIds:['est_simran','est_simran_sup'],invoiceId:null,qualityChecks:[],delayReason:'Additional work pending approval',createdAt:isoAt(-5,9,5)},
    {id:'job_faizan',number:'GG-JC-2084',bookingId:'bk_faizan',customerId:'cus_faizan',vehicleId:'veh_xuv',status:'IN_PROGRESS',priority:'High',concerns:['Vehicle vibration'],services:['svc_mechanical'],advisorId:'st_manager',techIds:['st_tech1','st_tech2'],checkInAt:isoAt(-7,12,0),expectedAt:isoAt(2,17,0),actualCompletedAt:null,odometer:22010,fuel:'50%',condition:{exterior:'Good',interior:'Good',belongings:'Umbrella, documents folder',keys:'2 keys received'},notes:'Customer declined the suspension bushing replacement. Approved wheel balancing and alignment completed. Safety note recorded.',internalNotes:[{at:isoAt(-4,11,10),text:'Customer declined front suspension bushing replacement (safety-critical). Manager reviewed and recorded risk. Vehicle will not be released without documented safety discussion.',by:'Meera Sethi'}],customerUpdates:[{at:isoAt(-4,11,30),text:'The approved balancing work is complete. The recommended suspension repair was declined, so it will not be carried out. We will discuss the safety recommendation before collection.',by:'Gear Go Automobiles'}],tasks:[mkTask('task_faizan_1','Wheel balancing and alignment','completed','st_tech2',{startedAt:isoAt(-6,9,0),completedAt:isoAt(-6,11,0),minutes:120}),mkTask('task_faizan_2','Suspension bushing replacement','declined','st_tech1',{note:'Declined by customer'})],inspectionId:'insp_faizan',estimateIds:['est_faizan'],invoiceId:null,qualityChecks:[],delayReason:'Customer decision pending on safety recommendation',createdAt:isoAt(-7,12,0)},
    {id:'job_aditi',number:'GG-JC-2085',bookingId:'bk_aditi',customerId:'cus_aditi',vehicleId:'veh_innova',status:'AWAITING_PARTS',priority:'High',concerns:['AC not cooling','General inspection'],services:['svc_mechanical','svc_ac'],advisorId:'st_front',techIds:['st_tech3'],checkInAt:isoAt(-8,9,30),expectedAt:isoAt(-2,17,0),actualCompletedAt:null,odometer:104480,fuel:'35%',condition:{exterior:'Good for age; small dent on tailgate',interior:'Well used, third row present',belongings:'Tool kit, first-aid box',keys:'1 key received'},notes:'AC compressor replacement approved. Part is currently unavailable from the configured demo supplier.',internalNotes:[{at:isoAt(-3,9,10),text:'Compressor part out of stock. Expected stock arrival demo window: 3–4 days. Customer informed of delay.',by:'Imran Qureshi'}],customerUpdates:[{at:isoAt(-3,9,30),text:'Your approved AC compressor work is waiting for a part. We have updated the expected completion time and will confirm as soon as stock arrives.',by:'Gear Go Automobiles'}],tasks:[mkTask('task_aditi_1','AC system diagnosis','completed','st_tech3',{startedAt:isoAt(-7,10,0),completedAt:isoAt(-7,12,0),minutes:120}),mkTask('task_aditi_2','Replace AC compressor','blocked','st_tech3',{note:'Part unavailable',partId:'part_accomp'})],inspectionId:'insp_aditi',estimateIds:['est_aditi'],invoiceId:null,qualityChecks:[],delayReason:'AC compressor unavailable from supplier',createdAt:isoAt(-8,9,30)},
    {id:'job_arjun',number:'GG-JC-2086',bookingId:'bk_arjun',customerId:'cus_arjun',vehicleId:'veh_seltos',status:'DELIVERED',priority:'Normal',concerns:['Routine maintenance'],services:['svc_periodic'],advisorId:'st_front',techIds:['st_tech1'],checkInAt:isoAt(-14,10,0),expectedAt:isoAt(-14,16,0),actualCompletedAt:isoAt(-14,15,20),odometer:18960,fuel:'55%',condition:{exterior:'Excellent',interior:'Excellent',belongings:'None',keys:'1 key received'},notes:'Completed and delivered. Invoice fully paid via UPI.',internalNotes:[],customerUpdates:[{at:isoAt(-14,14,40),text:'Service complete and quality checked. Invoice ready for collection.',by:'Gear Go Automobiles'},{at:isoAt(-14,15,30),text:'Vehicle delivered. Thank you for choosing Gear Go.',by:'Gear Go Automobiles'}],tasks:[mkTask('task_arjun_1','Periodic service','completed','st_tech1',{startedAt:isoAt(-14,10,20),completedAt:isoAt(-14,12,30),minutes:130}),mkTask('task_arjun_2','Quality check','completed','st_tech1',{startedAt:isoAt(-14,14,0),completedAt:isoAt(-14,14,30),minutes:30})],inspectionId:'insp_arjun',estimateIds:['est_arjun'],invoiceId:'inv_arjun',qualityChecks:[{at:isoAt(-14,14,30),result:'pass',items:['Wheels torqued','Fluid levels checked','Road test completed'],by:'st_manager'}],delayReason:'',createdAt:isoAt(-14,10,0)},
    {id:'job_neha',number:'GG-JC-2087',bookingId:'bk_neha',customerId:'cus_neha',vehicleId:'veh_city',status:'DELIVERED',priority:'Normal',concerns:['AC not cooling'],services:['svc_ac'],advisorId:'st_manager',techIds:['st_tech3'],checkInAt:isoAt(-20,10,0),expectedAt:isoAt(-19,16,0),actualCompletedAt:isoAt(-19,15,0),odometer:52380,fuel:'40%',condition:{exterior:'Minor kerb marks on alloys',interior:'Clean',belongings:'Sunglasses',keys:'1 key received'},notes:'Delivered with a partial payment recorded. Outstanding balance is overdue. Finance follow-up required.',internalNotes:[{at:isoAt(-19,15,20),text:'Delivery approved by manager with partial payment recorded. Balance due within 7 days; collection policy override documented.',by:'Meera Sethi'}],customerUpdates:[{at:isoAt(-19,14,30),text:'AC service complete. Your invoice is ready and the vehicle is ready for collection.',by:'Gear Go Automobiles'}],tasks:[mkTask('task_neha_1','AC service and gas top-up','completed','st_tech3',{startedAt:isoAt(-20,11,0),completedAt:isoAt(-20,14,0),minutes:180})],inspectionId:'insp_neha',estimateIds:['est_neha'],invoiceId:'inv_neha',qualityChecks:[{at:isoAt(-19,14,0),result:'pass',items:['Cooling performance verified','Invoice reviewed'],by:'st_manager'}],delayReason:'',createdAt:isoAt(-20,10,0)},
    {id:'job_sana',number:'GG-JC-2088',bookingId:'bk_sana',customerId:'cus_sana',vehicleId:'veh_venue',status:'DELIVERED',priority:'Low',concerns:['Routine maintenance'],services:['svc_wash','svc_interior'],advisorId:'st_front',techIds:['st_tech2'],checkInAt:isoAt(-28,11,0),expectedAt:isoAt(-28,16,0),actualCompletedAt:isoAt(-28,15,10),odometer:27800,fuel:'65%',condition:{exterior:'Good',interior:'Pet hair on rear seat',belongings:'None',keys:'1 key received'},notes:'Interior cleaning and exterior wash delivered. Feedback submitted.',internalNotes:[],customerUpdates:[{at:isoAt(-28,14,50),text:'Cleaning complete and ready for collection.',by:'Gear Go Automobiles'}],tasks:[mkTask('task_sana_1','Exterior wash','completed','st_tech2',{startedAt:isoAt(-28,11,15),completedAt:isoAt(-28,12,15),minutes:60}),mkTask('task_sana_2','Interior cleaning','completed','st_tech2',{startedAt:isoAt(-28,12,20),completedAt:isoAt(-28,14,30),minutes:130})],inspectionId:null,estimateIds:['est_sana'],invoiceId:'inv_sana',qualityChecks:[{at:isoAt(-28,15,0),result:'pass',items:['Exterior finish checked','Interior checked'],by:'st_manager'}],delayReason:'',createdAt:isoAt(-28,11,0)},
    {id:'job_ananya',number:'GG-JC-2091',bookingId:'bk_ananya',customerId:'cus_ananya',vehicleId:'veh_creta2',status:'INSPECTION_IN_PROGRESS',priority:'Normal',concerns:['Warning light on dashboard'],services:['svc_diagnostics','svc_electrical'],advisorId:'st_front',techIds:['st_tech1'],checkInAt:isoAt(0,8,55),expectedAt:isoAt(0,17,0),actualCompletedAt:null,odometer:21400,fuel:'80%',condition:{exterior:'Good',interior:'Clean',belongings:'Laptop bag',keys:'1 key received'},notes:'Inspection is incomplete. Several items remain not inspected.',internalNotes:[{at:isoAt(0,9,45),text:'Battery and charging tests complete. Waiting for diagnostic scan with vehicle ignition cycle.',by:'Rohit Nair'}],customerUpdates:[],tasks:[mkTask('task_ananya_1','Diagnostic scan','in_progress','st_tech1'),mkTask('task_ananya_2','Electrical inspection','pending','st_tech1')],inspectionId:'insp_ananya',estimateIds:[],invoiceId:null,qualityChecks:[],delayReason:'',createdAt:isoAt(0,8,55)},
    {id:'job_karan',number:'GG-JC-2089',bookingId:'bk_karan',customerId:'cus_karan',vehicleId:'veh_scorpio',status:'IN_PROGRESS',priority:'High',concerns:['Brake noise'],services:['svc_brakes','svc_mechanical'],advisorId:'st_manager',techIds:['st_tech2','st_tech3'],checkInAt:isoAt(-10,13,0),expectedAt:isoAt(2,17,0),actualCompletedAt:null,odometer:9840,fuel:'60%',condition:{exterior:'Excellent',interior:'Excellent; third row unused',belongings:'None',keys:'1 key received'},notes:'Returned from quality check for rework because of a brake pedal feel concern. Rework in progress.',internalNotes:[{at:isoAt(-4,16,0),text:'QC failed: brake pedal feel below standard. Returned to technicians. Rework assigned.',by:'Meera Sethi'}],customerUpdates:[{at:isoAt(-4,16,30),text:'Our quality check found an issue with brake pedal feel. We are reworking it before release. Expected completion updated.',by:'Gear Go Automobiles'}],tasks:[mkTask('task_karan_1','Front pad replacement','completed','st_tech2',{startedAt:isoAt(-9,9,0),completedAt:isoAt(-9,12,0),minutes:180}),mkTask('task_karan_2','Brake bleed and pedal re-check','in_progress','st_tech3',{startedAt:isoAt(-3,10,0)}),mkTask('task_karan_3','Road test','pending','st_tech2')],inspectionId:'insp_karan',estimateIds:['est_karan'],invoiceId:null,qualityChecks:[{at:isoAt(-4,15,30),result:'fail',items:['Pedal feel below standard'],notes:'Rework required',by:'st_manager'}],delayReason:'QC rework',createdAt:isoAt(-10,13,0)},
    {id:'job_rohan',number:'GG-JC-2090',bookingId:'bk_rohan',customerId:'cus_rohan',vehicleId:'veh_amaze',status:'READY_FOR_COLLECTION',priority:'Normal',concerns:['Reduced mileage'],services:['svc_periodic'],advisorId:'st_front',techIds:['st_tech2'],checkInAt:isoAt(-3,10,0),expectedAt:isoAt(-1,17,0),actualCompletedAt:isoAt(-1,16,10),odometer:54300,fuel:'30%',condition:{exterior:'Fair; small dent on front bumper',interior:'Clean',belongings:'Charger cable',keys:'1 key received'},notes:'Work completed and quality checked. Invoice issued; balance is unpaid. Vehicle is ready for collection only after payment or an authorised override.',internalNotes:[{at:isoAt(-1,16,20),text:'Customer asked to collect tomorrow. Invoice sent; balance outstanding.',by:'Imran Qureshi'}],customerUpdates:[{at:isoAt(-1,16,30),text:'Your service is complete and ready for collection. Invoice is available in the portal.',by:'Gear Go Automobiles'}],tasks:[mkTask('task_rohan_1','Periodic service','completed','st_tech2',{startedAt:isoAt(-2,10,0),completedAt:isoAt(-2,14,0),minutes:240}),mkTask('task_rohan_2','Quality check','completed','st_tech2',{startedAt:isoAt(-1,15,0),completedAt:isoAt(-1,16,0),minutes:60})],inspectionId:'insp_rohan',estimateIds:['est_rohan'],invoiceId:'inv_rohan',qualityChecks:[{at:isoAt(-1,16,0),result:'pass',items:['Road test','Fluids checked','Interior protection'],by:'st_manager'}],delayReason:'',createdAt:isoAt(-3,10,0)}
  ];
  const inspectionFor = (id, jobId, status, overrides = {}, byId = 'st_tech1', startedAt = isoAt(-2, 10, 0), completedAt = null) => ({
    id, jobId, status, startedAt, completedAt, by:byId,
    items:INSPECTION_TEMPLATE.map(t => {
      const custom = overrides[t.key] || {};
      return {key:t.key, cat:t.cat, label:t.label, result:custom.result || 'good', note:custom.note || '', recommendedAction:custom.action || '', priority:custom.priority || '', needsApproval:custom.needsApproval || false, photo:custom.photo || '', updatedAt:status === 'completed' ? (completedAt || isoAt(-2, 12, 0)) : startedAt};
    })
  });
  const inspections = [
    inspectionFor('insp_priya','job_priya','completed',{
      front_pads:{result:'urgent',note:'Front brake pads measured at approximately 2.5 mm. Significant wear visible; stopping distance may be affected.',action:'Replace front brake pads and inspect discs.',priority:'High',needsApproval:true,photo:'evidence-brakes'},
      brake_fluid:{result:'attention',note:'Brake fluid moisture content elevated. Recommend replacement with the brake work.',action:'Replace brake fluid.',priority:'Medium',needsApproval:true},
      rear_brakes:{result:'monitor',note:'Rear brake shoes have around 40% life remaining. Monitor at next service.',action:'Monitor at next service.',priority:'Low'},
      tyre_tread:{result:'monitor',note:'Front tyres are wearing more quickly on the inner edge. Alignment check recommended.',action:'Perform wheel alignment check.',priority:'Medium',needsApproval:true},
      tyres:{result:'good',note:'Tyre pressures adjusted.'},
      battery_health:{result:'attention',note:'Battery resting voltage is lower than expected for the age of the battery. Retest recommended.',action:'Retest battery at next visit.',priority:'Low'}
    }, 'st_tech1', isoAt(-4,10,30), isoAt(-3,11,0)),
    inspectionFor('insp_rahul','job_rahul','completed',{
      engine_belts:{result:'attention',note:'Accessory belt shows surface cracking. Replacement recommended before failure.',action:'Replace accessory belt.',priority:'Medium',needsApproval:true},
      engine_leaks:{result:'monitor',note:'Light oil mist around the engine mount area. Cleaned and will recheck after repair.',action:'Recheck after engine mount replacement.',priority:'Low'},
      front_suspension:{result:'urgent',note:'Engine mount rubber is visibly degraded, consistent with the reported noise above 2,000 rpm.',action:'Replace the engine mount.',priority:'High',needsApproval:true},
      engine_oil:{result:'good',note:'Engine oil level and condition acceptable.'}
    }, 'st_tech2', isoAt(-2,10,0), isoAt(-1,10,0)),
    inspectionFor('insp_simran','job_simran','completed',{
      ac_performance:{result:'urgent',note:'AC vent temperature remains high. Condenser leak identified during pressure check.',action:'Replace AC condenser and recharge system.',priority:'High',needsApproval:true,photo:'evidence-ac'},
      coolant:{result:'good',note:'Coolant level correct.'},
      engine_oil:{result:'good',note:'Engine oil replaced during approved service.'},
      tyre_tread:{result:'monitor',note:'Tyres at approximately 4 mm. Monitor at next service.',action:'Monitor tyre wear.',priority:'Low'},
      battery_health:{result:'good',note:'Battery health acceptable.'}
    }, 'st_tech3', isoAt(-5,9,30), isoAt(-3,12,0)),
    inspectionFor('insp_faizan','job_faizan','completed',{
      front_suspension:{result:'urgent',note:'Front suspension bushings are cracked and have excessive play. Safety-critical recommendation.',action:'Replace front suspension bushings.',priority:'High',needsApproval:true},
      tyre_tread:{result:'attention',note:'Uneven wear indicates alignment issue. Alignment recommended with balancing.',action:'Wheel alignment and balancing.',priority:'Medium',needsApproval:true},
      steering:{result:'monitor',note:'Slight steering wheel off-centre. Recheck after alignment.',action:'Recheck after alignment.',priority:'Low'}
    }, 'st_tech1', isoAt(-7,12,30), isoAt(-5,11,0)),
    inspectionFor('insp_aditi','job_aditi','completed',{
      ac_performance:{result:'urgent',note:'Compressor not building pressure. Replacement recommended.',action:'Replace AC compressor and recharge system.',priority:'High',needsApproval:true},
      engine_oil:{result:'attention',note:'Engine oil is due for replacement based on recorded interval and condition.',action:'Replace engine oil and filter.',priority:'Medium',needsApproval:true},
      body:{result:'monitor',note:'Small dent on tailgate noted. Cosmetic only; customer aware.',action:'Optional dent repair.',priority:'Low'},
      tyre_tread:{result:'attention',note:'Rear tyres approaching replacement threshold.',action:'Replace rear tyres.',priority:'Medium',needsApproval:true}
    }, 'st_tech3', isoAt(-8,10,0), isoAt(-6,13,0)),
    inspectionFor('insp_arjun','job_arjun','completed',{
      engine_oil:{result:'good',note:'Oil and filter replaced.'},
      front_pads:{result:'good',note:'Front pads at approximately 70% life.'},
      tyre_tread:{result:'good',note:'Even wear, pressures set.'}
    }, 'st_tech1', isoAt(-14,10,20), isoAt(-14,11,40)),
    inspectionFor('insp_neha','job_neha','completed',{
      ac_performance:{result:'attention',note:'Cooling restored after gas top-up. Recommend checking for slow leak at next service.',action:'Monitor AC performance.',priority:'Low'}
    }, 'st_tech3', isoAt(-20,11,0), isoAt(-19,12,0)),
    inspectionFor('insp_karan','job_karan','completed',{
      front_pads:{result:'urgent',note:'Front pads worn to approximately 2 mm. Replacement completed under approved scope.',action:'Replace front pads.',priority:'High',needsApproval:true},
      brake_fluid:{result:'attention',note:'Brake fluid condition is marginal; replacement included in approved work.',action:'Replace brake fluid.',priority:'Medium',needsApproval:true},
      tyre_tread:{result:'good',note:'Tyres in good condition.'}
    }, 'st_tech2', isoAt(-10,13,30), isoAt(-9,10,0)),
    inspectionFor('insp_rohan','job_rohan','completed',{
      engine_oil:{result:'good',note:'Replaced during service.'},
      air_filter:{result:'good',note:'Air filter replaced.'},
      tyre_tread:{result:'monitor',note:'Front tyres at approximately 4 mm. Recommend monitoring.',action:'Monitor tyre wear.',priority:'Low'},
      body:{result:'monitor',note:'Small front bumper dent noted; cosmetic.',action:'Optional dent repair.',priority:'Low'}
    }, 'st_tech2', isoAt(-3,10,20), isoAt(-2,11,30)),
    inspectionFor('insp_ananya','job_ananya','in_progress',{
      battery_health:{result:'monitor',note:'Battery load test acceptable but voltage drops under extended load. Retest after scan.',action:'Complete diagnostic scan.',priority:'Medium'},
      engine_oil:{result:'not_inspected',note:''},
      brake_fluid:{result:'not_inspected',note:''},
      front_pads:{result:'not_inspected',note:''},
      rear_brakes:{result:'not_inspected',note:''},
      tyre_tread:{result:'not_inspected',note:''},
      ac_performance:{result:'not_inspected',note:''}
    }, 'st_tech1', isoAt(0,9,0), null)
  ];
  const line = (id, type, description, category, qty, unitPrice, extra = {}) => ({id, type, description, category, qty, unit:extra.unit || 'item', unitPrice, discountPct:extra.discountPct || 0, taxRate:extra.taxRate ?? null, partId:extra.partId || null});
  const estimates = [
    {id:'est_priya',number:'GG-EST-3071',jobId:'job_priya',customerId:'cus_priya',version:1,kind:'primary',status:'VIEWED',lines:[
      line('el_p1','Part','Front brake pad set', 'Parts',1,2450,{partId:'part_brakepad'}),
      line('el_p2','Labour','Replace front brake pads','Labour',1,650),
      line('el_p3','Part','Brake fluid DOT 4 (500 ml)','Consumables',1,480,{partId:'part_brakefluid'}),
      line('el_p4','Labour','Brake fluid replacement','Labour',1,450),
      line('el_p5','Service','Diagnostic scan and road test','Diagnostic',1,799),
      line('el_p6','Service','Wheel alignment check','Labour',1,899)
    ],discount:0,notes:'Prices are illustrative demo values. Front pad specification to be confirmed against the vehicle before ordering.',exclusions:'Does not include disc replacement unless additional wear is found and separately approved.',validUntil:addDays(todayKey(),2),sentAt:isoAt(-3,14,0),viewedAt:isoAt(-2,9,20),supersededBy:null,parentId:null,createdAt:isoAt(-3,13,0),decisions:[{at:isoAt(-2,9,40),actor:'Priya Verma',actorType:'customer',decision:'clarification',lineIds:[],comment:'Can you confirm whether the alignment check is included only if needed? I do not want to pay for it unnecessarily.'}]},
    {id:'est_rahul',number:'GG-EST-3072',jobId:'job_rahul',customerId:'cus_rahul',version:1,kind:'primary',status:'APPROVED',lines:[
      line('el_r1','Part','Engine mount', 'Parts',1,3200,{partId:'part_mount'}),
      line('el_r2','Labour','Replace engine mount','Labour',1,1200),
      line('el_r3','Service','Road test and noise verification','Labour',1,400)
    ],discount:0,notes:'Approved repair only. Any additional findings require a separate approval.',exclusions:'Does not include unrelated driveline repairs unless separately approved.',validUntil:addDays(todayKey(),1),sentAt:isoAt(-2,12,0),viewedAt:isoAt(-2,12,20),supersededBy:null,parentId:null,createdAt:isoAt(-2,11,30),decisions:[{at:isoAt(-2,13,5),actor:'Rahul Yadav',actorType:'customer',decision:'approve',lineIds:['el_r1','el_r2','el_r3'],comment:'Approved. Please complete by tomorrow evening.'}]},
    {id:'est_simran',number:'GG-EST-3068',jobId:'job_simran',customerId:'cus_simran',version:1,kind:'primary',status:'APPROVED',lines:[
      line('el_s1','Service','Periodic service package','Labour',1,1499),
      line('el_s2','Part','Engine oil and filter','Parts',1,1850,{partId:'part_oil'}),
      line('el_s3','Service','AC performance check','Diagnostic',1,699),
      line('el_s4','Part','Cabin filter','Parts',1,450,{partId:'part_cabin'})
    ],discount:0,notes:'Approved at time of check-in. AC condenser found later is covered by a separate supplementary estimate.',exclusions:'Supplementary work requires a separate approval.',validUntil:addDays(todayKey(),2),sentAt:isoAt(-5,10,0),viewedAt:isoAt(-5,10,20),supersededBy:null,parentId:null,createdAt:isoAt(-5,9,40),decisions:[{at:isoAt(-5,10,45),actor:'Simran Kaur',actorType:'customer',decision:'approve',lineIds:['el_s1','el_s2','el_s3','el_s4'],comment:''}]},
    {id:'est_simran_sup',number:'GG-EST-3075',jobId:'job_simran',customerId:'cus_simran',version:2,kind:'supplementary',status:'SENT',lines:[
      line('el_s5','Part','AC condenser', 'Parts',1,7800,{partId:'part_condenser'}),
      line('el_s6','Labour','Replace AC condenser and recharge','Labour',1,1800),
      line('el_s7','Consumable','AC refrigerant recharge','Consumables',1,950)
    ],discount:0,notes:'Additional work discovered during the approved service. The original periodic service remains approved and will not be reversed if this is declined.',exclusions:'Only the additional AC condenser work is covered by this estimate.',validUntil:addDays(todayKey(),3),sentAt:isoAt(-2,17,10),viewedAt:null,supersededBy:null,parentId:'est_simran',createdAt:isoAt(-2,16,45),decisions:[]},
    {id:'est_faizan',number:'GG-EST-3070',jobId:'job_faizan',customerId:'cus_faizan',version:1,kind:'primary',status:'PARTIALLY_APPROVED',lines:[
      line('el_f1','Labour','Four-wheel balancing','Labour',1,1200),
      line('el_f2','Labour','Wheel alignment','Labour',1,899),
      line('el_f3','Part','Front suspension bushing set','Parts',1,4600,{partId:'part_bushing'}),
      line('el_f4','Labour','Replace front suspension bushings','Labour',1,2200),
      line('el_f5','Service','Road test verification','Labour',1,350)
    ],discount:0,notes:'Customer approved balancing, alignment and road test. Suspension bushing replacement was declined. Safety recommendation remains documented.',exclusions:'Declined suspension work is not authorised and will not be performed.',validUntil:addDays(todayKey(),1),sentAt:isoAt(-6,13,0),viewedAt:isoAt(-6,13,30),supersededBy:null,parentId:null,createdAt:isoAt(-6,12,30),decisions:[{at:isoAt(-6,14,5),actor:'Mohammed Faizan',actorType:'customer',decision:'approve',lineIds:['el_f1','el_f2','el_f5'],comment:'Please proceed with balancing and alignment only.'},{at:isoAt(-6,14,6),actor:'Mohammed Faizan',actorType:'customer',decision:'decline',lineIds:['el_f3','el_f4'],comment:'I will manage the suspension later. Please do not carry out that work.'}]},
    {id:'est_aditi',number:'GG-EST-3069',jobId:'job_aditi',customerId:'cus_aditi',version:1,kind:'primary',status:'APPROVED',lines:[
      line('el_a1','Part','AC compressor', 'Parts',1,18500,{partId:'part_accomp'}),
      line('el_a2','Labour','Replace AC compressor and recharge','Labour',1,2500),
      line('el_a3','Part','Engine oil and filter','Parts',1,2400,{partId:'part_oil'}),
      line('el_a4','Labour','Periodic engine service','Labour',1,1200)
    ],discount:0,notes:'Approved. Compressor currently out of stock; expected completion depends on supplier availability.',exclusions:'Tyre replacement shown in inspection was not included in this approved estimate.',validUntil:addDays(todayKey(),5),sentAt:isoAt(-7,14,0),viewedAt:isoAt(-7,14,20),supersededBy:null,parentId:null,createdAt:isoAt(-7,13,30),decisions:[{at:isoAt(-7,15,0),actor:'Aditi Singh',actorType:'customer',decision:'approve',lineIds:['el_a1','el_a2','el_a3','el_a4'],comment:'Approved. Please keep me updated about the part.'}]},
    {id:'est_arjun',number:'GG-EST-3060',jobId:'job_arjun',customerId:'cus_arjun',version:1,kind:'primary',status:'APPROVED',lines:[
      line('el_ar1','Service','Periodic service package','Labour',1,1499),
      line('el_ar2','Part','Engine oil and filter','Parts',1,2200,{partId:'part_oil'}),
      line('el_ar3','Part','Cabin filter','Parts',1,550,{partId:'part_cabin'})
    ],discount:0,notes:'Approved service completed.',exclusions:'',validUntil:addDays(todayKey(),-10),sentAt:isoAt(-14,11,0),viewedAt:isoAt(-14,11,10),supersededBy:null,parentId:null,createdAt:isoAt(-14,10,45),decisions:[{at:isoAt(-14,11,30),actor:'Arjun Mehta',actorType:'customer',decision:'approve',lineIds:['el_ar1','el_ar2','el_ar3'],comment:''}]},
    {id:'est_neha',number:'GG-EST-3055',jobId:'job_neha',customerId:'cus_neha',version:1,kind:'primary',status:'APPROVED',lines:[
      line('el_n1','Service','AC service and gas top-up','Labour',1,1299),
      line('el_n2','Service','AC leak inspection','Diagnostic',1,699)
    ],discount:0,notes:'Approved and completed. Balance remains outstanding.',exclusions:'',validUntil:addDays(todayKey(),-15),sentAt:isoAt(-20,12,0),viewedAt:isoAt(-20,12,10),supersededBy:null,parentId:null,createdAt:isoAt(-20,11,45),decisions:[{at:isoAt(-20,12,30),actor:'Neha Gupta',actorType:'customer',decision:'approve',lineIds:['el_n1','el_n2'],comment:''}]},
    {id:'est_karan',number:'GG-EST-3065',jobId:'job_karan',customerId:'cus_karan',version:1,kind:'primary',status:'APPROVED',lines:[
      line('el_k1','Part','Front brake pad set','Parts',1,3800,{partId:'part_brakepad'}),
      line('el_k2','Labour','Replace front brake pads','Labour',1,900),
      line('el_k3','Part','Brake fluid','Consumables',1,550,{partId:'part_brakefluid'}),
      line('el_k4','Labour','Brake fluid replacement and bleed','Labour',1,750)
    ],discount:0,notes:'Approved. Rework is operationally required after QC and does not change the approved scope or price.',exclusions:'',validUntil:addDays(todayKey(),1),sentAt:isoAt(-9,15,0),viewedAt:isoAt(-9,15,10),supersededBy:null,parentId:null,createdAt:isoAt(-9,14,30),decisions:[{at:isoAt(-9,15,30),actor:'Karan Bhatia',actorType:'customer',decision:'approve',lineIds:['el_k1','el_k2','el_k3','el_k4'],comment:''}]},
    {id:'est_rohan',number:'GG-EST-3063',jobId:'job_rohan',customerId:'cus_rohan',version:1,kind:'primary',status:'APPROVED',lines:[
      line('el_ro1','Service','Periodic service package','Labour',1,1499),
      line('el_ro2','Part','Engine oil and filter','Parts',1,2100,{partId:'part_oil'}),
      line('el_ro3','Part','Air filter','Parts',1,650,{partId:'part_air'}),
      line('el_ro4','Consumable','Workshop consumables','Consumables',1,250)
    ],discount:0,notes:'Approved and completed.',exclusions:'',validUntil:addDays(todayKey(),-2),sentAt:isoAt(-3,12,0),viewedAt:isoAt(-3,12,20),supersededBy:null,parentId:null,createdAt:isoAt(-3,11,40),decisions:[{at:isoAt(-3,13,0),actor:'Rohan Malhotra',actorType:'customer',decision:'approve',lineIds:['el_ro1','el_ro2','el_ro3','el_ro4'],comment:''}]},
    {id:'est_sana',number:'GG-EST-3048',jobId:'job_sana',customerId:'cus_sana',version:1,kind:'primary',status:'APPROVED',lines:[
      line('el_sa1','Service','Exterior wash','Labour',1,399),
      line('el_sa2','Service','Interior cleaning','Labour',1,1299)
    ],discount:0,notes:'Paid and closed.',exclusions:'',validUntil:addDays(todayKey(),-20),sentAt:isoAt(-28,11,20),viewedAt:isoAt(-28,11,30),supersededBy:null,parentId:null,createdAt:isoAt(-28,11,10),decisions:[{at:isoAt(-28,11,45),actor:'Sana Khan',actorType:'customer',decision:'approve',lineIds:['el_sa1','el_sa2'],comment:''}]}
  ];
  const invoice = (id, number, jobId, customerId, date, dueDate, estimateId, extra = {}) => {
    const est = estimates.find(e => e.id === estimateId);
    return {id, number, jobId, customerId, date, dueDate, estimateId, lines:clone(est ? est.lines : []), discount:0, status:extra.status || 'ISSUED', notes:extra.notes || 'Thank you for choosing Gear Go Automobiles. This is a demonstration invoice, not a tax document.', terms:extra.terms || 'Payment is recorded offline by the garage. This prototype does not process payments.', createdBy:extra.createdBy || 'st_finance', payments:extra.payments || [], voidReason:null, createdAt:isoAt(extra.day || -1, 16, 0)};
  };
  const invoices = [
    invoice('inv_arjun','GG-INV-4058','job_arjun','cus_arjun',addDays(todayKey(),-14),addDays(todayKey(),-7),'est_arjun',{status:'PAID',day:-14,payments:[{id:'pay_arjun',amount:6380,method:'upi',reference:'DEMO-UPI-8842',at:isoAt(-14,15,15),by:'st_finance',notes:'Full and final payment recorded offline. Demonstration reference only.',reversed:false}]}),
    invoice('inv_neha','GG-INV-4055','job_neha','cus_neha',addDays(todayKey(),-19),addDays(todayKey(),-12),'est_neha',{status:'PARTIALLY_PAID',day:-19,payments:[{id:'pay_neha',amount:1000,method:'cash',reference:'DEMO-CASH-221',at:isoAt(-19,15,5),by:'st_finance',notes:'Partial payment received. Balance promised later. Demonstration only.',reversed:false}],notes:'Partial payment recorded. Outstanding balance is overdue in this demo scenario. Demo invoice only.'}),
    invoice('inv_rohan','GG-INV-4060','job_rohan','cus_rohan',addDays(todayKey(),-1),addDays(todayKey(),4),'est_rohan',{status:'ISSUED',day:-1,notes:'Ready for collection. Balance outstanding at the time of this demo.'}),
    invoice('inv_sana','GG-INV-4050','job_sana','cus_sana',addDays(todayKey(),-28),addDays(todayKey(),-21),'est_sana',{status:'PAID',day:-28,payments:[{id:'pay_sana',amount:2033,method:'card',reference:'DEMO-CARD-7781',at:isoAt(-28,15,20),by:'st_finance',notes:'Card terminal payment recorded offline. Demonstration only.',reversed:false}]})
  ];
  const parts = [
    {id:'part_brakepad',sku:'BRK-SW-001',name:'Front brake pad set — compact hatchback',category:'Brakes',compatibility:'Swift, Baleno, i20 (demo compatibility)',supplier:'Delhi Auto Parts Co.',cost:1780,price:2450,stock:2,reserved:1,reorder:5,location:'Rack B2',active:true,createdAt:isoAt(-180,10,0)},
    {id:'part_brakefluid',sku:'FLU-BRK-004',name:'Brake fluid DOT 4 — 500 ml',category:'Fluids',compatibility:'Universal demo part',supplier:'NCR Lubricants',cost:310,price:480,stock:14,reserved:2,reorder:6,location:'Shelf A1',active:true,createdAt:isoAt(-180,10,0)},
    {id:'part_accomp',sku:'AC-COMP-018',name:'AC compressor — Innova Crysta (demo fitment)',category:'AC & cooling',compatibility:'Toyota Innova Crysta (illustrative)',supplier:'South Delhi Cooling Systems',cost:14200,price:18500,stock:0,reserved:0,reorder:2,location:'Rack C4',active:true,createdAt:isoAt(-160,10,0)},
    {id:'part_condenser',sku:'AC-COND-011',name:'AC condenser — Nexon (demo fitment)',category:'AC & cooling',compatibility:'Tata Nexon (illustrative)',supplier:'NCR Climate Parts',cost:5600,price:7800,stock:3,reserved:0,reorder:3,location:'Rack C1',active:true,createdAt:isoAt(-170,10,0)},
    {id:'part_oil',sku:'OIL-5W30-4L',name:'Engine oil 5W-30 — 4 litre (demo grade)',category:'Fluids',compatibility:'Multiple petrol/diesel demo fitments',supplier:'NCR Lubricants',cost:1650,price:2200,stock:18,reserved:3,reorder:8,location:'Shelf A2',active:true,createdAt:isoAt(-220,10,0)},
    {id:'part_cabin',sku:'FLT-CAB-007',name:'Cabin air filter — multi-fit demo',category:'Filters',compatibility:'Creta, Seltos, Nexon (illustrative)',supplier:'Delhi Auto Parts Co.',cost:330,price:550,stock:9,reserved:1,reorder:6,location:'Shelf B1',active:true,createdAt:isoAt(-200,10,0)},
    {id:'part_air',sku:'FLT-AIR-005',name:'Engine air filter — compact sedan',category:'Filters',compatibility:'Honda City, Amaze (illustrative)',supplier:'Delhi Auto Parts Co.',cost:420,price:650,stock:7,reserved:1,reorder:4,location:'Shelf B2',active:true,createdAt:isoAt(-200,10,0)},
    {id:'part_mount',sku:'ENG-MNT-022',name:'Engine mount — Baleno (demo fitment)',category:'Engine',compatibility:'Maruti Suzuki Baleno (illustrative)',supplier:'Delhi Auto Parts Co.',cost:2400,price:3200,stock:4,reserved:1,reorder:3,location:'Rack D2',active:true,createdAt:isoAt(-150,10,0)},
    {id:'part_bushing',sku:'SUS-BSH-014',name:'Front suspension bushing set — SUV',category:'Suspension',compatibility:'XUV700, Scorpio-N (illustrative)',supplier:'NCR Suspension House',cost:3400,price:4600,stock:6,reserved:0,reorder:3,location:'Rack E1',active:true,createdAt:isoAt(-140,10,0)},
    {id:'part_wiper',sku:'WPR-24-003',name:'Wiper blade set — 24 inch',category:'Exterior',compatibility:'Multiple demo fitments',supplier:'Delhi Auto Parts Co.',cost:510,price:850,stock:12,reserved:0,reorder:5,location:'Shelf C3',active:true,createdAt:isoAt(-120,10,0)},
    {id:'part_battery',sku:'BAT-AGM-009',name:'Battery 12V AGM — demo specification',category:'Battery',compatibility:'Vehicles requiring AGM battery (illustrative)',supplier:'PowerCell Delhi',cost:7200,price:9400,stock:3,reserved:0,reorder:2,location:'Rack A4',active:true,createdAt:isoAt(-110,10,0)},
    {id:'part_acgas',sku:'AC-GAS-134',name:'R134a refrigerant — 500 g',category:'AC & cooling',compatibility:'Compatible demo AC systems only',supplier:'NCR Climate Parts',cost:720,price:1100,stock:8,reserved:0,reorder:4,location:'Shelf D1',active:true,createdAt:isoAt(-100,10,0)}
  ];
  const movements = [
    {id:'mov_1',partId:'part_brakepad',type:'reserve',qty:-1,jobId:'job_priya',reason:'Reserved for approved brake work',by:'st_front',at:isoAt(-3,14,30)},
    {id:'mov_2',partId:'part_brakepad',type:'consume',qty:-1,jobId:'job_karan',reason:'Fitted during brake job',by:'st_tech2',at:isoAt(-9,11,0)},
    {id:'mov_3',partId:'part_accomp',type:'consume',qty:-1,jobId:'job_aditi',reason:'Attempted allocation; stock unavailable',by:'st_tech3',at:isoAt(-3,9,5)},
    {id:'mov_4',partId:'part_oil',type:'reserve',qty:-2,jobId:'job_simran',reason:'Reserved for approved service',by:'st_tech3',at:isoAt(-5,10,0)},
    {id:'mov_5',partId:'part_condenser',type:'reserve',qty:0,jobId:'job_simran',reason:'Not reserved: supplementary approval pending',by:'st_front',at:isoAt(-2,17,5)},
    {id:'mov_6',partId:'part_oil',type:'receive',qty:10,jobId:null,reason:'Stock received against demo purchase entry',by:'st_manager',at:isoAt(-14,9,0)}
  ];
  const communication = (id, type, entityType, entityId, cid, channel, at, status = 'delivered', extra = {}) => ({
    id, type, entityType, entityId, customerId:cid, channel, recipient:channel === 'email' ? (getCustomerStatic(customers, cid)?.email || '') : (getCustomerStatic(customers, cid)?.mobile || ''),
    subject:extra.subject || settings.templates[type]?.subject || COMMUNICATION_TYPES[type] || 'Demo notification',
    body:extra.body || settings.templates[type]?.body || 'Simulated customer communication.',
    status, failureReason:extra.failureReason || '', simulated:true, at, by:extra.by || 'system'
  });
  const communications = [
    communication('com_1','booking_confirmation','booking','bk_tanya','cus_tanya','whatsapp',isoAt(-1,9,20)),
    communication('com_2','appointment_reminder','booking','bk_tanya','cus_tanya','sms',isoAt(0,8,15)),
    communication('com_3','inspection_ready','job','job_priya','cus_priya','email',isoAt(-3,14,5)),
    communication('com_4','estimate_ready','estimate','est_priya','cus_priya','whatsapp',isoAt(-3,14,10)),
    communication('com_5','approval_reminder','estimate','est_priya','cus_priya','sms',isoAt(-1,10,0),'failed',{failureReason:'Simulated delivery failure — demo contact not reachable'}),
    communication('com_6','additional_work','estimate','est_simran_sup','cus_simran','whatsapp',isoAt(-2,17,15)),
    communication('com_7','delay_notice','job','job_aditi','cus_aditi','sms',isoAt(-3,9,30)),
    communication('com_8','completion','job','job_rohan','cus_rohan','whatsapp',isoAt(-1,16,30)),
    communication('com_9','payment_reminder','invoice','inv_neha','cus_neha','email',isoAt(-5,10,0),'delivered'),
    communication('com_10','feedback_request','job','job_sana','cus_sana','whatsapp',isoAt(-27,10,0)),
    communication('com_11','progress_update','job','job_karan','cus_karan','whatsapp',isoAt(-4,16,30))
  ];
  const reminders = [
    {id:'rem_rohan',customerId:'cus_rohan',vehicleId:'veh_amaze',type:'Time since service',dueDate:dayOffsetKey(-2),reason:'Last recorded service was over 8 months ago under this demo schedule.',channel:'whatsapp',status:'pending',notes:'Service reminder due. Customer has opted out of promotional messages; this is treated as a service reminder, not marketing.',createdAt:isoAt(-30,10,0)},
    {id:'rem_priya',customerId:'cus_priya',vehicleId:'veh_i20',type:'Odometer guidance',dueDate:dayOffsetKey(6),reason:'Configurable demo guidance based on recorded odometer and time.',channel:'email',status:'pending',notes:'Second vehicle in household.',createdAt:isoAt(-10,10,0)},
    {id:'rem_neha',customerId:'cus_neha',vehicleId:'veh_city',type:'Customer-approved follow-up',dueDate:dayOffsetKey(14),reason:'Follow up on AC cooling performance after the delivered service.',channel:'sms',status:'scheduled',notes:'',createdAt:isoAt(-19,16,0)},
    {id:'rem_sana',customerId:'cus_sana',vehicleId:'veh_venue',type:'Manual',dueDate:dayOffsetKey(-20),reason:'Interior cleaning follow-up.',channel:'whatsapp',status:'sent',notes:'Sent as demo message.',createdAt:isoAt(-28,16,0)}
  ];
  const feedback = [
    {id:'fb_sana',jobId:'job_sana',customerId:'cus_sana',ratings:{overall:5,quality:5,communication:5,value:4},comment:'The interior cleaning was thorough and the team explained what was included. The demo portal updates were easy to follow.',category:'Service quality',publicConsent:true,status:'published',response:'Thank you for the feedback. — Gear Go Automobiles (demo response)',at:isoAt(-27,12,0)},
    {id:'fb_arjun',jobId:'job_arjun',customerId:'cus_arjun',ratings:{overall:4,quality:5,communication:4,value:4},comment:'Service was completed on time. I appreciated seeing the itemised invoice before collection.',category:'Communication',publicConsent:false,status:'reviewed',response:'',at:isoAt(-13,10,0)},
    {id:'fb_neha',jobId:'job_neha',customerId:'cus_neha',ratings:{overall:3,quality:4,communication:3,value:3},comment:'The AC works now, but I would have liked an earlier update about the invoice balance.',category:'Billing',publicConsent:false,status:'new',response:'',at:isoAt(-18,18,0)}
  ];
  const auditEvents = [
    {id:'aud_seed_1',at:isoAt(-3,14,0),actor:'Meera Sethi',role:'Service Manager',action:'estimate.sent',entityType:'estimate',entityId:'est_priya',summary:'Estimate GG-EST-3071 sent to Priya Verma',before:null,after:{status:'SENT'},reason:null},
    {id:'aud_seed_2',at:isoAt(-2,9,40),actor:'Priya Verma',role:'Customer',action:'approval.clarification',entityType:'estimate',entityId:'est_priya',summary:'Customer requested clarification on estimate GG-EST-3071',before:null,after:{status:'VIEWED'},reason:null},
    {id:'aud_seed_3',at:isoAt(-9,15,30),actor:'Karan Bhatia',role:'Customer',action:'approval.approved',entityType:'estimate',entityId:'est_karan',summary:'Customer approved estimate GG-EST-3065',before:null,after:{status:'APPROVED'},reason:null},
    {id:'aud_seed_4',at:isoAt(-6,14,6),actor:'Mohammed Faizan',role:'Customer',action:'approval.declined',entityType:'estimate',entityId:'est_faizan',summary:'Customer declined front suspension bushing work; safety review required',before:null,after:{status:'PARTIALLY_APPROVED'},reason:'Customer will manage suspension later'},
    {id:'aud_seed_5',at:isoAt(-4,16,0),actor:'Meera Sethi',role:'Service Manager',action:'job.qc_failed',entityType:'job',entityId:'job_karan',summary:'Quality check failed for GG-JC-2089; returned for rework',before:{status:'QUALITY_CHECK'},after:{status:'IN_PROGRESS'},reason:'Brake pedal feel below standard'},
    {id:'aud_seed_6',at:isoAt(-19,15,20),actor:'Meera Sethi',role:'Service Manager',action:'collection.override',entityType:'job',entityId:'job_neha',summary:'Vehicle delivered with partial payment recorded',before:null,after:{status:'DELIVERED'},reason:'Manager-approved collection policy override; balance follow-up scheduled'}
  ];
  return {
    version:APP_VERSION, schemaVersion:SCHEMA_VERSION, seededAt:now, demoDate:todayKey(), settings, staff, customers, vehicles, bookings, jobs, inspections, estimates, invoices, parts, movements, reservations:[], communications, reminders, feedback,
    audit:auditEvents,
    session:freshSession(),
    ui:{bookingDraft:null,estimateDraft:null,lastRoute:'/demo',filters:{},tourDone:false},
    notifications:[
      {id:'ntf_1',read:false,at:isoAt(-1,10,0),text:'Estimate GG-EST-3071 has been viewed but not approved.',href:'/ops/estimates/est_priya'},
      {id:'ntf_2',read:false,at:isoAt(-1,16,30),text:'GG-JC-2090 is ready for collection with an unpaid invoice.',href:'/ops/jobs/job_rohan'},
      {id:'ntf_3',read:false,at:isoAt(-2,17,15),text:'Supplementary approval is pending for Simran Kaur.',href:'/ops/estimates/est_simran_sup'},
      {id:'ntf_4',read:true,at:isoAt(-3,9,30),text:'GG-JC-2085 is delayed: AC compressor unavailable.',href:'/ops/jobs/job_aditi'}
    ]
  };
}

function getCustomerStatic(customers, id) { return customers.find(c => c.id === id); }
