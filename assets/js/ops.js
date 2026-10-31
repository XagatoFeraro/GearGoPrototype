/* ==========================================================================
   Gear Go Automobiles — garage operations
   Dashboard, bookings, job cards, estimates, inventory, money and settings.
   ========================================================================== */
'use strict';

function timeOfDayGreeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB',{timeZone:IST,hour:'2-digit',hourCycle:'h23'}).format(new Date()));
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function searchFilter(list, term, keys) {
  const q = String(term || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter(item => keys.some(k => String(typeof k === 'function' ? k(item) : item[k] || '').toLowerCase().includes(q)));
}

function todayBookings() {
  return db.bookings.filter(b => b.date === todayKey() && !['cancelled','rejected','no_show'].includes(b.status));
}

function todayInvoicesValue() {
  return db.invoices.filter(i => i.status !== 'VOID').reduce((sum, inv) => {
    const t = invoiceTotals(inv, db);
    return sum + (inv.date === todayKey() ? t.paid : 0);
  }, 0);
}

function opsDashboardView() {
  const active = activeJobs(db);
  const today = todayBookings().sort((a,b) => a.slot.localeCompare(b.slot));
  const approvals = pendingApprovals(db);
  const overdue = db.invoices.filter(i => isOverdueInvoice(db, i));
  const lowStock = db.parts.filter(p => p.active && p.stock <= p.reorder);
  const openInvoices = db.invoices.filter(i => i.status !== 'VOID' && invoiceTotals(i, db).balance > 0.49);
  const dueValue = openInvoices.reduce((s,i) => s + invoiceTotals(i,db).balance, 0);
  const inWorkshop = active.filter(j => !['CHECKED_IN','AWAITING_APPROVAL'].includes(j.status)).length;
  const recent = db.audit.slice(0,7);
  const weekData = Array.from({length:7}, (_, idx) => {
    const key = dayOffsetKey(idx - 6);
    const total = db.invoices.filter(i => i.status !== 'VOID').flatMap(i => i.payments || []).filter(p => !p.reversed && dateKeyOf(new Date(p.at)) === key).reduce((s,p)=>s+Number(p.amount||0),0);
    return {label:new Intl.DateTimeFormat('en-IN',{timeZone:IST,weekday:'short'}).format(dateFromKey(key)),short:new Intl.DateTimeFormat('en-IN',{timeZone:IST,weekday:'narrow'}).format(dateFromKey(key)),value:Math.round(total)};
  });
  const statusData = Object.entries(active.reduce((acc,j) => { acc[j.status] = (acc[j.status]||0)+1; return acc; },{})).map(([s,v]) => ({label:jobStageLabel(s),short:jobStageLabel(s).split(' ')[0],value:v,colour:s === 'AWAITING_APPROVAL' ? '#e7a91c' : s === 'AWAITING_PARTS' ? '#c26332' : '#2f6d45'}));
  const todayLabel = new Intl.DateTimeFormat('en-IN',{timeZone:IST,weekday:'long',day:'numeric',month:'long'}).format(new Date());
  return `${pageHead('Garage overview',`${todayLabel} · ${esc(currentStaff(db)?.title || 'Team')} view. All figures are demo data.`, `<button class="btn btn-outline btn-sm" data-action="ops.booking.new">${icon('plus','icon-sm')} New booking</button><button class="btn btn-dark btn-sm" data-action="ops.job.new">${icon('wrench','icon-sm')} Check in vehicle</button>`)}
    <div class="stat-grid mb-5">
      ${statCard('In the workshop', inWorkshop, `${active.length} active job${active.length === 1 ? '' : 's'} total`, {icon:'wrench',accent:true})}
      ${statCard('Today’s appointments', today.length, `${today.filter(b=>b.status==='confirmed').length} confirmed`, {icon:'calendar'})}
      ${statCard('Approvals waiting', approvals.length, approvals.length ? 'Customer decisions needed' : 'No pending decisions', {icon:'shield'})}
      ${statCard('Outstanding balance', fmtINR(dueValue), `${overdue.length} overdue · ${openInvoices.length} open`, {icon:'wallet'})}
    </div>
    <div class="two-col">
      <div>
        <div class="card"><div class="card-head"><div><h3 class="card-title">Today at a glance</h3><p class="card-sub">Bookings and live workshop load.</p></div><a class="link tiny" href="#/ops/calendar">Open calendar</a></div>
          <div class="timeline">${today.slice(0,6).map(b => { const c = getCustomer(db,b.customerId), v = getVehicle(db,b.vehicleId); return `<div class="tl-item ${['confirmed','checked_in','converted'].includes(b.status) ? 'done' : 'active'}"><span class="tl-dot"></span><div class="tl-title">${fmtTime(b.slot)} · ${esc(c?.name || 'Customer')} ${bookingBadge(b.status)}</div><div class="tl-meta">${esc(v?.make)} ${esc(v?.model)} · ${esc(fmtReg(v?.reg))} · ${esc(b.services.map(id=>serviceById(db,id)?.name).filter(Boolean).join(', '))}</div></div>`; }).join('') || '<p class="small muted">No appointments scheduled for today.</p>'}</div>
          ${today.length ? `<a class="btn btn-outline btn-sm mt-4" href="#/ops/bookings?date=${todayKey()}">View today’s bookings ${icon('arrow','icon-sm')}</a>` : ''}
        </div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Workshop load</h3><p class="card-sub">Jobs by current stage.</p></div><a class="link tiny" href="#/ops/workboard">Work board</a></div>${statusData.length ? barChart(statusData, 560, 210) : '<p class="small muted">No active jobs.</p>'}</div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Customer approval queue</h3><p class="card-sub">No paid work starts without an explicit decision.</p></div><a class="link tiny" href="#/ops/approvals">All approvals</a></div>
          ${approvals.slice(0,4).map(e => { const c = getCustomer(db,e.customerId), v = getVehicle(db,e.vehicleId); const t = estimateTotals(e,db); return `<div class="detail-row"><span class="k"><strong style="color:var(--ink)">${esc(c?.name)}</strong><br><span class="tiny">${esc(v?.make)} ${esc(v?.model)} · ${esc(e.ref)}</span></span><span class="v">${fmtINR(t.total)}<br><span class="tiny">${estimateBadge(e.status)}</span></span><a class="btn btn-outline btn-xs" href="#/ops/estimates/${e.id}">Open</a></div>`; }).join('') || '<p class="small muted">Nothing waiting. Good.</p>'}
        </div>
      </div>
      <div>
        <div class="card"><div class="card-head"><div><h3 class="card-title">Active jobs</h3><p class="card-sub">Highest priority and latest activity.</p></div><a class="link tiny" href="#/ops/jobs">All jobs</a></div>
          ${active.slice(0,6).map(j => { const v = getVehicle(db,j.vehicleId), c = getCustomer(db,j.customerId); return `<a class="portal-vehicle" href="#/ops/jobs/${j.id}" style="margin-bottom:8px"><span style="width:32px;height:32px;border-radius:8px;background:var(--paper);display:grid;place-items:center">${icon('car','icon-sm')}</span><span class="grow"><strong>${esc(j.number)} · ${esc(c?.name)}</strong><span class="tiny muted" style="display:block">${esc(v?.make)} ${esc(v?.model)} · ${esc(fmtReg(v?.reg))}</span></span>${jobBadge(j.status)}</a>`; }).join('') || '<p class="small muted">No active jobs.</p>'}
        </div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Collections this week</h3><p class="card-sub">Simulated payments, by day.</p></div><span class="tiny muted">Last 7 days</span></div>${lineChart(weekData, 560, 200)}</div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Needs attention</h3></div></div>
          ${lowStock.length ? `<div class="alert-strip warn">${icon('box')}<div class="grow"><strong>${lowStock.length} parts at or below reorder level.</strong><br>${esc(lowStock.slice(0,3).map(p=>p.name).join(', '))}</div><a class="btn btn-dark btn-sm" href="#/ops/inventory">Inventory</a></div>` : ''}
          ${overdue.length ? `<div class="alert-strip danger">${icon('wallet')}<div class="grow"><strong>${overdue.length} overdue invoice${overdue.length===1?'':'s'}.</strong><br>${fmtINR(overdue.reduce((s,i)=>s+invoiceTotals(i,db).balance,0))} outstanding past due date.</div><a class="btn btn-dark btn-sm" href="#/ops/receivables">Receivables</a></div>` : ''}
          ${!lowStock.length && !overdue.length ? '<p class="small muted">No inventory or receivable alerts in the demo.</p>' : ''}
          ${db.communications.filter(c=>c.status==='failed').length ? `<div class="alert-strip info">${icon('message')}<div class="grow"><strong>Simulated delivery failures.</strong> ${db.communications.filter(c=>c.status==='failed').length} message(s) failed in the demo; no real retry occurs.</div><a class="btn btn-dark btn-sm" href="#/ops/communications">View</a></div>` : ''}
        </div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Recent activity</h3><p class="card-sub">Audit trail excerpt.</p></div><a class="link tiny" href="#/ops/audit">Audit</a></div><div class="timeline">${recent.map(a => `<div class="tl-item done"><span class="tl-dot"></span><div class="tl-title">${esc(a.summary)}</div><div class="tl-meta">${fmtDateTime(a.at)} · ${esc(a.actor)} (${esc(a.role)})</div></div>`).join('')}</div></div>
      </div>
    </div>`;
}

function opsBookingsView() {
  const q = currentRoute.query;
  const statusFilter = q.get('status') || 'active';
  const search = q.get('q') || '';
  const dateFilter = q.get('date') || '';
  let list = db.bookings.slice();
  if (statusFilter === 'active') list = list.filter(b => !['converted','cancelled','rejected','no_show'].includes(b.status));
  else if (statusFilter === 'all') {}
  else list = list.filter(b => b.status === statusFilter);
  if (dateFilter) list = list.filter(b => b.date === dateFilter);
  list = searchFilter(list, search, [b => b.ref, b => getCustomer(db,b.customerId)?.name, b => getCustomer(db,b.customerId)?.mobile, b => getVehicle(db,b.vehicleId)?.reg]);
  list.sort((a,b) => (a.date+a.slot).localeCompare(b.date+b.slot));
  return `${pageHead('Bookings','Appointment requests, confirmations and check-ins.', `<button class="btn btn-outline btn-sm" data-action="ops.booking.new">${icon('plus','icon-sm')} Add booking</button><a class="btn btn-dark btn-sm" href="#/ops/calendar">${icon('calendar','icon-sm')} Calendar</a>`)}
    <div class="card pad-0">
      <div style="padding:14px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--line)">
        <div class="pill-tabs">${[['active','Active'],['confirmed','Confirmed'],['new_request','New'],['converted','Checked in'],['all','All']].map(([k,l]) => `<a href="#/ops/bookings?status=${k}${dateFilter?`&date=${dateFilter}`:''}" style="text-decoration:none" class="${statusFilter===k?'active':''}">${l}</a>`).join('')}</div>
        <form data-form="ops.booking.search" style="margin-left:auto;display:flex;gap:6px"><input class="input" name="q" value="${esc(search)}" placeholder="Search name, reg, reference" style="height:34px;width:230px"><button class="btn btn-outline btn-sm" type="submit">${icon('search','icon-sm')}</button></form>
      </div>
      ${dateFilter ? `<div style="padding:10px 16px;border-bottom:1px solid var(--line);font-size:11px">Showing ${fmtDateKey(dateFilter)} <a class="link" href="#/ops/bookings?status=${statusFilter}">clear date</a></div>` : ''}
      ${list.length ? `<div class="table-wrap" style="border:0;border-radius:0"><table class="table"><thead><tr><th>Reference / received</th><th>Customer</th><th>Vehicle</th><th>Requested slot</th><th>Services</th><th>Status</th><th class="actions"></th></tr></thead><tbody>${list.map(b => { const c=getCustomer(db,b.customerId), v=getVehicle(db,b.vehicleId); return `<tr><td class="main-cell"><strong>${esc(b.ref)}</strong><span>${fmtDateTime(b.createdAt)} · ${esc(b.source)}</span></td><td class="main-cell"><strong>${esc(c?.name)}</strong><span>${esc(fmtMobile(c?.mobile))}</span></td><td class="main-cell"><strong>${esc(v?.make)} ${esc(v?.model)}</strong><span class="mono">${esc(fmtReg(v?.reg))}</span></td><td>${fmtDateKey(b.date)}<br><span class="tiny muted">${fmtTime(b.slot)}</span></td><td style="max-width:190px">${esc(b.services.map(id=>serviceById(db,id)?.name).filter(Boolean).join(', '))}</td><td>${bookingBadge(b.status)}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/ops/bookings/${b.id}">Open</a></td></tr>`; }).join('')}</tbody></table></div>` : `<div style="padding:30px">${emptyState('No bookings found','Try a different filter or search.','','calendar')}</div>`}
    </div>`;
}

function opsBookingDetailView(id) {
  const booking = getBooking(db, id);
  if (!booking) return opsNotFoundView('booking');
  const c = getCustomer(db, booking.customerId), v = getVehicle(db, booking.vehicleId);
  const linkedJob = booking.jobId ? getJob(db, booking.jobId) : db.jobs.find(j => j.bookingId === booking.id);
  const internal = `<div class="card"><div class="card-head"><div><h3 class="card-title">Internal notes</h3><p class="card-sub">Never shown in the customer portal.</p></div><span class="badge amber no-dot">Internal</span></div><form data-form="ops.booking.internal"><input type="hidden" name="id" value="${booking.id}"><textarea class="textarea" name="note" placeholder="Add capacity, access or handover notes…" maxlength="500">${esc(booking.internalNotes || '')}</textarea><button class="btn btn-outline btn-sm mt-3" type="submit">Save internal note</button></form></div>`;
  return `${pageHead(`Booking ${esc(booking.ref)}`,`${fmtDateKey(booking.date)} · ${fmtTime(booking.slot)} · ${esc(booking.source)}`, `<a class="btn btn-outline btn-sm" href="#/ops/bookings">← Bookings</a>${linkedJob ? `<a class="btn btn-dark btn-sm" href="#/ops/jobs/${linkedJob.id}">Open job</a>` : ''}`)}
    <div class="two-col"><div>
      <div class="card"><div class="card-head"><div><h3 class="card-title">Appointment request</h3><p class="card-sub">${esc(booking.ref)} · created ${fmtDateTime(booking.createdAt)}</p></div>${bookingBadge(booking.status)}</div>
        <div class="detail-list"><div class="detail-row"><span class="k">Customer</span><span class="v"><a class="link" href="#/ops/customers/${c?.id}">${esc(c?.name)}</a><br><span class="tiny">${esc(c?.ref)} · ${esc(fmtMobile(c?.mobile))}</span></span></div><div class="detail-row"><span class="k">Vehicle</span><span class="v">${esc(v?.make)} ${esc(v?.model)} ${esc(v?.variant||'')}<br><span class="mono tiny">${esc(fmtReg(v?.reg))}</span></span></div><div class="detail-row"><span class="k">Requested slot</span><span class="v">${fmtDateKey(booking.date)}<br>${fmtTime(booking.slot)}</span></div><div class="detail-row"><span class="k">Type</span><span class="v">${booking.appointmentType === 'pickup' ? 'Pickup requested · subject to availability' : booking.appointmentType === 'inspection' ? 'Inspection' : 'Drop-off'}</span></div><div class="detail-row"><span class="k">Services</span><span class="v">${esc(booking.services.map(id=>serviceById(db,id)?.name).filter(Boolean).join(', '))}</span></div><div class="detail-row"><span class="k">Concerns</span><span class="v">${esc((booking.concerns||[]).join(', ') || '—')}</span></div><div class="detail-row"><span class="k">Customer notes</span><span class="v" style="max-width:320px">${esc(booking.notes || '—')}</span></div><div class="detail-row"><span class="k">Alternative preference</span><span class="v">${esc(booking.altPreference || '—')}</span></div><div class="detail-row"><span class="k">Preferred contact</span><span class="v">${esc(CHANNEL_LABELS[c?.channel] || c?.channel || '—')}</span></div></div>
        <div class="section-divider"></div>
        <div class="btn-group">
          ${['new_request','pending_confirmation','rescheduled'].includes(booking.status) ? `<button class="btn btn-dark btn-sm" data-action="ops.booking.confirm" data-id="${booking.id}">Confirm booking</button>` : ''}
          ${['confirmed','checked_in'].includes(booking.status) && !linkedJob ? `<button class="btn btn-lime btn-sm" data-action="ops.booking.checkin" data-id="${booking.id}">Check in & create job</button>` : ''}
          ${['new_request','pending_confirmation','confirmed','rescheduled'].includes(booking.status) ? `<button class="btn btn-outline btn-sm" data-action="ops.booking.reschedule" data-id="${booking.id}">Reschedule</button><button class="btn btn-ghost btn-sm" data-action="ops.booking.cancel" data-id="${booking.id}" style="color:var(--red)">Cancel</button>` : ''}
          ${booking.status === 'no_show' ? `<button class="btn btn-outline btn-sm" data-action="ops.booking.confirm" data-id="${booking.id}">Reinstate</button>` : ''}
          ${linkedJob ? `<a class="btn btn-outline btn-sm" href="#/ops/jobs/${linkedJob.id}">Open job card</a>` : ''}
        </div>
      </div>
      ${internal}
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">History</h3><p class="card-sub">Customer-safe activity.</p></div></div><div class="timeline">${(booking.history||[]).slice().reverse().map((h,i) => `<div class="tl-item ${i===0?'active':'done'}"><span class="tl-dot"></span><div class="tl-title">${esc(h.label)}</div><div class="tl-meta">${fmtDateTime(h.at)}${h.detail?`<br>${esc(h.detail)}`:''}</div></div>`).join('')}</div></div>
    </div>
    <div>
      <div class="card"><div class="card-head"><div><h3 class="card-title">Customer & vehicle</h3></div></div><div class="detail-list"><div class="detail-row"><span class="k">Name</span><span class="v">${esc(c?.name)}</span></div><div class="detail-row"><span class="k">Mobile</span><span class="v mono">${esc(fmtMobile(c?.mobile))}</span></div><div class="detail-row"><span class="k">Email</span><span class="v">${esc(c?.email || '—')}</span></div><div class="detail-row"><span class="k">Locality</span><span class="v">${esc(c?.address?.locality || '—')}</span></div><div class="detail-row"><span class="k">Consent</span><span class="v">Service ${c?.consents?.service ? 'yes' : 'no'} · Marketing ${c?.consents?.marketing ? 'yes' : 'no'}</span></div><div class="detail-row"><span class="k">Odometer declared</span><span class="v">${v?.odometer ? fmtNum(v.odometer)+' km' : '—'}</span></div></div><div class="btn-group mt-4"><a class="btn btn-outline btn-sm" href="#/ops/customers/${c?.id}">Customer record</a><a class="btn btn-outline btn-sm" href="#/ops/vehicles/${v?.id}">Vehicle record</a></div></div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Capacity check</h3><p class="card-sub">Configured demo capacity per slot.</p></div></div>${(() => { const cap = slotCapacity(db, booking.date, booking.slot); return `<div class="detail-row"><span class="k">Slot</span><span class="v">${fmtDateKey(booking.date)} · ${fmtTime(booking.slot)}</span></div><div class="detail-row"><span class="k">Booked / capacity</span><span class="v">${cap.booked} / ${cap.capacity}</span></div><div class="detail-row"><span class="k">Availability</span><span class="v">${cap.available ? badge('Within capacity','green') : badge('Over capacity','red')}</span></div>`; })()}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Communication</h3><p class="card-sub">Simulated messages only.</p></div></div>${db.communications.filter(x=>x.entityType==='booking'&&x.entityId===booking.id).map(x => `<div class="detail-row"><span class="k">${esc(COMMUNICATION_TYPES[x.type]||x.type)}<br><span class="tiny">${fmtDateTime(x.at)} · ${esc(CHANNEL_LABELS[x.channel]||x.channel)}</span></span><span class="v">${commStatusBadge(x.status)}</span></div>`).join('') || '<p class="small muted">No messages logged.</p>'}<button class="btn btn-outline btn-sm mt-4" data-action="ops.communicate" data-type="booking" data-id="${booking.id}">Send simulated update</button></div>
    </div></div>`;
}

function opsCalendarView() {
  const date = currentRoute.query.get('date') || todayKey();
  const days = Array.from({length:7},(_,i) => addDays(date, i));
  const bookings = db.bookings.filter(b => days.includes(b.date) && !['cancelled','rejected'].includes(b.status));
  const jobs = activeJobs(db);
  return `${pageHead('Calendar','A day-based view of configured booking capacity and workshop load.', `<button class="btn btn-outline btn-sm" data-action="ops.booking.new">${icon('plus','icon-sm')} Add booking</button><button class="btn btn-dark btn-sm" data-action="ops.job.new">${icon('wrench','icon-sm')} Check in</button>`)}
    <div class="card mb-5"><div class="flex between wrap"><div class="flex gap-2"><a class="btn btn-outline btn-sm" href="#/ops/calendar?date=${addDays(date,-7)}">← Previous</a><a class="btn btn-outline btn-sm" href="#/ops/calendar?date=${todayKey()}">Today</a><a class="btn btn-outline btn-sm" href="#/ops/calendar?date=${addDays(date,7)}">Next →</a></div><form data-form="ops.calendar.date" class="flex gap-2"><input class="input" type="date" name="date" value="${date}" style="height:34px"><button class="btn btn-outline btn-sm" type="submit">Go</button></form></div></div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(140px,1fr));gap:10px;overflow-x:auto;padding-bottom:6px">${days.map(key => {
      const dayBookings = bookings.filter(b=>b.date===key).sort((a,b)=>a.slot.localeCompare(b.slot));
      const closed = dateIsClosed(db,key);
      const isToday = key === todayKey();
      return `<div class="card" style="padding:0;border-color:${isToday?'var(--night)':'var(--line)'};min-width:140px"><div style="padding:10px;background:${isToday?'var(--night)':'var(--paper)'};color:${isToday?'var(--white)':'inherit'};border-radius:13px 13px 0 0"><div class="tiny" style="${isToday?'color:rgba(255,255,255,.55)':''}">${new Intl.DateTimeFormat('en-IN',{timeZone:IST,weekday:'short'}).format(dateFromKey(key))}</div><strong style="font-family:var(--font-display);font-size:19px">${new Intl.DateTimeFormat('en-IN',{timeZone:IST,day:'numeric'}).format(dateFromKey(key))}</strong><div class="tiny" style="${isToday?'color:rgba(255,255,255,.5)':''}">${closed ? 'Closed' : `${dayBookings.length} booking${dayBookings.length===1?'':'s'}`}</div></div><div style="padding:8px;display:grid;gap:6px;min-height:160px">${closed ? '<p class="tiny muted">No appointments.</p>' : dayBookings.map(b => { const c=getCustomer(db,b.customerId); return `<a href="#/ops/bookings/${b.id}" style="text-decoration:none;color:inherit;border:1px solid var(--line);border-radius:7px;padding:6px;font-size:9.5px;background:var(--white)"><strong style="display:block">${fmtTime(b.slot)}</strong>${esc(c?.name?.split(' ')[0])}<br><span class="muted">${esc(getVehicle(db,b.vehicleId)?.make)}</span></a>`; }).join('')}${!closed ? `<a href="#/ops/bookings?date=${key}" style="font-size:9px;text-align:center;color:var(--green);text-decoration:none;padding:4px">+ add / view</a>` : ''}</div></div>`;
    }).join('')}</div>
    <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Workshop load by technician</h3><p class="card-sub">Active jobs assigned in this demo.</p></div><a class="link tiny" href="#/ops/workboard">Work board</a></div><div class="table-wrap"><table class="table"><thead><tr><th>Technician</th><th>Open jobs</th><th>Current work</th><th></th></tr></thead><tbody>${db.staff.filter(s=>s.role==='technician'&&s.active).map(s => { const assigned = jobs.filter(j=>(j.techIds||[]).includes(s.id)); return `<tr><td class="main-cell"><strong>${esc(s.name)}</strong><span>${esc(s.title)}</span></td><td>${assigned.length}</td><td>${assigned.map(j=>`<a class="link tiny" href="#/ops/jobs/${j.id}">${esc(j.number)}</a>`).join(', ') || '<span class="muted">Available</span>'}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/ops/staff">Team</a></td></tr>`; }).join('')}</tbody></table></div></div>`;
}

function opsCustomersView() {
  const q = currentRoute.query.get('q') || '';
  const list = searchFilter(db.customers.slice().sort(by('createdAt', -1)), q, ['name','mobile','email','ref']);
  return `${pageHead('Customers','Customer records, consents and linked vehicles.', `<button class="btn btn-dark btn-sm" data-action="ops.customer.new">${icon('plus','icon-sm')} Add customer</button>`)}
    <div class="card pad-0"><div style="padding:14px 16px;border-bottom:1px solid var(--line)"><form data-form="ops.customer.search" class="flex gap-2"><input class="input" name="q" value="${esc(q)}" placeholder="Search by name, mobile, email or reference" style="max-width:380px"><button class="btn btn-outline btn-sm" type="submit">${icon('search','icon-sm')} Search</button></form></div>
    ${list.length ? `<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Customer</th><th>Contact</th><th>Locality</th><th>Vehicles</th><th>Consents</th><th>Status</th><th class="actions"></th></tr></thead><tbody>${list.map(c => { const vh = customerVehicles(db,c.id); return `<tr><td class="main-cell"><strong>${esc(c.name)}</strong><span>${esc(c.ref)} · ${esc(c.type)}</span></td><td>${esc(fmtMobile(c.mobile))}<br><span class="tiny muted">${esc(c.email || 'No email')}</span></td><td>${esc(c.address?.locality || '—')}</td><td>${vh.length}</td><td><span class="tiny">Service: ${c.consents?.service ? 'yes' : 'no'}<br>Marketing: ${c.consents?.marketing ? 'yes' : 'no'}</span></td><td>${badge(c.status || 'active', c.status === 'active' ? 'green' : 'grey', false)}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/ops/customers/${c.id}">Open</a></td></tr>`; }).join('')}</tbody></table></div>` : `<div style="padding:30px">${emptyState('No customers match','Try another search term.','','users')}</div>`}</div>`;
}

function opsCustomerDetailView(id) {
  const c = getCustomer(db, id);
  if (!c) return opsNotFoundView('customer');
  const vehicles = customerVehicles(db, c.id);
  const bookings = customerBookings(db, c.id);
  const jobs = customerJobs(db, c.id).sort(by('createdAt',-1));
  const invoices = customerInvoices(db, c.id);
  const openBalance = invoices.filter(i=>i.status!=='VOID').reduce((s,i)=>s+invoiceTotals(i,db).balance,0);
  return `${pageHead(esc(c.name),`${esc(c.ref)} · ${esc(c.type)} · customer since ${fmtDateKey(c.createdAt.slice(0,10))}`, `<a class="btn btn-outline btn-sm" href="#/ops/customers">← Customers</a><button class="btn btn-outline btn-sm" data-action="ops.customer.edit" data-id="${c.id}">Edit details</button><a class="btn btn-dark btn-sm" href="#/book?service=svc_periodic">New booking</a>`)}
    ${findCustomerMatches(db, c.mobile, c.name).some(m => m.customer.id !== c.id) ? `<div class="alert-strip warn">${icon('alert')}<div class="grow"><strong>Possible duplicate record.</strong> Review linked vehicles and mobile before merging. This demo never auto-merges.</div></div>` : ''}
    <div class="stat-grid mb-5">${statCard('Vehicles',vehicles.length,'Linked records',{icon:'car'})}${statCard('Jobs',jobs.length,`${jobs.filter(j=>j.status==='DELIVERED').length} delivered`,{icon:'wrench'})}${statCard('Bookings',bookings.length,'All time',{icon:'calendar'})}${statCard('Open balance',fmtINR(openBalance),`${invoices.length} invoices`,{icon:'wallet'})}</div>
    <div class="two-col"><div>
      <div class="card"><div class="card-head"><div><h3 class="card-title">Contact & consent</h3></div><span class="badge ${c.guest?'amber':'green'} no-dot">${c.guest?'Guest':'Registered'}</span></div><div class="detail-list"><div class="detail-row"><span class="k">Mobile</span><span class="v mono">${esc(fmtMobile(c.mobile))}</span></div><div class="detail-row"><span class="k">Email</span><span class="v">${esc(c.email || '—')}</span></div><div class="detail-row"><span class="k">Address</span><span class="v">${esc([c.address?.line,c.address?.locality,c.address?.city,c.address?.pincode].filter(Boolean).join(', ') || '—')}</span></div><div class="detail-row"><span class="k">Preferred channel</span><span class="v">${esc(CHANNEL_LABELS[c.channel] || c.channel)}</span></div><div class="detail-row"><span class="k">Essential updates</span><span class="v">${c.consents?.service ? badge('Consented','green',false) : badge('Not consented','grey',false)}</span></div><div class="detail-row"><span class="k">Marketing</span><span class="v">${c.consents?.marketing ? badge('Opted in','blue',false) : badge('Opted out','grey',false)}</span></div><div class="detail-row"><span class="k">Notes</span><span class="v" style="max-width:320px">${esc(c.notes || '—')}</span></div></div></div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Vehicles</h3></div><a class="link tiny" href="#/ops/vehicles">All vehicles</a></div><div class="portal-vehicle-list">${vehicles.map(v=>`<a class="portal-vehicle" href="#/ops/vehicles/${v.id}"><span style="width:30px;height:30px;border-radius:7px;background:var(--paper);display:grid;place-items:center">${icon('car','icon-sm')}</span><span class="grow"><strong>${esc(v.make)} ${esc(v.model)}</strong><span class="tiny muted" style="display:block">${esc(fmtReg(v.reg))} · ${fmtNum(v.odometer)} km</span></span>${icon('chevronRight','icon-sm')}</a>`).join('')||'<p class="small muted">No vehicles linked.</p>'}</div></div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Customer messages</h3><p class="card-sub">Simulated, with delivery state.</p></div><button class="btn btn-outline btn-xs" data-action="ops.communicate" data-type="customer" data-id="${c.id}">Log message</button></div>${db.communications.filter(x=>x.customerId===c.id).slice(0,6).map(x=>`<div class="detail-row"><span class="k">${esc(COMMUNICATION_TYPES[x.type]||x.type)}<br><span class="tiny">${fmtDateTime(x.at)}</span></span><span class="v">${commStatusBadge(x.status)}</span></div>`).join('')||'<p class="small muted">No messages yet.</p>'}</div>
    </div>
    <div>
      <div class="card"><div class="card-head"><div><h3 class="card-title">Service history</h3></div></div><div class="timeline">${jobs.map(j=>`<div class="tl-item ${j.status==='DELIVERED'?'done':'active'}"><span class="tl-dot"></span><div class="tl-title">${esc(j.number)} ${jobBadge(j.status)}</div><div class="tl-meta">${fmtDateKey(j.createdAt.slice(0,10))} · ${esc(getVehicle(db,j.vehicleId)?.make)} ${esc(getVehicle(db,j.vehicleId)?.model)}<br>${esc((j.concerns||[]).join(', ')||j.concern||'Service visit')} · <a class="link" href="#/ops/jobs/${j.id}">open job</a></div></div>`).join('')||'<p class="small muted">No jobs yet.</p>'}</div></div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Bookings</h3></div><a class="link tiny" href="#/ops/bookings?q=${encodeURIComponent(c.mobile)}">View in bookings</a></div>${bookings.slice(0,6).map(b=>`<a class="detail-row" href="#/ops/bookings/${b.id}" style="text-decoration:none;color:inherit"><span class="k">${fmtDateKey(b.date)} · ${fmtTime(b.slot)}<br><span class="tiny">${esc(b.ref)}</span></span><span class="v">${bookingBadge(b.status)}</span></a>`).join('')||'<p class="small muted">No bookings.</p>'}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Invoices</h3></div></div>${invoices.map(i=>{const t=invoiceTotals(i,db);return `<a class="detail-row" href="#/ops/invoices/${i.id}" style="text-decoration:none;color:inherit"><span class="k">${esc(i.ref)}<br><span class="tiny">${fmtDateKey(i.date)}</span></span><span class="v">${fmtINR(t.total)}<br>${invoiceBadge(i)}</span></a>`;}).join('')||'<p class="small muted">No invoices.</p>'}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Possible duplicate check</h3><p class="card-sub">No automatic merge is performed.</p></div></div>${findCustomerMatches(db,c.mobile,c.name).filter(m=>m.customer.id!==c.id).map(m=>`<div class="detail-row"><span class="k">${esc(m.customer.name)}<br><span class="tiny">${esc(m.customer.ref)} · ${esc(fmtMobile(m.customer.mobile))}</span></span><span class="v"><a class="btn btn-outline btn-xs" href="#/ops/customers/${m.customer.id}">Review</a></span></div>`).join('')||'<p class="tiny muted">No obvious duplicates by mobile. Vehicle and name checks should still be done by staff.</p>'}</div>
    </div></div>`;
}

function opsVehiclesView() {
  const q = currentRoute.query.get('q') || '';
  const list = searchFilter(db.vehicles.slice(), q, ['reg','make','model','variant', v => getCustomer(db,v.customerId)?.name]);
  return `${pageHead('Vehicles','Registration, ownership and service records.', `<button class="btn btn-dark btn-sm" data-action="ops.vehicle.new">${icon('plus','icon-sm')} Add vehicle</button>`)}
    <div class="card pad-0"><div style="padding:14px 16px;border-bottom:1px solid var(--line)"><form data-form="ops.vehicle.search" class="flex gap-2"><input class="input" name="q" value="${esc(q)}" placeholder="Search registration, model or owner" style="max-width:380px"><button class="btn btn-outline btn-sm" type="submit">${icon('search','icon-sm')} Search</button></form></div>
    ${list.length ? `<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Registration</th><th>Vehicle</th><th>Owner</th><th>Odometer</th><th>Jobs</th><th>Status</th><th class="actions"></th></tr></thead><tbody>${list.map(v=>{const c=getCustomer(db,v.customerId);const jobCount=db.jobs.filter(j=>j.vehicleId===v.id).length;return `<tr><td class="main-cell"><strong class="mono">${esc(fmtReg(v.reg))}</strong><span>${esc(v.year)} · ${esc(v.fuel)}</span></td><td class="main-cell"><strong>${esc(v.make)} ${esc(v.model)}</strong><span>${esc(v.variant||'')} · ${esc(v.transmission)}</span></td><td><a class="link" href="#/ops/customers/${c?.id}">${esc(c?.name||'Unlinked')}</a><br><span class="tiny muted">${esc(c?.ref||'')}</span></td><td>${fmtNum(v.odometer)} km</td><td>${jobCount}</td><td>${badge(v.status||'active',v.status==='active'?'green':'grey',false)}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/ops/vehicles/${v.id}">Open</a></td></tr>`;}).join('')}</tbody></table></div>` : `<div style="padding:30px">${emptyState('No vehicles match','Try another search term.','','car')}</div>`}</div>`;
}

function opsVehicleDetailView(id) {
  const v = getVehicle(db,id);
  if (!v) return opsNotFoundView('vehicle');
  const c = getCustomer(db,v.customerId);
  const jobs = db.jobs.filter(j=>j.vehicleId===v.id).sort(by('createdAt',-1));
  const invoices = db.invoices.filter(i=>i.vehicleId===v.id);
  return `${pageHead(`${esc(v.make)} ${esc(v.model)}`, `${esc(fmtReg(v.reg))} · ${esc(v.fuel)} · ${esc(v.transmission)} · ${fmtNum(v.odometer)} km`, `<a class="btn btn-outline btn-sm" href="#/ops/vehicles">← Vehicles</a><button class="btn btn-outline btn-sm" data-action="ops.vehicle.edit" data-id="${v.id}">Edit vehicle</button>`)}
    <div class="two-col"><div><div class="card"><div class="card-head"><div><h3 class="card-title">Vehicle record</h3></div><span class="badge ${v.status==='active'?'green':'grey'} no-dot">${esc(v.status||'active')}</span></div><div class="detail-list"><div class="detail-row"><span class="k">Registration</span><span class="v mono">${esc(fmtReg(v.reg))}</span></div><div class="detail-row"><span class="k">Owner</span><span class="v"><a class="link" href="#/ops/customers/${c?.id}">${esc(c?.name||'Unlinked')}</a><br><span class="tiny">${esc(c?.ref||'')} · ${esc(fmtMobile(c?.mobile))}</span></span></div><div class="detail-row"><span class="k">Make / model / variant</span><span class="v">${esc(v.make)} ${esc(v.model)} ${esc(v.variant||'')}</span></div><div class="detail-row"><span class="k">Year / fuel / transmission</span><span class="v">${v.year} · ${esc(v.fuel)} · ${esc(v.transmission)}</span></div><div class="detail-row"><span class="k">Odometer</span><span class="v">${fmtNum(v.odometer)} km</span></div><div class="detail-row"><span class="k">Colour / nickname</span><span class="v">${esc(v.color||'—')} · ${esc(v.nickname||'—')}</span></div><div class="detail-row"><span class="k">Notes</span><span class="v" style="max-width:330px">${esc(v.notes||'—')}</span></div></div></div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Job history</h3></div></div><div class="timeline">${jobs.map(j=>`<div class="tl-item ${j.status==='DELIVERED'?'done':'active'}"><span class="tl-dot"></span><div class="tl-title">${esc(j.number)} ${jobBadge(j.status)}</div><div class="tl-meta">${fmtDateKey(j.createdAt.slice(0,10))} · ${esc((j.concerns||[]).join(', ')||j.concern||'Service visit')} · <a class="link" href="#/ops/jobs/${j.id}">open</a></div></div>`).join('')||'<p class="small muted">No jobs.</p>'}</div></div></div>
      <div><div class="card"><div class="card-head"><div><h3 class="card-title">Next service guidance</h3><p class="card-sub">Demo guidance, not a manufacturer schedule.</p></div></div><p class="small muted">Based on the last recorded odometer and visit, the prototype can schedule a reminder. The garage must confirm the actual interval for this vehicle. No date is guaranteed.</p><button class="btn btn-outline btn-sm mt-4" data-action="ops.reminder.new" data-vehicle="${v.id}">${icon('bell','icon-sm')} Create reminder</button></div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Invoices</h3></div></div>${invoices.map(i=>{const t=invoiceTotals(i,db);return `<a class="detail-row" href="#/ops/invoices/${i.id}" style="text-decoration:none;color:inherit"><span class="k">${esc(i.ref)}<br><span class="tiny">${fmtDateKey(i.date)}</span></span><span class="v">${fmtINR(t.total)}<br>${invoiceBadge(i)}</span></a>`;}).join('')||'<p class="small muted">No invoices.</p>'}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Ownership check</h3></div></div><p class="tiny muted">Registration conflicts are blocked at booking and never auto-overwritten. Staff must verify ownership before changing a vehicle's customer link.</p></div></div></div>`;
}

function opsNotFoundView(kind) {
  return `<div class="card">${emptyState('Record not found',`This ${kind} does not exist in the demo database.`,'<a class="btn btn-dark btn-sm" href="#/ops">Back to dashboard</a>','search')}</div>`;
}

function opsJobsView() {
  const q = currentRoute.query;
  const status = q.get('status') || 'active';
  const search = q.get('q') || '';
  let list = db.jobs.slice();
  if (status === 'active') list = list.filter(j => !['DELIVERED','CANCELLED'].includes(j.status));
  else if (status === 'all') {}
  else if (status === 'ready') list = list.filter(j => j.status === 'READY_FOR_COLLECTION');
  else list = list.filter(j => j.status === status);
  list = searchFilter(list, search, [j => j.number, j => getCustomer(db,j.customerId)?.name, j => getVehicle(db,j.vehicleId)?.reg, j => (j.concerns||[]).join(' ') || j.concern]);
  return `${pageHead('Job cards','Every vehicle visit, its tasks, approvals and documents.', `<a class="btn btn-outline btn-sm" href="#/ops/workboard">${icon('grid','icon-sm')} Work board</a><button class="btn btn-dark btn-sm" data-action="ops.job.new">${icon('plus','icon-sm')} Check in vehicle</button>`)}
    <div class="card pad-0"><div style="padding:14px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--line)">
      <div class="pill-tabs">${[['active','Active'],['AWAITING_APPROVAL','Approval'],['AWAITING_PARTS','Parts'],['QUALITY_CHECK','QC'],['ready','Ready'],['DELIVERED','Delivered'],['all','All']].map(([k,l])=>`<a href="#/ops/jobs?status=${k}" style="text-decoration:none" class="${status===k?'active':''}">${l}</a>`).join('')}</div>
      <form data-form="ops.job.search" style="margin-left:auto;display:flex;gap:6px"><input class="input" name="q" value="${esc(search)}" placeholder="Search job, customer or reg" style="height:34px;width:220px"><button class="btn btn-outline btn-sm" type="submit">${icon('search','icon-sm')}</button></form>
    </div>
    ${list.length ? `<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Job</th><th>Customer</th><th>Vehicle</th><th>Concern</th><th>Technician</th><th>Expected</th><th>Status</th><th class="actions"></th></tr></thead><tbody>${list.map(j=>{const c=getCustomer(db,j.customerId),v=getVehicle(db,j.vehicleId);const techs=(j.techIds||[]).map(id=>getStaff(db,id)?.name.split(' ')[0]).filter(Boolean).join(', ');return `<tr><td class="main-cell"><strong>${esc(j.number)}</strong><span>${fmtDateKey(j.createdAt.slice(0,10))}</span></td><td>${esc(c?.name)}<br><span class="tiny muted">${esc(fmtMobile(c?.mobile))}</span></td><td class="main-cell"><strong>${esc(v?.make)} ${esc(v?.model)}</strong><span class="mono">${esc(fmtReg(v?.reg))}</span></td><td style="max-width:190px">${esc((j.concerns||[]).join(', ')||j.concern||'—')}</td><td>${esc(techs||'Unassigned')}</td><td>${j.expectedAt?fmtDateKey(j.expectedAt.slice(0,10)):'—'}</td><td>${jobBadge(j.status)}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/ops/jobs/${j.id}">Open</a></td></tr>`;}).join('')}</tbody></table></div>` : `<div style="padding:30px">${emptyState('No jobs match','Try another filter or search.','','clipboard')}</div>`}</div>`;
}

function taskStatusBadge(status) {
  const map = {pending:['Pending','grey'],in_progress:['In progress','blue'],blocked:['Blocked','amber'],completed:['Completed','green'],declined:['Declined','red']};
  const v = map[status] || [status,'grey'];
  return badge(v[0],v[1],false);
}

function opsJobDetailView(id) {
  const job = getJob(db,id);
  if (!job) return opsNotFoundView('job');
  const c = getCustomer(db,job.customerId), v = getVehicle(db,job.vehicleId);
  const inspection = jobInspection(db,job);
  const estimates = jobEstimates(db,job.id);
  const invoice = jobInvoice(db,job);
  const techs = (job.techIds||[]).map(tid=>getStaff(db,tid)).filter(Boolean);
  const isTech = db.session.kind === 'staff' && currentStaff(db)?.role === 'technician';
  const nextStatuses = (JOB_STATUS[job.status]?.next || []).filter(s => !['CANCELLED'].includes(s));
  const qcPassed = (job.qualityChecks||[]).some(q => q.result === 'pass');
  const statusActions = {
    'APPROVED':['IN_PROGRESS'],'IN_PROGRESS':['AWAITING_PARTS','QUALITY_CHECK'],'AWAITING_PARTS':['IN_PROGRESS'],'QUALITY_CHECK':qcPassed?['WORK_COMPLETED','IN_PROGRESS']:['IN_PROGRESS'],'WORK_COMPLETED':['READY_FOR_COLLECTION','QUALITY_CHECK'],'READY_FOR_COLLECTION':['DELIVERED','WORK_COMPLETED'],'CHECKED_IN':['INSPECTION_PENDING','INSPECTION_IN_PROGRESS'],'INSPECTION_PENDING':['INSPECTION_IN_PROGRESS'],'INSPECTION_IN_PROGRESS':['ESTIMATE_PREPARATION','APPROVED'],'ESTIMATE_PREPARATION':['AWAITING_APPROVAL'],'AWAITING_APPROVAL':['APPROVED']
  }[job.status] || nextStatuses.slice(0,2);
  return `${pageHead(`Job ${esc(job.number)}`,`${esc(c?.name)} · ${esc(v?.make)} ${esc(v?.model)} · ${esc(fmtReg(v?.reg))}`, `<a class="btn btn-outline btn-sm" href="#/ops/jobs">← Jobs</a>${!isTech ? `<a class="btn btn-outline btn-sm" href="#/ops/inspections/${job.id}">${icon('clipboard','icon-sm')} Inspection</a><button class="btn btn-outline btn-sm" data-action="ops.estimate.new" data-job="${job.id}">${icon('plus','icon-sm')} Estimate</button>` : ''}${job.status === 'READY_FOR_COLLECTION' && !isTech ? `<button class="btn btn-dark btn-sm" data-action="ops.delivery.open" data-id="${job.id}">Release vehicle</button>` : ''}`)}
    <div class="alert-strip ${job.priority === 'High' ? 'warn' : 'info'}">${icon(job.priority === 'High' ? 'alert' : 'wrench')}<div class="grow"><strong>${jobBadge(job.status)} ${job.priority === 'High' ? '<span style="color:var(--red)">High priority</span>' : ''}</strong><br>${esc(job.notes || 'No job notes.')}</div><span class="tiny">${job.delayReason ? `Delay: ${esc(job.delayReason)}` : ''}</span></div>
    <div class="two-col"><div>
      <div class="card"><div class="card-head"><div><h3 class="card-title">Vehicle & handover</h3><p class="card-sub">Checked in ${fmtDateTime(job.checkInAt)}</p></div>${jobBadge(job.status)}</div><div class="detail-list"><div class="detail-row"><span class="k">Vehicle</span><span class="v"><a class="link" href="#/ops/vehicles/${v?.id}">${esc(v?.make)} ${esc(v?.model)}</a><br><span class="mono tiny">${esc(fmtReg(v?.reg))}</span></span></div><div class="detail-row"><span class="k">Odometer at check-in</span><span class="v">${fmtNum(job.odometer)} km</span></div><div class="detail-row"><span class="k">Fuel</span><span class="v">${esc(job.fuel||'—')}</span></div><div class="detail-row"><span class="k">Condition</span><span class="v" style="max-width:320px">${Object.entries(job.condition||{}).map(([k,val])=>`${esc(k)}: ${esc(val)}`).join('<br>')}</span></div><div class="detail-row"><span class="k">Concerns</span><span class="v">${esc((job.concerns||[]).join(', ')||'—')}</span></div><div class="detail-row"><span class="k">Advisor</span><span class="v">${esc(getStaff(db,job.advisorId)?.name||'—')}</span></div><div class="detail-row"><span class="k">Technicians</span><span class="v">${esc(techs.map(t=>t.name).join(', ')||'Unassigned')}</span></div><div class="detail-row"><span class="k">Expected completion</span><span class="v">${job.expectedAt?fmtDateTime(job.expectedAt):'—'}</span></div></div>
        <div class="section-divider"></div>
        <div class="btn-group">${statusActions.map(s=>`<button class="btn ${s==='DELIVERED'?'btn-lime':s==='IN_PROGRESS'?'btn-dark':'btn-outline'} btn-sm" data-action="ops.job.status" data-status="${s}" data-id="${job.id}">${s==='IN_PROGRESS'?icon('play','icon-sm'):''} ${esc(jobStageLabel(s))}</button>`).join('')}${!isTech&&!['DELIVERED','CANCELLED'].includes(job.status)?`<button class="btn btn-ghost btn-sm" data-action="ops.job.assign" data-id="${job.id}">Assign</button><button class="btn btn-ghost btn-sm" data-action="ops.job.delay" data-id="${job.id}">Update ETA</button>`:''}</div>
      </div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Tasks</h3><p class="card-sub">Technician checklist for this job.</p></div>${!isTech ? `<button class="btn btn-outline btn-xs" data-action="ops.task.new" data-job="${job.id}">Add task</button>` : ''}</div>
        ${(job.tasks||[]).map((t,i)=>`<div class="line-check"><input type="checkbox" ${t.status==='completed'?'checked':''} ${t.status==='declined'?'disabled':''} data-action="ops.task.toggle" data-job="${job.id}" data-task="${t.id}" aria-label="Mark ${esc(t.title)} complete"><span class="l"><strong>${esc(t.title)} ${taskStatusBadge(t.status)}</strong><span>${esc(getStaff(db,t.assigneeId)?.name||'Unassigned')} ${t.minutes?`· ${t.minutes} min`:''} ${t.note?`· ${esc(t.note)}`:''}</span></span></div>`).join('')||'<p class="small muted">No tasks yet.</p>'}
      </div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Inspection summary</h3><p class="card-sub">Customer-safe findings only below.</p></div>${inspection?`<a class="btn btn-outline btn-xs" href="#/ops/inspections/${job.id}">Edit inspection</a>`:''}</div>${inspection?`<div class="flex gap-2 wrap mb-3">${badge(inspection.status==='completed'?'Inspection complete':'Inspection in progress',inspection.status==='completed'?'green':'amber',false)}${(inspection.items||[]).filter(i=>i.result==='urgent').length?badge(`${(inspection.items||[]).filter(i=>i.result==='urgent').length} urgent`,'red',false):''}</div><div class="timeline">${(inspection.items||[]).filter(i=>i.result&&i.result!=='good'&&i.result!=='not_inspected'&&i.result!=='na').slice(0,6).map(i=>`<div class="tl-item ${i.result==='urgent'?'active':'done'}"><span class="tl-dot"></span><div class="tl-title">${esc(i.label)} ${inspectionResultBadge(i.result)}</div><div class="tl-meta">${esc(i.note||'No customer note.')}${i.recommendedAction?`<br><strong>Recommendation:</strong> ${esc(i.recommendedAction)}`:''}</div></div>`).join('')||'<p class="small muted">No customer-visible findings yet.</p>'}</div>`:'<p class="small muted">No inspection created for this job.</p>'}</div>
    </div>
    <div>
      <div class="card"><div class="card-head"><div><h3 class="card-title">Documents</h3></div></div><div class="detail-list">
        ${estimates.map(e=>{const t=estimateTotals(e,db);return `<a class="detail-row" href="#/ops/estimates/${e.id}" style="text-decoration:none;color:inherit"><span class="k">${esc(e.ref)} · ${esc(e.kind)}<br><span class="tiny">${fmtDateKey(e.createdAt.slice(0,10))} · authorised ${fmtINR(estimateAuthorizedTotal(e,db))}</span></span><span class="v">${fmtINR(t.total)}<br>${estimateBadge(e.status)}</span></a>`;}).join('')||'<p class="small muted">No estimate yet.</p>'}
        ${invoice?`<a class="detail-row" href="#/ops/invoices/${invoice.id}" style="text-decoration:none;color:inherit"><span class="k">Invoice ${esc(invoice.ref)}<br><span class="tiny">${fmtDateKey(invoice.date)}</span></span><span class="v">${fmtINR(invoiceTotals(invoice,db).total)}<br>${invoiceBadge(invoice)}</span></a>`:''}
      </div>${!invoice&&!isTech?`<button class="btn btn-outline btn-sm mt-4" data-action="ops.invoice.fromJob" data-id="${job.id}">Create invoice from approved lines</button>`:''}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Quality checks</h3><p class="card-sub">Second check before release.</p></div>${!isTech && job.status === 'QUALITY_CHECK' ? `<button class="btn btn-outline btn-xs" data-action="ops.qc.new" data-id="${job.id}">Record QC</button>` : ''}</div>${(job.qualityChecks||[]).map(q=>`<div class="detail-row"><span class="k">${fmtDateTime(q.at)}<br><span class="tiny">${esc(getStaff(db,q.by)?.name||'—')}</span></span><span class="v">${badge(q.result==='pass'?'Passed':'Failed',q.result==='pass'?'green':'red',false)}<div class="tiny muted" style="font-weight:400">${esc((q.items||[]).join(', '))}${q.notes?`<br>${esc(q.notes)}`:''}</div></span></div>`).join('')||'<p class="small muted">No quality check recorded.</p>'}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Internal notes</h3><p class="card-sub">Never shown to the customer.</p></div><span class="badge amber no-dot">Internal</span></div><div class="timeline">${(job.internalNotes||[]).slice().reverse().map(n=>`<div class="tl-item done"><span class="tl-dot"></span><div class="tl-title">${esc(getStaff(db,n.by)?.name||n.by)}</div><div class="tl-meta">${fmtDateTime(n.at)}<br>${esc(n.text)}</div></div>`).join('')||'<p class="small muted">No internal notes.</p>'}</div><form data-form="ops.job.note" class="mt-3"><input type="hidden" name="id" value="${job.id}"><textarea class="textarea" name="note" required maxlength="600" placeholder="Add a private note for the team…"></textarea><button class="btn btn-outline btn-sm mt-2" type="submit">Add internal note</button></form></div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Customer updates</h3><p class="card-sub">What the customer can see.</p></div></div><div class="timeline">${(job.customerUpdates||[]).slice().reverse().map(n=>`<div class="tl-item done"><span class="tl-dot"></span><div class="tl-title">${esc(n.by||'Gear Go')}</div><div class="tl-meta">${fmtDateTime(n.at)}<br>${esc(n.text)}</div></div>`).join('')||'<p class="small muted">No customer-visible updates.</p>'}</div><form data-form="ops.job.customerUpdate" class="mt-3"><input type="hidden" name="id" value="${job.id}"><textarea class="textarea" name="text" required maxlength="500" placeholder="Add a customer-safe update…"></textarea><button class="btn btn-outline btn-sm mt-2" type="submit">Post customer update</button></form></div>
    </div></div>`;
}

function opsWorkboardView() {
  const columns = [
    ['CHECKED_IN','Checked in'],['INSPECTION_IN_PROGRESS','Inspection'],['ESTIMATE_PREPARATION','Estimate'],['AWAITING_APPROVAL','Approval'],['APPROVED','Approved'],['IN_PROGRESS','In progress'],['AWAITING_PARTS','Awaiting parts'],['QUALITY_CHECK','Quality check'],['WORK_COMPLETED','Completed'],['READY_FOR_COLLECTION','Ready']
  ];
  return `${pageHead('Work board','A live operational view. Click a job to open its card.', `<a class="btn btn-outline btn-sm" href="#/ops/jobs">${icon('clipboard','icon-sm')} List view</a><button class="btn btn-dark btn-sm" data-action="ops.job.new">${icon('plus','icon-sm')} Check in</button>`)}
    <div style="display:grid;grid-template-columns:repeat(5,minmax(180px,1fr));gap:12px;overflow-x:auto;padding-bottom:8px">${columns.map(([status,label])=>{const list=db.jobs.filter(j=>j.status===status);return `<div class="card" style="padding:10px;background:var(--paper-2);min-width:180px"><div class="flex between mb-2"><strong style="font-size:11px;text-transform:uppercase;letter-spacing:.06em">${label}</strong><span class="badge grey no-dot">${list.length}</span></div>${list.map(j=>{const v=getVehicle(db,j.vehicleId),c=getCustomer(db,j.customerId);return `<a href="#/ops/jobs/${j.id}" style="display:block;text-decoration:none;color:inherit;background:var(--white);border:1px solid var(--line);border-radius:9px;padding:9px;margin-bottom:8px"><strong style="font-size:10.5px;display:block">${esc(j.number)} · ${esc(j.priority)}</strong><span style="font-size:10px;color:var(--muted);display:block;margin-top:3px">${esc(c?.name)}</span><span style="font-size:9.5px;color:var(--muted)">${esc(v?.make)} ${esc(v?.model)} · ${esc(fmtReg(v?.reg))}</span><div class="flex between mt-2">${jobBadge(j.status)}<span class="tiny muted">${j.expectedAt?fmtDateKey(j.expectedAt.slice(0,10)).slice(0,6):''}</span></div></a>`;}).join('')||`<p class="tiny muted" style="text-align:center;padding:12px 0">Empty</p>`}</div>`;}).join('')}</div>
    <p class="tiny muted mt-3">Columns reflect the current demo status. Cancelled jobs are excluded from this board.</p>`;
}

function opsInspectionView(jobId) {
  const job = getJob(db,jobId);
  if (!job) return opsNotFoundView('job');
  const inspection = jobInspection(db,job);
  const v = getVehicle(db,job.vehicleId);
  if (!inspection) return `<div class="card">${emptyState('No inspection for this job','Create an inspection record from the job card first.','<a class="btn btn-dark btn-sm" href="#/ops/jobs/'+jobId+'">Back to job</a>','clipboard')}</div>`;
  const completed = inspection.status === 'completed';
  return `${pageHead(`Inspection · ${esc(job.number)}`,`${esc(v?.make)} ${esc(v?.model)} · ${esc(fmtReg(v?.reg))} · ${completed ? 'completed' : 'in progress'}`, `<a class="btn btn-outline btn-sm" href="#/ops/jobs/${job.id}">← Job card</a><button class="btn btn-outline btn-sm" data-action="print">${icon('print','icon-sm')} Print</button>`)}
    <div class="alert-strip info">${icon('info')}<div class="grow"><strong>Only results and customer notes are visible to the customer.</strong> Internal notes, priority and approval flags remain internal. Findings are observations, not guarantees.</div></div>
    <form data-form="ops.inspection.save" data-job="${job.id}" data-inspection="${inspection.id}">
      <div class="card"><div class="card-head"><div><h3 class="card-title">Inspection checklist</h3><p class="card-sub">${esc(INSPECTION_TEMPLATE.length)} configured demo checks. Mark “not inspected” rather than guessing.</p></div><div class="flex gap-2">${badge(completed?'Completed':'In progress',completed?'green':'amber',false)}<span class="badge grey no-dot">${inspection.items.filter(i=>i.result&&i.result!=='not_inspected').length}/${inspection.items.length} checked</span></div></div>
      <div class="checklist-editor">${inspection.items.map((item,idx)=>`<div class="inspect-item"><button type="button" class="inspect-head" data-action="inspection.toggle" data-target="insp-body-${idx}" aria-expanded="false"><span class="status-dot" style="background:${item.result==='urgent'?'var(--red)':item.result==='attention'?'var(--amber)':item.result==='good'?'var(--green)':item.result==='monitor'?'var(--blue)':'var(--muted-2)'}"></span><span class="title">${esc(item.label)} ${item.needsApproval?badge('Approval','amber',false):''}</span><span class="cat">${esc(item.cat)}</span>${icon('chevronDown','icon-sm')}</button><div class="inspect-body" id="insp-body-${idx}">
        <div class="grid-3" style="gap:10px"><div class="field"><label>Result</label><select class="select" name="result_${item.key}">${Object.entries(INSPECTION_RESULTS).map(([k,r])=>`<option value="${k}" ${item.result===k?'selected':''}>${esc(r.label)}</option>`).join('')}</select></div><div class="field"><label>Priority</label><select class="select" name="priority_${item.key}"><option value="">None</option>${['Low','Medium','High'].map(p=>`<option ${item.priority===p?'selected':''}>${p}</option>`).join('')}</select></div><div class="field" style="display:flex;align-items:flex-end"><label class="check"><input type="checkbox" name="approval_${item.key}" ${item.needsApproval?'checked':''}> Needs customer approval</label></div></div>
        <div class="field mt-2"><label>Customer-visible note</label><textarea class="textarea" name="note_${item.key}" maxlength="500" placeholder="Explain what was observed in plain language">${esc(item.note)}</textarea></div>
        <div class="field mt-2"><label>Recommended action (customer-visible)</label><input class="input" name="action_${item.key}" maxlength="200" value="${esc(item.recommendedAction)}"></div>
        <div class="field mt-2"><label>Internal note (never customer-visible)</label><input class="input" name="internal_${item.key}" maxlength="200" value="${esc(item.internalNote||'')}" placeholder="Optional internal context"></div>
      </div></div>`).join('')}</div>
      <div class="flex between wrap mt-4"><div class="tiny muted">Saving does not send an estimate. Additional work still requires a separate customer decision.</div><div class="btn-group"><button class="btn btn-outline" type="button" data-action="ops.inspection.complete" data-job="${job.id}" data-id="${inspection.id}">Save & mark complete</button><button class="btn btn-dark" type="submit">Save inspection</button></div></div></div>
    </form>`;
}

function opsApprovalsView() {
  const pending = pendingApprovals(db);
  const all = db.estimates.slice().sort(by('createdAt',-1)).slice(0,10);
  return `${pageHead('Approval queue','Track what the customer has explicitly authorised. Viewing is not approval.', '')}
    <div class="alert-strip warn">${icon('shield')}<div class="grow"><strong>Never start paid additional work from a viewed estimate.</strong> A decision must be explicitly recorded. Supplementary estimates preserve earlier approvals and declines.</div></div>
    <div class="stat-grid mb-5">${statCard('Awaiting decision',pending.length,'Sent or viewed',{icon:'clock',accent:pending.length>0})}${statCard('Total waiting value',fmtINR(pending.reduce((s,e)=>s+estimateTotals(e,db).total,0)),'Estimate totals, incl. demo tax',{icon:'wallet'})}${statCard('Approved today',db.audit.filter(a=>a.action==='approval.approved'&&dateKeyOf(new Date(a.at))===todayKey()).length,'Recorded decisions',{icon:'check'})}${statCard('Declined lines',db.estimates.reduce((s,e)=>s+(e.decisions||[]).filter(d=>d.decision==='decline').reduce((x,d)=>x+(d.lineIds||[]).length,0),0),'Preserved in records',{icon:'shield'})}</div>
    <div class="card pad-0"><div style="padding:14px 16px;border-bottom:1px solid var(--line)"><h3 class="card-title">Pending customer decisions</h3></div>${pending.length?`<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Estimate</th><th>Customer</th><th>Vehicle</th><th>Sent / viewed</th><th>Total</th><th>Status</th><th class="actions"></th></tr></thead><tbody>${pending.map(e=>{const c=getCustomer(db,e.customerId),v=getVehicle(db,e.vehicleId);return `<tr><td class="main-cell"><strong>${esc(e.ref)}</strong><span>${esc(e.kind)} · ${esc(e.jobId?getJob(db,e.jobId)?.number:'')}</span></td><td>${esc(c?.name)}<br><span class="tiny muted">${esc(fmtMobile(c?.mobile))}</span></td><td>${esc(v?.make)} ${esc(v?.model)}<br><span class="tiny muted mono">${esc(fmtReg(v?.reg))}</span></td><td>${e.sentAt?fmtDateTime(e.sentAt):'Not sent'}<br><span class="tiny muted">${e.viewedAt?'Viewed '+fmtDateTime(e.viewedAt):'Not viewed'}</span></td><td class="mono">${fmtINR(estimateTotals(e,db).total)}</td><td>${estimateBadge(e.status)}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/ops/estimates/${e.id}">Open</a></td></tr>`;}).join('')}</tbody></table></div>`:`<div style="padding:30px">${emptyState('Approval queue is clear','No estimate is currently waiting for a customer decision.','','shield')}</div>`}</div>
    <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Recent estimates</h3><p class="card-sub">All statuses, newest first.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Estimate</th><th>Customer</th><th>Job</th><th>Authorised</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${all.map(e=>{const c=getCustomer(db,e.customerId);return `<tr><td>${esc(e.ref)}</td><td>${esc(c?.name)}</td><td>${esc(e.jobId?getJob(db,e.jobId)?.number:'—')}</td><td class="mono">${fmtINR(estimateAuthorizedTotal(e,db))}</td><td class="mono">${fmtINR(estimateTotals(e,db).total)}</td><td>${estimateBadge(e.status)}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/ops/estimates/${e.id}">Open</a></td></tr>`;}).join('')}</tbody></table></div></div>`;
}

function opsEstimateDetailView(id) {
  const est = getEstimate(db,id);
  if (!est) return opsNotFoundView('estimate');
  const job = getJob(db,est.jobId), c = getCustomer(db,est.customerId), v = getVehicle(db,est.vehicleId);
  const t = estimateTotals(est,db), auth = estimateAuthorizedTotal(est,db);
  const approved = approvedLineIds(est), declined = declinedLineIds(est);
  return `${pageHead(`Estimate ${esc(est.ref)}`,`${esc(c?.name)} · ${esc(v?.make)} ${esc(v?.model)} · ${esc(job?.number||'')}`, `<a class="btn btn-outline btn-sm" href="#/ops/approvals">← Approvals</a>${job?`<a class="btn btn-outline btn-sm" href="#/ops/jobs/${job.id}">Job card</a>`:''}${est.status==='DRAFT'?`<button class="btn btn-dark btn-sm" data-action="ops.estimate.send" data-id="${est.id}">Send to customer</button>`:`<button class="btn btn-outline btn-sm" data-action="ops.estimate.remind" data-id="${est.id}">Send reminder</button>`}`)}
    ${est.kind==='supplementary'?`<div class="alert-strip info">${icon('layers')}<div class="grow"><strong>Supplementary estimate.</strong> The parent estimate’s decisions remain unchanged. Only new lines are included here.</div></div>`:''}
    <div class="two-col"><div><div class="card pad-0"><div style="padding:20px;border-bottom:1px solid var(--line)"><div class="flex between wrap"><div><div class="tiny muted">Demo estimate</div><h2 style="font-family:var(--font-display);font-size:24px">${esc(est.ref)}</h2><p class="small muted mt-1">${esc(est.kind)} · version ${est.version} · valid until ${fmtDateKey(est.validUntil)}</p></div><div class="text-right">${estimateBadge(est.status)}<div class="tiny muted mt-2">${est.sentAt?`Sent ${fmtDateTime(est.sentAt)}`:'Not sent'}</div></div></div></div>
      <div style="padding:0 20px">${est.lines.map((line,i)=>{const calc=estimateLineCalc(line,db.settings.tax.rate,db.settings.tax.enabled);const state=approved.has(line.id)?'approved':declined.has(line.id)?'declined':null;return `<div class="est-line" style="padding:14px 0"><div class="desc"><strong>${i+1}. ${esc(line.description)} ${line.partId?`<span class="badge grey no-dot">Part</span>`:''}</strong><span>${esc(line.type)} · ${esc(line.category)} · Qty ${line.qty} × ${fmtINR(line.unitPrice)}${line.discountPct?` · ${line.discountPct}% discount`:''}</span>${line.partId?(()=>{const p=getPart(db,line.partId);const av=p?partAvailable(p):0;return `<span class="tiny muted" style="display:block">Part stock ${p?p.stock:0} · available ${av}${av<=0?' · shortage':''}</span>`;})():''}</div><div style="text-align:right"><span class="amt">${fmtINR(calc.total)}</span><div class="mt-1">${state?badge(state==='approved'?'Approved':'Declined',state==='approved'?'green':'red',false):badge('Undecided','grey',false)}</div></div></div>`;}).join('')}</div>
      <div class="est-total">${moneyRow('Subtotal',fmtINR(t.base))}${t.discount?moneyRow('Discount','− '+fmtINR(t.discount)):''}${moneyRow('Tax',fmtINR(t.tax))}<div class="row grand"><span>Total</span><span>${fmtINR(t.total)}</span></div>${moneyRow('Authorised by customer',fmtINR(auth))}</div>
      <div style="padding:16px 20px;border-top:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" data-action="print">${icon('print','icon-sm')} Print</button>${job?`<button class="btn btn-outline btn-sm" data-action="ops.estimate.supplementary" data-id="${est.id}">Create supplementary</button>`:''}${approved.size&&job?`<button class="btn btn-dark btn-sm" data-action="ops.invoice.fromJob" data-id="${job.id}">Create invoice</button>`:''}</div></div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Notes & exclusions</h3></div></div><p class="small">${esc(est.notes||'—')}</p><div class="section-divider"></div><p class="tiny muted"><strong>Exclusions:</strong> ${esc(est.exclusions||'—')}</p></div>
    </div>
    <div><div class="card"><div class="card-head"><div><h3 class="card-title">Customer decision record</h3></div></div><div class="timeline">${(est.decisions||[]).slice().reverse().map(d=>`<div class="tl-item done"><span class="tl-dot"></span><div class="tl-title">${d.decision==='approve'?'Approved':d.decision==='decline'?'Declined':d.decision==='clarification'?'Clarification requested':esc(d.decision)}</div><div class="tl-meta">${fmtDateTime(d.at)} · ${esc(d.actor)} (${esc(d.actorType)})${d.comment?`<br>“${esc(d.comment)}”`:''}${(d.lineIds||[]).length?`<br>${d.lineIds.length} line(s) affected`:''}</div></div>`).join('')||'<p class="small muted">No decision yet. Viewing is not approval.</p>'}</div>${est.status==='PARTIALLY_APPROVED'?`<div class="decision-box mt-3">Partially approved. Undecided lines remain unauthorised.</div>`:''}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Comms</h3></div><button class="btn btn-outline btn-xs" data-action="ops.communicate" data-type="estimate" data-id="${est.id}">Log message</button></div>${db.communications.filter(x=>x.entityType==='estimate'&&x.entityId===est.id).map(x=>`<div class="detail-row"><span class="k">${esc(COMMUNICATION_TYPES[x.type]||x.type)}<br><span class="tiny">${fmtDateTime(x.at)}</span></span><span class="v">${commStatusBadge(x.status)}</span></div>`).join('')||'<p class="small muted">No messages.</p>'}</div>
      <div class="inline-note mt-5">${icon('info')}<div>Estimate totals use the same shared tax and line calculation as invoices. Changing a tax setting later does not retroactively alter this document.</div></div>
    </div></div>`;
}

function opsEstimateBuilderView() {
  const q = currentRoute.query;
  const jobId = q.get('job') || '';
  const job = getJob(db,jobId);
  if (!job) return `<div class="card">${emptyState('Choose a job','An estimate must be linked to a job card.','<a class="btn btn-dark btn-sm" href="#/ops/jobs">Open jobs</a>','clipboard')}</div>`;
  const c = getCustomer(db,job.customerId), v = getVehicle(db,job.vehicleId);
  const existing = jobEstimates(db,job.id);
  const prior = existing[existing.length-1];
  const supplementary = q.get('kind') === 'supplementary' || !!prior;
  let draft = db.ui.estimateDraft;
  if (!draft || draft.jobId !== job.id || draft.mode !== (supplementary?'supplementary':'primary')) {
    draft = {jobId:job.id,mode:supplementary?'supplementary':'primary',lines:[{id:uid('el'),type:'Part',description:'',category:'Parts',qty:1,unit:'item',unitPrice:0,discountPct:0,taxRate:null,partId:null},{id:uid('el'),type:'Labour',description:'',category:'Labour',qty:1,unit:'hour',unitPrice:0,discountPct:0,taxRate:null,partId:null}],notes:supplementary?'Additional work found during inspection. Previously approved work is unchanged.':'',exclusions:'Any work not listed is excluded and requires a separate approval.'};
    db.ui.estimateDraft = draft;
    saveDB({silent:true});
  }
  const totals = documentTotals(draft.lines,db.settings.tax.rate,db.settings.tax.enabled);
  return `${pageHead(`New ${supplementary?'supplementary ':''}estimate`,`${esc(c?.name)} · ${esc(v?.make)} ${esc(v?.model)} · ${esc(job.number)}`,`<a class="btn btn-outline btn-sm" href="#/ops/jobs/${job.id}">← Job</a>`)}
    ${supplementary?`<div class="alert-strip info">${icon('layers')}<div class="grow">This estimate is linked to existing estimate ${esc(prior?.ref||'')}. It preserves all earlier decisions and includes only new scope.</div></div>`:''}
    <form data-form="ops.estimate.save" data-job="${job.id}">
      <div class="two-col"><div><div class="card"><div class="card-head"><div><h3 class="card-title">Line items</h3><p class="card-sub">Customer sees these descriptions, quantities and prices.</p></div><span class="badge grey no-dot">${draft.lines.length} lines</span></div>
        <div id="estimate-lines">${draft.lines.map((line,i)=>`<div class="card" style="background:var(--paper);margin-bottom:10px;padding:13px" data-est-line="${i}"><div class="flex between mb-2"><strong style="font-size:11px">Line ${i+1}</strong>${draft.lines.length>1?`<button type="button" class="link tiny" data-action="ops.estimate.removeLine" data-index="${i}" style="color:var(--red);border:0;background:none">Remove</button>`:''}</div><div class="form-grid" style="gap:9px"><div class="field full"><label>Description *</label><input class="input" name="description_${i}" value="${esc(line.description)}" maxlength="140" required></div><div class="field"><label>Type</label><select class="select" name="type_${i}">${['Part','Labour','Service','Consumable','Sublet','Other'].map(x=>`<option ${line.type===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Category</label><input class="input" name="category_${i}" value="${esc(line.category)}" maxlength="40"></div><div class="field"><label>Quantity *</label><input class="input" name="qty_${i}" type="number" min="0.01" step="0.01" value="${line.qty}" required></div><div class="field"><label>Unit price ₹ *</label><input class="input" name="unitPrice_${i}" type="number" min="0" step="0.01" value="${line.unitPrice}" required></div><div class="field"><label>Discount %</label><input class="input" name="discountPct_${i}" type="number" min="0" max="100" step="0.01" value="${line.discountPct||0}"></div><div class="field"><label>Linked part (optional)</label><select class="select" name="partId_${i}"><option value="">No linked stock item</option>${db.parts.filter(p=>p.active).map(p=>`<option value="${p.id}" ${line.partId===p.id?'selected':''}>${esc(p.name)} · ${fmtINR(p.price)} · ${partAvailable(p)} available</option>`).join('')}</select></div></div><div class="flex between mt-2"><span class="tiny muted">Line preview</span><strong class="mono" style="font-size:11px">${fmtINR(estimateLineCalc(line,db.settings.tax.rate,db.settings.tax.enabled).total)}</strong></div></div>`).join('')}</div>
        <div class="flex between wrap mt-3"><button class="btn btn-outline btn-sm" type="button" data-action="ops.estimate.addLine">${icon('plus','icon-sm')} Add line</button><span class="tiny muted">Tax applied from settings · ${db.settings.tax.enabled?db.settings.tax.rate+'%':'disabled'}</span></div>
      </div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Notes for the customer</h3></div></div><div class="field"><label for="est-notes">Scope notes</label><textarea class="textarea" id="est-notes" name="notes" maxlength="800">${esc(draft.notes)}</textarea></div><div class="field mt-3"><label for="est-exclusions">Exclusions</label><textarea class="textarea" id="est-exclusions" name="exclusions" maxlength="500">${esc(draft.exclusions)}</textarea></div><div class="form-grid mt-3"><div class="field"><label>Valid for (days)</label><input class="input" name="validity" type="number" min="1" max="30" value="${db.settings.approval.validityDays}"></div><div class="field"><label>Tax setting</label><input class="input" value="${esc(db.settings.tax.label)}" disabled></div></div></div>
      </div>
      <div><div class="card" style="position:sticky;top:80px"><div class="card-head"><div><h3 class="card-title">Estimate totals</h3></div></div>${moneyRow('Subtotal',fmtINR(totals.base))}${totals.discount?moneyRow('Discount','− '+fmtINR(totals.discount)):''}${moneyRow('Tax',fmtINR(totals.tax))}<div class="row grand" style="display:flex;justify-content:space-between;border-top:2px solid var(--night);margin-top:8px;padding-top:10px"><strong>Total</strong><strong class="mono">${fmtINR(totals.total)}</strong></div><p class="tiny muted mt-3">Saving creates a draft. Sending notifies the customer and updates the job to await approval. No paid work starts automatically.</p><button class="btn btn-outline" type="button" data-action="ops.estimate.saveDraft">Save draft</button><button class="btn btn-dark" type="button" data-action="ops.estimate.saveSend">${icon('send','icon-sm')} Save & send</button></div>
      <div class="inline-note mt-4">${icon('shield')}<div>${supplementary?'Supplementary estimates never overwrite prior approvals or declines.':'A customer must explicitly approve before additional paid work begins. Viewing is not approval.'}</div></div></div></div>
    </form>`;
}

function supersedePriorEstimates(est) {
  if (!est) return;
  db.estimates.forEach(other => {
    if (other.id === est.id || other.jobId !== est.jobId || other.kind !== est.kind) return;
    if (!['DRAFT','SENT','VIEWED','PARTIALLY_APPROVED','APPROVED'].includes(other.status)) return;
    other.status = 'SUPERSEDED';
    other.supersededBy = est.id;
    releaseReservationsForEstimate(other.id, `Superseded by ${est.ref}`);
  });
}

function setJobAwaitingApproval(job, est) {
  if (!job) return;
  const approvedElsewhere = jobEstimates(db, job.id).some(e => e.id !== est?.id && approvedLineIds(e).size > 0);
  if (!approvedElsewhere) job.status = 'AWAITING_APPROVAL';
}

function partAvailable(part) {
  return Math.max(0, Number(part?.stock || 0) - Number(part?.reserved || 0));
}

function syncPartReserved(partId) {
  const part = getPart(db, partId);
  if (!part) return;
  part.reserved = round2((db.reservations || []).filter(r => r.partId === part.id && r.status === 'active').reduce((sum, r) => sum + Number(r.qty || 0), 0));
}

function syncAllReserved() {
  (db.parts || []).forEach(part => syncPartReserved(part.id));
}

function logStockMovement(partId, {type, qty = 0, stockDelta = 0, reservedDelta = 0, reason = '', jobId = null, estimateId = null, lineId = null, by = null}) {
  db.movements.unshift({id:uid('mov'),partId,type,qty,stockDelta,reservedDelta,reason,jobId,estimateId,lineId,at:new Date().toISOString(),by:by || db.session.staffId || 'system'});
}

function releaseReservationsForEstimate(estimateId, reason) {
  const records = (db.reservations || []).filter(r => r.estimateId === estimateId && ['active','shortage'].includes(r.status));
  records.forEach(r => {
    const wasActive = r.status === 'active';
    r.status = 'released';
    r.releasedAt = new Date().toISOString();
    r.releaseReason = reason;
    if (wasActive) logStockMovement(r.partId, {type:'release',qty:r.qty,reservedDelta:-r.qty,reason,jobId:r.jobId,estimateId:r.estimateId,lineId:r.lineId});
  });
  syncAllReserved();
}

function releaseReservationsForJob(jobId, reason) {
  const records = (db.reservations || []).filter(r => r.jobId === jobId && ['active','shortage'].includes(r.status));
  records.forEach(r => {
    const wasActive = r.status === 'active';
    r.status = 'released';
    r.releasedAt = new Date().toISOString();
    r.releaseReason = reason;
    if (wasActive) logStockMovement(r.partId, {type:'release',qty:r.qty,reservedDelta:-r.qty,reason,jobId:r.jobId,estimateId:r.estimateId,lineId:r.lineId});
  });
  syncAllReserved();
}

function reserveEstimateLines(est) {
  if (!est) return;
  releaseReservationsForEstimate(est.id, 'Approval scope recalculated');
  const job = getJob(db, est.jobId);
  if (!job || ['DELIVERED','CANCELLED'].includes(job.status)) return;
  const approved = approvedLineIds(est);
  if (!approved.size) return;
  let shortage = false;
  (est.lines || []).forEach(line => {
    if (!line.partId || !approved.has(line.id)) return;
    const part = getPart(db, line.partId);
    if (!part) return;
    const qty = Math.max(0, Number(line.qty) || 0);
    if (!qty) return;
    const activeQty = Math.min(qty, partAvailable(part));
    if (activeQty > 0) {
      db.reservations.push({id:uid('res'),partId:part.id,jobId:job.id,estimateId:est.id,lineId:line.id,qty:activeQty,status:'active',createdAt:new Date().toISOString()});
      logStockMovement(part.id, {type:'reserve',qty:activeQty,reservedDelta:activeQty,reason:`Reserved for ${job.number} · ${est.ref}`,jobId:job.id,estimateId:est.id,lineId:line.id});
    }
    if (qty > activeQty) {
      shortage = true;
      db.reservations.push({id:uid('res'),partId:part.id,jobId:job.id,estimateId:est.id,lineId:line.id,qty:qty - activeQty,status:'shortage',createdAt:new Date().toISOString()});
    }
    syncPartReserved(part.id);
  });
  syncAllReserved();
  if (shortage) {
    job.status = 'AWAITING_PARTS';
    job.delayReason = 'Approved parts are not fully available in inventory';
    addCustomerUpdate(job, 'Approved work is waiting for parts. The garage will confirm when stock is available.');
    db.notifications.unshift({id:uid('ntf'),read:false,at:new Date().toISOString(),text:`Part shortage recorded on ${job.number} from ${est.ref}.`,href:`/ops/jobs/${job.id}`});
  } else {
    reconcileJobParts(job.id);
  }
}

function consumeReservationsForJob(job, partId = null, reason = 'Parts consumed on job', taskId = null) {
  if (!job) return 0;
  const active = (db.reservations || []).filter(r => r.jobId === job.id && r.status === 'active' && (!partId || r.partId === partId));
  let consumed = 0;
  active.forEach(r => {
    const part = getPart(db, r.partId);
    if (!part) return;
    const requested = Number(r.qty || 0);
    const qty = Math.min(requested, Math.max(0, Number(part.stock || 0)));
    if (qty <= 0) {
      r.status = 'shortage';
      syncPartReserved(part.id);
      return;
    }
    part.stock = round2(Math.max(0, Number(part.stock || 0) - qty));
    r.qty = qty;
    r.consumedQty = qty;
    r.status = 'consumed';
    r.consumedAt = new Date().toISOString();
    r.consumedBy = db.session.staffId || 'system';
    r.consumedByTask = taskId;
    logStockMovement(part.id, {type:'consume',qty:-qty,stockDelta:-qty,reservedDelta:-qty,reason,jobId:job.id,estimateId:r.estimateId,lineId:r.lineId});
    if (qty < requested) db.reservations.push({id:uid('res'),partId:part.id,jobId:job.id,estimateId:r.estimateId,lineId:r.lineId,qty:requested - qty,status:'shortage',createdAt:new Date().toISOString()});
    consumed += qty;
    syncPartReserved(part.id);
  });
  syncAllReserved();
  return consumed;
}

function restoreConsumedForTask(job, taskId, reason = 'Task reopened') {
  if (!job || !taskId) return 0;
  const records = (db.reservations || []).filter(r => r.jobId === job.id && r.status === 'consumed' && r.consumedByTask === taskId);
  let restored = 0;
  records.forEach(r => {
    const part = getPart(db, r.partId);
    if (!part) return;
    const qty = Number(r.consumedQty ?? r.qty ?? 0);
    if (qty <= 0) return;
    part.stock = round2(Number(part.stock || 0) + qty);
    r.status = 'active';
    r.consumedAt = null;
    r.consumedBy = null;
    r.consumedQty = null;
    delete r.consumedByTask;
    logStockMovement(part.id, {type:'return',qty,stockDelta:qty,reservedDelta:qty,reason,jobId:job.id,estimateId:r.estimateId,lineId:r.lineId});
    syncPartReserved(part.id);
    allocateShortages(part.id);
    restored += qty;
  });
  syncAllReserved();
  return restored;
}

function reconcileJobParts(jobId) {
  const job = getJob(db, jobId);
  if (!job || job.status !== 'AWAITING_PARTS') return;
  const stillShort = (db.reservations || []).some(r => r.jobId === job.id && r.status === 'shortage');
  if (stillShort) return;
  const hasApproved = jobEstimates(db, job.id).some(e => approvedLineIds(e).size > 0);
  job.status = hasApproved ? 'IN_PROGRESS' : 'AWAITING_APPROVAL';
  job.delayReason = '';
  addCustomerUpdate(job, hasApproved ? 'Parts are available. The approved work has resumed.' : 'The parts-dependent work is no longer waiting on stock.');
}

function allocateShortages(partId) {
  const part = getPart(db, partId);
  if (!part) return;
  let available = partAvailable(part);
  const affectedJobs = new Set();
  const shortages = (db.reservations || []).filter(r => r.partId === part.id && r.status === 'shortage').sort(by('createdAt', 1));
  shortages.forEach(r => {
    if (available <= 0) return;
    const qty = Math.min(available, Number(r.qty || 0));
    if (qty <= 0) return;
    if (qty >= Number(r.qty || 0)) {
      r.status = 'active';
    } else {
      r.qty = round2(Number(r.qty || 0) - qty);
      db.reservations.push({...r,id:uid('res'),qty,status:'active',createdAt:new Date().toISOString()});
    }
    logStockMovement(part.id, {type:'reserve',qty,reservedDelta:qty,reason:'Stock received · shortage allocated',jobId:r.jobId,estimateId:r.estimateId,lineId:r.lineId});
    const job = getJob(db, r.jobId);
    if (job) {
      affectedJobs.add(job.id);
      db.notifications.unshift({id:uid('ntf'),read:false,at:new Date().toISOString(),text:`Part ${part.name} is now available for ${job.number}.`,href:`/ops/jobs/${job.id}`});
    }
    available -= qty;
  });
  syncPartReserved(part.id);
  affectedJobs.forEach(reconcileJobParts);
}

function opsInventoryView() {
  const q = currentRoute.query.get('q') || '';
  const parts = searchFilter(db.parts.slice(), q, ['name','sku','category','supplier']);
  const low = db.parts.filter(p=>p.active&&p.stock<=p.reorder);
  return `${pageHead('Inventory','Parts, reservations and stock movements. Values are illustrative.', `<button class="btn btn-dark btn-sm" data-action="ops.part.new">${icon('plus','icon-sm')} Add part</button>`)}
    ${low.length?`<div class="alert-strip warn">${icon('box')}<div class="grow"><strong>${low.length} item${low.length===1?'':'s'} need attention.</strong> ${esc(low.map(p=>`${p.name} (${p.stock})`).join(', '))}</div></div>`:''}
    <div class="stat-grid mb-5">${statCard('Active parts',db.parts.filter(p=>p.active).length,'Configured demo catalogue',{icon:'box'})}${statCard('Low stock',low.filter(p=>p.stock>0).length,'At or below reorder level',{icon:'alert'})}${statCard('Out of stock',db.parts.filter(p=>p.active&&p.stock<=0).length,'Blocking or delaying work',{icon:'alert'})}${statCard('Stock value',fmtINR(db.parts.filter(p=>p.active).reduce((s,p)=>s+p.cost*p.stock,0)),'Demo cost valuation',{icon:'wallet'})}</div>
    <div class="card pad-0"><div style="padding:14px 16px;border-bottom:1px solid var(--line)"><form data-form="ops.inventory.search" class="flex gap-2"><input class="input" name="q" value="${esc(q)}" placeholder="Search part, SKU, category or supplier" style="max-width:380px"><button class="btn btn-outline btn-sm" type="submit">${icon('search','icon-sm')} Search</button></form></div>
    <div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Part</th><th>Category</th><th>Stock</th><th>Reserved</th><th>Available</th><th>Reorder</th><th>Cost / price</th><th>Location</th><th>Status</th><th class="actions"></th></tr></thead><tbody>${parts.map(p=>`<tr><td class="main-cell"><strong>${esc(p.name)}</strong><span>${esc(p.sku)} · ${esc(p.supplier)}</span></td><td>${esc(p.category)}</td><td><strong>${p.stock}</strong></td><td>${p.reserved||0}</td><td>${partAvailable(p)}</td><td>${p.reorder}</td><td class="mono">${fmtINR(p.cost)} / ${fmtINR(p.price)}</td><td>${esc(p.location)}</td><td>${partStockBadge(p)}</td><td class="actions"><button class="btn btn-outline btn-xs" data-action="ops.part.adjust" data-id="${p.id}">Adjust</button></td></tr>`).join('')||`<tr><td colspan="10"><div style="padding:20px">${emptyState('No parts match','Try another search.','','box')}</div></td></tr>`}</tbody></table></div></div>
    <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Recent stock movements</h3><p class="card-sub">Reservations, consumption and receipts.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Part</th><th>Type</th><th>Qty</th><th>Reason</th><th>By</th></tr></thead><tbody>${db.movements.slice(0,12).map(m=>{const p=getPart(db,m.partId);return `<tr><td>${fmtDateTime(m.at)}</td><td>${esc(p?.name||'Unknown')}</td><td>${badge(m.type,m.type==='receive'?'green':m.type==='consume'?'blue':'amber',false)}</td><td class="mono">${m.qty>0?'+':''}${m.qty}</td><td>${esc(m.reason)}</td><td>${esc(getStaff(db,m.by)?.name||m.by)}</td></tr>`;}).join('')}</tbody></table></div></div>`;
}

function opsInvoicesView() {
  const q = currentRoute.query;
  const status = q.get('status') || 'all';
  const search = q.get('q') || '';
  let list = db.invoices.slice();
  if (status !== 'all') list = list.filter(i => invoiceTotals(i,db).status === status);
  list = searchFilter(list, search, [i=>i.ref, i=>getCustomer(db,i.customerId)?.name, i=>getVehicle(db,i.vehicleId)?.reg]);
  list.sort(by('date',-1));
  const totals = list.filter(i=>i.status!=='VOID').reduce((acc,i)=>{const t=invoiceTotals(i,db);acc.total+=t.total;acc.paid+=t.paid;acc.balance+=t.balance;return acc;},{total:0,paid:0,balance:0});
  return `${pageHead('Invoices','Issued documents, recorded payments and balances. No real money movement.', `<button class="btn btn-dark btn-sm" data-action="ops.invoice.new">${icon('plus','icon-sm')} New invoice</button>`)}
    <div class="stat-grid mb-5">${statCard('Invoiced',fmtINR(totals.total),`${list.length} document${list.length===1?'':'s'}`,{icon:'receipt'})}${statCard('Recorded paid',fmtINR(totals.paid),'Simulated payments only',{icon:'wallet'})}${statCard('Balance',fmtINR(totals.balance),'Outstanding in demo',{icon:'clock'})}${statCard('Overdue',db.invoices.filter(i=>isOverdueInvoice(db,i)).length,'Past due date',{icon:'alert'})}</div>
    <div class="card pad-0"><div style="padding:14px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--line)"><div class="pill-tabs">${[['all','All'],['ISSUED','Issued'],['PARTIALLY_PAID','Part paid'],['OVERDUE','Overdue'],['PAID','Paid'],['VOID','Void']].map(([k,l])=>`<a href="#/ops/invoices?status=${k}" style="text-decoration:none" class="${status===k?'active':''}">${l}</a>`).join('')}</div><form data-form="ops.invoice.search" style="margin-left:auto;display:flex;gap:6px"><input class="input" name="q" value="${esc(search)}" placeholder="Search invoice, customer or reg" style="height:34px;width:220px"><button class="btn btn-outline btn-sm" type="submit">${icon('search','icon-sm')}</button></form></div>
    ${list.length?`<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Invoice</th><th>Customer</th><th>Vehicle</th><th>Issued</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>${list.map(i=>{const t=invoiceTotals(i,db),c=getCustomer(db,i.customerId),v=getVehicle(db,i.vehicleId);return `<tr><td class="main-cell"><strong>${esc(i.ref)}</strong><span>${esc(i.jobId?getJob(db,i.jobId)?.number:'')}</span></td><td>${esc(c?.name)}<br><span class="tiny muted">${esc(c?.ref)}</span></td><td>${esc(v?.make)} ${esc(v?.model)}<br><span class="tiny muted mono">${esc(fmtReg(v?.reg))}</span></td><td>${fmtDateKey(i.date)}<br><span class="tiny muted">due ${fmtDateKey(i.dueDate)}</span></td><td class="mono">${fmtINR(t.total)}</td><td class="mono">${fmtINR(t.paid)}</td><td class="mono">${fmtINR(t.balance)}</td><td>${invoiceBadge(i)}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/ops/invoices/${i.id}">Open</a></td></tr>`;}).join('')}</tbody></table></div>`:`<div style="padding:30px">${emptyState('No invoices match','Try another filter or search.','','receipt')}</div>`}</div>`;
}

function opsInvoiceDetailView(id) {
  const inv = getInvoice(db,id);
  if (!inv) return opsNotFoundView('invoice');
  const t = invoiceTotals(inv,db);
  return `${pageHead(`Invoice ${esc(inv.ref)}`,`${fmtDateKey(inv.date)} · ${esc(getCustomer(db,inv.customerId)?.name)} · ${invoiceBadge(inv)}`, `<a class="btn btn-outline btn-sm" href="#/ops/invoices">← Invoices</a><button class="btn btn-outline btn-sm" data-action="print">${icon('print','icon-sm')} Print</button>${t.balance>0.49&&inv.status!=='VOID'?`<button class="btn btn-dark btn-sm" data-action="ops.payment.record" data-id="${inv.id}">${icon('wallet','icon-sm')} Record payment</button>`:''}${inv.status!=='VOID'&&t.paid<=0?`<button class="btn btn-ghost btn-sm" data-action="ops.invoice.void" data-id="${inv.id}" style="color:var(--red)">Void</button>`:''}`)}
    ${t.status==='OVERDUE'?`<div class="alert-strip danger">${icon('clockAlert')}<div class="grow"><strong>Overdue by ${Math.max(1,Math.ceil((new Date()-new Date(inv.dueDate))/86400000))} day(s).</strong> Follow up is simulated; no automatic messages are sent.</div></div>`:''}${t.balance<=0.49?`<div class="alert-strip success">${icon('check')}<div class="grow"><strong>Settled in the demo.</strong> No real money moved. Payment records are synthetic.</div></div>`:''}
    <div class="two-col" style="align-items:start"><div>${invoiceDocument(inv,{portal:false})}</div>
    <div><div class="card"><div class="card-head"><div><h3 class="card-title">Balance</h3></div>${invoiceBadge(inv)}</div>${moneyRow('Invoice total',fmtINR(t.total))}${moneyRow('Recorded paid',fmtINR(t.paid))}<div class="row grand" style="display:flex;justify-content:space-between;border-top:2px solid var(--night);padding-top:8px;margin-top:6px"><strong>Balance</strong><strong class="mono">${fmtINR(t.balance)}</strong></div>${t.balance>0.49?`<button class="btn btn-dark btn-sm mt-4" data-action="ops.payment.record" data-id="${inv.id}">Record demo payment</button>`:''}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Payments</h3><p class="card-sub">No gateway; manually recorded demo entries.</p></div></div>${(inv.payments||[]).map(p=>`<div class="payment-row"><span class="pay-icon">${icon('check','icon-sm')}</span><span class="grow">${fmtINR(p.amount)} · ${esc(PAYMENT_METHODS[p.method]||p.method)}<br><span class="tiny muted">${fmtDateTime(p.at)} · ${esc(p.reference||'no reference')} · by ${esc(p.by||'—')}</span></span>${!p.reversed?`<button class="btn btn-ghost btn-xs" data-action="ops.payment.reverse" data-id="${inv.id}" data-payment="${p.id}" style="color:var(--red)">Reverse</button>`:badge('Reversed','red',false)}</div>`).join('')||'<p class="small muted">No payments recorded.</p>'}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Collection check</h3><p class="card-sub">Invoice balance is checked against policy.</p></div></div><div class="detail-row"><span class="k">Balance</span><span class="v mono">${fmtINR(t.balance)}</span></div><div class="detail-row"><span class="k">Policy status</span><span class="v">${t.balance<=0.49?badge('Can release','green',false):badge('Payment or override required','amber',false)}</span></div>${inv.jobId?`<a class="btn btn-outline btn-sm mt-4" href="#/ops/jobs/${inv.jobId}">Open job</a>`:''}</div>
      <div class="inline-note mt-5">${icon('shield')}<div>Invoice and customer portal totals both use <code>invoiceTotals()</code>. No total is typed manually.</div></div>
    </div></div>`;
}

function opsReceivablesView() {
  const invoices = db.invoices.filter(i=>i.status!=='VOID'&&invoiceTotals(i,db).balance>0.49).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  const overdue = invoices.filter(i=>isOverdueInvoice(db,i));
  const total = invoices.reduce((s,i)=>s+invoiceTotals(i,db).balance,0);
  const buckets = [
    ['Current',invoices.filter(i=>new Date(i.dueDate)>=new Date() && !isOverdueInvoice(db,i))],
    ['1–15 days',invoices.filter(i=>{const d=Math.floor((new Date()-new Date(i.dueDate))/86400000);return d>=1&&d<=15;})],
    ['16–30 days',invoices.filter(i=>{const d=Math.floor((new Date()-new Date(i.dueDate))/86400000);return d>=16&&d<=30;})],
    ['31+ days',invoices.filter(i=>{const d=Math.floor((new Date()-new Date(i.dueDate))/86400000);return d>30;})]
  ];
  return `${pageHead('Receivables','Outstanding demo balances and follow-up actions.', `<button class="btn btn-outline btn-sm" data-action="export.receivables">${icon('download','icon-sm')} Export CSV</button>`)}
    <div class="stat-grid mb-5">${statCard('Outstanding',fmtINR(total),`${invoices.length} open invoice${invoices.length===1?'':'s'}`,{icon:'wallet',accent:true})}${statCard('Overdue',fmtINR(overdue.reduce((s,i)=>s+invoiceTotals(i,db).balance,0)),`${overdue.length} invoice${overdue.length===1?'':'s'}`,{icon:'clockAlert'})}${statCard('Collected this week',fmtINR(db.invoices.flatMap(i=>i.payments||[]).filter(p=>!p.reversed&&new Date(p.at)>=new Date(Date.now()-7*86400000)).reduce((s,p)=>s+Number(p.amount||0),0)),'Simulated only',{icon:'check'})}${statCard('Average balance',fmtINR(invoices.length?total/invoices.length:0),'Open documents',{icon:'receipt'})}</div>
    <div class="card mb-5"><div class="card-head"><div><h3 class="card-title">Aging</h3><p class="card-sub">Demo due-date buckets.</p></div></div><div class="grid-4" style="gap:10px">${buckets.map(([label,list])=>`<div style="background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:13px"><div class="tiny muted">${label}</div><strong style="font-family:var(--font-display);font-size:20px">${fmtINR(list.reduce((s,i)=>s+invoiceTotals(i,db).balance,0))}</strong><div class="tiny muted">${list.length} invoice(s)</div></div>`).join('')}</div></div>
    <div class="card pad-0"><div style="padding:14px 16px;border-bottom:1px solid var(--line)"><h3 class="card-title">Open invoices</h3></div>${invoices.length?`<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Invoice</th><th>Customer</th><th>Due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th class="actions"></th></tr></thead><tbody>${invoices.map(i=>{const t=invoiceTotals(i,db),c=getCustomer(db,i.customerId);return `<tr><td>${esc(i.ref)}</td><td>${esc(c?.name)}<br><span class="tiny muted">${esc(fmtMobile(c?.mobile))}</span></td><td>${fmtDateKey(i.dueDate)}<br><span class="tiny ${isOverdueInvoice(db,i)?'':'muted'}" style="${isOverdueInvoice(db,i)?'color:var(--red)':''}">${isOverdueInvoice(db,i)?'Overdue':fmtDay(i.dueDate)}</span></td><td class="mono">${fmtINR(t.total)}</td><td class="mono">${fmtINR(t.paid)}</td><td class="mono">${fmtINR(t.balance)}</td><td>${invoiceBadge(i)}</td><td class="actions"><a class="btn btn-outline btn-xs" href="#/ops/invoices/${i.id}">Open</a></td></tr>`;}).join('')}</tbody></table></div>`:`<div style="padding:30px">${emptyState('No outstanding balances','All demo invoices are settled.','','wallet')}</div>`}</div>`;
}

function opsCommunicationsView() {
  const filter = currentRoute.query.get('type') || 'all';
  let comms = db.communications.slice().sort(by('at',-1));
  if (filter === 'failed') comms = comms.filter(c=>c.status==='failed');
  else if (filter === 'queued') comms = comms.filter(c=>c.status==='queued');
  else if (filter !== 'all') comms = comms.filter(c=>c.channel===filter);
  return `${pageHead('Communications','Simulated customer messages only. Nothing is sent outside this browser.', `<button class="btn btn-dark btn-sm" data-action="ops.communicate" data-type="customer">${icon('send','icon-sm')} Log message</button>`)}
    <div class="alert-strip info">${icon('message')}<div class="grow"><strong>Simulation.</strong> Delivered, failed and queued states are seeded or set locally. No SMS, WhatsApp or email provider is connected.</div></div>
    <div class="card pad-0"><div style="padding:14px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--line)"><div class="pill-tabs">${[['all','All'],['failed','Failed'],['queued','Queued'],['whatsapp','WhatsApp'],['sms','SMS'],['email','Email']].map(([k,l])=>`<a href="#/ops/communications?type=${k}" style="text-decoration:none" class="${filter===k?'active':''}">${l}</a>`).join('')}</div><span class="tiny muted" style="margin-left:auto">${comms.length} message(s)</span></div>
    ${comms.length?`<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>When</th><th>Customer</th><th>Type</th><th>Channel</th><th>Subject</th><th>Status</th><th></th></tr></thead><tbody>${comms.map(x=>{const c=getCustomer(db,x.customerId);return `<tr><td>${fmtDateTime(x.at)}</td><td>${esc(c?.name||'—')}<br><span class="tiny muted">${esc(x.recipient)}</span></td><td>${esc(COMMUNICATION_TYPES[x.type]||x.type)}<br><span class="tiny muted">${esc(x.entityType)}</span></td><td>${esc(CHANNEL_LABELS[x.channel]||x.channel)}</td><td style="max-width:260px">${esc(x.subject)}</td><td>${commStatusBadge(x.status)}</td><td class="actions"><button class="btn btn-outline btn-xs" data-action="ops.comm.view" data-id="${x.id}">View</button></td></tr>`;}).join('')}</tbody></table></div>`:`<div style="padding:30px">${emptyState('No messages match','Try another filter.','','message')}</div>`}</div>`;
}

function opsRemindersView() {
  const filter = currentRoute.query.get('status') || 'open';
  let list = db.reminders.slice().sort(by('dueDate',1));
  if (filter === 'open') list = list.filter(r=>['pending','scheduled'].includes(r.status));
  else if (filter !== 'all') list = list.filter(r=>r.status===filter);
  return `${pageHead('Reminders','Configurable service follow-ups. Marketing consent is handled separately.', `<button class="btn btn-dark btn-sm" data-action="ops.reminder.new">${icon('plus','icon-sm')} New reminder</button>`)}
    <div class="alert-strip info">${icon('bell')}<div class="grow">Reminder guidance is not a manufacturer schedule or diagnosis. Sending is simulated; no message leaves the browser.</div></div>
    <div class="card pad-0"><div style="padding:14px 16px;display:flex;gap:10px;border-bottom:1px solid var(--line)"><div class="pill-tabs">${[['open','Open'],['pending','Pending'],['scheduled','Scheduled'],['sent','Sent'],['all','All']].map(([k,l])=>`<a href="#/ops/reminders?status=${k}" style="text-decoration:none" class="${filter===k?'active':''}">${l}</a>`).join('')}</div></div>
    ${list.length?`<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Due</th><th>Customer</th><th>Vehicle</th><th>Type / reason</th><th>Channel</th><th>Status</th><th class="actions"></th></tr></thead><tbody>${list.map(r=>{const c=getCustomer(db,r.customerId),v=getVehicle(db,r.vehicleId);return `<tr><td>${fmtDateKey(r.dueDate)}</td><td>${esc(c?.name)}<br><span class="tiny muted">${esc(fmtMobile(c?.mobile))}</span></td><td>${esc(v?.make)} ${esc(v?.model)}<br><span class="tiny muted mono">${esc(fmtReg(v?.reg))}</span></td><td>${esc(r.type)}<br><span class="tiny muted">${esc(r.reason)}</span></td><td>${esc(CHANNEL_LABELS[r.channel]||r.channel)}</td><td>${badge(r.status,r.status==='sent'?'green':r.status==='pending'?'amber':'blue',false)}</td><td class="actions">${r.status!=='sent'?`<button class="btn btn-outline btn-xs" data-action="ops.reminder.send" data-id="${r.id}">Send demo</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`:`<div style="padding:30px">${emptyState('No reminders match','Create a reminder from here or from a vehicle record.','','bell')}</div>`}</div>`;
}

function opsFeedbackView() {
  const feedback = db.feedback.slice().sort(by('at',-1));
  const avg = feedback.length ? feedback.reduce((s,f)=>s+f.ratings.overall,0)/feedback.length : 0;
  return `${pageHead('Feedback moderation','Only consented feedback can appear publicly. Responses are moderated in this demo.', '')}
    <div class="stat-grid mb-5">${statCard('Average overall',feedback.length?avg.toFixed(1)+' / 5':'—',`${feedback.length} submission(s)`,{icon:'star'})}${statCard('Awaiting review',feedback.filter(f=>f.status==='new').length,'Not public',{icon:'clock'})}${statCard('Published',feedback.filter(f=>f.status==='published').length,'Consent confirmed',{icon:'check'})}${statCard('Private',feedback.filter(f=>!f.publicConsent).length,'No public consent',{icon:'lock'})}</div>
    ${feedback.length?`<div class="grid-2">${feedback.map(f=>{const c=getCustomer(db,f.customerId),j=getJob(db,f.jobId);return `<div class="card"><div class="card-head"><div><div class="flex gap-2 mb-2">${badge(f.status,f.status==='published'?'green':f.status==='reviewed'?'blue':'amber',false)}${f.publicConsent?badge('Public consent','green',false):badge('Private','grey',false)}</div><h3 class="card-title">${esc(c?.name)} · ${f.ratings.overall}/5</h3><p class="card-sub">${esc(j?.number||'')} · ${fmtDateTime(f.at)} · ${esc(f.category)}</p></div></div><p class="small">“${esc(f.comment)}”</p><div class="detail-list mt-3"><div class="detail-row"><span class="k">Quality / Communication / Value</span><span class="v">${f.ratings.quality} / ${f.ratings.communication} / ${f.ratings.value}</span></div></div>${f.response?`<div class="decision-box mt-3">${esc(f.response)}</div>`:''}<div class="btn-group mt-3">${f.status!=='published'&&f.publicConsent?`<button class="btn btn-outline btn-xs" data-action="ops.feedback.publish" data-id="${f.id}">Publish</button>`:''}${f.status==='published'?`<button class="btn btn-ghost btn-xs" data-action="ops.feedback.unpublish" data-id="${f.id}">Unpublish</button>`:''}<button class="btn btn-outline btn-xs" data-action="ops.feedback.respond" data-id="${f.id}">${f.response?'Edit response':'Respond'}</button></div></div>`;}).join('')}</div>`:`<div class="card">${emptyState('No feedback yet','Customer feedback appears after a delivered demo visit.','','star')}</div>`}`;
}

function opsStaffView() {
  return `${pageHead('Staff & permissions','Role-based access is enforced for actions, not just menu visibility.', `<button class="btn btn-dark btn-sm" data-action="ops.staff.new">${icon('plus','icon-sm')} Add staff</button>`)}
    <div class="alert-strip warn">${icon('lock')}<div class="grow"><strong>Action-level permissions.</strong> Switching persona changes what this prototype permits. Attempts outside the role are denied and logged as demo denials.</div></div>
    <div class="card-grid">${db.staff.map(s=>{const role=ROLE_DEFS[s.role];return `<div class="card"><div class="flex gap-3"><div style="flex:none">${avatar(s.name,s.colour)}</div><div class="grow"><h3 class="card-title">${esc(s.name)}</h3><p class="card-sub">${esc(s.title)} · ${esc(s.email)}</p><div class="flex gap-2 mt-2">${badge(role?.label||s.role,role?.tone||'grey',false)}${s.active?badge('Active','green',false):badge('Inactive','grey',false)}</div></div></div><p class="tiny muted mt-3">${esc(role?.desc||'')}</p><div class="section-divider"></div><div class="tiny muted"><strong style="color:var(--ink)">Permissions</strong><br>${(role?.perms||[]).includes('*')?'All business permissions':esc((role?.perms||[]).join(', '))}</div><div class="btn-group mt-3"><button class="btn btn-outline btn-xs" data-action="ops.staff.edit" data-id="${s.id}">Edit</button><button class="btn btn-ghost btn-xs" data-action="ops.staff.toggle" data-id="${s.id}" style="color:${s.active?'var(--red)':'var(--green)'}">${s.active?'Deactivate':'Activate'}</button></div></div>`;}).join('')}</div>
    <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Role permission matrix</h3><p class="card-sub">High-level summary of the demo permission model.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Role</th><th>Scope</th><th>Key permissions</th></tr></thead><tbody>${Object.entries(ROLE_DEFS).map(([key,role])=>`<tr><td class="main-cell"><strong>${esc(role.label)}</strong><span>${esc(key)}</span></td><td>${esc(role.desc)}</td><td class="tiny">${(role.perms||[]).includes('*')?'All':esc((role.perms||[]).join(', '))}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function opsReportsView() {
  const delivered = db.jobs.filter(j=>j.status==='DELIVERED');
  const revenue = db.invoices.filter(i=>i.status!=='VOID').reduce((s,i)=>s+invoiceTotals(i,db).total,0);
  const paid = db.invoices.flatMap(i=>i.payments||[]).filter(p=>!p.reversed).reduce((s,p)=>s+Number(p.amount||0),0);
  const avgOrder = db.invoices.length ? revenue/db.invoices.length : 0;
  const serviceCounts = db.jobs.flatMap(j=>j.services||[]).reduce((acc,id)=>{acc[id]=(acc[id]||0)+1;return acc;},{});
  const serviceData = Object.entries(serviceCounts).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([id,v])=>({label:serviceById(db,id)?.name||id,short:(serviceById(db,id)?.name||id).split(' ')[0],value:v}));
  const months = Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));const key=`${d.getFullYear()}-${pad2(d.getMonth()+1)}`;const total=db.invoices.filter(inv=>inv.status!=='VOID'&&String(inv.date).startsWith(key)).reduce((s,inv)=>s+invoiceTotals(inv,db).total,0);return {label:new Intl.DateTimeFormat('en-IN',{month:'short'}).format(d),short:new Intl.DateTimeFormat('en-IN',{month:'short'}).format(d),value:Math.round(total)};});
  const sentEstimates = db.estimates.filter(e => e.sentAt);
  const approvalRate = sentEstimates.length ? Math.round(sentEstimates.filter(e=>['APPROVED','PARTIALLY_APPROVED'].includes(e.status)).length/sentEstimates.length*100) : 0;
  return `${pageHead('Reports','Demo operational and financial metrics. Export is illustrative.', `<button class="btn btn-outline btn-sm" data-action="export.reports">${icon('download','icon-sm')} Export summary CSV</button>`)}
    <div class="stat-grid mb-5">${statCard('Invoiced value',fmtINR(revenue),'Excluding void invoices',{icon:'wallet'})}${statCard('Recorded paid',fmtINR(paid),'Simulated receipts',{icon:'check'})}${statCard('Average invoice',fmtINR(avgOrder),`${db.invoices.length} invoices`,{icon:'receipt'})}${statCard('Approval rate',approvalRate+'%','Approved or partial',{icon:'shield'})}</div>
    <div class="two-col"><div><div class="card"><div class="card-head"><div><h3 class="card-title">Invoiced value · last 6 months</h3><p class="card-sub">Based on invoice issue date.</p></div></div>${lineChart(months,560,230)}</div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Most requested services</h3><p class="card-sub">Job service selections in demo data.</p></div></div>${serviceData.length?barChart(serviceData,560,230):'<p class="small muted">No service data.</p>'}</div></div>
    <div><div class="card"><div class="card-head"><div><h3 class="card-title">Operations</h3></div></div><div class="detail-list"><div class="detail-row"><span class="k">Delivered jobs</span><span class="v">${delivered.length}</span></div><div class="detail-row"><span class="k">Active jobs</span><span class="v">${activeJobs(db).length}</span></div><div class="detail-row"><span class="k">Jobs waiting approval</span><span class="v">${db.jobs.filter(j=>j.status==='AWAITING_APPROVAL').length}</span></div><div class="detail-row"><span class="k">Awaiting parts</span><span class="v">${db.jobs.filter(j=>j.status==='AWAITING_PARTS').length}</span></div><div class="detail-row"><span class="k">QC rework in progress</span><span class="v">${db.jobs.filter(j=>(j.qualityChecks||[]).some(q=>q.result==='fail')&&!['DELIVERED','CANCELLED'].includes(j.status)).length}</span></div><div class="detail-row"><span class="k">Bookings this week</span><span class="v">${db.bookings.filter(b=>b.date>=todayKey()&&b.date<=dayOffsetKey(7)).length}</span></div><div class="detail-row"><span class="k">Average rating</span><span class="v">${db.feedback.length?(db.feedback.reduce((s,f)=>s+f.ratings.overall,0)/db.feedback.length).toFixed(1):'—'} / 5</span></div></div></div>
      <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Approval discipline</h3><p class="card-sub">Evidence of recorded customer decisions.</p></div></div><div class="detail-row"><span class="k">Estimates sent</span><span class="v">${db.estimates.filter(e=>e.sentAt).length}</span></div><div class="detail-row"><span class="k">Approved</span><span class="v">${db.estimates.filter(e=>e.status==='APPROVED').length}</span></div><div class="detail-row"><span class="k">Partially approved</span><span class="v">${db.estimates.filter(e=>e.status==='PARTIALLY_APPROVED').length}</span></div><div class="detail-row"><span class="k">Declined</span><span class="v">${db.estimates.filter(e=>e.status==='REJECTED').length}</span></div><div class="detail-row"><span class="k">Declined line items</span><span class="v">${db.estimates.reduce((s,e)=>s+(e.decisions||[]).filter(d=>d.decision==='decline').reduce((x,d)=>x+(d.lineIds||[]).length,0),0)}</span></div></div>
      <div class="inline-note mt-5">${icon('info')}<div>Reports are derived from synthetic seed data and local demo actions. They are not accounting records.</div></div></div></div>`;
}

function opsSettingsView() {
  const s = db.settings;
  return `${pageHead('Settings','Configure the demo business. Changes affect this browser only.', `<button class="btn btn-outline btn-sm" data-action="export.settings">${icon('download','icon-sm')} Export settings</button>`)}
    <div class="alert-strip info">${icon('info')}<div class="grow"><strong>Demo configuration.</strong> Tax, approval and collection settings here are illustrative. Real businesses must confirm legal, tax and safety requirements.</div></div>
    <form data-form="ops.settings.save">
      <div class="two-col"><div>
        <div class="card"><div class="card-head"><div><h3 class="card-title">Business details</h3><p class="card-sub">Shown on the public website and documents.</p></div></div><div class="form-grid"><div class="field full"><label>Business name</label><input class="input" name="businessName" value="${esc(s.business.name)}" required maxlength="100"></div><div class="field full"><label>Address</label><textarea class="textarea" name="address" maxlength="250">${esc(s.business.address)}</textarea></div><div class="field"><label>Phone</label><input class="input" name="phone" value="${esc(s.business.phone)}" maxlength="25"></div><div class="field"><label>Email</label><input class="input" name="email" type="email" value="${esc(s.business.email)}" maxlength="100"></div><div class="field"><label>GSTIN (demo)</label><input class="input" name="gstin" value="${esc(s.business.gstin)}" maxlength="20"><span class="hint">Do not use a real GSTIN in this prototype.</span></div><div class="field"><label>Tagline</label><input class="input" name="tagline" value="${esc(s.business.tagline)}" maxlength="120"></div></div></div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Opening & booking</h3><p class="card-sub">Capacity is per generated time slot.</p></div></div><div class="form-grid"><div class="field"><label>Booking opens</label><input class="input" type="time" name="bookingOpen" value="${esc(s.booking.open)}"></div><div class="field"><label>Booking closes</label><input class="input" type="time" name="bookingClose" value="${esc(s.booking.close)}"></div><div class="field"><label>Slot capacity</label><input class="input" type="number" min="1" max="10" name="capacity" value="${s.booking.capacity}"></div><div class="field"><label>Slot minutes</label><input class="input" type="number" min="30" max="120" step="15" name="slotMinutes" value="${s.booking.slotMinutes}"></div><div class="field full"><label>Hours summary</label><input class="input" value="${esc(Object.entries(s.business.hours).map(([d,h])=>`${d}: ${h}`).join(' · '))}" disabled><span class="hint">Hours are fixed demo values in this build; booking open/close controls generated slots.</span></div></div></div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Approval & collection policy</h3><p class="card-sub">Rules shown to staff; not legal advice.</p></div></div><div class="form-grid"><div class="field"><label>Estimate validity (days)</label><input class="input" name="validityDays" type="number" min="1" max="30" value="${s.approval.validityDays}"></div><div class="field full"><label>Collection policy</label><textarea class="textarea" name="collectionPolicy" maxlength="500">${esc(s.approval.collectionPolicy)}</textarea></div><div class="field full"><label>Safety review policy</label><textarea class="textarea" name="safetyPolicy" maxlength="500">${esc(s.approval.safetyPolicy)}</textarea></div></div></div>
      </div>
      <div>
        <div class="card"><div class="card-head"><div><h3 class="card-title">Tax</h3><p class="card-sub">Applied to new calculations from this setting.</p></div></div><label class="check mb-3"><input type="checkbox" name="taxEnabled" ${s.tax.enabled?'checked':''}> Enable tax calculation</label><div class="form-grid"><div class="field"><label>Rate (%)</label><input class="input" name="taxRate" type="number" min="0" max="28" step="0.5" value="${s.tax.rate}"></div><div class="field"><label>Label</label><input class="input" name="taxLabel" value="${esc(s.tax.label)}" maxlength="80"></div></div><div class="inline-note warn mt-3">${icon('alert')}<div>${esc(s.tax.note)}</div></div></div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Communication templates</h3><p class="card-sub">Simulated messages; placeholders remain literal.</p></div></div>${Object.entries(s.templates).map(([key,t])=>`<div class="field mb-3"><label>${esc(COMMUNICATION_TYPES[key]||key)} subject</label><input class="input" name="tpl_${key}_subject" value="${esc(t.subject)}" maxlength="120"><textarea class="textarea mt-2" name="tpl_${key}_body" style="min-height:65px" maxlength="500">${esc(t.body)}</textarea></div>`).join('')}<p class="tiny muted">Messages are stored and displayed as simulated. Nothing is sent.</p></div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Numbering</h3><p class="card-sub">Next numbers used by new documents.</p></div></div><div class="form-grid"><div class="field"><label>Booking</label><input class="input" name="numBooking" type="number" min="1" value="${s.numbering.booking}"></div><div class="field"><label>Job</label><input class="input" name="numJob" type="number" min="1" value="${s.numbering.job}"></div><div class="field"><label>Estimate</label><input class="input" name="numEstimate" type="number" min="1" value="${s.numbering.estimate}"></div><div class="field"><label>Invoice</label><input class="input" name="numInvoice" type="number" min="1" value="${s.numbering.invoice}"></div><div class="field"><label>Customer</label><input class="input" name="numCustomer" type="number" min="1" value="${s.numbering.customer}"></div><div class="field"><label>Vehicle</label><input class="input" name="numVehicle" type="number" min="1" value="${s.numbering.vehicle}"></div></div></div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Services</h3><p class="card-sub">Enable, disable and preview catalogue pricing.</p></div><a class="link tiny" href="#/site/services" target="_blank">Public view</a></div>${s.services.map(sv=>`<div class="detail-row"><span class="k">${esc(sv.name)}<br><span class="tiny">${sv.price?fmtINR(sv.price):'Inspection'}</span></span><span class="v">${sv.enabled?badge('Enabled','green',false):badge('Disabled','grey',false)}<button class="btn btn-ghost btn-xs" type="button" data-action="ops.service.toggle" data-id="${sv.id}">${sv.enabled?'Disable':'Enable'}</button></span></div>`).join('')}</div>
        <div class="card mt-5"><div class="card-head"><div><h3 class="card-title">Save</h3><p class="card-sub">Validated and written to LocalStorage.</p></div></div><button class="btn btn-dark" type="submit">Save settings</button><button class="btn btn-outline" type="button" data-action="ops.settings.export">Export settings</button></div>
      </div></div>
    </form>`;
}

function opsAuditView() {
  const q = currentRoute.query;
  const search = q.get('q') || '';
  const type = q.get('entity') || 'all';
  let list = db.audit.slice();
  if (type !== 'all') list = list.filter(a=>a.entityType===type);
  list = searchFilter(list, search, ['summary','actor','action','role']);
  return `${pageHead('Audit history','Append-style local record of key demo actions. Not tamper-proof.', `<button class="btn btn-outline btn-sm" data-action="export.audit">${icon('download','icon-sm')} Export CSV</button>`)}
    <div class="alert-strip info">${icon('shield')}<div class="grow">Permissions, customer decisions, status changes and demo resets are recorded here. Do not treat this as a compliance-grade audit system.</div></div>
    <div class="card pad-0"><div style="padding:14px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--line)"><div class="pill-tabs">${[['all','All'],['estimate','Estimates'],['job','Jobs'],['invoice','Invoices'],['booking','Bookings'],['customer','Customers'],['settings','Settings']].map(([k,l])=>`<a href="#/ops/audit?entity=${k}" style="text-decoration:none" class="${type===k?'active':''}">${l}</a>`).join('')}</div><form data-form="ops.audit.search" style="margin-left:auto;display:flex;gap:6px"><input class="input" name="q" value="${esc(search)}" placeholder="Search audit summary or actor" style="height:34px;width:230px"><button class="btn btn-outline btn-sm" type="submit">${icon('search','icon-sm')}</button></form></div>
    ${list.length?`<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Summary</th><th>Reason</th></tr></thead><tbody>${list.slice(0,150).map(a=>`<tr><td>${fmtDateTime(a.at)}</td><td>${esc(a.actor)}<br><span class="tiny muted">${esc(a.role)}</span></td><td><span class="mono tiny">${esc(a.action)}</span></td><td>${esc(a.entityType)}<br><span class="tiny muted">${esc(a.entityId||'')}</span></td><td style="max-width:380px">${esc(a.summary)}</td><td class="tiny">${esc(a.reason||'—')}</td></tr>`).join('')}</tbody></table></div>`:`<div style="padding:30px">${emptyState('No audit events match','Try another filter or search.','','shield')}</div>`}</div>`;
}

