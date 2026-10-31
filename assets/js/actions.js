/* ==========================================================================
   Gear Go Automobiles — actions
   Delegated click-action handlers for every surface.
   ========================================================================== */
'use strict';

Object.assign(actions, {
  'modal.close': () => closeModal(),
  'auth.login': (el) => performLogin(el.dataset.kind, el.dataset.id, el.dataset.next),
  'auth.logout': () => {
    const name = currentUserLabel(db);
    db.session = freshSession();
    audit(db, 'auth.logout', 'session', null, `Signed out ${name}`);
    persist('Signed out of the demo', 'success', {title:'Demo sign-in'});
    closeModal();
    go('/site');
  },
  'recovery.reload': () => location.reload(),
  'sidebar.open': () => {
    document.body.classList.add('nav-open');
    document.querySelector('.sidebar')?.classList.add('open');
    document.querySelector('.side-scrim')?.classList.add('open');
    document.querySelectorAll('[data-action="sidebar.open"]').forEach(btn => btn.setAttribute('aria-expanded', 'true'));
  },
  'sidebar.close': () => {
    document.body.classList.remove('nav-open');
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.side-scrim')?.classList.remove('open');
    document.querySelectorAll('[data-action="sidebar.open"]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  },
  'exp.toggle': (el) => {
    const menu = document.getElementById('exp-menu');
    if (!menu) return;
    const open = menu.classList.toggle('open');
    el.setAttribute('aria-expanded', open ? 'true' : 'false');
  },
  'exp.go': () => { const menu = document.getElementById('exp-menu'); menu?.classList.remove('open'); closeModal(); },
  'exp.customer-site': () => { closeModal(); go('/site'); },
  'exp.customer-portal': () => {
    closeModal();
    if (db.session.kind === 'customer' && currentCustomer(db)) go('/portal');
    else go(loginPath('/portal'));
  },
  'exp.ops': () => {
    closeModal();
    const staff = currentStaff(db);
    if (db.session.kind === 'staff' && staff && staff.role !== 'technician') go('/ops');
    else go(loginPath('/ops'));
  },
  'exp.tech': () => {
    closeModal();
    if (db.session.kind === 'staff' && currentStaff(db)?.role === 'technician') go('/tech');
    else go(loginPath('/tech'));
  },
  'exp.personas': () => { closeModal(); go('/demo/personas'); },
  'exp.controls': () => { closeModal(); go('/demo'); },
  'experience.open': () => {
    openModal({
      title:'Switch demo experience', size:'lg',
      body:`<p class="small muted mb-4">This prototype has several connected surfaces. Opening another area asks you to sign in with a demo staff member or customer so permissions and records stay consistent.</p>
        <div class="card-grid">
          <button class="card" data-action="exp.customer-site" style="text-align:left"><strong>Customer website</strong><p class="tiny muted mt-2">Public services, booking request and tracking.</p><span class="link tiny mt-3">Open website →</span></button>
          <button class="card" data-action="exp.customer-portal" style="text-align:left"><strong>Customer portal</strong><p class="tiny muted mt-2">Vehicles, approvals, invoices and privacy controls.</p><span class="link tiny mt-3">Open portal →</span></button>
          <button class="card" data-action="exp.ops" style="text-align:left"><strong>Garage operations</strong><p class="tiny muted mt-2">Bookings, check-in, workshop, money and settings.</p><span class="link tiny mt-3">Open operations →</span></button>
          <button class="card" data-action="exp.tech" style="text-align:left"><strong>Mechanic workspace</strong><p class="tiny muted mt-2">Assigned jobs, tasks, inspections and QC.</p><span class="link tiny mt-3">Open workshop →</span></button>
        </div>
        <div class="section-divider"></div>
        <div class="flex between wrap gap-3"><div><strong style="font-size:12px">Current: ${esc(currentUserLabel(db))}</strong><div class="tiny muted">${esc(currentRoleLabel(db))}</div></div><div class="btn-group">${isSignedIn(db) ? '<button class="btn btn-ghost btn-sm" data-action="auth.logout" style="color:var(--red)">Sign out</button>' : ''}<a class="btn btn-dark btn-sm" href="#/login?next=%2Fportal">Open sign in</a></div></div>`,
      footer:`<a class="btn btn-outline" href="#/demo" data-action="exp.controls">Demo controls</a><button class="btn btn-ghost" data-action="modal.close">Close</button>`
    });
  },
  'notifications.open': () => {
    const items = (db.notifications || []).slice(0, 12);
    openModal({title:'Demo notifications', body:items.length ? `<div class="timeline">${items.map(n => `<a class="tl-item ${n.read?'done':'active'}" href="#${n.href}" data-action="notification.read" data-id="${n.id}" style="text-decoration:none;color:inherit"><span class="tl-dot"></span><div class="tl-title">${esc(n.text)}</div><div class="tl-meta">${fmtDateTime(n.at)}${n.read?' · read':' · unread'}</div></a>`).join('')}</div>` : '<p class="small muted">No notifications.</p>', footer:`<button class="btn btn-outline" data-action="notifications.clear">Mark all read</button><button class="btn btn-dark" data-action="modal.close">Close</button>`});
  },
  'notification.read': (el) => {
    const n = db.notifications.find(x => x.id === el.dataset.id);
    if (n) { n.read = true; saveDB({silent:true}); }
    closeModal();
  },
  'notifications.clear': () => { db.notifications.forEach(n => { n.read = true; }); persist('All demo notifications marked read', 'success', {title:'Notifications'}); closeModal(); },
  'copy.text': async (el) => {
    const text = el.dataset.text || '';
    try { await navigator.clipboard.writeText(text); toast('Copied', 'Text copied to the clipboard.', 'success'); }
    catch (e) { openShareModal(text, 'Copy unavailable'); }
  },
  'print': () => window.print(),
  'faq.toggle': (el) => { const item = el.closest('.faq-item'); if (item) { item.classList.toggle('open'); el.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false'); } },
  'inspection.toggle': (el) => { const body = document.getElementById(el.dataset.target); if (body) { body.classList.toggle('open'); el.setAttribute('aria-expanded', body.classList.contains('open') ? 'true' : 'false'); } },
  'mobile.open': () => actions['sidebar.open'](),
  'mobile.close': () => actions['sidebar.close'](),
  'booking.service.toggle': (el) => {
    const d = ensureBookingDraft();
    const id = el.dataset.service;
    d.services = d.services.includes(id) ? d.services.filter(x => x !== id) : [...d.services, id];
    render();
  },
  'booking.concern': (el) => {
    const d = ensureBookingDraft();
    const label = el.dataset.concern;
    d.concerns = d.concerns.includes(label) ? d.concerns.filter(x => x !== label) : [...d.concerns, label];
    if (el.dataset.service && !d.services.includes(el.dataset.service) && d.concerns.includes(label)) d.services.push(el.dataset.service);
    if (!d.concerns.includes(label) && el.dataset.service && !d.concerns.some(c => CONCERNS.find(x => x.label === c)?.service === el.dataset.service)) d.services = d.services.filter(x => x !== el.dataset.service);
    render();
  },
  'booking.addon': (el) => {
    const d = ensureBookingDraft();
    if (el.checked) { if (!d.addons.includes(el.value)) d.addons.push(el.value); }
    else d.addons = d.addons.filter(x => x !== el.value);
  },
  'booking.back': (el) => go(`/book?step=${Math.max(1, Number(el.dataset.step) || 1)}`),
  'booking.edit': (el) => go(`/book?step=${Number(el.dataset.step) || 1}`),
  'booking.date': (el) => { const d = ensureBookingDraft(); d.date = el.dataset.date; d.slot = ''; d.step = 4; render(); },
  'booking.slot': (el) => { const d = ensureBookingDraft(); d.slot = el.dataset.slot; d.step = 4; render(); },
  'booking.appointmentType': (el) => { const d = ensureBookingDraft(); d.appointmentType = el.dataset.type; d.step = 4; render(); },
  'booking.vehicleMode': (el) => { const d = ensureBookingDraft(); d.vehicleMode = el.dataset.mode; if (el.dataset.mode === 'new') d.existingVehicleId = ''; render(); },
  'booking.existingVehicle': (el) => { const d = ensureBookingDraft(); d.existingVehicleId = el.dataset.id; d.vehicleMode = 'existing'; render(); },
  'booking.share': (el) => {
    const b = db.bookings.find(x => x.ref === el.dataset.ref);
    if (!b) return;
    const text = `Gear Go Automobiles — demo service request\nReference: ${b.ref}\nRequested: ${fmtDateKey(b.date)} at ${fmtTime(b.slot)}\nThis is a prototype reference only, not a real booking.`;
    openShareModal(text);
  },
  'confirmation.portal': () => go(loginPath('/portal')),
  'confirmation.frontdesk': () => go(loginPath('/ops/bookings')),
  'track.portal': (el) => { closeModal(); go(loginPath('/portal', el.dataset.customer ? `customer:${el.dataset.customer}` : '')); },
  'portal.approval.review': (el) => {
    const est = portalOwned(db.estimates, el.dataset.id);
    if (!est) return toast('Estimate unavailable', 'This estimate does not belong to the current customer identity.', 'error');
    const form = el.closest('form');
    const decision = el.dataset.decision;
    const checked = form ? [...form.querySelectorAll('input[name="line"]:checked:not(:disabled)')].map(i => i.value) : [];
    if (!checked.length) return toast('Select at least one line', 'Tick the work you want to authorise or decline, then choose an action.', 'error');
    const verb = decision === 'approve' ? 'approve' : 'decline';
    confirmDialog({
      title:`${decision === 'approve' ? 'Approve' : 'Decline'} ${checked.length} line${checked.length===1?'':'s'}?`,
      message:`You are about to <strong>${verb}</strong> ${checked.length} item(s) on estimate <strong>${esc(est.ref)}</strong>. Earlier decisions on other lines remain unchanged. This records a customer decision in the demo; no work starts from this prototype.`,
      confirmLabel:decision === 'approve' ? 'Record approval' : 'Record decline',
      danger:decision !== 'approve',
      requireReason:decision !== 'approve', reasonLabel:'Reason (optional)',
      onConfirm:async (reason) => {
        const now = new Date().toISOString();
        est.decisions = est.decisions || [];
        est.decisions.push({at:now,actor:currentCustomer(db)?.name || 'Customer',actorType:'customer',decision,lineIds:checked,comment:reason || ''});
        const decided = new Set();
        est.decisions.forEach(d => (d.lineIds || []).forEach(id => decided.add(id)));
        const approved = approvedLineIds(est);
        const allDecided = est.lines.every(l => decided.has(l.id));
        const noneApproved = approved.size === 0;
        est.status = noneApproved && allDecided ? 'REJECTED' : allDecided ? 'APPROVED' : 'PARTIALLY_APPROVED';
        if (est.jobId) {
          const job = getJob(db, est.jobId);
          if (job && est.status === 'APPROVED') { job.status = 'APPROVED'; job.customerUpdates = job.customerUpdates || []; job.customerUpdates.push({at:now,text:`Customer approved ${checked.length} item(s) on ${est.ref}. Approved work can be scheduled.`,by:'Gear Go Automobiles'}); }
        }
        if (est.status === 'REJECTED') {
          releaseReservationsForEstimate(est.id, 'Estimate declined by customer');
          if (est.jobId) reconcileJobParts(est.jobId);
        } else reserveEstimateLines(est);
        audit(db, decision === 'approve' ? 'approval.approved' : 'approval.declined', 'estimate', est.id, `Customer ${decision === 'approve' ? 'approved' : 'declined'} ${checked.length} line(s) on ${est.ref}`, {reason});
        db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`Customer ${decision === 'approve' ? 'approved' : 'declined'} ${checked.length} line(s) on ${est.ref}.`,href:`/ops/estimates/${est.id}`});
        persist('Customer decision recorded', 'success', {title:'Decision saved'});
        render();
      }
    });
  },
  'portal.approval.clarify': (el) => {
    const est = portalOwned(db.estimates, el.dataset.id);
    if (!est) return;
    openModal({
      title:'Ask the garage a question', size:'sm',
      body:`<p class="small muted mb-3">This is recorded on the estimate. No real message is sent.</p><form data-form="portal.clarify" data-id="${est.id}"><div class="field"><label>Your question</label><textarea class="textarea" name="comment" required maxlength="500" placeholder="e.g. Is the alignment check included only if needed?"></textarea></div><button class="btn btn-dark btn-sm mt-4" type="submit">Record question</button></form>`
    });
  },
  'portal.booking.cancel': (el) => {
    const b = portalOwned(db.bookings, el.dataset.id);
    if (!b) return;
    confirmDialog({title:'Cancel this request?',message:`Booking <strong>${esc(b.ref)}</strong> will be marked cancelled in the demo. This does not contact the garage in real life.`,confirmLabel:'Cancel booking',danger:true,requireReason:true,reasonLabel:'Why are you cancelling?',onConfirm:async (reason) => {
      b.status = 'cancelled'; b.updatedAt = new Date().toISOString(); b.history = b.history || []; b.history.push({at:b.updatedAt,label:'Cancelled by customer',detail:reason});
      audit(db,'booking.cancelled','booking',b.id,`Customer cancelled booking ${b.ref}`,{reason});
      db.notifications.unshift({id:uid('ntf'),read:false,at:new Date().toISOString(),text:`Booking ${b.ref} was cancelled by the customer.`,href:`/ops/bookings/${b.id}`});
      persist('Booking cancelled', 'success'); render();
    }});
  },
  'portal.booking.reschedule': (el) => {
    const b = portalOwned(db.bookings, el.dataset.id);
    if (!b) return;
    openModal({title:`Request a reschedule · ${esc(b.ref)}`,size:'sm',body:`<p class="small muted mb-3">The garage still needs to confirm availability. This is a request, not a guarantee.</p><form data-form="portal.reschedule" data-id="${b.id}"><div class="field"><label>Requested date</label><input class="input" type="date" name="date" min="${todayKey()}" value="${b.date}" required></div><div class="field mt-3"><label>Preferred time</label><select class="select" name="slot">${slotsForDate(db,b.date).map(s=>`<option value="${s.value}" ${b.slot===s.value?'selected':''}>${s.label}</option>`).join('')}</select></div><div class="field mt-3"><label>Note</label><textarea class="textarea" name="note" maxlength="300"></textarea></div><button class="btn btn-dark btn-sm mt-4" type="submit">Send demo request</button></form>`});
  },
  'portal.payment.instructions': () => {
    openModal({title:'Payment instructions · demo only',body:`<div class="message-bubble">This prototype does not accept payments and does not provide bank details. Recorded payments are entered manually by garage staff for demonstration only. Never transfer money based on this screen.</div>`,footer:`<button class="btn btn-dark" data-action="modal.close">Understood</button>`});
  },
  'portal.delete.request': () => {
    confirmDialog({title:'Request data deletion?',message:'This creates a simulated deletion request for the demo. Nothing is deleted automatically. Use Demo controls to reset all local data.',confirmLabel:'Record request',requireReason:false,onConfirm:async () => {
      const c = currentCustomer(db); audit(db,'privacy.deletion_requested','customer',c?.id,`Customer ${c?.name} requested demo data deletion`); db.notifications.unshift({id:uid('ntf'),read:false,at:new Date().toISOString(),text:`Privacy deletion request recorded for ${c?.name}.`,href:'/demo'}); persist('Deletion request recorded', 'success'); closeModal();
    }});
  },
  'portal.export': () => {
    const c = currentCustomer(db); if (!c) return;
    const data = {customer:c, vehicles:customerVehicles(db,c.id), bookings:customerBookings(db,c.id), jobs:customerJobs(db,c.id), estimates:db.estimates.filter(e=>e.customerId===c.id), invoices:customerInvoices(db,c.id), reminders:db.reminders.filter(r=>r.customerId===c.id), feedback:db.feedback.filter(f=>f.customerId===c.id)};
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`geargo-demo-${c.ref}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),400);
    toast('Export ready','Your local demo data was exported as JSON.');
  },
  'ops.booking.confirm': (el) => {
    if (!requirePermission('bookings.manage')) return;
    const b = getBooking(db, el.dataset.id); if (!b) return;
    const cap = slotCapacity(db,b.date,b.slot);
    if (cap.booked >= cap.capacity && b.status !== 'confirmed') return toast('Slot is full','This slot is at demo capacity. Reschedule the request or record a rejection.', 'error');
    confirmDialog({title:`Confirm ${b.ref}?`,message:`The customer requested <strong>${fmtDateKey(b.date)} at ${fmtTime(b.slot)}</strong>. Confirming records the appointment in this demo and does not send a real message.`,confirmLabel:'Confirm booking',onConfirm:async () => {
      b.status='confirmed'; b.updatedAt=new Date().toISOString(); b.history=b.history||[]; b.history.push({at:b.updatedAt,label:'Confirmed by front desk',detail:'Slot capacity checked in demo'});
      db.communications.unshift({id:uid('com'),type:'booking_confirmation',entityType:'booking',entityId:b.id,customerId:b.customerId,channel:getCustomer(db,b.customerId)?.channel||'whatsapp',recipient:getCustomer(db,b.customerId)?.mobile,subject:'Your appointment is confirmed',body:`Demo confirmation for ${b.ref} on ${fmtDateKey(b.date)} at ${fmtTime(b.slot)}. No real message was sent.`,status:'delivered',simulated:true,at:new Date().toISOString(),by:db.session.staffId});
      audit(db,'booking.confirmed','booking',b.id,`Booking ${b.ref} confirmed`); persist('Booking confirmed','success'); render();
    }});
  },
  'ops.booking.cancel': (el) => {
    if (!requirePermission('bookings.manage')) return;
    const b = getBooking(db, el.dataset.id); if (!b) return;
    confirmDialog({title:'Cancel booking?',message:`Booking <strong>${esc(b.ref)}</strong> will be cancelled. Record a reason for the audit history.`,confirmLabel:'Cancel booking',danger:true,requireReason:true,onConfirm:async (reason) => {
      b.status='cancelled'; b.updatedAt=new Date().toISOString(); audit(db,'booking.cancelled','booking',b.id,`Booking ${b.ref} cancelled by staff`,{reason}); persist('Booking cancelled','success'); render();
    }});
  },
  'ops.booking.reschedule': (el) => {
    if (!requirePermission('bookings.manage')) return;
    const b = getBooking(db, el.dataset.id); if (!b) return;
    openModal({title:`Reschedule ${esc(b.ref)}`,size:'sm',body:`<form data-form="ops.booking.reschedule" data-id="${b.id}"><div class="field"><label>New date</label><input class="input" type="date" name="date" min="${todayKey()}" value="${b.date}" required></div><div class="field mt-3"><label>New time</label><input class="input" type="time" name="slot" value="${b.slot}" required></div><div class="field mt-3"><label>Reason</label><textarea class="textarea" name="reason" required maxlength="300"></textarea></div><p class="tiny muted mt-3">Capacity is re-checked when saved. This is a demo reschedule; no message is sent.</p><button class="btn btn-dark btn-sm mt-4" type="submit">Save reschedule</button></form>`});
  },
  'ops.booking.checkin': (el) => {
    if (!requirePermission('bookings.manage') && !requirePermission('job_cards.create')) return;
    const b = getBooking(db, el.dataset.id); if (!b) return;
    const v = getVehicle(db,b.vehicleId);
    openModal({title:`Check in · ${esc(b.ref)}`,size:'md',body:`<p class="small muted mb-3">Creates a job card and a blank inspection checklist. Odometer and handover details are recorded for the demo.</p><form data-form="ops.booking.checkin" data-id="${b.id}"><div class="form-grid"><div class="field"><label>Odometer (km) *</label><input class="input" type="number" name="odometer" min="0" max="999999" value="${v?.odometer||''}" required></div><div class="field"><label>Fuel level</label><select class="select" name="fuel">${['25%','50%','75%','100%'].map(f=>`<option>${f}</option>`).join('')}</select></div><div class="field full"><label>Keys received</label><input class="input" name="keys" value="1 key received" maxlength="80"></div><div class="field full"><label>Exterior condition</label><textarea class="textarea" name="exterior" maxlength="300" placeholder="Existing damage, cleanliness, accessories…"></textarea></div><div class="field full"><label>Internal note</label><textarea class="textarea" name="note" maxlength="300"></textarea></div></div><button class="btn btn-dark mt-4" type="submit">Create job card</button></form>`});
  },
  'ops.booking.new': () => {
    if (!requirePermission('bookings.manage')) return;
    openModal({title:'New booking request',size:'md',body:`<form data-form="ops.booking.new"><div class="form-grid"><div class="field full"><label>Customer *</label><select class="select" name="customerId" required>${db.customers.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.mobile)}</option>`).join('')}</select></div><div class="field full"><label>Vehicle *</label><select class="select" name="vehicleId" required>${db.vehicles.map(v=>`<option value="${v.id}">${esc(fmtReg(v.reg))} · ${esc(v.make)} ${esc(v.model)}</option>`).join('')}</select></div><div class="field"><label>Date *</label><input class="input" type="date" name="date" min="${todayKey()}" value="${availableBookingDates(db,10)[0]||''}" required></div><div class="field"><label>Time *</label><input class="input" type="time" name="slot" value="10:00" required></div><div class="field full"><label>Services *</label><select class="select" name="services" multiple size="4" required>${db.settings.services.filter(s=>s.enabled).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="field full"><label>Notes</label><textarea class="textarea" name="notes" maxlength="300"></textarea></div></div><button class="btn btn-dark mt-4" type="submit">Create request</button></form>`});
  },
  'ops.job.status': (el) => {
    const job = getJob(db, el.dataset.id); if (!job) return;
    const target = el.dataset.status;
    const isTech = db.session.kind === 'staff' && currentStaff(db)?.role === 'technician';
    const isRelease = target === 'READY_FOR_COLLECTION' || target === 'DELIVERED';
    if (isRelease && !can('delivery.manage', db) && !can('collection.manage', db)) return denyAccess('delivery.manage');
    if (!requirePermission(isTech ? 'assigned_jobs.view' : 'job_cards.view')) return;
    if (isTech && !(job.techIds || []).includes(db.session.staffId)) return denyAccess('assigned_jobs.view');
    const ests = jobEstimates(db,job.id);
    const auth = ests.some(e => approvedLineIds(e).size > 0);
    if (['IN_PROGRESS','APPROVED'].includes(target) && ests.length && !auth) return toast('Customer approval required','No estimate on this job is approved. Record the customer decision before starting paid work.', 'error');
    if (target === 'WORK_COMPLETED' && job.status === 'QUALITY_CHECK' && !(job.qualityChecks||[]).some(q => q.result === 'pass')) return toast('Record the QC result','A passing quality check is required before work can be marked complete.', 'info');
    const apply = (reason='') => {
      const inv = jobInvoice(db,job);
      const bal = inv ? invoiceTotals(inv,db).balance : 0;
      if (isRelease && bal > 0.49 && !reason) {
        toast('Payment blocks release','Record a payment or use Release vehicle with an authorised override.', 'error');
        return false;
      }
      const before = job.status;
      if (target === 'CANCELLED') releaseReservationsForJob(job.id, 'Job cancelled');
      if (target === 'WORK_COMPLETED' || target === 'DELIVERED') consumeReservationsForJob(job, null, `Job ${jobStageLabel(target).toLowerCase()}`);
      job.status = target;
      if (target === 'WORK_COMPLETED') job.actualCompletedAt = new Date().toISOString();
      if (target === 'DELIVERED') job.deliveredAt = job.actualCompletedAt = new Date().toISOString();
      addCustomerUpdate(job, `Status updated to ${jobStageLabel(target)}.`);
      audit(db,'job.status_changed','job',job.id,`${job.number} moved from ${before} to ${target}`,{reason,before:{status:before},after:{status:target}});
      db.notifications.unshift({id:uid('ntf'),read:false,at:new Date().toISOString(),text:`${job.number} is now ${jobStageLabel(target)}.`,href:`/ops/jobs/${job.id}`});
      persist('Job status updated','success');
      render();
      return true;
    };
    if (isRelease) {
      confirmDialog({title:`Move ${esc(job.number)} to ${esc(jobStageLabel(target))}?`,message:'This updates the customer-visible tracker in the demo. Release still checks the invoice balance and permissions.',confirmLabel:'Update job',onConfirm:async (reason)=>{ const ok = apply(reason); if (ok === false) return; }});
    } else apply();
  },
  'ops.job.assign': (el) => {
    if (!requirePermission('job_cards.assign')) return;
    const job = getJob(db,el.dataset.id); if (!job) return;
    openModal({title:`Assign ${esc(job.number)}`,size:'sm',body:`<form data-form="ops.job.assign" data-id="${job.id}"><p class="small muted mb-3">Only active technicians can be assigned in this demo.</p>${db.staff.filter(s=>s.role==='technician'&&s.active).map(s=>`<label class="check mb-2"><input type="checkbox" name="tech" value="${s.id}" ${(job.techIds||[]).includes(s.id)?'checked':''}> ${esc(s.name)} · ${esc(s.title)}</label>`).join('')}<div class="field mt-3"><label>Expected completion</label><input class="input" type="datetime-local" name="expectedAt" value="${job.expectedAt?job.expectedAt.slice(0,16):''}"></div><button class="btn btn-dark btn-sm mt-4" type="submit">Save assignment</button></form>`});
  },
  'ops.job.delay': (el) => {
    if (!requirePermission('job_cards.view')) return;
    const job = getJob(db,el.dataset.id); if (!job) return;
    openModal({title:`Update ETA · ${esc(job.number)}`,size:'sm',body:`<form data-form="ops.job.delay" data-id="${job.id}"><div class="field"><label>New expected completion</label><input class="input" type="datetime-local" name="expectedAt" required value="${job.expectedAt?job.expectedAt.slice(0,16):''}"></div><div class="field mt-3"><label>Reason</label><textarea class="textarea" name="reason" required maxlength="300" placeholder="e.g. Awaiting part delivery"></textarea></div><button class="btn btn-dark btn-sm mt-4" type="submit">Update ETA</button></form>`});
  },
  'ops.job.new': () => {
    if (!requirePermission('job_cards.create')) return;
    openModal({title:'Check in a vehicle',size:'md',body:`<form data-form="ops.job.new"><div class="form-grid"><div class="field full"><label>Customer *</label><select class="select" name="customerId" required>${db.customers.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.mobile)}</option>`).join('')}</select></div><div class="field full"><label>Vehicle *</label><select class="select" name="vehicleId" required>${db.vehicles.map(v=>`<option value="${v.id}">${esc(fmtReg(v.reg))} · ${esc(v.make)} ${esc(v.model)}</option>`).join('')}</select></div><div class="field"><label>Odometer *</label><input class="input" type="number" name="odometer" min="0" required></div><div class="field"><label>Fuel</label><select class="select" name="fuel">${['25%','50%','75%','100%'].map(f=>`<option>${f}</option>`).join('')}</select></div><div class="field full"><label>Concerns</label><textarea class="textarea" name="concerns" maxlength="300" placeholder="Customer-reported concerns, one per line"></textarea></div><div class="field full"><label>Internal note</label><textarea class="textarea" name="note" maxlength="300"></textarea></div></div><button class="btn btn-dark mt-4" type="submit">Create job + inspection</button></form>`});
  },
  'ops.delivery.open': (el) => {
    if (!requirePermission('delivery.manage') && !requirePermission('collection.manage')) return;
    const job = getJob(db,el.dataset.id); if (!job) return;
    const inv = jobInvoice(db,job); const t = inv ? invoiceTotals(inv,db) : null;
    openModal({title:`Release vehicle · ${esc(job.number)}`,size:'sm',body:`<div class="alert-strip ${t&&t.balance>0.49?'warn':'success'}">${icon(t&&t.balance>0.49?'alert':'check')}<div class="grow"><strong>${t?`Invoice balance: ${fmtINR(t.balance)}`:'No invoice attached'}</strong><br>${t&&t.balance>0.49?'Collection policy requires settlement or an authorised override with a reason.':`Collect the balance in the demo if needed, then record handover.`}</div></div><p class="small muted mb-4">This records a simulated handover. No real payment or message is sent.</p><form data-form="ops.delivery" data-id="${job.id}">${t&&t.balance>0.49?`<div class="field"><label>Override reason *</label><textarea class="textarea" name="reason" required maxlength="400" placeholder="Manager approval and follow-up plan"></textarea></div>`:''}<label class="check mt-3"><input type="checkbox" name="confirm" required> I confirm the demo handover and that this is not a real vehicle release. *</label><button class="btn btn-dark btn-sm mt-4" type="submit">Record handover</button></form>`});
  },
  'ops.task.toggle': (el) => {
    if (!requirePermission('tasks.manage')) return;
    const job = getJob(db, el.dataset.job); if (!job) return;
    if (!isAssignedTechnician(job)) return denyAccess('assigned_jobs.view');
    const task = (job.tasks||[]).find(t=>t.id===el.dataset.task); if (!task) return;
    const wasCompleted = task.status === 'completed';
    if (!el.checked && wasCompleted) {
      if (['DELIVERED','CANCELLED'].includes(job.status)) {
        el.checked = true;
        return toast('Cannot reopen task','Stock has already been settled for a delivered or cancelled job.', 'error');
      }
      restoreConsumedForTask(job, task.id, `Task reopened: ${task.title}`);
    }
    task.status = el.checked ? 'completed' : 'pending';
    task.completedAt = el.checked ? new Date().toISOString() : null;
    task.completedBy = el.checked ? db.session.staffId : null;
    if (el.checked) {
      const linkedPartId = task.partId || (task.estimateLineId ? db.estimates.flatMap(e => e.lines || []).find(l => l.id === task.estimateLineId)?.partId : null);
      if (linkedPartId) consumeReservationsForJob(job, linkedPartId, `Task completed: ${task.title}`, task.id);
    }
    audit(db,'task.updated','job',job.id,`Task “${task.title}” marked ${task.status} on ${job.number}`); persist('Task updated','success'); render();
  },
  'ops.task.new': (el) => {
    if (!requirePermission('tasks.manage')) return;
    const job = getJob(db,el.dataset.job); if (!job) return;
    if (!isAssignedTechnician(job)) return denyAccess('assigned_jobs.view');
    openModal({title:`Add task · ${esc(job.number)}`,size:'sm',body:`<form data-form="ops.task.new" data-id="${job.id}"><div class="field"><label>Task title *</label><input class="input" name="title" required maxlength="120"></div><div class="field mt-3"><label>Assign to</label><select class="select" name="assigneeId"><option value="">Unassigned</option>${db.staff.filter(s=>s.role==='technician'&&s.active).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="field mt-3"><label>Estimated minutes</label><input class="input" type="number" name="minutes" min="0" max="600"></div><div class="field mt-3"><label>Note</label><textarea class="textarea" name="note" maxlength="200"></textarea></div><button class="btn btn-dark btn-sm mt-4" type="submit">Add task</button></form>`});
  },
  'ops.inspection.complete': (el) => {
    if (!requirePermission('inspections.manage')) return;
    const job = getJob(db,el.dataset.job); const insp = getInspection(db,el.dataset.id); if (!job || !insp) return;
    if (!isAssignedTechnician(job)) return denyAccess('assigned_jobs.view');
    const result = saveInspectionForm(el.closest('form'), inspir => { inspir.status='completed'; inspir.completedAt=new Date().toISOString(); inspir.completedBy=db.session.staffId; });
    if (!result.ok) return;
    audit(db,'inspection.completed','job',job.id,`Inspection completed for ${job.number}`);
    if (!['ESTIMATE_PREPARATION','AWAITING_APPROVAL','APPROVED','IN_PROGRESS','AWAITING_PARTS','QUALITY_CHECK','WORK_COMPLETED','READY_FOR_COLLECTION','DELIVERED'].includes(job.status)) job.status='ESTIMATE_PREPARATION';
    persist('Inspection completed','success'); render();
  },
  'ops.estimate.new': (el) => { if (!requirePermission('estimates.create')) return; go(`/ops/estimates/new?job=${el.dataset.job}`); },
  'ops.estimate.supplementary': (el) => { if (!requirePermission('estimates.create')) return; const e=getEstimate(db,el.dataset.id); if(e) go(`/ops/estimates/new?job=${e.jobId}&kind=supplementary`); },
  'ops.estimate.addLine': () => {
    if (!requirePermission('estimates.create')) return;
    const d = db.ui.estimateDraft; if (!d) return;
    syncEstimateDraftFromForm();
    d.lines.push({id:uid('el'),type:'Labour',description:'',category:'Labour',qty:1,unit:'item',unitPrice:0,discountPct:0,taxRate:null,partId:null});
    saveDB({silent:true}); render();
  },
  'ops.estimate.removeLine': (el) => {
    if (!requirePermission('estimates.create')) return;
    syncEstimateDraftFromForm();
    if (db.ui.estimateDraft.lines.length <= 1) return toast('Keep one line','An estimate needs at least one line item.', 'info');
    db.ui.estimateDraft.lines.splice(Number(el.dataset.index),1); saveDB({silent:true}); render();
  },
  'ops.estimate.saveDraft': () => saveEstimate(false),
  'ops.estimate.saveSend': () => saveEstimate(true),
  'ops.estimate.send': (el) => {
    if (!requirePermission('estimates.send')) return;
    const est = getEstimate(db,el.dataset.id); if (!est) return;
    est.status='SENT'; est.sentAt=new Date().toISOString();
    supersedePriorEstimates(est);
    const job = getJob(db,est.jobId); if (job) setJobAwaitingApproval(job,est);
    db.communications.unshift({id:uid('com'),type:est.kind==='supplementary'?'additional_work':'estimate_ready',entityType:'estimate',entityId:est.id,customerId:est.customerId,channel:getCustomer(db,est.customerId)?.channel||'whatsapp',recipient:getCustomer(db,est.customerId)?.mobile,subject:'Estimate ready for your approval',body:`Demo estimate ${est.ref} is ready. No paid work starts until the customer approves it. No real message was sent.`,status:'delivered',simulated:true,at:new Date().toISOString(),by:db.session.staffId});
    audit(db,'estimate.sent','estimate',est.id,`Estimate ${est.ref} sent to customer`); persist('Estimate sent','success'); render();
  },
  'ops.estimate.remind': (el) => {
    if (!requirePermission('estimates.send')) return;
    const est = getEstimate(db,el.dataset.id); if (!est) return;
    db.communications.unshift({id:uid('com'),type:'approval_reminder',entityType:'estimate',entityId:est.id,customerId:est.customerId,channel:getCustomer(db,est.customerId)?.channel||'sms',recipient:getCustomer(db,est.customerId)?.mobile,subject:'A decision is needed on your estimate',body:`Simulated reminder for ${est.ref}.`,status:'queued',simulated:true,at:new Date().toISOString(),by:db.session.staffId});
    audit(db,'estimate.reminder','estimate',est.id,`Reminder queued for ${est.ref}`); persist('Reminder queued','success'); render();
  },
  'ops.invoice.fromJob': (el) => {
    if (!requirePermission('invoices.create')) return;
    const job = getJob(db,el.dataset.id); if (!job) return;
    if (jobInvoice(db,job)) return toast('Invoice exists','This job already has an active invoice.', 'info');
    const approved = [];
    let sourceEstimate = null;
    jobEstimates(db,job.id).forEach(est => {
      const ids = approvedLineIds(est);
      if (!ids.size) return;
      sourceEstimate = sourceEstimate || est;
      est.lines.forEach(l => { if (ids.has(l.id)) approved.push({...l}); });
    });
    if (!approved.length) return toast('No approved work','There are no customer-approved lines to invoice.', 'error');
    const inv = {id:uid('inv'),ref:invoiceNumber(db),jobId:job.id,customerId:job.customerId,vehicleId:job.vehicleId,estimateId:sourceEstimate?.id||null,date:todayKey(),dueDate:addDays(todayKey(),7),lines:approved,discount:0,status:'ISSUED',notes:'Generated from approved estimate lines in the demo.',terms:db.settings.approval.collectionPolicy,createdBy:db.session.staffId,payments:[],voidReason:null,createdAt:new Date().toISOString()};
    ++db.settings.numbering.invoice; db.invoices.unshift(inv); job.invoiceId=inv.id;
    audit(db,'invoice.created','invoice',inv.id,`Invoice ${inv.ref} created from approved work on ${job.number}`);
    db.communications.unshift({id:uid('com'),type:'completion',entityType:'invoice',entityId:inv.id,customerId:inv.customerId,channel:getCustomer(db,inv.customerId)?.channel||'whatsapp',recipient:getCustomer(db,inv.customerId)?.mobile,subject:'Invoice available in your portal',body:`Demo invoice ${inv.ref} has been issued. No real message was sent.`,status:'queued',simulated:true,at:new Date().toISOString(),by:db.session.staffId});
    persist('Invoice created','success'); go(`/ops/invoices/${inv.id}`);
  },
  'ops.invoice.new': () => {
    if (!requirePermission('invoices.create')) return;
    openModal({title:'New demo invoice',size:'md',body:`<form data-form="ops.invoice.new"><div class="form-grid"><div class="field"><label>Customer *</label><select class="select" name="customerId" required>${db.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Vehicle *</label><select class="select" name="vehicleId" required>${db.vehicles.map(v=>`<option value="${v.id}">${esc(fmtReg(v.reg))} · ${esc(v.make)} ${esc(v.model)}</option>`).join('')}</select></div><div class="field full"><label>Description *</label><input class="input" name="description" required maxlength="140"></div><div class="field"><label>Quantity *</label><input class="input" type="number" name="qty" min="0.01" step="0.01" value="1" required></div><div class="field"><label>Unit price ₹ *</label><input class="input" type="number" name="unitPrice" min="0" step="0.01" required></div><div class="field"><label>Due date</label><input class="input" type="date" name="dueDate" value="${addDays(todayKey(),7)}"></div><div class="field"><label>Type</label><select class="select" name="type">${['Service','Labour','Part','Consumable','Other'].map(x=>`<option>${x}</option>`).join('')}</select></div></div><button class="btn btn-dark mt-4" type="submit">Create invoice</button></form>`});
  },
  'ops.payment.record': (el) => {
    if (!requirePermission('payments.record')) return;
    const inv = getInvoice(db,el.dataset.id); if (!inv) return;
    const t = invoiceTotals(inv,db);
    openModal({title:`Record demo payment · ${esc(inv.ref)}`,size:'sm',body:`<div class="alert-strip info">${icon('info')}<div class="grow">No money moves. This records a synthetic offline payment for demonstration.</div></div><form data-form="ops.payment.record" data-id="${inv.id}"><div class="field"><label>Amount ₹ *</label><input class="input" type="number" name="amount" min="1" step="0.01" max="${t.balance}" value="${t.balance}" required></div><div class="field mt-3"><label>Method *</label><select class="select" name="method">${Object.entries(PAYMENT_METHODS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div class="field mt-3"><label>Reference / note</label><input class="input" name="reference" maxlength="60" placeholder="Synthetic reference"></div><div class="field mt-3"><label>Notes</label><textarea class="textarea" name="notes" maxlength="300">Demo payment recorded offline.</textarea></div><button class="btn btn-dark btn-sm mt-4" type="submit">Record payment</button></form>`});
  },
  'ops.payment.reverse': (el) => {
    if (!requirePermission('payments.record')) return;
    const inv = getInvoice(db,el.dataset.id); if (!inv) return;
    const p = (inv.payments||[]).find(x=>x.id===el.dataset.payment); if (!p) return;
    confirmDialog({title:'Reverse this demo payment?',message:`The recorded payment of <strong>${fmtINR(p.amount)}</strong> will remain in history but stop counting toward the balance.`,confirmLabel:'Reverse payment',danger:true,requireReason:true,onConfirm:async (reason) => {
      p.reversed=true; p.reversedAt=new Date().toISOString(); p.reversedBy=db.session.staffId; p.reverseReason=reason;
      audit(db,'payment.reversed','invoice',inv.id,`Payment ${p.id} reversed on ${inv.ref}`,{reason}); persist('Payment reversed','success'); render();
    }});
  },
  'ops.invoice.void': (el) => {
    if (!requirePermission('invoices.create')) return;
    const inv = getInvoice(db,el.dataset.id); if (!inv) return;
    confirmDialog({title:`Void ${esc(inv.ref)}?`,message:'Voiding hides the invoice from balances but preserves the record. This cannot be undone in the demo.',confirmLabel:'Void invoice',danger:true,requireReason:true,onConfirm:async (reason) => {
      inv.status='VOID'; inv.voidReason=reason; audit(db,'invoice.voided','invoice',inv.id,`Invoice ${inv.ref} voided`,{reason}); persist('Invoice voided','success'); render();
    }});
  },
  'ops.communicate': (el) => {
    if (!requirePermission('communications.manage')) return;
    const type = el.dataset.type, id = el.dataset.id;
    openModal({title:'Log simulated message',size:'sm',body:`<p class="small muted mb-3">Nothing is sent. This creates a communication record for the demo.</p><form data-form="ops.communicate" data-entity="${type}" data-id="${id}"><div class="field"><label>Message type</label><select class="select" name="type">${Object.entries(COMMUNICATION_TYPES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div class="field mt-3"><label>Channel</label><select class="select" name="channel">${Object.entries(CHANNEL_LABELS).filter(([k])=>k!=='in_app').map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><div class="field mt-3"><label>Body</label><textarea class="textarea" name="body" maxlength="500" required>Simulated demo message — no real message will be sent.</textarea></div><button class="btn btn-dark btn-sm mt-4" type="submit">Log message</button></form>`});
  },
  'ops.comm.view': (el) => {
    const c = db.communications.find(x=>x.id===el.dataset.id); if (!c) return;
    openModal({title:COMMUNICATION_TYPES[c.type]||'Communication record',body:`<div class="detail-list"><div class="detail-row"><span class="k">To</span><span class="v">${esc(getCustomer(db,c.customerId)?.name||'—')}<br><span class="tiny mono">${esc(c.recipient||'—')}</span></span></div><div class="detail-row"><span class="k">Channel</span><span class="v">${esc(CHANNEL_LABELS[c.channel]||c.channel)}</span></div><div class="detail-row"><span class="k">Status</span><span class="v">${commStatusBadge(c.status)}</span></div><div class="detail-row"><span class="k">When</span><span class="v">${fmtDateTime(c.at)}</span></div></div><h4 style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-top:18px;color:var(--muted)">Subject</h4><p class="small">${esc(c.subject)}</p><div class="message-bubble mt-3">${esc(c.body)}</div>${c.failureReason?`<div class="decision-box mt-3" style="color:var(--red)">${esc(c.failureReason)}</div>`:''}<p class="tiny muted mt-3">Simulated record. No message left the browser.</p>`,footer:`<button class="btn btn-dark" data-action="modal.close">Close</button>`});
  },
  'ops.part.adjust': (el) => {
    if (!requirePermission('inventory.manage')) return;
    const part = getPart(db,el.dataset.id); if (!part) return;
    openModal({title:`Adjust stock · ${esc(part.name)}`,size:'sm',body:`<p class="small muted mb-3">Current stock: <strong>${part.stock}</strong>. Movements are preserved in the demo log.</p><form data-form="ops.part.adjust" data-id="${part.id}"><div class="field"><label>Movement type</label><select class="select" name="type"><option value="receive">Receive stock</option><option value="consume">Consume / fit</option><option value="adjust">Manual adjustment</option></select></div><div class="field mt-3"><label>Quantity change *</label><input class="input" type="number" name="qty" step="1" required placeholder="e.g. 5 or -1"></div><div class="field mt-3"><label>Reason *</label><input class="input" name="reason" required maxlength="120"></div><button class="btn btn-dark btn-sm mt-4" type="submit">Save movement</button></form>`});
  },
  'ops.part.new': () => {
    if (!requirePermission('inventory.manage')) return;
    openModal({title:'Add demo part',size:'md',body:`<form data-form="ops.part.new"><div class="form-grid"><div class="field full"><label>Name *</label><input class="input" name="name" required maxlength="120"></div><div class="field"><label>SKU *</label><input class="input" name="sku" required maxlength="30"></div><div class="field"><label>Category</label><input class="input" name="category" value="General" maxlength="40"></div><div class="field"><label>Supplier</label><input class="input" name="supplier" maxlength="80"></div><div class="field"><label>Cost ₹</label><input class="input" type="number" name="cost" min="0" value="0"></div><div class="field"><label>Price ₹</label><input class="input" type="number" name="price" min="0" value="0"></div><div class="field"><label>Stock</label><input class="input" type="number" name="stock" min="0" value="0"></div><div class="field"><label>Reorder level</label><input class="input" type="number" name="reorder" min="0" value="2"></div><div class="field full"><label>Location</label><input class="input" name="location" maxlength="40"></div></div><button class="btn btn-dark mt-4" type="submit">Add part</button></form>`});
  },
  'ops.service.toggle': (el) => {
    if (!requirePermission('settings.manage')) return;
    const svc = serviceById(db,el.dataset.id); if (!svc) return;
    svc.enabled = !svc.enabled; audit(db,'settings.service_toggled','settings',svc.id,`Service “${svc.name}” ${svc.enabled?'enabled':'disabled'}`); persist('Service updated','success'); render();
  },
  'ops.customer.new': () => {
    if (!requirePermission('customers.create')) return;
    openModal({title:'Add customer',size:'md',body:`<form data-form="ops.customer.new"><div class="form-grid"><div class="field full"><label>Full name *</label><input class="input" name="name" required maxlength="80"></div><div class="field"><label>Mobile *</label><input class="input" name="mobile" required maxlength="15"></div><div class="field"><label>Email</label><input class="input" type="email" name="email" maxlength="120"></div><div class="field"><label>Locality</label><input class="input" name="locality" maxlength="80"></div><div class="field"><label>City</label><input class="input" name="city" value="New Delhi" maxlength="60"></div><div class="field"><label>Channel</label><select class="select" name="channel">${Object.entries(CHANNEL_LABELS).filter(([k])=>['whatsapp','sms','email','phone'].includes(k)).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div></div><label class="check mt-3"><input type="checkbox" name="consent"> Essential service updates consented</label><button class="btn btn-dark mt-4" type="submit">Create customer</button></form>`});
  },
  'ops.customer.edit': (el) => {
    if (!requirePermission('customers.edit')) return;
    const c=getCustomer(db,el.dataset.id); if(!c)return;
    openModal({title:`Edit ${esc(c.name)}`,size:'md',body:`<form data-form="ops.customer.edit" data-id="${c.id}"><div class="form-grid"><div class="field full"><label>Full name *</label><input class="input" name="name" value="${esc(c.name)}" required maxlength="80"></div><div class="field"><label>Mobile *</label><input class="input" name="mobile" value="${esc(c.mobile)}" required maxlength="15"></div><div class="field"><label>Email</label><input class="input" type="email" name="email" value="${esc(c.email||'')}" maxlength="120"></div><div class="field"><label>Locality</label><input class="input" name="locality" value="${esc(c.address?.locality||'')}" maxlength="80"></div><div class="field"><label>City</label><input class="input" name="city" value="${esc(c.address?.city||'')}" maxlength="60"></div><div class="field"><label>Status</label><select class="select" name="status">${['active','inactive'].map(s=>`<option ${c.status===s?'selected':''}>${s}</option>`).join('')}</select></div></div><label class="check mt-3"><input type="checkbox" name="service" ${c.consents?.service?'checked':''}> Essential service updates</label><label class="check mt-2"><input type="checkbox" name="marketing" ${c.consents?.marketing?'checked':''}> Marketing consent</label><div class="field mt-3"><label>Notes</label><textarea class="textarea" name="notes" maxlength="400">${esc(c.notes||'')}</textarea></div><button class="btn btn-dark mt-4" type="submit">Save customer</button></form>`});
  },
  'ops.vehicle.new': () => {
    if (!requirePermission('vehicles.edit')) return;
    openModal({title:'Add vehicle',size:'md',body:`<form data-form="ops.vehicle.new"><div class="form-grid"><div class="field full"><label>Owner *</label><select class="select" name="customerId" required>${db.customers.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.mobile)}</option>`).join('')}</select></div><div class="field"><label>Registration *</label><input class="input" name="reg" required maxlength="16"></div><div class="field"><label>Make *</label><input class="input" name="make" required maxlength="40"></div><div class="field"><label>Model *</label><input class="input" name="model" required maxlength="40"></div><div class="field"><label>Variant</label><input class="input" name="variant" maxlength="30"></div><div class="field"><label>Year *</label><input class="input" type="number" name="year" min="1990" max="${new Date().getFullYear()+1}" required></div><div class="field"><label>Fuel</label><select class="select" name="fuel">${['Petrol','Diesel','CNG','Electric','Hybrid'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Transmission</label><select class="select" name="transmission">${['Manual','Automatic','AMT','CVT','DCT'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Odometer</label><input class="input" type="number" name="odometer" min="0" value="0"></div></div><button class="btn btn-dark mt-4" type="submit">Add vehicle</button></form>`});
  },
  'ops.vehicle.edit': (el) => {
    if (!requirePermission('vehicles.edit')) return;
    const v=getVehicle(db,el.dataset.id); if(!v)return;
    openModal({title:`Edit ${esc(fmtReg(v.reg))}`,size:'md',body:`<form data-form="ops.vehicle.edit" data-id="${v.id}"><div class="form-grid"><div class="field full"><label>Owner</label><select class="select" name="customerId">${db.customers.map(c=>`<option value="${c.id}" ${v.customerId===c.id?'selected':''}>${esc(c.name)} · ${esc(c.mobile)}</option>`).join('')}</select></div><div class="field"><label>Registration *</label><input class="input" name="reg" value="${esc(fmtReg(v.reg))}" required maxlength="16"></div><div class="field"><label>Make *</label><input class="input" name="make" value="${esc(v.make)}" required maxlength="40"></div><div class="field"><label>Model *</label><input class="input" name="model" value="${esc(v.model)}" required maxlength="40"></div><div class="field"><label>Variant</label><input class="input" name="variant" value="${esc(v.variant||'')}" maxlength="30"></div><div class="field"><label>Year</label><input class="input" type="number" name="year" value="${v.year}" min="1990" max="${new Date().getFullYear()+1}"></div><div class="field"><label>Odometer</label><input class="input" type="number" name="odometer" value="${v.odometer}" min="0"></div><div class="field"><label>Status</label><select class="select" name="status">${['active','inactive'].map(s=>`<option ${v.status===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field full"><label>Notes</label><textarea class="textarea" name="notes" maxlength="400">${esc(v.notes||'')}</textarea></div></div><button class="btn btn-dark mt-4" type="submit">Save vehicle</button></form>`});
  },
  'ops.staff.new': () => {
    if (!requirePermission('settings.manage')) return;
    openModal({title:'Add staff member',size:'sm',body:`<form data-form="ops.staff.new"><div class="field"><label>Name *</label><input class="input" name="name" required maxlength="80"></div><div class="field mt-3"><label>Role *</label><select class="select" name="role">${Object.entries(ROLE_DEFS).filter(([k])=>k!=='customer').map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select></div><div class="field mt-3"><label>Title</label><input class="input" name="title" maxlength="50"></div><div class="field mt-3"><label>Phone</label><input class="input" name="phone" maxlength="20"></div><div class="field mt-3"><label>Email</label><input class="input" type="email" name="email" maxlength="100"></div><button class="btn btn-dark btn-sm mt-4" type="submit">Add staff</button></form>`});
  },
  'ops.staff.edit': (el) => {
    if (!requirePermission('settings.manage')) return;
    const st=getStaff(db,el.dataset.id); if(!st)return;
    openModal({title:`Edit ${esc(st.name)}`,size:'sm',body:`<form data-form="ops.staff.edit" data-id="${st.id}"><div class="field"><label>Name *</label><input class="input" name="name" value="${esc(st.name)}" required maxlength="80"></div><div class="field mt-3"><label>Role *</label><select class="select" name="role">${Object.entries(ROLE_DEFS).filter(([k])=>k!=='customer').map(([k,v])=>`<option value="${k}" ${st.role===k?'selected':''}>${v.label}</option>`).join('')}</select></div><div class="field mt-3"><label>Title</label><input class="input" name="title" value="${esc(st.title||'')}" maxlength="50"></div><div class="field mt-3"><label>Phone</label><input class="input" name="phone" value="${esc(st.phone||'')}" maxlength="20"></div><button class="btn btn-dark btn-sm mt-4" type="submit">Save staff</button></form>`});
  },
  'ops.staff.toggle': (el) => {
    if (!requirePermission('settings.manage')) return;
    const st=getStaff(db,el.dataset.id); if(!st)return;
    if (st.id === db.session.staffId) return toast('Cannot deactivate yourself','Switch to another owner persona first.', 'error');
    st.active=!st.active; audit(db,'staff.status_changed','staff',st.id,`${st.name} ${st.active?'activated':'deactivated'}`); persist('Staff status updated','success'); render();
  },
  'ops.feedback.publish': (el) => { if(!requirePermission('feedback.manage'))return; const f=db.feedback.find(x=>x.id===el.dataset.id); if(!f)return; if(!f.publicConsent)return toast('No public consent','This customer did not consent to public display.', 'error'); f.status='published'; audit(db,'feedback.published','feedback',f.id,'Feedback published as a demo testimonial'); persist('Feedback published','success'); render(); },
  'ops.feedback.unpublish': (el) => { if(!requirePermission('feedback.manage'))return; const f=db.feedback.find(x=>x.id===el.dataset.id); if(!f)return; f.status='reviewed'; audit(db,'feedback.unpublished','feedback',f.id,'Feedback removed from public display'); persist('Feedback unpublished','success'); render(); },
  'ops.feedback.respond': (el) => { if(!requirePermission('feedback.manage'))return; const f=db.feedback.find(x=>x.id===el.dataset.id); if(!f)return; openModal({title:'Respond to feedback',size:'sm',body:`<form data-form="ops.feedback.respond" data-id="${f.id}"><div class="field"><label>Public demo response</label><textarea class="textarea" name="response" required maxlength="500">${esc(f.response||'')}</textarea></div><button class="btn btn-dark btn-sm mt-4" type="submit">Save response</button></form>`}); },
  'ops.reminder.new': () => {
    if(!requirePermission('reminders.manage'))return;
    openModal({title:'Create service reminder',size:'sm',body:`<form data-form="ops.reminder.new"><div class="field"><label>Customer *</label><select class="select" name="customerId" required>${db.customers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field mt-3"><label>Vehicle *</label><select class="select" name="vehicleId" required>${db.vehicles.map(v=>`<option value="${v.id}">${esc(fmtReg(v.reg))} · ${esc(v.make)} ${esc(v.model)}</option>`).join('')}</select></div><div class="field mt-3"><label>Due date</label><input class="input" type="date" name="dueDate" value="${addDays(todayKey(),14)}"></div><div class="field mt-3"><label>Reason</label><textarea class="textarea" name="reason" maxlength="300" required></textarea></div><button class="btn btn-dark btn-sm mt-4" type="submit">Create reminder</button></form>`});
  },
  'ops.reminder.send': (el) => {
    if(!requirePermission('reminders.manage'))return;
    const r=db.reminders.find(x=>x.id===el.dataset.id); if(!r)return;
    r.status='sent'; r.sentAt=new Date().toISOString();
    db.communications.unshift({id:uid('com'),type:'service_reminder',entityType:'reminder',entityId:r.id,customerId:r.customerId,channel:r.channel,recipient:getCustomer(db,r.customerId)?.mobile,subject:'Service reminder',body:`Simulated reminder: ${r.reason}`,status:'delivered',simulated:true,at:new Date().toISOString(),by:db.session.staffId});
    audit(db,'reminder.sent','reminder',r.id,`Service reminder sent to ${getCustomer(db,r.customerId)?.name} (simulated)`); persist('Reminder marked sent','success'); render();
  },
  'ops.settings.export': () => {
    if(!requirePermission('settings.manage'))return;
    const blob=new Blob([JSON.stringify(db.settings,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='geargo-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),400);toast('Settings exported','Demo configuration downloaded as JSON.');
  },
  'export.settings': () => actions['ops.settings.export'](),
  'export.audit': () => {
    if(!requirePermission('settings.manage'))return;
    makeCSV(db.audit.map(a=>({when:a.at,actor:a.actor,role:a.role,action:a.action,entityType:a.entityType,entityId:a.entityId||'',summary:a.summary,reason:a.reason||''})),'geargo-audit.csv');
  },
  'export.receivables': () => {
    if(!requirePermission('receivables.manage'))return;
    makeCSV(db.invoices.filter(i=>i.status!=='VOID'&&invoiceTotals(i,db).balance>0.49).map(i=>{const t=invoiceTotals(i,db),c=getCustomer(db,i.customerId);return {invoice:i.ref,customer:c?.name||'',mobile:c?.mobile||'',due:i.dueDate,total:t.total,paid:t.paid,balance:t.balance,status:t.status};}),'geargo-receivables.csv');
  },
  'export.reports': () => {
    if(!requirePermission('reports.view'))return;
    makeCSV(db.jobs.map(j=>({job:j.number,status:j.status,customer:getCustomer(db,j.customerId)?.name||'',vehicle:getVehicle(db,j.vehicleId)?.make+' '+(getVehicle(db,j.vehicleId)?.model||''),created:j.createdAt,expected:j.expectedAt||''})),'geargo-jobs.csv');
  },
  'demo.staff': (el) => {
    const st=getStaff(db,el.dataset.id); if(!st)return;
    go(loginPath(st.role==='technician'?'/tech':'/ops', `staff:${st.id}`));
  },
  'demo.customer': (el) => {
    const c=getCustomer(db,el.dataset.id); if(!c)return;
    go(loginPath('/portal', `customer:${c.id}`));
  },
  'demo.reset': () => confirmDialog({title:'Reset the demo?',message:'All local changes will be replaced with fresh synthetic seed data and you will be signed out.',confirmLabel:'Reset demo',danger:true,onConfirm:async()=>{db=normalizeDB(buildSeed());saveDB({silent:true});toast('Demo reset','Fresh synthetic data loaded.');go('/login?next=%2Fdemo');render();}}),
  'demo.clear': () => confirmDialog({title:'Clear all demo data?',message:'The LocalStorage key will be removed and a fresh demo database created. This cannot be undone.',confirmLabel:'Clear and restart',danger:true,onConfirm:async()=>{try{localStorage.removeItem(LS_KEY);}catch(e){}db=normalizeDB(buildSeed());saveDB({silent:true});toast('Demo cleared','A new local demo database was seeded.');go('/login?next=%2Fdemo');render();}}),
  'demo.notify': () => { const now=new Date().toISOString(); db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:'Simulated notification from Demo controls.',href:'/demo'}); persist('Notification created','success'); render(); },
  'demo.seedFailure': () => { const c=db.customers[0]; db.communications.unshift({id:uid('com'),type:'appointment_reminder',entityType:'customer',entityId:c.id,customerId:c.id,channel:'sms',recipient:c.mobile,subject:'Simulated failed reminder',body:'Demo delivery failure record. No real message was attempted.',status:'failed',failureReason:'Simulated delivery failure — demo contact not reachable',simulated:true,at:new Date().toISOString(),by:'system'}); saveDB({silent:true}); toast('Failed message queued','Open Communications to review the simulated failure.','info'); if(currentRoute.path==='/demo') render(); },
  'demo.advance': () => {
    const job=db.jobs.find(j=>!['DELIVERED','CANCELLED','READY_FOR_COLLECTION'].includes(j.status)); if(!job)return toast('Nothing to advance','All active jobs are already complete in the demo.', 'info');
    const order=['CHECKED_IN','INSPECTION_PENDING','INSPECTION_IN_PROGRESS','ESTIMATE_PREPARATION','AWAITING_APPROVAL','IN_PROGRESS','QUALITY_CHECK','WORK_COMPLETED','READY_FOR_COLLECTION'];
    if (['APPROVED','AWAITING_PARTS'].includes(job.status)) { job.status='IN_PROGRESS'; }
    else { const i=order.indexOf(job.status); job.status=order[Math.min(order.length-1,i+1)] || 'IN_PROGRESS'; }
    audit(db,'demo.advanced','job',job.id,`Demo advanced ${job.number} to ${job.status}`); persist(`${job.number} advanced`,'success'); render();
  },
  'demo.export': () => { const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='geargo-full-demo-database.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),400);toast('Database exported','Full local demo database downloaded as JSON.'); },
  'demo.selfTest': () => {
    const tests=[];
    const c=estimateLineCalc({qty:1,unitPrice:100,discountPct:0,taxRate:null},18,true); tests.push(['Line tax calculation',c.total===118,`₹100 at 18% = ${fmtINR(c.total)}`]);
    const c2=estimateLineCalc({qty:2,unitPrice:100,discountPct:10,taxRate:null},18,true); tests.push(['Discount before tax',c2.total===212.40,`2 × ₹100 less 10% + 18% = ${fmtINR(c2.total)}`]);
    const est={status:'PARTIALLY_APPROVED',lines:[{id:'a',qty:1,unitPrice:100},{id:'b',qty:1,unitPrice:300}],decisions:[{decision:'approve',lineIds:['a']}]}; tests.push(['Approved line preservation',approvedLineIds(est).has('a')&&!approvedLineIds(est).has('b'),'Only explicitly approved lines count']);
    const seen=new Map(); let dup=0; db.vehicles.forEach(v=>{const r=normaliseReg(v.reg);if(seen.has(r))dup++;seen.set(r,true);}); tests.push(['No duplicate registrations',dup===0,`${dup} duplicate registration(s) found`]);
    tests.push(['Technician cannot access settings',!([...ROLE_DEFS.technician.perms].includes('*')||ROLE_DEFS.technician.perms.includes('settings.manage')),'Settings are owner-only in this demo']);
    const inv=db.invoices[0]; if(inv){const t=invoiceTotals(inv,db);tests.push(['Invoice totals are computed',Number.isFinite(t.total)&&Number.isFinite(t.balance),`${inv.ref}: total ${fmtINR(t.total)}, balance ${fmtINR(t.balance)}`]);}
    const html=`<div class="timeline">${tests.map(([name,ok,detail])=>`<div class="tl-item ${ok?'done':'active'}"><span class="tl-dot"></span><div class="tl-title">${esc(name)} ${badge(ok?'Pass':'Review',ok?'green':'red',false)}</div><div class="tl-meta">${esc(detail)}</div></div>`).join('')}</div>`;
    const el=document.getElementById('self-test-results'); if(el){el.innerHTML=html;el.scrollIntoView({behavior:'smooth',block:'center'});}else openModal({title:'Self-test results',body:html,footer:`<button class="btn btn-dark" data-action="modal.close">Close</button>`});
    toast('Self-tests complete',`${tests.filter(t=>t[1]).length}/${tests.length} checks passed.`,tests.every(t=>t[1])?'success':'info');
  },
  'demo.tour.start': () => startTour(TOUR_JOURNEY_STEPS, {auto:false}),
  'demo.tour.next': () => tourNext(),
  'demo.tour.skip': () => closeModal(),
  'demo.tour.close': () => closeModal(),
  'demo.whatsapp': () => {
    openShareModal(`https://wa.me/?text=${encodeURIComponent('Gear Go Automobiles (demo) — transparent car care in Aya Nagar. This is a prototype link; no real message is sent.')}`, 'Demo WhatsApp share');
  },
  'ops.qc.new': (el) => {
    if (!can('quality.manage', db) && !can('quality.submit', db)) return denyAccess('quality.manage');
    const job = getJob(db, el.dataset.id);
    if (!job) return;
    if (!isAssignedTechnician(job)) return denyAccess('assigned_jobs.view');
    openModal({title:`Record QC · ${esc(job.number)}`,size:'sm',body:`<form data-form="ops.qc.record" data-id="${job.id}"><div class="field"><label>QC result</label><select class="select" name="result"><option value="pass">Pass</option><option value="fail">Fail · return for rework</option></select></div><div class="field mt-3"><label>Checklist / notes</label><textarea class="textarea" name="notes" maxlength="400" placeholder="e.g. road test, fluid levels, torque check"></textarea></div><p class="tiny muted mt-3">A failed check returns the job to in-progress. Releasing the vehicle remains a separate permissioned step.</p><button class="btn btn-dark btn-sm mt-4" type="submit">Record QC</button></form>`});
  }
});

const TOUR_JOURNEY_STEPS = [
  {title:'Welcome to Gear Go',body:'Gear Go is a transparent car-care demo for Delhi NCR: inspections, estimates, approvals, live tracking, invoices and collection. Everything you see is synthetic.',href:'/site',label:'Open public site'},
  {title:'Book a service',body:'Start on the public site and request a service. A request is not a confirmation and no payment is taken yet.',href:'/book',label:'Open booking'},
  {title:'Confirm and check in',body:'The front desk confirms the slot and checks the vehicle in. This creates a job card and a blank inspection checklist.',href:'/ops/bookings',label:'Open bookings'},
  {title:'Inspect, estimate and approve',body:'The technician records inspection findings and prepares an estimate. Paid work waits for the customer’s explicit approval; declined lines stay declined.',href:'/ops/jobs',label:'Open jobs'},
  {title:'Track and collect',body:'The customer approves selected lines in the portal, the garage completes work and QC, issues an invoice, records a simulated payment and releases the vehicle.',href:'/portal',label:'Open customer portal'}
];

const TOUR_SCREEN_STEPS = {
  site: [
    {title:'Welcome to Gear Go',body:'This is the public Gear Go site — a transparent car-care demo for Delhi NCR. Bookings, service stories and policies live here.'},
    {title:'How a visit unfolds',body:'A customer books, checks in, is inspected, approves estimates, tracks the job, pays an invoice and collects the vehicle.'}
  ],
  book: [
    {title:'Book a service',body:'Request a service as a guest. Pick a capability, date and slot; a request reserves nothing yet and no payment is taken.'}
  ],
  portal: [
    {title:'Approvals live here',body:'This is the customer portal. Estimates appear here for explicit approval; decisions are preserved and nothing is auto-approved.'},
    {title:'Track and documents',body:'Vehicles, jobs, invoices and history are available for the signed-in customer identity.'}
  ],
  ops: [
    {title:'Garage operations console',body:'Front desk, service manager and finance work here: bookings, job cards, approvals, calendar, invoices and receivables.'}
  ],
  'ops.jobs': [
    {title:'Job card',body:'The job card holds vehicle handover, odometer, concerns, tasks, inspection summary, documents, quality checks and customer updates.'}
  ],
  'ops.approvals': [
    {title:'Approval queue',body:'Pending customer decisions. No paid work starts without an explicit approval; releases still check invoice balance and overrides.'}
  ],
  tech: [
    {title:'Mechanic workspace',body:'Technicians see assigned jobs, task completion and QC. A failed QC returns the job to rework before release.'}
  ],
  demo: [
    {title:'Demo controls',body:'Reset, personas, simulation tools, self-tests and the guided tour itself live here. All data is synthetic and local.'}
  ]
};

function tourScreenKey(path) {
  const parts = String(path || '').split('/').filter(Boolean);
  const root = parts[0] || 'site';
  if (['site','book','demo','portal'].includes(root)) return root;
  if (root === 'ops') return parts[1] ? `ops.${parts[1]}` : 'ops';
  if (root === 'tech') return parts[1] ? `tech.${parts[1]}` : 'tech';
  return root;
}

function maybeAutoTour() {
  if (document.querySelector('.modal-backdrop')) return false;
  const key = tourScreenKey(currentRoute.path);
  const seen = (db.ui && db.ui.toursSeen) || {};
  if (seen[key]) return false;
  const steps = TOUR_SCREEN_STEPS[key];
  if (!steps || !steps.length) return false;
  startTour(steps, {auto:true, screenKey:key});
  return true;
}

function startTour(steps, options = {}) {
  tourSteps = Array.isArray(steps) && steps.length ? steps : TOUR_JOURNEY_STEPS;
  tourIndex = 0;
  tourAuto = !!options.auto;
  if (options.auto && options.screenKey) {
    db.ui.toursSeen = {...(db.ui && db.ui.toursSeen) || {}, [options.screenKey]: true};
    saveDB({silent:true});
  }
  tourStepModal();
}

function tourNext() {
  const steps = (tourSteps && tourSteps.length) ? tourSteps : TOUR_JOURNEY_STEPS;
  tourIndex = Math.min(steps.length - 1, tourIndex + 1);
  tourStepModal();
}

function tourStepModal() {
  const steps = (tourSteps && tourSteps.length) ? tourSteps : TOUR_JOURNEY_STEPS;
  const i = Math.max(0, Math.min(tourIndex, steps.length - 1)); const st = steps[i];
  const isAuto = !!tourAuto;
  const isLast = i >= steps.length - 1;
  openModal({
    title: isAuto ? esc(st.title || 'Screen tour') : 'Guided demo tour',
    body: `<div class="badge amber no-dot mb-3">${esc(isAuto ? `Screen tour · first visit · ${i+1} of ${steps.length}` : `Step ${i+1} of ${steps.length}`)}</div><h3 style="font-family:var(--font-display);font-size:22px">${esc(st.title)}</h3><p class="small muted mt-2">${esc(st.body)}</p><div class="inline-note mt-4">${icon('info')}<div>The tour is a guide only. Every screen uses synthetic data and local persistence.</div></div>`,
    footer: isAuto
      ? `<button class="btn btn-outline" data-action="demo.tour.skip">Skip tour</button>${isLast ? `<button class="btn btn-dark" data-action="demo.tour.close">Finish</button>` : `<button class="btn btn-dark" data-action="demo.tour.next">Next</button>`}`
      : `${isLast ? '' : `<button class="btn btn-outline" data-action="demo.tour.next">Next step</button>`}<a class="btn btn-dark" href="#${esc(st.href || '/site')}" data-action="modal.close">${esc(st.label || 'Finish tour')}</a>`
  });
}

function syncEstimateDraftFromForm() {
  const d=db.ui.estimateDraft; if(!d) return;
  const form=document.querySelector('[data-form="ops.estimate.save"]'); if(!form) return;
  d.lines.forEach((line,i)=>{
    const get=n=>form.querySelector(`[name="${n}_${i}"]`);
    if(get('description')) line.description=get('description').value.trim();
    if(get('type')) line.type=get('type').value;
    if(get('category')) line.category=get('category').value.trim();
    if(get('qty')) line.qty=Math.max(0.01,Number(get('qty').value)||0);
    if(get('unitPrice')) line.unitPrice=Math.max(0,Number(get('unitPrice').value)||0);
    if(get('discountPct')) line.discountPct=clamp(Number(get('discountPct').value)||0,0,100);
    if(get('partId')) line.partId=get('partId').value||null;
  });
  const notes=form.querySelector('[name="notes"]'); if(notes) d.notes=notes.value.trim();
  const ex=form.querySelector('[name="exclusions"]'); if(ex) d.exclusions=ex.value.trim();
  saveDB({silent:true});
}

function saveEstimate(send) {
  if (!requirePermission('estimates.create')) return;
  const d=db.ui.estimateDraft; if(!d) return;
  syncEstimateDraftFromForm();
  const job=getJob(db,d.jobId); if(!job) return;
  if(!d.lines.length||d.lines.some(l=>!l.description)) return toast('Description required','Every estimate line needs a customer-visible description.', 'error');
  if(d.lines.some(l=>l.qty<=0||l.unitPrice<0)) return toast('Check quantities','Quantities must be positive and prices cannot be negative.', 'error');
  const existing=jobEstimates(db,job.id);
  const prior=existing[existing.length-1];
  const supplementary=d.mode==='supplementary';
  const now=new Date().toISOString();
  const est={id:uid('est'),ref:estimateNumber(db),jobId:job.id,customerId:job.customerId,vehicleId:job.vehicleId,version:supplementary?(prior?.version||0)+1:1,kind:supplementary?'supplementary':'primary',status:send?'SENT':'DRAFT',lines:d.lines.map(l=>({...l})),discount:0,notes:d.notes,exclusions:d.exclusions,validUntil:addDays(todayKey(),Number(document.querySelector('[name="validity"]')?.value)||db.settings.approval.validityDays),sentAt:send?now:null,viewedAt:null,supersededBy:null,parentId:supplementary?prior?.id||null:null,createdAt:now,decisions:[]};
  ++db.settings.numbering.estimate;
  db.estimates.unshift(est);
  job.estimateIds=job.estimateIds||[]; job.estimateIds.push(est.id);
  if(send){ supersedePriorEstimates(est); setJobAwaitingApproval(job,est); }
  else if(['CHECKED_IN','INSPECTION_PENDING','INSPECTION_IN_PROGRESS'].includes(job.status)) job.status='ESTIMATE_PREPARATION';
  if(send){
    db.communications.unshift({id:uid('com'),type:supplementary?'additional_work':'estimate_ready',entityType:'estimate',entityId:est.id,customerId:est.customerId,channel:getCustomer(db,est.customerId)?.channel||'whatsapp',recipient:getCustomer(db,est.customerId)?.mobile,subject:'Estimate ready for your approval',body:`Simulated estimate ${est.ref} is ready. No paid work starts until the customer approves it.`,status:'delivered',simulated:true,at:now,by:db.session.staffId});
  }
  audit(db,send?'estimate.sent':'estimate.created','estimate',est.id,`Estimate ${est.ref} ${send?'sent to customer':'saved as draft'}${supplementary?' (supplementary)':''}`);
  db.ui.estimateDraft=null;
  persist(send?'Estimate sent to customer':'Draft estimate saved','success');
  go(`/ops/estimates/${est.id}`);
}

function saveInspectionForm(form, transform) {
  if(!form) return {ok:false};
  const insp=getInspection(db,form.dataset.inspection); if(!insp) return {ok:false};
  insp.items.forEach(item=>{
    const result=form.querySelector(`[name="result_${item.key}"]`); if(result) item.result=result.value;
    const priority=form.querySelector(`[name="priority_${item.key}"]`); if(priority) item.priority=priority.value;
    const approval=form.querySelector(`[name="approval_${item.key}"]`); if(approval) item.needsApproval=approval.checked;
    const note=form.querySelector(`[name="note_${item.key}"]`); if(note) item.note=note.value.trim();
    const action=form.querySelector(`[name="action_${item.key}"]`); if(action) item.recommendedAction=action.value.trim();
    const internal=form.querySelector(`[name="internal_${item.key}"]`); if(internal) item.internalNote=internal.value.trim();
  });
  insp.updatedAt=new Date().toISOString(); insp.updatedBy=db.session.staffId;
  if(transform) transform(insp);
  saveDB({silent:true});
  return {ok:true};
}

function formFail(form, errors, names = []) {
  const list = (Array.isArray(errors) ? errors : [errors]).filter(Boolean);
  list.slice(0, 3).forEach((message, index) => { if (names[index]) fieldError(form, names[index], message); });
  toast('Check the form', list[0] || 'Some required details are missing.', 'error');
  return false;
}

function formAll(form, name) {
  return new FormData(form).getAll(name).map(value => String(value).trim()).filter(Boolean);
}

function addNotification(text, href) {
  db.notifications.unshift({id:uid('ntf'),read:false,at:new Date().toISOString(),text,href});
}

function addCustomerUpdate(job, text) {
  job.customerUpdates = job.customerUpdates || [];
  job.customerUpdates.push({at:new Date().toISOString(),text,by:db.settings.business.name});
}

function addBookingHistory(booking, label, detail = '') {
  booking.history = booking.history || [];
  booking.history.push({at:new Date().toISOString(),label,detail});
}

function logCommunication({type, entityType, entityId, customerId = null, channel = 'whatsapp', recipient = '', subject = '', body = '', status = 'queued', failureReason = ''}) {
  const record = {
    id:uid('com'), type, entityType, entityId, customerId, channel, recipient,
    subject, body, status, failureReason, simulated:true,
    at:new Date().toISOString(), by:db.session.staffId || 'system'
  };
  db.communications.unshift(record);
  return record;
}

function makeInspectionForJob(job) {
  const now = new Date().toISOString();
  return {
    id:uid('insp'), jobId:job.id, status:'pending', startedAt:null, completedAt:null,
    completedBy:null, createdBy:db.session.staffId, updatedAt:now, createdAt:now,
    items:INSPECTION_TEMPLATE.map(t => ({
      key:t.key, cat:t.cat, label:t.label, result:'not_inspected', note:'', internalNote:'',
      recommendedAction:'', priority:'', needsApproval:false, photo:'', updatedAt:now
    }))
  };
}

function createJob({customerId, vehicleId, odometer, fuel, concerns, note = '', bookingId = null, advisorId = null, keys = '1 key received', exterior = 'Not recorded', interior = 'Not recorded', belongings = 'Not recorded'}) {
  const booking = bookingId ? getBooking(db, bookingId) : null;
  const now = new Date().toISOString();
  const ref = jobNumber(db);
  const job = {
    id:uid('job'), number:ref, ref, bookingId, customerId, vehicleId, status:'CHECKED_IN', priority:'Normal',
    concerns:Array.isArray(concerns) ? concerns : [], services:booking ? [...(booking.services || [])] : [],
    advisorId:advisorId || db.session.staffId || 'st_front', techIds:[], checkInAt:now, expectedAt:null,
    actualCompletedAt:null, odometer:Number(odometer) || 0, fuel:fuel || '',
    condition:{exterior, interior, belongings, keys}, notes:note,
    internalNotes:[], customerUpdates:[], tasks:[], inspectionId:null, estimateIds:[], invoiceId:null,
    qualityChecks:[], delayReason:'', createdAt:now
  };
  ++db.settings.numbering.job;
  const inspection = makeInspectionForJob(job);
  job.inspectionId = inspection.id;
  db.jobs.unshift(job);
  db.inspections.unshift(inspection);
  return job;
}

function communicationCustomer(type, id) {
  if (type === 'customer') return getCustomer(db, id);
  if (type === 'booking') return getCustomer(db, getBooking(db, id)?.customerId);
  if (type === 'job') return getCustomer(db, getJob(db, id)?.customerId);
  if (type === 'estimate') return getCustomer(db, getEstimate(db, id)?.customerId);
  if (type === 'invoice') return getCustomer(db, getInvoice(db, id)?.customerId);
  return null;
}

function applyOpsSearch(form) {
  const values = formValues(form);
  const query = new URLSearchParams(currentRoute.query);
  if (values.q) query.set('q', values.q);
  else query.delete('q');
  const suffix = query.toString();
  go(`${currentRoute.path}${suffix ? `?${suffix}` : ''}`);
}

