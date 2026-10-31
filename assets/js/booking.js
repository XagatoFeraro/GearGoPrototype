/* ==========================================================================
   Gear Go Automobiles — booking
   Multi-step booking journey, validation and request submission.
   ========================================================================== */
'use strict';

const BOOKING_STEPS = [
  {key:'service',label:'Service'},
  {key:'vehicle',label:'Vehicle'},
  {key:'customer',label:'Contact'},
  {key:'appointment',label:'Appointment'},
  {key:'review',label:'Review'},
  {key:'confirm',label:'Confirmation'}
];

function freshBookingDraft() {
  const customer = db.session.kind === 'customer' ? currentCustomer(db) : null;
  const vehicles = customer ? customerVehicles(db, customer.id) : [];
  return {
    step:1,
    identity:customer?.id || 'guest',
    services:[], concerns:[], addons:[],
    unsure:false,
    vehicleMode:vehicles.length ? 'existing' : 'new',
    existingVehicleId:vehicles[0]?.id || '',
    vehicle:{reg:'',make:'',model:'',variant:'',year:'',fuel:'Petrol',transmission:'Manual',odometer:'',nickname:''},
    customer:{name:customer?.name || '',mobile:customer?.mobile || '',email:customer?.email || '',channel:customer?.channel || 'whatsapp',notes:''},
    customerId:customer?.id || null,
    date:'', slot:'', appointmentType:'drop_off', altPreference:'',
    consent:false, privacy:false, terms:false,
    confirmationRef:null, submittedAt:null
  };
}

function ensureBookingDraft() {
  const identity = db.session.kind === 'customer' && currentCustomer(db) ? db.session.customerId : 'guest';
  if (!db.ui.bookingDraft || db.ui.bookingDraft.identity !== identity) {
    db.ui.bookingDraft = freshBookingDraft();
    saveDB({silent:true});
  }
  return db.ui.bookingDraft;
}

function bookingStepFromRoute() {
  const step = Number(currentRoute.query.get('step')) || 1;
  return clamp(step, 1, 5);
}

function bookingNextStep(draft) {
  if (!draft.services || !draft.services.length) return 1;
  const hasVehicle = !!(draft.existingVehicleId || (draft.vehicle && (draft.vehicle.reg || draft.vehicle.make || draft.vehicle.model)));
  if (!hasVehicle) return 2;
  if (!draft.customerId) return 3;
  if (!draft.date || !draft.slot) return 4;
  return 5;
}

function bookingDraftTotals(draft) {
  let serviceTotal = 0;
  draft.services.forEach(id => { const s = serviceById(db, id); if (s?.price) serviceTotal += s.price; });
  draft.addons.forEach(id => { const a = ADDONS.find(x => x.id === id); if (a) serviceTotal += a.price; });
  return serviceTotal;
}

function draftHasInspectionRequired(draft) {
  return draft.services.some(id => !serviceById(db, id)?.price);
}

function bookingSummaryPanel(draft, step = 1) {
  const vehicle = draft.vehicleMode === 'existing' ? getVehicle(db, draft.existingVehicleId) : null;
  const vehicleText = vehicle ? `${vehicle.make} ${vehicle.model}` : [draft.vehicle.make, draft.vehicle.model].filter(Boolean).join(' ') || 'Not selected yet';
  const regText = vehicle ? fmtReg(vehicle.reg) : draft.vehicle.reg ? fmtReg(draft.vehicle.reg) : '—';
  const total = bookingDraftTotals(draft);
  const customerName = draft.customerId ? (getCustomer(db, draft.customerId)?.name || draft.customer.name) : draft.customer.name;
  return `<aside class="booking-summary">
    <h3>Your request</h3>
    <div class="summary-row"><span class="k">Services</span><span class="v">${draft.services.length ? draft.services.map(id => serviceById(db,id)?.name).filter(Boolean).join(', ') : 'Not selected'}</span></div>
    <div class="summary-row"><span class="k">Vehicle</span><span class="v">${esc(vehicleText)}<br><span style="color:rgba(255,255,255,.45);font-weight:400;font-size:10px">${esc(regText)}</span></span></div>
    ${customerName ? `<div class="summary-row"><span class="k">Customer</span><span class="v">${esc(customerName)}</span></div>` : ''}
    ${draft.date && draft.slot ? `<div class="summary-row"><span class="k">Preferred slot</span><span class="v">${fmtDateKey(draft.date)}<br><span style="color:rgba(255,255,255,.45);font-weight:400;font-size:10px">${fmtTime(draft.slot)}</span></span></div>` : ''}
    <div class="total"><span style="font-size:11px;color:rgba(255,255,255,.5)">${draftHasInspectionRequired(draft) ? 'Inspection required' : 'Indicative total'}</span><strong>${total ? fmtINR(total) : 'TBC'}</strong></div>
    <p style="font-size:9.5px;color:rgba(255,255,255,.42);line-height:1.5;margin-top:8px">Illustrative demo values. Final price depends on inspection and approved estimate.</p>
    ${step < 5 ? `<div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.14);display:flex;gap:9px"><span style="color:var(--lime)">${icon('shield','icon-sm')}</span><span style="font-size:10px;color:rgba(255,255,255,.55);line-height:1.5">Nothing is paid now. Paid work requires your approval after inspection.</span></div>` : ''}
  </aside>`;
}

function bookingView() {
  const draft = ensureBookingDraft();
  if (currentRoute.query.get('confirm')) {
    return bookingConfirmation(currentRoute.query.get('confirm'));
  }
  if (currentRoute.query.get('service') && !draft.services.includes(currentRoute.query.get('service'))) {
    const svc = serviceById(db, currentRoute.query.get('service'));
    if (svc?.enabled) draft.services.push(svc.id);
  }
  if (currentRoute.query.get('unsure') === '1') {
    draft.unsure = true;
    if (!draft.services.includes('svc_diagnostics')) draft.services.push('svc_diagnostics');
  }
  const step = bookingStepFromRoute();
  draft.step = step;
  if (!draft.date) {
    const dates = availableBookingDates(db, 10);
    if (dates.length) draft.date = dates[0];
  }
  const stepIndex = step - 1;
  const nav = `<div class="booking-steps" aria-label="Booking progress">${BOOKING_STEPS.slice(0,5).map((s, i) => `<div class="booking-step ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}" ${i === stepIndex ? 'aria-current="step"' : ''}><span class="n">${i < stepIndex ? '✓' : i+1}</span><span>${s.label}</span></div>`).join('')}</div>`;
  let panel = '';
  if (step === 1) panel = bookingStepService(draft);
  if (step === 2) panel = bookingStepVehicle(draft);
  if (step === 3) panel = bookingStepCustomer(draft);
  if (step === 4) panel = bookingStepAppointment(draft);
  if (step === 5) panel = bookingStepReview(draft);
  return `<div class="booking-shell">
    <div class="booking-wrap">
      <div class="booking-head">
        <div>
          <a href="#/site" class="brand" style="margin-bottom:14px">${brandMarkOnly()}<span style="font-size:17px">Gear Go</span></a>
          <h1 class="booking-title">Book a service</h1>
          <p class="small muted mt-2">A request, not a payment. You will see a reference and the next step.</p>
        </div>
        <div class="flex gap-2">${badge('Demo booking','amber',false)}<button class="switch-experience" style="border-color:var(--line);background:var(--white);color:var(--ink)" data-action="experience.open">${icon('grid','icon-sm')} Demo mode</button></div>
      </div>
      ${nav}
      <div class="booking-grid">${panel}${bookingSummaryPanel(draft, step)}</div>
      <p class="tiny muted center" style="margin-top:22px">Prototype only · no real appointment, message or payment is created. All names, numbers and vehicles are synthetic demo data.</p>
    </div>
  </div>`;
}

function brandMarkOnly() {
  return `<span class="brand-mark">${icon('car')}</span>`;
}

function bookingStepService(draft) {
  const selected = new Set(draft.services);
  return `<section class="booking-panel">
    <h2>What does your car need?</h2>
    <p class="sub">Start with a concern if you are not sure. This helps the garage prepare the right inspection — it does not diagnose the vehicle automatically.</p>
    <form data-form="booking.service" novalidate>
      <div class="label-text mb-2">What is the main concern?</div>
      <div class="option-grid concern-grid">
        ${CONCERNS.map(c => `<button type="button" class="option-card ${draft.concerns.includes(c.label) ? 'selected' : ''}" data-action="booking.concern" data-concern="${esc(c.label)}" data-service="${c.service}">
          <span class="opt-icon">${icon(c.icon)}</span><span><strong>${esc(c.label)}</strong><span>${c.id === 'unsure' ? 'We will suggest an inspection first.' : 'Suggests ' + esc(serviceById(db,c.service)?.name || 'a service')}</span></span>
          <span class="opt-check">${icon('check')}</span>
        </button>`).join('')}
      </div>
      <div class="section-divider"></div>
      <div class="flex between wrap mb-2"><div class="label-text">Requested services *</div><span class="tiny muted">Choose one or more</span></div>
      <div class="option-grid">
        ${db.settings.services.filter(s => s.enabled).map(s => `<button type="button" class="option-card ${selected.has(s.id) ? 'selected' : ''}" data-action="booking.service.toggle" data-service="${s.id}">
          <span class="opt-icon">${icon(s.icon)}</span><span><strong>${esc(s.name)}</strong><span>${s.price ? 'From '+fmtINR(s.price) : 'Inspection required'} · ${esc(s.duration)}</span></span>
          <span class="opt-check">${icon('check')}</span>
        </button>`).join('')}
      </div>
      <div class="section-divider"></div>
      <div class="label-text mb-2">Optional add-ons</div>
      <div class="form-grid">
        ${ADDONS.map(a => `<label class="option-card ${draft.addons.includes(a.id) ? 'selected' : ''}" style="cursor:pointer">
          <input type="checkbox" name="addons" value="${a.id}" ${draft.addons.includes(a.id) ? 'checked' : ''} style="margin-top:5px;accent-color:var(--night)" data-action="booking.addon">
          <span><strong>${esc(a.name)}</strong><span>${fmtINR(a.price)} · optional</span></span>
        </label>`).join('')}
      </div>
      <div class="inline-note mt-4">${icon('info')}<div>If you are unsure, choose “I’m not sure what my car needs”. The garage will start with an inspection and explain findings before recommending paid work.</div></div>
      <div class="booking-nav"><a class="btn btn-ghost btn-sm" href="#/site">Cancel</a><button class="btn btn-dark" type="submit">Continue to vehicle ${icon('arrow','icon-sm')}</button><button class="btn btn-lime" type="button" data-action="booking.bookNow">Book now ${icon('arrow','icon-sm')}</button></div>
    </form>
  </section>`;
}

function bookingStepVehicle(draft) {
  const customer = draft.customerId ? getCustomer(db, draft.customerId) : null;
  const vehicles = customer ? customerVehicles(db, customer.id) : [];
  return `<section class="booking-panel">
    <h2>Which vehicle?</h2>
    <p class="sub">Use an existing vehicle from your demo garage or add the details manually. Only the registration, make and model are essential.</p>
    <form data-form="booking.vehicle" novalidate>
      ${vehicles.length ? `<div class="pill-tabs mb-4"><button type="button" class="${draft.vehicleMode === 'existing' ? 'active' : ''}" data-action="booking.vehicleMode" data-mode="existing">Existing vehicle</button><button type="button" class="${draft.vehicleMode === 'new' ? 'active' : ''}" data-action="booking.vehicleMode" data-mode="new">Add another vehicle</button></div>` : ''}
      ${draft.vehicleMode === 'existing' && vehicles.length ? `<div class="option-grid">${vehicles.map(v => `<button type="button" class="option-card ${draft.existingVehicleId === v.id ? 'selected' : ''}" data-action="booking.existingVehicle" data-id="${v.id}">
        <span class="opt-icon">${icon('car')}</span><span><strong>${esc(v.make)} ${esc(v.model)} ${esc(v.variant || '')}</strong><span>${esc(fmtReg(v.reg))} · ${v.year} · ${esc(v.fuel)}</span></span><span class="opt-check">${icon('check')}</span>
      </button>`).join('')}</div>
      <p class="tiny muted mt-4">Need to correct the odometer or details? The garage can update them at check-in.</p>` : ''}
      <div ${draft.vehicleMode === 'existing' && vehicles.length ? 'hidden' : ''}>
        <div class="form-grid">
          <div class="field"><label for="bk-reg">Registration number *</label><input class="input" id="bk-reg" name="reg" value="${esc(draft.vehicle.reg)}" placeholder="DL 3C AB 1234" maxlength="16" autocomplete="off" required><span class="hint">Uppercase/lowercase, spaces and hyphens are normalised.</span></div>
          <div class="field"><label for="bk-make">Make *</label><input class="input" id="bk-make" name="make" value="${esc(draft.vehicle.make)}" placeholder="e.g. Maruti Suzuki" maxlength="40" required></div>
          <div class="field"><label for="bk-model">Model *</label><input class="input" id="bk-model" name="model" value="${esc(draft.vehicle.model)}" placeholder="e.g. Swift" maxlength="40" required></div>
          <div class="field"><label for="bk-variant">Variant (optional)</label><input class="input" id="bk-variant" name="variant" value="${esc(draft.vehicle.variant)}" placeholder="e.g. VXi" maxlength="30"></div>
          <div class="field"><label for="bk-year">Manufacturing year *</label><input class="input" id="bk-year" name="year" type="number" min="1990" max="${new Date().getFullYear() + 1}" value="${esc(draft.vehicle.year)}" required></div>
          <div class="field"><label for="bk-fuel">Fuel type *</label><select class="select" id="bk-fuel" name="fuel">${['Petrol','Diesel','CNG','Electric','Hybrid'].map(f => `<option ${draft.vehicle.fuel === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
          <div class="field"><label for="bk-trans">Transmission *</label><select class="select" id="bk-trans" name="transmission">${['Manual','Automatic','AMT','CVT','DCT'].map(t => `<option ${draft.vehicle.transmission === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="field"><label for="bk-odo">Odometer (km) *</label><input class="input" id="bk-odo" name="odometer" type="number" min="0" max="999999" value="${esc(draft.vehicle.odometer)}" placeholder="e.g. 28500" required></div>
          <div class="field full"><label for="bk-nick">Vehicle nickname (optional)</label><input class="input" id="bk-nick" name="nickname" value="${esc(draft.vehicle.nickname)}" placeholder="e.g. Family car" maxlength="40"></div>
        </div>
        <div class="inline-note mt-4">${icon('info')}<div>If this registration is already linked to another customer, the demo will not overwrite it. Staff will help verify ownership and link it safely.</div></div>
      </div>
      <div class="booking-nav"><button class="btn btn-ghost btn-sm" type="button" data-action="booking.back" data-step="1">← Back</button><button class="btn btn-dark" type="submit">Continue to contact details ${icon('arrow','icon-sm')}</button></div>
    </form>
  </section>`;
}

function bookingStepCustomer(draft) {
  const sessionCustomer = db.session.kind === 'customer' ? currentCustomer(db) : null;
  const prefilled = sessionCustomer?.id === draft.customerId;
  return `<section class="booking-panel">
    <h2>Who should we contact?</h2>
    <p class="sub">No account or password is needed. You only need to provide what is necessary to process this request.</p>
    <form data-form="booking.customer" novalidate>
      ${prefilled ? `<div class="inline-note mb-4">${icon('user')}<div>You are booking as <strong>${esc(sessionCustomer.name)}</strong> from the demo customer portal. Your saved contact details are pre-filled.</div></div>` : ''}
      <div class="form-grid">
        <div class="field"><label for="bk-name">Full name *</label><input class="input" id="bk-name" name="name" autocomplete="name" maxlength="80" value="${esc(draft.customer.name)}" required></div>
        <div class="field"><label for="bk-mobile">Mobile number *</label><input class="input" id="bk-mobile" name="mobile" inputmode="tel" maxlength="15" autocomplete="tel" value="${esc(draft.customer.mobile)}" placeholder="10-digit Indian mobile" required><span class="hint">Used only for this demo request. Seeded numbers are not real.</span></div>
        <div class="field"><label for="bk-email">Email (optional)</label><input class="input" id="bk-email" name="email" type="email" maxlength="120" autocomplete="email" value="${esc(draft.customer.email)}"></div>
        <div class="field"><label for="bk-channel">Preferred contact method</label><select class="select" id="bk-channel" name="channel">${Object.entries(CHANNEL_LABELS).filter(([k]) => ['whatsapp','sms','email','phone'].includes(k)).map(([k,v]) => `<option value="${k}" ${draft.customer.channel === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field full"><label for="bk-notes">Anything we should know?</label><textarea class="textarea" id="bk-notes" name="notes" maxlength="600" placeholder="Describe the concern, when it happens, or any access needs">${esc(draft.customer.notes)}</textarea><span class="hint">${draft.customer.notes.length}/600 characters. Do not include payment information.</span></div>
        <div class="field full"><label class="check"><input type="checkbox" name="consent" ${draft.consent ? 'checked' : ''}> I agree to receive essential service updates about this request. Marketing messages are separate and optional.</label></div>
        <div class="field full"><label class="check"><input type="checkbox" name="privacy" ${draft.privacy ? 'checked' : ''} required> I understand this is a demonstration prototype and have read the demo privacy notice. *</label></div>
      </div>
      <div class="booking-nav"><button class="btn btn-ghost btn-sm" type="button" data-action="booking.back" data-step="2">← Back</button><button class="btn btn-dark" type="submit">Choose an appointment ${icon('arrow','icon-sm')}</button></div>
    </form>
  </section>`;
}

function bookingStepAppointment(draft) {
  const dates = availableBookingDates(db, 14);
  if (!dates.includes(draft.date)) draft.date = dates[0] || '';
  const slots = draft.date ? slotsForDate(db, draft.date) : [];
  return `<section class="booking-panel">
    <h2>When would you like to come in?</h2>
    <p class="sub">Slots are generated from configured opening hours and demo capacity. A request is not a confirmed booking until the garage confirms it.</p>
    <form data-form="booking.appointment" novalidate>
      <div class="label-text mb-2">Preferred date *</div>
      <div class="calendar-strip">
        ${dates.slice(0,14).map(key => {
          const d = dateFromKey(key);
          const weekday = new Intl.DateTimeFormat('en-IN', {timeZone:IST,weekday:'short'}).format(d);
          const day = new Intl.DateTimeFormat('en-IN', {timeZone:IST,day:'numeric'}).format(d);
          const open = slotsForDate(db,key).some(s => s.available);
          return `<button type="button" class="day-pick ${draft.date === key ? 'selected' : ''}" data-action="booking.date" data-date="${key}" ${!open ? 'disabled' : ''} aria-label="${fmtDateKey(key)} ${open ? 'available' : 'fully booked or closed'}"><span>${weekday}</span><strong>${day}</strong><span class="tiny" style="display:block;font-size:8px">${open ? 'Open' : 'Full'}</span></button>`;
        }).join('')}
      </div>
      <div class="section-divider"></div>
      <div class="flex between wrap mb-2"><div class="label-text">Available time *</div><span class="tiny muted">${draft.date ? fmtDateKey(draft.date) : 'Choose a date'}</span></div>
      <div class="slot-grid">
        ${slots.map(s => `<button type="button" class="slot ${draft.slot === s.value ? 'selected' : ''}" data-action="booking.slot" data-slot="${s.value}" ${!s.available ? 'disabled' : ''}>${s.label}<small>${s.available ? `${s.capacity - s.booked} place${s.capacity - s.booked === 1 ? '' : 's'}` : 'Full'}</small></button>`).join('') || `<p class="small muted">No slots are available on this date. Try another date.</p>`}
      </div>
      <div class="section-divider"></div>
      <div class="label-text mb-2">Appointment type</div>
      <div class="option-grid concern-grid">
        ${[
          ['drop_off','Drop off','Bring the vehicle to Aya Nagar.'],
          ['inspection','Inspection only','Short diagnostic or assessment.'],
          ['pickup','Request pickup','Subject to availability.']
        ].map(([val,label,desc]) => `<button type="button" class="option-card ${draft.appointmentType === val ? 'selected' : ''}" data-action="booking.appointmentType" data-type="${val}"><span class="opt-icon">${icon(val === 'pickup' ? 'route' : val === 'inspection' ? 'search' : 'car')}</span><span><strong>${label}</strong><span>${desc}</span></span><span class="opt-check">${icon('check')}</span></button>`).join('')}
      </div>
      <div class="field mt-4"><label for="bk-alt">Alternative preference (optional)</label><input class="input" id="bk-alt" name="altPreference" value="${esc(draft.altPreference)}" placeholder="e.g. Later afternoon, any day next week" maxlength="120"></div>
      ${draft.appointmentType === 'pickup' ? `<div class="inline-note warn mt-4">${icon('alert')}<div>Pickup is a configurable capability in this prototype. The garage must confirm availability and any charges; it is not guaranteed.</div></div>` : ''}
      <div class="inline-note mt-4">${icon('info')}<div>Appointment time is separate from estimated repair completion. A slot does not guarantee when the repair will finish.</div></div>
      <div class="booking-nav"><button class="btn btn-ghost btn-sm" type="button" data-action="booking.back" data-step="3">← Back</button><button class="btn btn-dark" type="submit">Review request ${icon('arrow','icon-sm')}</button></div>
    </form>
  </section>`;
}

function bookingStepReview(draft) {
  const vehicle = draft.vehicleMode === 'existing' ? getVehicle(db, draft.existingVehicleId) : null;
  const vehicleData = vehicle || draft.vehicle;
  const serviceNames = draft.services.map(id => serviceById(db,id)?.name).filter(Boolean);
  const total = bookingDraftTotals(draft);
  let match = null;
  if (draft.customer.mobile) {
    const matches = findCustomerMatches(db, draft.customer.mobile, draft.customer.name, vehicleData.reg);
    match = matches[0]?.customer || null;
  }
  return `<section class="booking-panel">
    <h2>Review your request</h2>
    <p class="sub">Nothing is charged now. You can edit any section before submitting.</p>
    <form data-form="booking.submit" novalidate>
      <div class="review-block"><div class="head"><h3>Customer</h3><button type="button" class="link tiny" data-action="booking.edit" data-step="3" style="border:0;background:none;padding:0">Edit</button></div><div class="body"><strong>${esc(draft.customer.name)}</strong><br>${esc(fmtMobile(draft.customer.mobile))}${draft.customer.email ? `<br>${esc(draft.customer.email)}` : ''}<br><span class="muted">Preferred contact: ${esc(CHANNEL_LABELS[draft.customer.channel] || draft.customer.channel)}</span></div></div>
      <div class="review-block"><div class="head"><h3>Vehicle</h3><button type="button" class="link tiny" data-action="booking.edit" data-step="2" style="border:0;background:none;padding:0">Edit</button></div><div class="body"><strong>${esc(vehicleData.make)} ${esc(vehicleData.model)} ${esc(vehicleData.variant || '')}</strong><br><span class="mono">${esc(fmtReg(vehicleData.reg))}</span> · ${esc(vehicleData.year)} · ${esc(vehicleData.fuel)} · ${esc(vehicleData.transmission)}<br><span class="muted">Odometer: ${fmtNum(vehicleData.odometer)} km${vehicleData.nickname ? ` · ${esc(vehicleData.nickname)}` : ''}</span></div></div>
      <div class="review-block"><div class="head"><h3>Requested services</h3><button type="button" class="link tiny" data-action="booking.edit" data-step="1" style="border:0;background:none;padding:0">Edit</button></div><div class="body">${serviceNames.map(n => `<span class="chip" style="margin:2px 2px 2px 0">${esc(n)}</span>`).join('')}${draft.addons.length ? `<div class="tiny muted mt-2">Add-ons: ${draft.addons.map(id => ADDONS.find(a=>a.id===id)?.name).filter(Boolean).join(', ')}</div>` : ''}${draft.customer.notes ? `<p class="mt-2" style="font-size:12px;color:var(--muted)">“${esc(draft.customer.notes)}”</p>` : ''}</div></div>
      <div class="review-block"><div class="head"><h3>Preferred appointment</h3><button type="button" class="link tiny" data-action="booking.edit" data-step="4" style="border:0;background:none;padding:0">Edit</button></div><div class="body"><strong>${fmtDateKey(draft.date)} · ${fmtTime(draft.slot)}</strong><br><span class="muted">${draft.appointmentType === 'pickup' ? 'Pickup requested · subject to availability' : draft.appointmentType === 'inspection' ? 'Inspection appointment' : 'Drop-off at Aya Nagar'}${draft.altPreference ? `<br>Alternative: ${esc(draft.altPreference)}` : ''}</span></div></div>
      <div class="review-block" style="background:var(--night);color:var(--white);border-color:var(--night)">
        <div class="flex between"><div><div class="tiny" style="color:rgba(255,255,255,.5)">${draftHasInspectionRequired(draft) ? 'Inspection required first' : 'Indicative total'}</div><strong style="font-family:var(--font-display);font-size:26px;color:var(--lime)">${total ? fmtINR(total) : 'To be confirmed'}</strong></div><span class="badge dark no-dot">Demo pricing</span></div>
        <p style="font-size:10.5px;color:rgba(255,255,255,.5);margin-top:8px;line-height:1.5">Not a final quotation. Taxes, parts and any additional work are confirmed in an estimate after inspection.</p>
      </div>
      ${match ? `<div class="inline-note mt-4">${icon('users')}<div><strong>Existing demo record found.</strong> This booking will be linked to ${esc(match.name)} (${esc(match.ref)}) using the mobile number and vehicle. If this is not you, contact the garage or change your mobile number.</div></div>` : ''}
      <label class="check mt-4"><input type="checkbox" name="terms" required> I understand this is an appointment request, not a confirmed booking, and that this prototype stores data locally and sends no real messages. *</label>
      <label class="check mt-2"><input type="checkbox" name="accuracy" required> I confirm the demo details above are complete and that I am not entering real personal information. *</label>
      <div class="booking-nav"><button class="btn btn-ghost btn-sm" type="button" data-action="booking.back" data-step="4">← Back</button><button class="btn btn-lime" type="submit">Submit request ${icon('arrow','icon-sm')}</button></div>
      <p class="tiny muted center mt-4">By submitting, the booking appears immediately in the garage operations demo.</p>
    </form>
  </section>`;
}

function bookingConfirmation(ref) {
  const booking = db.bookings.find(b => b.ref === ref);
  if (!booking) return `<div class="booking-shell"><div class="booking-wrap"><div class="card">${emptyState('Confirmation not found','This demo reference no longer exists. The demo may have been reset.','<a class="btn btn-dark btn-sm" href="#/book">Start a new booking</a>','search')}</div></div></div>`;
  const customer = getCustomer(db, booking.customerId);
  const vehicle = getVehicle(db, booking.vehicleId);
  const services = booking.services.map(id => serviceById(db,id)?.name).filter(Boolean);
  return `<div class="booking-shell"><div class="booking-wrap" style="max-width:760px">
    <div class="booking-panel" style="padding:36px">
      <div class="confirm-hero">
        <div class="success-orb">${icon('check')}</div>
        <h1>Request received.</h1>
        <p>Thanks, ${esc(customer?.name?.split(' ')[0] || 'there')}. Your appointment request is now with the front desk. This is not confirmed until the garage reviews the slot.</p>
        <div class="ref-box"><span>Booking reference</span><strong>${esc(booking.ref)}</strong></div>
      </div>
      <div class="detail-list">
        <div class="detail-row"><span class="k">Vehicle</span><span class="v">${esc(vehicle?.make)} ${esc(vehicle?.model)} · ${esc(fmtReg(vehicle?.reg))}</span></div>
        <div class="detail-row"><span class="k">Requested services</span><span class="v">${esc(services.join(', '))}</span></div>
        <div class="detail-row"><span class="k">Preferred appointment</span><span class="v">${fmtDateKey(booking.date)} · ${fmtTime(booking.slot)}</span></div>
        <div class="detail-row"><span class="k">Status</span><span class="v">${bookingBadge(booking.status)}</span></div>
        <div class="detail-row"><span class="k">Contact</span><span class="v">${esc(fmtMobile(customer?.mobile))}<br><span class="tiny muted">Demo number only</span></span></div>
      </div>
      <div class="inline-note mt-6">${icon('clock')}<div><strong>What happens next?</strong><br>The front desk reviews capacity and confirms the appointment. You can track this reference without signing in. All updates in this prototype are simulated.</div></div>
      <div class="btn-group mt-6">
        <a class="btn btn-dark" href="#/site/track?ref=${encodeURIComponent(booking.ref)}&found=1">Track request ${icon('arrow','icon-sm')}</a>
        <button class="btn btn-outline" data-action="booking.share" data-ref="${esc(booking.ref)}">${icon('send','icon-sm')} Share demo reference</button>
        <button class="btn btn-outline" data-action="print">${icon('print','icon-sm')} Print confirmation</button>
      </div>
      <div class="btn-group mt-4" style="justify-content:center">
        <a class="link small" href="#/demo/personas" data-action="confirmation.portal" data-customer="${customer?.id}">Open this customer in the portal</a>
        <a class="link small" href="#/demo/personas" data-action="confirmation.frontdesk">Open as front desk</a>
        <a class="link small" href="#/site">Return to website</a>
      </div>
      <div class="print-only mt-8"><p class="tiny">Gear Go Automobiles · ${esc(db.settings.business.address)}<br>This is a demonstration confirmation. Not a real booking.</p></div>
    </div>
  </div></div>`;
}

function validateBookingDraft(draft, forSubmit = false) {
  const errors = [];
  if (!draft.services.length) errors.push('Choose at least one service.');
  draft.services.forEach(id => { if (!serviceById(db,id)?.enabled) errors.push('One selected service is currently disabled.'); });
  if (!draft.customer.name || draft.customer.name.length < 2) errors.push('Enter the customer’s full name.');
  if (!isValidMobile(draft.customer.mobile)) errors.push('Enter a valid 10-digit Indian mobile number.');
  if (draft.customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.customer.email)) errors.push('Enter a valid email address or leave it blank.');
  if (forSubmit && !draft.consent && !draft.privacy) errors.push('Please acknowledge the demo privacy notice.');
  if (!draft.date || !draft.slot) errors.push('Choose an available appointment date and time.');
  if (draft.date < todayKey()) errors.push('The appointment date cannot be in the past.');
  if (draft.date && !draft.slot && draft.step >= 4) errors.push('Choose an available time slot.');
  if (draft.vehicleMode === 'new') {
    if (!isValidReg(draft.vehicle.reg)) errors.push('Enter a valid Indian registration number (e.g. DL 3C AB 1234).');
    if (!draft.vehicle.make || !draft.vehicle.model) errors.push('Enter the vehicle make and model.');
    if (!draft.vehicle.year || Number(draft.vehicle.year) < 1990 || Number(draft.vehicle.year) > new Date().getFullYear() + 1) errors.push('Enter a valid manufacturing year.');
    if (isBlank(String(draft.vehicle.odometer))) errors.push('Enter the odometer reading.');
  } else if (!draft.existingVehicleId) {
    errors.push('Select a vehicle.');
  }
  return errors;
}

function submitBooking() {
  const draft = ensureBookingDraft();
  const errors = validateBookingDraft(draft, true);
  if (errors.length) return {ok:false, errors};
  if (!draft.privacy) return {ok:false, errors:['Please acknowledge the demo privacy notice.']};
  if (!draft.terms) return {ok:false, errors:['Please accept the appointment request terms.']};
  const date = draft.date;
  if (dateIsClosed(db, date)) return {ok:false, errors:['The chosen date is now closed or unavailable. Please choose another date.']};
  const slotState = slotCapacity(db, date, draft.slot);
  if (!slotState.available) return {ok:false, errors:['That appointment slot has just become unavailable. Please choose another slot.']};
  const slotHour = Number(draft.slot.split(':')[0]);
  const openHour = Number(db.settings.booking.open.split(':')[0]);
  const closeHour = Number(db.settings.booking.close.split(':')[0]);
  if (slotHour < openHour || slotHour >= closeHour) return {ok:false, errors:['The chosen time is outside configured opening hours.']};
  let customer = draft.customerId ? getCustomer(db, draft.customerId) : null;
  let vehicle = draft.vehicleMode === 'existing' ? getVehicle(db, draft.existingVehicleId) : null;
  if (!customer) {
    const mobile = cleanMobile(draft.customer.mobile);
    const matches = findCustomerMatches(db, mobile, draft.customer.name, vehicle?.reg || draft.vehicle.reg);
    const exact = matches.find(m => cleanMobile(m.customer.mobile) === mobile && (m.customer.name.toLowerCase() === draft.customer.name.toLowerCase() || (vehicle && m.customer.id === vehicle.customerId)));
    if (exact) customer = exact.customer;
  }
  if (vehicle && customer && vehicle.customerId && vehicle.customerId !== customer.id) {
    return {ok:false, errors:['The selected vehicle belongs to a different customer record. Please contact the garage to correct the ownership record.']};
  }
  if (!vehicle) {
    const reg = normaliseReg(draft.vehicle.reg);
    const conflict = db.vehicles.find(v => normaliseReg(v.reg) === reg && (!customer || v.customerId !== customer.id));
    if (conflict) {
      return {ok:false, errors:[`Registration ${fmtReg(reg)} is already linked to another customer record (${getCustomer(db, conflict.customerId)?.ref}). Staff must verify ownership before it can be booked here.`]};
    }
    vehicle = customer ? db.vehicles.find(v => normaliseReg(v.reg) === reg && v.customerId === customer.id) : null;
  }
  if (!customer) {
    customer = {
      id:uid('cus'), ref:`GG-C-${++db.settings.numbering.customer}`, name:cleanName(draft.customer.name), mobile:cleanMobile(draft.customer.mobile),
      email:draft.customer.email, channel:draft.customer.channel || 'whatsapp',
      address:{line:'',locality:'Not provided',city:'',pincode:''}, type:'Individual',
      consents:{service:!!draft.consent,marketing:false}, marketingOptOut:true, status:'active', guest:true,
      notes:'Created from a guest booking request. Verify details at check-in.', createdAt:new Date().toISOString()
    };
    db.customers.push(customer);
    audit(db,'customer.created','customer',customer.id,`Guest customer ${customer.name} created from booking request`);
  }
  if (!vehicle) {
    if (!draft.customerId && customer.guest === false) {
      draft.customerId = customer.id;
    }
    vehicle = {
      id:uid('veh'), ref:`GG-V-${++db.settings.numbering.vehicle}`, reg:normaliseReg(draft.vehicle.reg), make:cleanName(draft.vehicle.make), model:cleanName(draft.vehicle.model),
      variant:cleanName(draft.vehicle.variant), year:Number(draft.vehicle.year), fuel:draft.vehicle.fuel, transmission:draft.vehicle.transmission,
      odometer:Number(draft.vehicle.odometer), customerId:customer.id, color:'', nickname:cleanName(draft.vehicle.nickname), status:'active',
      notes:'Added during online booking; verify at check-in.', createdAt:new Date().toISOString()
    };
    db.vehicles.push(vehicle);
    audit(db,'vehicle.created','vehicle',vehicle.id,`Vehicle ${fmtReg(vehicle.reg)} added for ${customer.name}`);
  } else if (vehicle.customerId !== customer.id) {
    if (vehicle.customerId) return {ok:false, errors:['The selected vehicle belongs to a different customer record. Please contact the garage to correct the ownership record.']};
    vehicle.customerId = customer.id;
  }
  const existingDuplicate = db.bookings.find(b => b.vehicleId === vehicle.id && b.date === date && b.slot === draft.slot && !['cancelled','no_show','rejected'].includes(b.status));
  if (existingDuplicate) return {ok:false, errors:[`This vehicle already has an active request for ${fmtDateKey(date)} at ${fmtTime(draft.slot)} (${existingDuplicate.ref}). Choose another slot or contact the garage.`]};
  const ref = bookingRef(db);
  ++db.settings.numbering.booking;
  const now = new Date().toISOString();
  const booking = {
    id:uid('bk'), ref, customerId:customer.id, vehicleId:vehicle.id, services:[...draft.services],
    concerns:[...(draft.concerns || [])], addons:[...draft.addons], inspectionRequested:draftHasInspectionRequired(draft),
    appointmentType:draft.appointmentType, date, slot:draft.slot, altPreference:draft.altPreference,
    status:'new_request', source:'Website', notes:draft.customer.notes, internalNotes:'',
    jobId:null, createdAt:now, updatedAt:now,
    history:[{at:now,label:'Booking request received',detail:'Submitted through the demo website'}]
  };
  db.bookings.unshift(booking);
  audit(db,'booking.created','booking',booking.id,`Booking ${ref} created for ${customer.name} · ${fmtReg(vehicle.reg)}`);
  const comm = {
    id:uid('com'), type:'booking_confirmation', entityType:'booking', entityId:booking.id, customerId:customer.id,
    channel:draft.customer.channel, recipient:draft.customer.channel === 'email' ? customer.email : customer.mobile,
    subject:'We received your service request', body:`Hi ${customer.name.split(' ')[0]}, your service request ${ref} for ${vehicle.make} ${vehicle.model} has been received and is awaiting confirmation. This is a simulated demo message — no real message was sent.`,
    status:'queued', failureReason:'', simulated:true, at:now, by:'system'
  };
  db.communications.unshift(comm);
  db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`New booking ${ref} from ${customer.name} requires confirmation.`,href:`/ops/bookings/${booking.id}`});
  db.ui.bookingDraft = {...freshBookingDraft(), confirmationRef:ref, submittedAt:now};
  saveDB({silent:true});
  return {ok:true, booking, customer, vehicle};
}

function openShareModal(text, title = 'Share demo link') {
  openModal({title, body:`<p class="small muted mb-4">This is a demo reference. It does not represent a real booking.</p><div class="message-bubble mono" style="word-break:break-word">${esc(text)}</div>`, footer:`<button class="btn btn-outline" data-action="modal.close">Close</button><button class="btn btn-dark" data-action="copy.text" data-text="${esc(text)}">${icon('clipboard','icon-sm')} Copy text</button>`});
}

