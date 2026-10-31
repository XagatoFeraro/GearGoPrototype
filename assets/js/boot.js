/* ==========================================================================
   Gear Go Automobiles — boot
   Global search, event wiring, route listeners and application startup.
   ========================================================================== */
'use strict';

function openGlobalSearch(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query) return;
  const needle = query.toLowerCase();
  const match = (...values) => values.some(value => String(value || '').toLowerCase().includes(needle));
  const people = db.customers.filter(c => match(c.name,c.mobile,c.ref)).slice(0,5);
  const vehicles = db.vehicles.filter(v => match(v.reg,v.make,v.model,v.ref)).slice(0,5);
  const jobs = db.jobs.filter(j => match(j.number,j.ref,j.concerns?.join(' '))).slice(0,5);
  const invoices = db.invoices.filter(i => match(i.ref)).slice(0,5);
  const bookings = db.bookings.filter(b => match(b.ref)).slice(0,5);
  const groups = [
    ['Customers', people.map(c => ({title:c.name,meta:`${c.ref} · ${fmtMobile(c.mobile)}`,href:`#/ops/customers/${c.id}`}))],
    ['Vehicles', vehicles.map(v => ({title:`${v.make} ${v.model}`,meta:`${fmtReg(v.reg)} · ${v.ref || ''}`,href:`#/ops/vehicles/${v.id}`}))],
    ['Jobs', jobs.map(j => ({title:j.number || j.ref,meta:jobStageLabel(j.status),href:`#/ops/jobs/${j.id}`}))],
    ['Invoices', invoices.map(i => ({title:i.ref,meta:`${fmtINR(invoiceTotals(i,db).total)} · ${invoiceTotals(i,db).status}`,href:`#/ops/invoices/${i.id}`}))],
    ['Bookings', bookings.map(b => ({title:b.ref,meta:`${fmtDateKey(b.date)} · ${fmtTime(b.slot)}`,href:`#/ops/bookings/${b.id}`}))]
  ].filter(([,items]) => items.length);
  const body = groups.length
    ? groups.map(([label,items]) => `<div class="section-divider"></div><div class="label-text mb-2">${esc(label)}</div><div class="detail-list">${items.map(item => `<a class="detail-row" href="${item.href}" data-action="modal.close" style="text-decoration:none;color:inherit"><span class="k">${esc(item.title)}</span><span class="v">${esc(item.meta)}</span></a>`).join('')}</div>`).join('')
    : emptyState('No demo records found',`Nothing matched “${query}”. Try a customer name, registration, job, invoice or booking reference.`,'','search');
  openModal({title:`Search · ${esc(query)}`,body,footer:`<button class="btn btn-dark" data-action="modal.close">Close</button>`});
}

function syncSiteHeader() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const alwaysSolid = header.dataset.solid === 'true';
  header.classList.toggle('scrolled', alwaysSolid || window.scrollY > 8);
}

function bootApp() {
  db = loadDB();
  window.addEventListener('scroll', syncSiteHeader, {passive:true});
  window.addEventListener('hashchange', () => {
    if (document.querySelector('.modal-backdrop')) closeModal();
    render();
  });
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    const handler = actions[action];
    if (!handler) return;
    const isFormControl = trigger.matches('input[type="checkbox"], input[type="radio"], select, textarea');
    if (isFormControl) return;
    const isAnchor = trigger.tagName === 'A' && trigger.getAttribute('href');
    if (!isAnchor || !['notification.read','modal.close','exp.go'].includes(action)) event.preventDefault();
    try {
      const result = handler(trigger, event);
      if (result && typeof result.catch === 'function') result.catch(error => {
        console.error(error);
        toast('Action failed',error.message || 'The demo action could not be completed.','error');
      });
    } catch (error) {
      console.error(error);
      toast('Action failed',error.message || 'The demo action could not be completed.','error');
    }
  });
  document.addEventListener('change', event => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    if (!trigger.matches('input[type="checkbox"], input[type="radio"], select')) return;
    const handler = actions[trigger.dataset.action];
    if (!handler) return;
    try { handler(trigger, event); }
    catch (error) { console.error(error); toast('Action failed',error.message || 'The demo action could not be completed.','error'); }
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    clearErrors(form);
    const handler = formHandlers[form.dataset.form];
    if (!handler) {
      toast('Form unavailable','This demo form is not connected yet.','error');
      return;
    }
    try {
      const result = handler(form, event);
      if (result && typeof result.catch === 'function') result.catch(error => {
        console.error(error);
        toast('Form could not be saved',error.message || 'Please try again.','error');
      });
    } catch (error) {
      console.error(error);
      toast('Form could not be saved',error.message || 'Please try again.','error');
    }
  });
  document.addEventListener('keydown', event => {
    const searchInput = event.target.closest('[data-global-search]');
    if (searchInput && event.key === 'Enter') { event.preventDefault(); openGlobalSearch(searchInput.value); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      const input = document.querySelector('[data-global-search]');
      if (input) { event.preventDefault(); input.focus(); input.select(); }
      return;
    }
    if (event.key === 'Escape') {
      if (document.querySelector('.modal-backdrop')) { closeModal(); return; }
      if (document.body.classList.contains('nav-open')) actions['sidebar.close']();
    }
  });
  render();
}

bootApp();

/* ==APP== */
