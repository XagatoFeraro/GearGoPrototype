/* ==========================================================================
   Gear Go Automobiles — customer portal
   Portal views, approvals, invoices, login screen and sign-in flow.
   ========================================================================== */
'use strict';

function portalApprovals() {
  const customer = currentCustomer(db);
  if (!customer) return [];
  return db.estimates.filter(e => e.customerId === customer.id && ['SENT','VIEWED','PARTIALLY_APPROVED'].includes(e.status)).sort(by('createdAt', 1));
}

function portalOwned(list, id, key = 'customerId') {
  const customer = currentCustomer(db);
  return customer ? list.find(x => x.id === id && x[key] === customer.id) : null;
}

function milestoneTrack(job) {
  const order = [
    ['CHECKED_IN','Checked in','Vehicle and keys received.'],
    ['INSPECTION_PENDING','Inspection','A technician documents the vehicle condition and findings.'],
    ['ESTIMATE_PREPARATION','Estimate','The garage prepares an itemised estimate for your approval.'],
    ['AWAITING_APPROVAL','Approval','Paid work waits for your explicit approval.'],
    ['IN_PROGRESS','Repair in progress','Approved work is being carried out.'],
    ['QUALITY_CHECK','Quality check','A second check before the vehicle is released.'],
    ['WORK_COMPLETED','Work completed','Repair work is complete and the invoice is prepared.'],
    ['READY_FOR_COLLECTION','Ready for collection','The vehicle can be collected during opening hours.'],
    ['DELIVERED','Delivered','Vehicle handed over and the job closed.']
  ];
  const currentIndex = order.findIndex(([s]) => s === job.status);
  const effective = job.status === 'APPROVED' ? order.findIndex(([s]) => s === 'IN_PROGRESS') - 1 : job.status === 'AWAITING_PARTS' ? order.findIndex(([s]) => s === 'IN_PROGRESS') : job.status === 'CANCELLED' || job.status === 'DRAFT' ? -1 : currentIndex;
  return order.map(([status,label,desc], i) => {
    const done = effective > i || (job.status === 'DELIVERED' && i <= order.length - 1);
    const active = effective === i;
    return `<div class="milestone ${done ? 'done' : active ? 'active' : 'pending'}">
      <span class="ms-node">${done ? '✓' : active ? icon('wrench','icon-sm') : i + 1}</span>
      <span class="ms-text"><strong>${label}${active ? ' · now' : ''}</strong><span>${desc}</span>${active && job.status === 'AWAITING_PARTS' ? '<span class="tiny" style="color:var(--amber)">Waiting for a part. The garage will update the expected date.</span>' : ''}</span>
    </div>`;
  }).join('');
}

function jobStageLabel(status) {
  return JOB_STATUS[status]?.label || status;
}

function activeCustomerJob(customerId) {
  return customerJobs(db, customerId).filter(j => !['DELIVERED','CANCELLED'].includes(j.status)).sort(by('createdAt', -1))[0];
}

function portalTracker(job, compact = false) {
  const vehicle = getVehicle(db, job.vehicleId);
  const invoice = jobInvoice(db, job);
  const invTotals = invoice ? invoiceTotals(invoice, db) : null;
  const pending = jobEstimates(db, job.id).find(e => ['SENT','VIEWED','PARTIALLY_APPROVED'].includes(e.status));
  return `<div class="tracker-card">
    <div class="tracker-head">
      <div><h2>${esc(vehicle?.make)} ${esc(vehicle?.model)}</h2><p><span class="mono">${esc(fmtReg(vehicle?.reg))}</span> · ${esc(job.number)}</p></div>
      <div class="text-right">${jobBadge(job.status)}<div class="tiny" style="color:rgba(255,255,255,.45);margin-top:6px">${job.status === 'READY_FOR_COLLECTION' ? 'Ready to collect' : 'Live demo status'}</div></div>
    </div>
    <div class="tracker-body">
      ${pending ? `<div class="alert-strip warn">${icon('shield')}<div class="grow"><strong>Your approval is needed</strong><br>${esc(pending.ref)} · ${fmtINR(estimateTotals(pending, db).total)} total. No additional paid work will start until you decide.</div><a class="btn btn-dark btn-sm" href="#/portal/approvals/${pending.id}">Review</a></div>` : ''}
      ${job.status === 'READY_FOR_COLLECTION' ? `<div class="alert-strip success">${icon('check')}<div class="grow"><strong>Your vehicle is ready.</strong><br>Collection is during configured opening hours.${invTotals && invTotals.balance > 0 ? ` Balance due: ${fmtINR(invTotals.balance)}.` : ''}</div>${invoice ? `<a class="btn btn-dark btn-sm" href="#/portal/invoices/${invoice.id}">View invoice</a>` : ''}</div>` : ''}
      ${compact ? '' : `<div class="milestone-track">${milestoneTrack(job)}</div>`}
      <div class="btn-group mt-4">
        <a class="btn btn-outline btn-sm" href="#/portal/jobs/${job.id}">Job details ${icon('arrow','icon-sm')}</a>
        ${pending ? `<a class="btn btn-dark btn-sm" href="#/portal/approvals/${pending.id}">Review approval</a>` : ''}
        ${invoice ? `<a class="btn btn-outline btn-sm" href="#/portal/invoices/${invoice.id}">Invoice</a>` : ''}
      </div>
    </div>
  </div>`;
}

function portalHomeView() {
  const customer = currentCustomer(db);
  if (!customer) return portalMissingView();
  const vehicles = customerVehicles(db, customer.id);
  const job = activeCustomerJob(customer.id);
  const upcoming = customerBookings(db, customer.id).filter(b => ['new_request','pending_confirmation','confirmed','reschedule_requested','rescheduled'].includes(b.status))[0];
  const pending = portalApprovals();
  const invoices = customerInvoices(db, customer.id).filter(i => i.status !== 'VOID' && invoiceTotals(i, db).balance > 0.49);
  const reminders = db.reminders.filter(r => r.customerId === customer.id && ['pending','scheduled'].includes(r.status));
  return `${pageHead(`Good ${timeOfDayGreeting()}, ${esc(customer.name.split(' ')[0])}`, 'Your garage, your records and every decision in one place.', `<a class="btn btn-dark btn-sm" href="#/book?${vehicles[0] ? 'service=svc_periodic' : ''}">${icon('plus','icon-sm')} Book a service</a>`)}
    <div class="portal-hero"><div class="inner"><div><h1>${job ? esc(jobStageLabel(job.status)) : pending.length ? 'Your approval is waiting' : 'Everything looks clear.'}</h1><p>${job ? `${esc(getVehicle(db, job.vehicleId)?.make)} ${esc(getVehicle(db, job.vehicleId)?.model)} · ${esc(job.number)}. Updates are simulated and saved locally in this demo.` : pending.length ? `You have ${pending.length} estimate${pending.length === 1 ? '' : 's'} awaiting a decision. Viewing is not approval — nothing starts until you confirm.` : 'No active repair right now. Your vehicle history and documents remain available below.'}</p></div>${job ? `<a class="btn btn-lime" href="#/portal/jobs/${job.id}">Track repair ${icon('arrow','icon-sm')}</a>` : `<a class="btn btn-lime" href="#/portal/approvals">Review approvals ${icon('arrow','icon-sm')}</a>`}</div></div>
    ${pending.length ? `<div class="alert-strip warn">${icon('shield')}<div class="grow"><strong>${pending.length} approval${pending.length === 1 ? '' : 's'} need your attention.</strong> Earlier decisions and declined items stay preserved.</div><a class="btn btn-dark btn-sm" href="#/portal/approvals">Open approvals</a></div>` : ''}
    <div class="stat-grid mb-5">
      ${statCard('Vehicles', vehicles.length, 'In your demo garage', {icon:'car'})}
      ${statCard('Active job', job ? '1' : '0', job ? jobStageLabel(job.status) : 'No repair in progress', {icon:'wrench',accent:!!job})}
      ${statCard('Awaiting your approval', pending.length, pending.length ? 'Viewing is not approval' : 'Nothing waiting', {icon:'shield'})}
      ${statCard('Invoice balance', fmtINR(invoices.reduce((s,i) => s + invoiceTotals(i,db).balance, 0)), invoices.length ? `${invoices.length} open invoice${invoices.length === 1 ? '' : 's'}` : 'All settled in demo', {icon:'wallet'})}
    </div>
    <div class="two-col">
      <div>
        ${job ? portalTracker(job) : `<div class="card">${emptyState('No active repair','When your vehicle is checked in, the live tracker will appear here.','<a class="btn btn-dark btn-sm" href="#/book">Book a service</a>','wrench')}</div>`}
        <div class="card mt-5">
          <div class="card-head"><div><h3 class="card-title">Upcoming appointment</h3><p class="card-sub">Requests are not confirmed automatically.</p></div><a class="link tiny" href="#/portal/bookings">All bookings</a></div>
          ${upcoming ? `<div class="flex gap-3"><div style="background:var(--night);color:var(--white);border-radius:10px;padding:10px 13px;text-align:center;min-width:64px"><div class="tiny" style="color:rgba(255,255,255,.5)">${new Intl.DateTimeFormat('en-IN',{timeZone:IST,month:'short'}).format(dateFromKey(upcoming.date)).toUpperCase()}</div><strong style="font-family:var(--font-display);font-size:22px">${new Intl.DateTimeFormat('en-IN',{timeZone:IST,day:'numeric'}).format(dateFromKey(upcoming.date))}</strong></div><div class="grow"><strong style="font-size:13px">${fmtTime(upcoming.slot)} · ${esc(getVehicle(db,upcoming.vehicleId)?.make)} ${esc(getVehicle(db,upcoming.vehicleId)?.model)}</strong><p class="tiny muted mt-1">${esc(upcoming.ref)} · ${esc(upcoming.services.map(id=>serviceById(db,id)?.name).filter(Boolean).join(', '))}</p></div><div>${bookingBadge(upcoming.status)}</div></div><div class="btn-group mt-4"><a class="btn btn-outline btn-sm" href="#/portal/bookings/${upcoming.id}">View booking</a></div>` : emptyState('No upcoming booking','Choose a service and a preferred slot whenever you are ready.','<a class="btn btn-outline btn-sm" href="#/book">Book a service</a>','calendar')}
        </div>
      </div>
      <div>
        <div class="card">
          <div class="card-head"><div><h3 class="card-title">My vehicles</h3><p class="card-sub">Records and latest known mileage.</p></div><a class="link tiny" href="#/portal/vehicles">View all</a></div>
          <div class="portal-vehicle-list">${vehicles.map(v => `<a class="portal-vehicle" href="#/portal/vehicles/${v.id}"><span style="width:32px;height:32px;border-radius:8px;background:var(--paper);display:grid;place-items:center">${icon('car','icon-sm')}</span><span class="grow"><strong>${esc(v.make)} ${esc(v.model)}</strong><span class="tiny muted" style="display:block">${esc(fmtReg(v.reg))} · ${fmtNum(v.odometer)} km</span></span>${icon('chevronRight','icon-sm')}</a>`).join('') || emptyState('No vehicles yet','Add a vehicle during booking.','','car')}</div>
        </div>
        <div class="card mt-5">
          <div class="card-head"><div><h3 class="card-title">Recent updates</h3><p class="card-sub">Simulated customer communications.</p></div><a class="link tiny" href="#/portal/history">History</a></div>
          <div class="timeline">${db.communications.filter(c => c.customerId === customer.id).slice(0,4).map(c => `<div class="tl-item done"><span class="tl-dot"></span><div class="tl-title">${esc(COMMUNICATION_TYPES[c.type] || c.type)} ${commStatusBadge(c.status)}</div><div class="tl-meta">${fmtDateTime(c.at)} · ${esc(CHANNEL_LABELS[c.channel] || c.channel)}${c.status === 'failed' ? ' · delivery failed in this simulation' : ''}</div></div>`).join('') || '<p class="small muted">No customer messages yet.</p>'}</div>
        </div>
        ${reminders.length ? `<div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Service reminders</h3><p class="card-sub">Configurable demo guidance, not a diagnosis.</p></div><a class="link tiny" href="#/portal/reminders">Manage</a></div>${reminders.map(r => `<div class="detail-row"><span class="k">${esc(r.type)}</span><span class="v">${fmtDateKey(r.dueDate)}</span></div>`).join('')}</div>` : ''}
      </div>
    </div>`;
}

function portalVehiclesView() {
  const customer = currentCustomer(db);
  if (!customer) return portalMissingView();
  const vehicles = customerVehicles(db, customer.id);
  return `${pageHead('My vehicles', `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} linked to ${esc(customer.name)}’s demo account.`, `<a class="btn btn-dark btn-sm" href="#/book">${icon('plus','icon-sm')} Add via booking</a>`)}
    <div class="card-grid">${vehicles.map(v => {
      const jobs = db.jobs.filter(j => j.vehicleId === v.id);
      const last = jobs.sort(by('createdAt', -1))[0];
      return `<a class="vehicle-card" href="#/portal/vehicles/${v.id}"><div class="vehicle-visual">${miniCarArt ? miniCarArt() : carArt()}</div><div class="vehicle-body"><h3>${esc(v.make)} ${esc(v.model)}</h3><p>${esc(v.variant || '')} ${v.variant ? '·' : ''} ${esc(v.fuel)} · ${esc(v.transmission)}</p><div class="flex between mt-3"><span class="vehicle-reg">${esc(fmtReg(v.reg))}</span><span class="tiny muted">${fmtNum(v.odometer)} km</span></div><div class="section-divider" style="margin:12px 0"></div><p class="tiny muted">${last ? `Last job: ${esc(last.ref)} · ${fmtDateKey(last.createdAt.slice(0,10))}` : 'No workshop history yet.'}</p></div></a>`;
    }).join('') || emptyState('No vehicles','Your vehicles are added during booking or by the garage.','<a class="btn btn-dark btn-sm" href="#/book">Book a service</a>','car')}</div>`;
}

function portalVehicleDetailView(id) {
  const vehicle = portalOwned(db.vehicles, id);
  if (!vehicle) return portalNotFoundView('vehicle');
  const jobs = db.jobs.filter(j => j.vehicleId === vehicle.id).sort(by('createdAt', -1));
  const bookings = db.bookings.filter(b => b.vehicleId === vehicle.id).sort(by('createdAt', -1));
  const invoices = db.invoices.filter(i => i.vehicleId === vehicle.id);
  const last = jobs[0];
  return `${pageHead(`${esc(vehicle.make)} ${esc(vehicle.model)}`, `${esc(fmtReg(vehicle.reg))} · ${esc(vehicle.fuel)} · ${esc(vehicle.transmission)}`, `<a class="btn btn-outline btn-sm" href="#/portal/vehicles">← All vehicles</a><a class="btn btn-dark btn-sm" href="#/book?service=svc_periodic">Book service</a>`)}
    <div class="two-col">
      <div>
        <div class="card pad-0" style="overflow:hidden"><div class="vehicle-visual" style="height:170px">${miniCarArt ? miniCarArt() : carArt()}</div><div style="padding:20px"><div class="detail-list">
          <div class="detail-row"><span class="k">Registration</span><span class="v mono">${esc(fmtReg(vehicle.reg))}</span></div>
          <div class="detail-row"><span class="k">Make / model</span><span class="v">${esc(vehicle.make)} ${esc(vehicle.model)} ${esc(vehicle.variant || '')}</span></div>
          <div class="detail-row"><span class="k">Year</span><span class="v">${vehicle.year}</span></div>
          <div class="detail-row"><span class="k">Fuel / transmission</span><span class="v">${esc(vehicle.fuel)} · ${esc(vehicle.transmission)}</span></div>
          <div class="detail-row"><span class="k">Odometer</span><span class="v">${fmtNum(vehicle.odometer)} km</span></div>
          <div class="detail-row"><span class="k">Nickname</span><span class="v">${esc(vehicle.nickname || '—')}</span></div>
          <div class="detail-row"><span class="k">Notes</span><span class="v">${esc(vehicle.notes || '—')}</span></div>
          <div class="detail-row"><span class="k">Last visit</span><span class="v">${last ? `${fmtDateKey(last.createdAt.slice(0,10))} · ${esc(last.ref)}` : 'No visits yet'}</span></div>
        </div></div></div>
        <div class="inline-note mt-4">${icon('info')}<div>Need to correct a vehicle detail? In this demo, front desk can update records after verification. Customer edits are intentionally limited.</div></div>
      </div>
      <div>
        <div class="card"><div class="card-head"><div><h3 class="card-title">Service history</h3><p class="card-sub">Only records linked to this vehicle.</p></div><span class="badge grey no-dot">${jobs.length} visit${jobs.length === 1 ? '' : 's'}</span></div>
          ${jobs.length ? `<div class="timeline">${jobs.map(j => `<div class="tl-item ${j.status === 'DELIVERED' ? 'done' : 'active'}"><span class="tl-dot"></span><div class="tl-title">${esc(j.number)} ${jobBadge(j.status)}</div><div class="tl-meta">${fmtDateKey(j.createdAt.slice(0,10))} · ${esc((j.concerns || []).join(', ') || j.concern || 'Service visit')}<br>Approved value: ${fmtINR(jobEstimates(db,j.id).reduce((s,e)=>s+estimateAuthorizedTotal(e,db),0))}</div></div>`).join('')}</div>` : '<p class="small muted">No workshop visits yet.</p>'}
        </div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Bookings</h3><p class="card-sub">Including requests not yet converted to a job.</p></div></div>
          ${bookings.length ? bookings.slice(0,5).map(b => `<a class="detail-row" href="#/portal/bookings/${b.id}" style="text-decoration:none;color:inherit"><span class="k">${fmtDateKey(b.date)} · ${fmtTime(b.slot)}</span><span class="v">${bookingBadge(b.status)}</span></a>`).join('') : '<p class="small muted">No booking requests.</p>'}
        </div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Invoices</h3><p class="card-sub">Shared calculations with the garage.</p></div></div>
          ${invoices.length ? invoices.map(i => { const t = invoiceTotals(i,db); return `<a class="detail-row" href="#/portal/invoices/${i.id}" style="text-decoration:none;color:inherit"><span class="k">${esc(i.ref)} · ${fmtDateKey(i.date)}</span><span class="v">${fmtINR(t.total)} ${invoiceBadge(i)}</span></a>`; }).join('') : '<p class="small muted">No invoices for this vehicle.</p>'}
        </div>
      </div>
    </div>`;
}

function portalBookingsView() {
  const customer = currentCustomer(db);
  if (!customer) return portalMissingView();
  const bookings = customerBookings(db, customer.id);
  return `${pageHead('My bookings','Appointment requests and their current status.', `<a class="btn btn-dark btn-sm" href="#/book">${icon('plus','icon-sm')} New booking</a>`)}
    ${bookings.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Vehicle</th><th>Requested slot</th><th>Services</th><th>Status</th><th class="actions"></th></tr></thead><tbody>${bookings.map(b => {
      const v = getVehicle(db,b.vehicleId);
      return `<tr><td class="main-cell"><strong>${esc(b.ref)}</strong><span>${fmtDateKey(b.createdAt.slice(0,10))}</span></td><td class="main-cell"><strong>${esc(v?.make)} ${esc(v?.model)}</strong><span>${esc(fmtReg(v?.reg))}</span></td><td>${fmtDateKey(b.date)}<br><span class="tiny muted">${fmtTime(b.slot)} · ${b.appointmentType === 'pickup' ? 'Pickup requested' : b.appointmentType === 'inspection' ? 'Inspection' : 'Drop-off'}</span></td><td>${esc(b.services.map(id=>serviceById(db,id)?.name).filter(Boolean).join(', '))}</td><td>${bookingBadge(b.status)}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/portal/bookings/${b.id}">View</a></td></tr>`;
    }).join('')}</tbody></table></div>` : `<div class="card">${emptyState('No bookings yet','Start with a service request. The garage confirms every appointment.','<a class="btn btn-dark btn-sm" href="#/book">Book a service</a>','calendar')}</div>`}`;
}

function portalBookingDetailView(id) {
  const booking = portalOwned(db.bookings, id);
  if (!booking) return portalNotFoundView('booking');
  const vehicle = getVehicle(db, booking.vehicleId);
  const job = booking.jobId ? getJob(db, booking.jobId) : db.jobs.find(j => j.bookingId === booking.id);
  return `${pageHead(`Booking ${esc(booking.ref)}`, `${fmtDateKey(booking.date)} · ${fmtTime(booking.slot)}`, `<a class="btn btn-outline btn-sm" href="#/portal/bookings">← All bookings</a>${job ? `<a class="btn btn-dark btn-sm" href="#/portal/jobs/${job.id}">Open job tracker</a>` : ''}`)}
    <div class="two-col"><div class="card"><div class="card-head"><div><h3 class="card-title">Appointment</h3><p class="card-sub">A request is not a confirmed booking.</p></div>${bookingBadge(booking.status)}</div>
      <div class="detail-list"><div class="detail-row"><span class="k">Reference</span><span class="v mono">${esc(booking.ref)}</span></div><div class="detail-row"><span class="k">Requested slot</span><span class="v">${fmtDateKey(booking.date)} · ${fmtTime(booking.slot)}</span></div><div class="detail-row"><span class="k">Appointment type</span><span class="v">${booking.appointmentType === 'pickup' ? 'Pickup requested' : booking.appointmentType === 'inspection' ? 'Inspection' : 'Drop-off'}</span></div><div class="detail-row"><span class="k">Alternative preference</span><span class="v">${esc(booking.altPreference || '—')}</span></div><div class="detail-row"><span class="k">Vehicle</span><span class="v">${esc(vehicle?.make)} ${esc(vehicle?.model)}<br><span class="mono tiny">${esc(fmtReg(vehicle?.reg))}</span></span></div><div class="detail-row"><span class="k">Services</span><span class="v">${esc(booking.services.map(id=>serviceById(db,id)?.name).filter(Boolean).join(', '))}</span></div><div class="detail-row"><span class="k">Your notes</span><span class="v">${esc(booking.notes || '—')}</span></div></div>
      <div class="section-divider"></div>
      ${['new_request','pending_confirmation','confirmed','rescheduled'].includes(booking.status) ? `<div class="btn-group"><button class="btn btn-outline btn-sm" data-action="portal.booking.reschedule" data-id="${booking.id}">Request reschedule</button><button class="btn btn-ghost btn-sm" data-action="portal.booking.cancel" data-id="${booking.id}" style="color:var(--red)">Cancel request</button></div>` : ''}
      ${!job && ['new_request','pending_confirmation'].includes(booking.status) ? `<div class="inline-note mt-4">${icon('clock')}<div>The front desk reviews capacity before confirming. You will see the status change in this demo.</div></div>` : ''}
    </div>
    <div><div class="card"><div class="card-head"><div><h3 class="card-title">Activity</h3><p class="card-sub">Booking history shown to the customer.</p></div></div><div class="timeline">${(booking.history || []).slice().reverse().map((h,i) => `<div class="tl-item ${i === 0 ? 'active' : 'done'}"><span class="tl-dot"></span><div class="tl-title">${esc(h.text || h.label || 'Update')}</div><div class="tl-meta">${fmtDateTime(h.at)}${h.detail ? `<br>${esc(h.detail)}` : ''}</div></div>`).join('')}</div></div>
    ${job ? `<div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Linked job</h3><p class="card-sub">Created at check-in.</p></div>${jobBadge(job.status)}</div><a class="btn btn-outline btn-sm" href="#/portal/jobs/${job.id}">Open live tracker ${icon('arrow','icon-sm')}</a></div>` : `<div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Need to change something?</h3><p class="card-sub">Demo changes are visible immediately to staff.</p></div></div><p class="small muted">You can request a reschedule or cancel this request. Confirmed bookings may need the garage to re-check capacity.</p></div>`}</div></div>`;
}

function portalApprovalsView() {
  const approvals = portalApprovals();
  const customer = currentCustomer(db);
  const recent = db.estimates.filter(e => e.customerId === customer?.id && !['SENT','VIEWED','PARTIALLY_APPROVED','DRAFT'].includes(e.status)).sort(by('createdAt', -1)).slice(0,4);
  return `${pageHead('Approvals','No paid work starts without your explicit decision. Viewing an estimate is not approval.', '')}
    ${approvals.length ? `<div class="grid-2">${approvals.map(est => {
      const job = getJob(db, est.jobId); const vehicle = getVehicle(db, est.vehicleId);
      const t = estimateTotals(est, db); const auth = estimateAuthorizedTotal(est, db);
      const decided = (est.decisions || []).length;
      return `<div class="card" style="border-color:#e5d5a7"><div class="card-head"><div><div class="flex gap-2 mb-2">${estimateBadge(est.status)}${est.kind === 'supplementary' ? '<span class="badge dark no-dot">Supplementary</span>' : ''}</div><h3 class="card-title">${esc(vehicle?.make)} ${esc(vehicle?.model)}</h3><p class="card-sub">${esc(est.ref)} · ${esc(job?.number || '')} · ${fmtReg(vehicle?.reg)}</p></div></div>
        <p class="small muted">${esc(est.notes)}</p>
        <div class="section-divider"></div>
        <div class="detail-row"><span class="k">Estimate total</span><span class="v mono">${fmtINR(t.total)}</span></div>
        <div class="detail-row"><span class="k">Already authorised</span><span class="v mono" style="color:var(--green)">${fmtINR(auth)}</span></div>
        <div class="detail-row"><span class="k">Valid until</span><span class="v">${fmtDateKey(est.validUntil)}</span></div>
        <div class="btn-group mt-4"><a class="btn btn-dark btn-sm" href="#/portal/approvals/${est.id}">Review line by line ${icon('arrow','icon-sm')}</a></div>
        ${decided ? `<p class="tiny muted mt-3">${decided} earlier decision${decided === 1 ? '' : 's'} preserved. Undecided lines remain open.</p>` : ''}
      </div>`;
    }).join('')}</div>` : `<div class="card">${emptyState('Nothing awaiting approval','When the garage sends an estimate, it appears here. Viewing is not approval, and earlier decisions stay preserved.','<a class="btn btn-outline btn-sm" href="#/portal">Back to overview</a>','shield')}</div>`}
    ${recent.length ? `<div class="card mt-6"><div class="card-head"><div><h3 class="card-title">Recent decisions</h3><p class="card-sub">Read-only record of what you authorised.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Estimate</th><th>Vehicle</th><th>Status</th><th>Authorised</th><th></th></tr></thead><tbody>${recent.map(est => { const v = getVehicle(db,est.vehicleId); return `<tr><td class="main-cell"><strong>${esc(est.ref)}</strong><span>${esc(est.kind)}</span></td><td>${esc(v?.make)} ${esc(v?.model)}</td><td>${estimateBadge(est.status)}</td><td class="mono">${fmtINR(estimateAuthorizedTotal(est,db))}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/portal/approvals/${est.id}">View record</a></td></tr>`; }).join('')}</tbody></table></div></div>` : ''}`;
}

function lineDecision(est, lineId) {
  let state = null;
  (est.decisions || []).forEach(d => { if ((d.lineIds || []).includes(lineId)) state = d.decision; });
  return state;
}

function portalApprovalDetailView(id) {
  const est = portalOwned(db.estimates, id);
  if (!est) return portalNotFoundView('estimate');
  if (est.status === 'SENT') {
    est.status = 'VIEWED'; est.viewedAt = new Date().toISOString();
    audit(db,'estimate.viewed','estimate',est.id,`Customer viewed estimate ${est.ref}`);
    saveDB({silent:true});
  }
  const job = getJob(db, est.jobId);
  const vehicle = getVehicle(db, est.vehicleId);
  const t = estimateTotals(est, db);
  const auth = estimateAuthorizedTotal(est, db);
  const pending = ['SENT','VIEWED','PARTIALLY_APPROVED'].includes(est.status);
  const existing = (est.decisions || []).map(d => `<div class="tl-item done"><span class="tl-dot"></span><div class="tl-title">${d.decision === 'approve' ? 'Approved' : d.decision === 'decline' ? 'Declined' : d.decision === 'clarification' ? 'Clarification requested' : esc(d.decision)} ${badge(d.actorType === 'customer' ? 'Customer' : d.actorType, d.decision === 'approve' ? 'green' : d.decision === 'decline' ? 'red' : 'blue', false)}</div><div class="tl-meta">${fmtDateTime(d.at)} · ${esc(d.comment || 'No comment')}${d.lineIds?.length ? `<br>Lines: ${d.lineIds.map(lid => esc(est.lines.find(l=>l.id===lid)?.description || lid)).join('; ')}` : ''}</div></div>`).join('');
  return `${pageHead(`Estimate ${esc(est.ref)}`, `${esc(job?.number || '')} · ${esc(vehicle?.make)} ${esc(vehicle?.model)} · ${esc(fmtReg(vehicle?.reg))}`, `<a class="btn btn-outline btn-sm" href="#/portal/approvals">← Approvals</a>`)}
    ${est.kind === 'supplementary' ? `<div class="alert-strip info">${icon('layers')}<div class="grow"><strong>Supplementary estimate.</strong> Work discovered after the original approval. This does not reverse anything already approved or declined; only this new scope needs a decision.</div></div>` : ''}
    ${est.status === 'PARTIALLY_APPROVED' ? `<div class="alert-strip warn">${icon('shield')}<div class="grow"><strong>Partially decided.</strong> Some lines have been decided and are locked here. Remaining lines still need your decision.</div></div>` : ''}
    <div class="two-col"><div>
      <div class="estimate-summary">
        <div style="padding:20px;border-bottom:1px solid var(--line)"><div class="flex between wrap mb-3"><div><div class="tiny muted">From ${esc(db.settings.business.name)}</div><h2 style="font-family:var(--font-display);font-size:22px;margin-top:3px">Items for your approval</h2></div>${estimateBadge(est.status)}</div><p class="small muted">${esc(est.notes)}</p></div>
        <div style="padding:0 20px">
          ${pending ? `<form data-form="portal.estimate.decision" data-id="${est.id}"><input type="hidden" name="estimateId" value="${est.id}">
            <div class="tiny muted" style="padding:12px 0 4px">Tick the work you authorise. Leave anything you do not want unticked, then choose an action below.</div>
            ${est.lines.map(line => {
              const state = lineDecision(est,line.id);
              const calc = estimateLineCalc(line, db.settings.tax.rate, db.settings.tax.enabled);
              const locked = !!state;
              return `<label class="line-check" style="${locked ? 'opacity:.72;background:var(--paper);margin:0 -20px;padding:12px 20px' : ''}"><input type="checkbox" name="line" value="${line.id}" ${state === 'approve' || (state === null && est.status === 'APPROVED') ? 'checked' : ''} ${locked || !pending ? 'disabled' : ''}><span class="l"><strong>${esc(line.description)} ${locked ? badge(state === 'approve' ? 'Earlier approval' : 'Earlier decline', state === 'approve' ? 'green' : 'red', false) : ''}</strong><span>${esc(line.type)} · Qty ${line.qty} × ${fmtINR(line.unitPrice)}${line.discountPct ? ` · ${line.discountPct}% discount` : ''}${line.partId ? ' · linked inventory item' : ''}</span></span><span class="price">${fmtINR(calc.total)}</span></label>`;
            }).join('')}
            <div class="est-total" style="margin:8px -20px 0">
              ${moneyRow('Estimate total', fmtINR(t.total))}${moneyRow('Already authorised', fmtINR(auth))}<div class="row grand"><span>Selected above</span><span id="approval-selected-total">${fmtINR(auth)}</span></div>
            </div>
            <div class="approval-actions">
              <button class="btn btn-lime primary" type="button" data-action="portal.approval.review" data-decision="approve" data-id="${est.id}">${icon('check','icon-sm')} Approve selected work</button>
              <button class="btn btn-outline" type="button" data-action="portal.approval.review" data-decision="decline" data-id="${est.id}">Decline selected</button>
              <button class="btn btn-ghost" type="button" data-action="portal.approval.clarify" data-id="${est.id}">Ask a question</button>
            </div>
            <p class="tiny muted center" style="margin:12px 0 4px">Approval is explicit. Ticking boxes alone does not save a decision; you must confirm it in the next step.</p>
            </form>` : `<div style="padding:12px 0">${est.lines.map(line => { const calc = estimateLineCalc(line,db.settings.tax.rate,db.settings.tax.enabled); const state = lineDecision(est,line.id); return `<div class="est-line"><div class="desc"><strong>${esc(line.description)}</strong><span>${esc(line.type)} · Qty ${line.qty} × ${fmtINR(line.unitPrice)} ${state ? badge(state === 'approve' ? 'Approved' : 'Declined', state === 'approve' ? 'green' : 'red', false) : ''}</span></div><span class="amt">${fmtINR(calc.total)}</span></div>`; }).join('')}</div>`}
        </div>
      </div>
      <div class="inline-note mt-4">${icon('info')}<div>Prices are illustrative demo values and include configured demo tax (${db.settings.tax.enabled ? `${db.settings.tax.rate}%` : 'disabled'}). No online payment is collected on this page.</div></div>
    </div>
    <div>
      <div class="card"><div class="card-head"><div><h3 class="card-title">Decision record</h3><p class="card-sub">Every approval, decline and question is preserved.</p></div></div>${existing ? `<div class="timeline">${existing}</div>` : '<p class="small muted">No decision recorded yet. Viewing this page does not count as approval.</p>'}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">What is this for?</h3></div></div><div class="detail-list"><div class="detail-row"><span class="k">Vehicle</span><span class="v">${esc(vehicle?.make)} ${esc(vehicle?.model)}<br><span class="mono tiny">${esc(fmtReg(vehicle?.reg))}</span></span></div><div class="detail-row"><span class="k">Valid until</span><span class="v">${fmtDateKey(est.validUntil)}</span></div><div class="detail-row"><span class="k">Exclusions</span><span class="v" style="max-width:230px">${esc(est.exclusions || '—')}</span></div><div class="detail-row"><span class="k">Estimate total</span><span class="v mono">${fmtINR(t.total)}</span></div><div class="detail-row"><span class="k">Authorised now</span><span class="v mono" style="color:var(--green)">${fmtINR(auth)}</span></div></div></div>
      <div class="card mt-5" style="background:var(--paper)"><div class="inline-note" style="margin:0">${icon('shield')}<div><strong>Your control.</strong> Declining a line means it will not be performed. The garage may document a safety concern but cannot charge for declined work.</div></div></div>
    </div></div>`;
}

function portalJobDetailView(id) {
  const job = portalOwned(db.jobs, id);
  if (!job) return portalNotFoundView('job');
  const vehicle = getVehicle(db, job.vehicleId);
  const inspection = jobInspection(db, job);
  const estimates = jobEstimates(db, job.id);
  const invoice = jobInvoice(db, job);
  return `${pageHead(`Job ${esc(job.number)}`, `${esc(vehicle?.make)} ${esc(vehicle?.model)} · ${esc(fmtReg(vehicle?.reg))}`, `<a class="btn btn-outline btn-sm" href="#/portal">← Overview</a>${invoice ? `<a class="btn btn-dark btn-sm" href="#/portal/invoices/${invoice.id}">Invoice</a>` : ''}`)}
    ${portalTracker(job)}
    <div class="two-col mt-6"><div>
      <div class="card"><div class="card-head"><div><h3 class="card-title">Vehicle & concern</h3></div>${jobBadge(job.status)}</div><div class="detail-list"><div class="detail-row"><span class="k">Vehicle</span><span class="v">${esc(vehicle?.make)} ${esc(vehicle?.model)} ${esc(vehicle?.variant || '')}<br><span class="mono tiny">${esc(fmtReg(vehicle?.reg))}</span></span></div><div class="detail-row"><span class="k">Reported concern</span><span class="v" style="max-width:280px">${esc((job.concerns || []).join(', ') || '—')}</span></div><div class="detail-row"><span class="k">Odometer at check-in</span><span class="v">${job.odometer ? fmtNum(job.odometer)+' km' : '—'}</span></div><div class="detail-row"><span class="k">Advisor</span><span class="v">${esc(getStaff(db,job.advisorId)?.name || 'Front desk')}</span></div><div class="detail-row"><span class="k">Technician</span><span class="v">${esc((job.techIds || []).map(id => getStaff(db,id)?.name).filter(Boolean).join(', ') || 'To be assigned')}</span></div><div class="detail-row"><span class="k">Expected completion</span><span class="v">${job.expectedAt ? fmtDateTime(job.expectedAt) : 'To be confirmed'}</span></div></div></div>
      ${inspection ? `<div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Inspection report</h3><p class="card-sub">Visible customer findings only. Internal notes stay hidden.</p></div>${inspection.status === 'COMPLETED' ? badge('Completed','green') : badge('In progress','amber')}</div>
        ${inspection.status !== 'COMPLETED' ? `<div class="inline-note">${icon('clock')}<div>The technician has not completed the inspection. Some items may still be “not inspected”.</div></div>` : ''}
        ${(inspection.items || []).filter(i => i.result && i.result !== 'not_inspected' && i.result !== 'na').map(i => `<div class="detail-row"><span class="k">${esc(i.label)}</span><span class="v">${inspectionResultBadge(i.result)}${i.customerNote ? `<div class="tiny muted" style="font-weight:400;margin-top:3px">${esc(i.customerNote)}</div>` : ''}</span></div>`).join('')}
        <p class="tiny muted mt-3">Inspection findings are observations, not a guarantee. Additional work requires a separate estimate and your approval.</p></div>` : ''}
    </div>
    <div>
      <div class="card"><div class="card-head"><div><h3 class="card-title">Estimates</h3><p class="card-sub">Original and supplementary versions.</p></div></div>${estimates.length ? estimates.map(est => { const et = estimateTotals(est,db); return `<a class="detail-row" href="#/portal/approvals/${est.id}" style="text-decoration:none;color:inherit"><span class="k">${esc(est.ref)} · ${esc(est.kind)}<br><span class="tiny">${fmtDateKey(est.createdAt.slice(0,10))}</span></span><span class="v">${fmtINR(et.total)} ${estimateBadge(est.status)}</span></a>`; }).join('') : '<p class="small muted">No estimate prepared yet.</p>'}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Updates</h3><p class="card-sub">Customer-visible activity only.</p></div></div><div class="timeline">${(job.customerUpdates || []).slice().reverse().slice(0,8).map((h,i) => `<div class="tl-item ${i===0?'active':'done'}"><span class="tl-dot"></span><div class="tl-title">${esc(h.text || h.label || 'Update')}</div><div class="tl-meta">${fmtDateTime(h.at)}${h.detail ? `<br>${esc(h.detail)}` : ''}</div></div>`).join('')}</div></div>
      ${invoice ? `<div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Invoice</h3></div>${invoiceBadge(invoice)}</div><div class="detail-row"><span class="k">Balance</span><span class="v mono">${fmtINR(invoiceTotals(invoice,db).balance)}</span></div><a class="btn btn-outline btn-sm mt-4" href="#/portal/invoices/${invoice.id}">View invoice</a></div>` : ''}
    </div></div>`;
}

function portalHistoryView() {
  const customer = currentCustomer(db);
  if (!customer) return portalMissingView();
  const jobs = customerJobs(db, customer.id).sort(by('createdAt', -1));
  return `${pageHead('Service history','Every recorded visit for your vehicles.', `<a class="btn btn-dark btn-sm" href="#/book">${icon('plus','icon-sm')} Book service</a>`)}
    ${jobs.length ? `<div class="timeline">${jobs.map(j => { const v = getVehicle(db,j.vehicleId); const inv = jobInvoice(db,j); return `<div class="tl-item ${j.status === 'DELIVERED' ? 'done' : 'active'}"><span class="tl-dot"></span><div class="tl-title">${esc(v?.make)} ${esc(v?.model)} · ${esc(j.number)} ${jobBadge(j.status)}</div><div class="tl-meta">${fmtDateKey(j.createdAt.slice(0,10))} · ${esc((j.concerns || []).join(', ') || j.concern || 'Service visit')}<br>${inv ? `Invoice ${esc(inv.ref)} · ${fmtINR(invoiceTotals(inv,db).total)}` : 'No invoice issued'} · <a href="#/portal/jobs/${j.id}" class="link">Open job</a></div></div>`; }).join('')}</div>` : `<div class="card">${emptyState('No service history','Completed visits and their documents will appear here.','<a class="btn btn-dark btn-sm" href="#/book">Book a service</a>','clock')}</div>`}`;
}

function invoiceDocument(inv, options = {}) {
  const customer = getCustomer(db, inv.customerId);
  const vehicle = getVehicle(db, inv.vehicleId);
  const job = getJob(db, inv.jobId);
  const totals = invoiceTotals(inv, db);
  const isPortal = options.portal;
  return `<div class="invoice-paper">
    <div class="invoice-brand"><div>${brandBlock(false, isPortal ? '/portal' : '/ops')}<div class="invoice-title">Tax invoice</div><p class="tiny muted" style="margin-top:4px">Demonstration document · not a valid tax invoice</p></div><div class="invoice-meta"><strong style="color:var(--ink);font-size:13px">${esc(inv.ref)}</strong><br>Issued: ${fmtDateKey(inv.date)}<br>Due: ${fmtDateKey(inv.dueDate)}<br>${invoiceBadge(inv)}<br>Job: ${esc(job?.number || '—')}</div></div>
    <div class="invoice-parties"><div><h4>From</h4><p><strong>${esc(db.settings.business.name)}</strong><br>${esc(db.settings.business.address)}<br>GSTIN: ${esc(db.settings.business.gstin)} (demo)<br>${esc(db.settings.business.phone)}</p></div><div><h4>Bill to</h4><p><strong>${esc(customer?.name)}</strong><br>${esc(fmtMobile(customer?.mobile))}<br>${esc(customer?.email || '')}<br>${esc(customer?.address?.line || '')} ${esc(customer?.address?.locality || '')}</p></div></div>
    <div class="detail-list three-up" style="margin-top:16px"><div><div class="tiny muted">Vehicle</div><strong style="font-size:12px">${esc(vehicle?.make)} ${esc(vehicle?.model)}</strong><div class="mono tiny">${esc(fmtReg(vehicle?.reg))}</div></div><div><div class="tiny muted">Odometer</div><strong style="font-size:12px">${fmtNum(vehicle?.odometer)} km</strong></div><div><div class="tiny muted">Payment terms</div><strong style="font-size:12px">${esc(db.settings.invoice.terms || 'Due on collection')}</strong></div></div>
    <table class="invoice-table"><thead><tr><th>Description</th><th>Type</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th>Tax</th><th style="text-align:right">Amount</th></tr></thead><tbody>${(inv.lines || []).map(line => { const c = estimateLineCalc(line, db.settings.tax.rate, db.settings.tax.enabled); return `<tr><td><strong>${esc(line.description)}</strong>${line.discountPct ? `<div class="tiny muted">${line.discountPct}% discount applied</div>` : ''}</td><td>${esc(line.type)}</td><td style="text-align:right">${line.qty}</td><td style="text-align:right">${fmtINR(line.unitPrice)}</td><td>${c.rate}%</td><td style="text-align:right">${fmtINR(c.total)}</td></tr>`; }).join('')}</tbody></table>
    <div class="invoice-totals">${moneyRow('Subtotal', fmtINR(totals.base))}${totals.discount ? moneyRow('Discount', '− '+fmtINR(totals.discount)) : ''}${moneyRow('Taxable value', fmtINR(totals.taxable))}${moneyRow(`Tax (${db.settings.tax.enabled ? db.settings.tax.rate : 0}%)`, fmtINR(totals.tax))}<div class="grand"><span>Total</span><span>${fmtINR(totals.total)}</span></div>${moneyRow('Paid', fmtINR(totals.paid), 'paid')}<div class="due"><span>Balance</span><span>${fmtINR(totals.balance)}</span></div></div>
    ${(inv.payments || []).length ? `<div style="margin-top:22px"><h4 style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px">Simulated payment records</h4>${inv.payments.filter(p=>!p.reversed).map(p => `<div class="payment-row"><span class="pay-icon">${icon('check','icon-sm')}</span><span class="grow">${fmtINR(p.amount)} · ${esc(PAYMENT_METHODS[p.method] || p.method)}<br><span class="tiny muted">${fmtDateTime(p.at)}${p.reference ? ` · ${esc(p.reference)}` : ''} · not a real payment</span></span></div>`).join('')}</div>` : ''}
    <div class="invoice-footer"><strong>Demo notice:</strong> This invoice is synthetic and generated inside a local prototype. It is not a tax invoice, no money has moved, and no government or financial system has been contacted. ${esc(inv.notes || '')}<br><br>${esc(db.settings.business.name)} · ${esc(db.settings.business.address)} · ${esc(db.settings.business.email)}</div>
  </div>`;
}

function portalInvoicesView() {
  const customer = currentCustomer(db);
  if (!customer) return portalMissingView();
  const invoices = customerInvoices(db, customer.id).filter(i => i.status !== 'DRAFT').sort(by('date', -1));
  return `${pageHead('Invoices & payments','Downloadable demo documents. No online payment is connected.', '')}
    ${invoices.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Invoice</th><th>Vehicle</th><th>Issued</th><th>Total</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>${invoices.map(inv => { const v = getVehicle(db,inv.vehicleId); const t = invoiceTotals(inv,db); return `<tr><td class="main-cell"><strong>${esc(inv.ref)}</strong><span>${esc(inv.jobId ? getJob(db,inv.jobId)?.ref : '')}</span></td><td>${esc(v?.make)} ${esc(v?.model)}<br><span class="tiny muted">${esc(fmtReg(v?.reg))}</span></td><td>${fmtDateKey(inv.date)}</td><td class="mono">${fmtINR(t.total)}</td><td class="mono">${fmtINR(t.balance)}</td><td>${invoiceBadge(inv)}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/portal/invoices/${inv.id}">View</a></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="card">${emptyState('No invoices yet','Invoices are issued after approved work is completed.','','receipt')}</div>`}`;
}

function portalInvoiceDetailView(id) {
  const inv = portalOwned(db.invoices, id);
  if (!inv) return portalNotFoundView('invoice');
  const t = invoiceTotals(inv, db);
  return `${pageHead(`Invoice ${esc(inv.ref)}`,`${fmtDateKey(inv.date)} · ${esc(getVehicle(db,inv.vehicleId)?.make)} ${esc(getVehicle(db,inv.vehicleId)?.model)}`,`<a class="btn btn-outline btn-sm" href="#/portal/invoices">← All invoices</a><button class="btn btn-outline btn-sm" data-action="print">${icon('print','icon-sm')} Print</button>${t.balance > 0.49 ? `<button class="btn btn-dark btn-sm" data-action="portal.payment.instructions" data-id="${inv.id}">Payment options</button>` : ''}`)}
    <div class="alert-strip info">${icon('info')}<div class="grow"><strong>Demo invoice.</strong> Totals use the same shared calculation as the garage view. No payment gateway is connected and no money can move.</div></div>
    ${invoiceDocument(inv, {portal:true})}
    ${t.balance > 0.49 ? `<div class="invoice-paper mt-5" style="max-width:850px"><h3 class="card-title mb-2">Need to pay?</h3><p class="small muted">Online payment is intentionally unavailable in this prototype. Use the “Payment options” button to see the demo offline-payment guidance. Payments recorded by the garage appear here immediately.</p></div>` : `<div class="decision-box mt-5" style="max-width:850px">${icon('check','icon-sm')} This invoice is settled in the demo. No real payment was processed.</div>`}`;
}

function portalRemindersView() {
  const customer = currentCustomer(db);
  if (!customer) return portalMissingView();
  const reminders = db.reminders.filter(r => r.customerId === customer.id).sort(by('dueDate', 1));
  return `${pageHead('Service reminders','Demo guidance based on recorded service history. These are not automatic diagnoses or guarantees.', '')}
    <div class="two-col"><div><div class="card"><div class="card-head"><div><h3 class="card-title">Your reminders</h3><p class="card-sub">Service reminders may still be sent if you opt out of marketing.</p></div></div>${reminders.length ? reminders.map(r => { const v = getVehicle(db,r.vehicleId); return `<div class="detail-row"><span class="k">${esc(r.type)}<br><span class="tiny">${esc(v?.make)} ${esc(v?.model)} · ${esc(fmtReg(v?.reg))}</span></span><span class="v">${fmtDateKey(r.dueDate)}<br>${badge(r.status === 'sent' ? 'Sent · simulated' : r.status, r.status === 'sent' ? 'green' : r.status === 'pending' ? 'amber' : 'blue', false)}</span></div>`; }).join('') : '<p class="small muted">No reminders for your vehicles.</p>'}</div></div>
    <div><div class="card"><div class="card-head"><div><h3 class="card-title">Reminder preferences</h3><p class="card-sub">Separate from essential service updates.</p></div></div><form data-form="portal.reminder.prefs"><label class="check mb-3"><input type="checkbox" name="serviceReminders" ${customer.consents?.service !== false ? 'checked' : ''}> Service reminders for my vehicles</label><label class="check mb-3"><input type="checkbox" name="marketing" ${customer.consents?.marketing ? 'checked' : ''} ${customer.marketingOptOut ? '' : ''}> Marketing and offers</label><div class="field"><label for="rem-channel">Preferred channel</label><select class="select" id="rem-channel" name="channel">${Object.entries(CHANNEL_LABELS).filter(([k])=>['whatsapp','sms','email'].includes(k)).map(([k,v]) => `<option value="${k}" ${customer.channel === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div><button class="btn btn-dark btn-sm mt-4" type="submit">Save preferences</button><p class="tiny muted mt-3">Marketing is opt-in. Essential updates about an active booking or repair are handled separately.</p></form></div></div></div>`;
}

function portalFeedbackView() {
  const customer = currentCustomer(db);
  if (!customer) return portalMissingView();
  const delivered = customerJobs(db, customer.id).filter(j => j.status === 'DELIVERED');
  const feedback = db.feedback.filter(f => f.customerId === customer.id).sort(by('at', -1));
  return `${pageHead('Feedback','Tell the garage about a completed visit. Public display requires your consent.', '')}
    <div class="two-col"><div><div class="card"><div class="card-head"><div><h3 class="card-title">Share feedback</h3><p class="card-sub">Only for a completed demo job.</p></div></div>${delivered.length ? `<form data-form="portal.feedback">
      <div class="field mb-3"><label for="fb-job">Completed visit *</label><select class="select" id="fb-job" name="jobId" required>${delivered.map(j => `<option value="${j.id}">${esc(j.number)} · ${esc(getVehicle(db,j.vehicleId)?.make)} ${esc(getVehicle(db,j.vehicleId)?.model)} · ${fmtDateKey(j.createdAt.slice(0,10))}</option>`).join('')}</select></div>
      <div class="form-grid"><div class="field"><label>Overall *</label><select class="select" name="overall">${[5,4,3,2,1].map(n=>`<option value="${n}">${n} / 5</option>`).join('')}</select></div><div class="field"><label>Quality *</label><select class="select" name="quality">${[5,4,3,2,1].map(n=>`<option value="${n}">${n} / 5</option>`).join('')}</select></div><div class="field"><label>Communication *</label><select class="select" name="communication">${[5,4,3,2,1].map(n=>`<option value="${n}">${n} / 5</option>`).join('')}</select></div><div class="field"><label>Value *</label><select class="select" name="value">${[5,4,3,2,1].map(n=>`<option value="${n}">${n} / 5</option>`).join('')}</select></div></div>
      <div class="field mt-3"><label for="fb-cat">Category</label><select class="select" id="fb-cat" name="category">${['Service quality','Communication','Billing','Collection','Other'].map(c=>`<option>${c}</option>`).join('')}</select></div>
      <div class="field mt-3"><label for="fb-comment">Comment *</label><textarea class="textarea" id="fb-comment" name="comment" maxlength="700" required placeholder="What went well or what could be better?"></textarea></div>
      <label class="check mt-3"><input type="checkbox" name="publicConsent"> I consent to this feedback being shown as a demo testimonial with my first name and vehicle model. Staff moderation still applies.</label>
      <button class="btn btn-dark btn-sm mt-4" type="submit">Submit demo feedback</button>
    </form>` : `<p class="small muted">Feedback opens after your first completed visit. No fake reviews are pre-filled for you.</p>`}</div></div>
    <div><div class="card"><div class="card-head"><div><h3 class="card-title">Your feedback</h3></div></div>${feedback.length ? feedback.map(f => `<div class="review-block"><div class="head"><h3>${esc(f.category)} · ${f.ratings.overall}/5</h3>${badge(f.status, f.status === 'published' ? 'green' : f.status === 'reviewed' ? 'blue' : 'amber', false)}</div><div class="body">“${esc(f.comment)}”<div class="tiny muted mt-2">${fmtDateTime(f.at)} · Public consent: ${f.publicConsent ? 'yes' : 'no'}</div>${f.response ? `<div class="decision-box mt-3">${esc(f.response)}</div>` : ''}</div></div>`).join('') : '<p class="small muted">You have not submitted feedback yet.</p>'}</div></div></div>`;
}

function portalProfileView() {
  const customer = currentCustomer(db);
  if (!customer) return portalMissingView();
  return `${pageHead('Profile & privacy','Control your demo contact details, consents and data.', '')}
    <div class="two-col"><div><div class="card"><div class="card-head"><div><h3 class="card-title">Contact details</h3><p class="card-sub">Used for this local prototype only.</p></div>${badge(customer.guest ? 'Guest record' : 'Registered demo', customer.guest ? 'amber' : 'green', false)}</div>
      <form data-form="portal.profile"><div class="form-grid"><div class="field full"><label for="pf-name">Full name *</label><input class="input" id="pf-name" name="name" value="${esc(customer.name)}" maxlength="80" required></div><div class="field"><label for="pf-mobile">Mobile *</label><input class="input" id="pf-mobile" name="mobile" value="${esc(customer.mobile)}" maxlength="15" required><span class="hint">Changing this affects how staff find your record.</span></div><div class="field"><label for="pf-email">Email</label><input class="input" id="pf-email" name="email" type="email" value="${esc(customer.email || '')}" maxlength="120"></div><div class="field"><label for="pf-line">Address</label><input class="input" id="pf-line" name="line" value="${esc(customer.address?.line || '')}" maxlength="120"></div><div class="field"><label for="pf-locality">Locality</label><input class="input" id="pf-locality" name="locality" value="${esc(customer.address?.locality || '')}" maxlength="80"></div><div class="field"><label for="pf-city">City</label><input class="input" id="pf-city" name="city" value="${esc(customer.address?.city || '')}" maxlength="60"></div><div class="field"><label for="pf-pin">PIN code</label><input class="input" id="pf-pin" name="pincode" value="${esc(customer.address?.pincode || '')}" inputmode="numeric" maxlength="6"></div></div><button class="btn btn-dark btn-sm mt-4" type="submit">Save profile</button></form></div></div>
    <div><div class="card"><div class="card-head"><div><h3 class="card-title">Consents</h3><p class="card-sub">Marketing is separate from essential service messages.</p></div></div><form data-form="portal.consents"><label class="check mb-3"><input type="checkbox" name="service" ${customer.consents?.service !== false ? 'checked' : ''}> Essential service updates</label><label class="check mb-3"><input type="checkbox" name="marketing" ${customer.consents?.marketing ? 'checked' : ''}> Marketing messages</label><button class="btn btn-outline btn-sm" type="submit">Update consents</button></form></div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Your data</h3><p class="card-sub">Everything stays in this browser.</p></div></div><div class="btn-group"><button class="btn btn-outline btn-sm" data-action="portal.export">${icon('download','icon-sm')} Export my demo data</button><button class="btn btn-ghost btn-sm" data-action="portal.delete.request" style="color:var(--red)">Request deletion</button></div><p class="tiny muted mt-3">Deletion requests are simulated. In this demo, use Demo controls to reset all data. Do not enter real personal information.</p></div>
      <div class="card mt-5" style="background:var(--night);color:var(--white);border-color:var(--night)"><h3 class="card-title" style="color:var(--white)">Demo privacy</h3><p class="small" style="color:rgba(255,255,255,.6);margin-top:6px">All customers, vehicles, invoices and messages are synthetic. The prototype stores data in your browser’s LocalStorage and sends nothing to a server.</p></div>
    </div></div>`;
}

function portalMissingView() {
  return `<div class="card">${emptyState('Sign in to your portal','Choose a customer identity to open the portal. Sign-in is simulated and stays in this browser.','<a class="btn btn-dark btn-sm" href="#/login?next=%2Fportal">Sign in as a customer</a><a class="btn btn-outline btn-sm" href="#/site">Back to website</a>','user')}</div>`;
}

function loginView() {
  const next = safeReturnTo(currentRoute.query.get('next'), '/portal');
  const intent = loginIntent(next);
  const suggestion = String(currentRoute.query.get('as') || '');
  const staff = db.staff.filter(s => s.active);
  const customers = db.customers.filter(c => c.status !== 'deleted');
  const signedIn = isSignedIn(db);
  const wanted = key => suggestion === key;
  const suggestedPerson = (() => {
    const [kind, id] = suggestion.split(':');
    if (kind === 'staff') return db.staff.find(s => s.id === id && s.active) ? {kind, person:db.staff.find(s => s.id === id)} : null;
    if (kind === 'customer') return db.customers.find(c => c.id === id && c.status !== 'deleted') ? {kind, person:db.customers.find(c => c.id === id)} : null;
    return null;
  })();
  const suggestedBanner = suggestedPerson ? `<div class="alert-strip info">${icon('user')}<div class="grow"><strong>${esc(suggestedPerson.person.name)} is ready to sign in.</strong> Confirm this demo identity to continue to <span class="mono">${esc(next)}</span>.</div><button class="btn btn-dark btn-sm" data-action="auth.login" data-kind="${suggestedPerson.kind}" data-id="${esc(suggestedPerson.person.id)}" data-next="${esc(next)}">Continue as ${esc(suggestedPerson.person.name.split(' ')[0])} ${icon('arrow','icon-sm')}</button></div>` : '';
  const current = signedIn ? `<div class="alert-strip info">${icon('user')}<div class="grow"><strong>Signed in as ${esc(currentUserLabel(db))}</strong> · ${esc(currentRoleLabel(db))}. Choose a role-appropriate identity below to continue, or sign out.</div><button class="btn btn-outline btn-sm" data-action="auth.logout">Sign out</button></div>` : '';
  const staffCard = st => `<button type="button" class="card${wanted(`staff:${st.id}`) ? ' is-suggested' : ''}" data-action="auth.login" data-kind="staff" data-id="${st.id}" data-next="${esc(next)}" style="text-align:left;cursor:pointer"><div class="flex between wrap gap-2"><strong>${esc(st.name)}</strong>${wanted(`staff:${st.id}`) ? badge('Selected','green',false) : badge(ROLE_DEFS[st.role]?.label || st.role,'grey',false)}</div><p class="tiny muted mt-2">${esc((st.specialties || []).join(' · ') || 'Garage team')}</p><span class="link tiny mt-3">Sign in as ${esc(st.name.split(' ')[0])} →</span></button>`;
  const customerCard = c => `<button type="button" class="card${wanted(`customer:${c.id}`) ? ' is-suggested' : ''}" data-action="auth.login" data-kind="customer" data-id="${c.id}" data-next="${esc(next)}" style="text-align:left;cursor:pointer"><div class="flex between wrap gap-2"><strong>${esc(c.name)}</strong>${wanted(`customer:${c.id}`) ? badge('Selected','green',false) : badge(c.guest ? 'Guest record' : 'Customer', c.guest ? 'amber' : 'green', false)}</div><p class="tiny muted mt-2">${esc(c.mobile)} · ${customerVehicles(db,c.id).length} vehicle${customerVehicles(db,c.id).length === 1 ? '' : 's'}</p><span class="link tiny mt-3">Open customer portal →</span></button>`;
  const heading = intent === 'staff'
    ? {eyebrow:'Garage sign in', title:'Sign in to garage operations.', lede:'Choose a demo staff member. The role you pick decides which bookings, job cards, money and settings you can open.'}
    : intent === 'customer'
      ? {eyebrow:'Customer sign in', title:'Sign in to your portal.', lede:'Choose a demo customer. You will only see that customer’s vehicles, approvals, history and invoices.'}
      : {eyebrow:'Demo sign in', title:'Choose who you want to be.', lede:'Sign-in is simulated. It selects which demo records and permissions you can see; nothing is sent to a server and no password is required.'};
  const groupHead = (title, sub) => `<div class="card"><div class="card-head"><div><h3 class="card-title">${title}</h3><p class="card-sub">${sub}</p></div></div><div class="grid-2">`;
  const switchLink = intent === 'staff'
    ? `<a class="link" href="#${loginPath('/portal')}">Looking to view a customer portal? Sign in as a customer →</a>`
    : intent === 'customer'
      ? `<a class="link" href="#${loginPath('/ops')}">Looking for the garage team? Sign in to operations →</a>`
      : '';
  const staffPanel = `${groupHead('Garage team','Front desk, manager and technician access.')}${staff.map(staffCard).join('')}</div></div>`;
  const customerPanel = `${groupHead('Customers','Open a portal with linked vehicles, approvals and invoices.')}${customers.map(customerCard).join('')}</div></div>`;
  const groups = intent === 'staff'
    ? staffPanel
    : intent === 'customer'
      ? customerPanel
      : `<div class="two-col" style="align-items:start">${staffPanel}${customerPanel}</div>`;
  const destination = `<p class="tiny muted mt-4">${icon('route','icon-sm')} After sign-in you will continue to <strong>${esc(next)}</strong> if your role allows it.</p>`;
  return `<section class="page-hero compact-hero"><div class="inner">
    <span class="eyebrow" style="color:var(--lime)">${heading.eyebrow}</span>
    <h1>${heading.title}</h1>
    <p>${heading.lede}</p>
  </div></section>
  <section class="section"><div class="section-inner">
    ${current}
    ${suggestedBanner}
    <div class="inline-note mb-6">${icon('shield')}<div><strong>Role-aware prototype.</strong> Customer, front desk, manager and technician records are separated, and every portal, garage or workshop link asks for sign-in first.</div></div>
    ${groups}
    ${destination}
    <div class="flex between wrap gap-3 mt-6">${switchLink}<a class="link" href="#/site">← Back to the website</a></div>
    <p class="tiny muted mt-6">This is a local prototype using synthetic data. Do not enter real personal, payment or vehicle information.</p>
  </div></section>`;
}
function performLogin(kind, id, next) {
  if (kind === 'staff') {
    const person = db.staff.find(s => s.id === id && s.active);
    if (!person) return toast('Sign-in unavailable', 'That demo staff record is not active.', 'error');
    db.session = {kind:'staff',staffId:person.id,customerId:null};
    const destination = loginDestination('staff', next, person);
    audit(db, 'auth.login', 'session', person.id, `Signed in as ${person.name} (${ROLE_DEFS[person.role]?.label || person.role})`);
    persist(`Signed in as ${person.name}`, 'success', {title:'Demo sign-in'});
    closeModal();
    go(destination);
    return;
  }
  const customer = db.customers.find(c => c.id === id && c.status !== 'deleted');
  if (!customer) return toast('Sign-in unavailable', 'That demo customer record is not available.', 'error');
  db.session = {kind:'customer',customerId:customer.id,staffId:null};
  const destination = loginDestination('customer', next);
  audit(db, 'auth.login', 'session', customer.id, `Signed in as customer ${customer.name}`);
  persist(`Signed in as ${customer.name}`, 'success', {title:'Demo sign-in'});
  closeModal();
  go(destination);
}

function portalNotFoundView(kind) {
  return `<div class="card">${emptyState('Record not available',`This ${kind} does not exist or is not linked to your signed-in demo customer. Access to another customer’s records is intentionally blocked.`,'<a class="btn btn-dark btn-sm" href="#/portal">Back to portal</a>','shield')}</div>`;
}
