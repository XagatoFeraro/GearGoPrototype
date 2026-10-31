/* ==========================================================================
   Gear Go Automobiles — router
   Hash routing, auth guards, view resolution and the render boundary.
   ========================================================================== */
'use strict';

function routeTitle(path) {
  const p = path.split('/').filter(Boolean);
  if (p[0] === 'demo') return p[1] === 'personas' ? 'Switch demo identity · Gear Go' : 'Demo controls · Gear Go';
  if (p[0] === 'tech') return 'Mechanic workspace · Gear Go';
  if (p[0] === 'ops') return 'Garage operations · Gear Go';
  if (p[0] === 'portal') return 'Customer portal · Gear Go';
  if (p[0] === 'login') return 'Sign in · Gear Go';
  if (p[0] === 'book') return 'Book a service · Gear Go';
  const names = {services:'Services', 'how-it-works':'How it works', 'why-us':'Why Gear Go', 'service-area':'Service area', contact:'Contact', faqs:'FAQs', track:'Track request', privacy:'Privacy', terms:'Terms', cancellation:'Cancellation'};
  return `${names[p[p.length - 1]] || 'Car service in Aya Nagar'} · Gear Go Automobiles`;
}

function opsRoutePermission(path) {
  if (path === '/ops/settings' || path === '/ops/audit') return 'settings.manage';
  if (path.startsWith('/ops/staff')) return 'staff.view';
  if (path.startsWith('/ops/reports')) return 'reports.view';
  if (path.startsWith('/ops/receivables')) return 'receivables.manage';
  if (path.startsWith('/ops/invoices')) return path === '/ops/invoices/new' ? 'invoices.create' : 'invoices.view';
  if (path.startsWith('/ops/approvals') || path.startsWith('/ops/estimates')) return path.includes('/new') ? 'estimates.create' : 'approvals.view';
  if (path.startsWith('/ops/customers')) return 'customers.view';
  if (path.startsWith('/ops/vehicles')) return 'vehicles.view';
  if (path.startsWith('/ops/bookings')) return 'bookings.view';
  if (path.startsWith('/ops/inspections')) return 'inspections.manage';
  if (path.startsWith('/ops/jobs') || path.startsWith('/ops/workboard')) return currentStaff(db)?.role === 'technician' ? 'assigned_jobs.view' : 'job_cards.view';
  if (path.startsWith('/ops/inventory')) return 'inventory.manage';
  if (path.startsWith('/ops/communications')) return 'communications.manage';
  if (path.startsWith('/ops/reminders')) return 'reminders.manage';
  if (path.startsWith('/ops/feedback')) return 'feedback.manage';
  if (path.startsWith('/ops/calendar')) return 'calendar.manage';
  return 'job_cards.view';
}

/* Every portal, garage and workshop entrance is gated. Guests (and signed-in
   users pointing at another surface) are bounced through /login with the
   intended route preserved, so identity is always chosen explicitly. */
function authRedirect(hash) {
  const path = String(hash || '').split('?')[0] || '/site';
  const section = path.split('/').filter(Boolean)[0] || 'site';
  const staff = db.session.kind === 'staff' ? currentStaff(db) : null;
  const customer = db.session.kind === 'customer' ? currentCustomer(db) : null;
  if (section === 'portal' && !customer) return loginPath(path);
  if (section === 'tech' && (!staff || staff.role !== 'technician')) return loginPath(path);
  if (section === 'ops' && !staff) return loginPath(path);
  return null;
}

function applyAuthRedirect() {
  const hash = location.hash.replace(/^#/, '') || '/site';
  const gate = authRedirect(hash);
  if (!gate) return false;
  const target = `#${gate}`;
  if (location.hash === target) return true;
  try { history.replaceState(null, '', target); }
  catch (error) { location.replace(target); }
  return true;
}

function resolveView() {
  const hash = location.hash.replace(/^#/, '') || '/site';
  const [rawPath, rawQuery = ''] = hash.split('?');
  let path = rawPath || '/site';
  if (path.length > 1) path = path.replace(/\/$/, '');
  const parts = path.split('/').filter(Boolean);
  currentRoute = {path, query:new URLSearchParams(rawQuery), parts};
  const section = parts[0] || 'site';
  currentExperience = section === 'site' || section === 'book' ? 'site' : ['portal','tech','ops','demo'].includes(section) ? section : 'site';

  if (section === 'login') return {shell:'site', html:loginView(), title:routeTitle(path)};

  if (section === 'site' || section === 'book') {
    if (path === '/book') return {shell:'site', html:bookingView(), title:routeTitle(path)};
    if (!parts[1] || parts[1] === '') return {shell:'site', html:siteHome(), title:routeTitle(path)};
    if (parts[1] === 'services') return {shell:'site', html:parts[2] ? siteServiceDetail(parts[2]) : siteServices(), title:routeTitle(path)};
    if (parts[1] === 'how-it-works') return {shell:'site', html:siteHowItWorks(), title:routeTitle(path)};
    if (parts[1] === 'why-us') return {shell:'site', html:siteWhyUs(), title:routeTitle(path)};
    if (parts[1] === 'service-area') return {shell:'site', html:siteServiceArea(), title:routeTitle(path)};
    if (parts[1] === 'contact') return {shell:'site', html:siteContact(), title:routeTitle(path)};
    if (parts[1] === 'faqs') return {shell:'site', html:siteFaqs(), title:routeTitle(path)};
    if (parts[1] === 'track') return {shell:'site', html:siteTrack(), title:routeTitle(path)};
    if (['privacy','terms','cancellation'].includes(parts[1])) return {shell:'site', html:sitePolicy(parts[1]), title:routeTitle(path)};
    return {shell:'site', html:siteNotFound('Page not found','This public demo page does not exist. Return to the website or try the service catalogue.'), title:'Page not found · Gear Go'};
  }

  if (section === 'portal') {
    currentExperience = 'portal';
    if (db.session.kind !== 'customer' || !currentCustomer(db)) {
      return {shell:'app', experience:'portal', html:portalMissingView(), title:'Customer portal · Gear Go'};
    }
    let html;
    if (!parts[1]) html = portalHomeView();
    else if (parts[1] === 'vehicles') html = parts[2] ? portalVehicleDetailView(parts[2]) : portalVehiclesView();
    else if (parts[1] === 'bookings') html = parts[2] ? portalBookingDetailView(parts[2]) : portalBookingsView();
    else if (parts[1] === 'approvals') html = parts[2] ? portalApprovalDetailView(parts[2]) : portalApprovalsView();
    else if (parts[1] === 'jobs') html = parts[2] ? portalJobDetailView(parts[2]) : portalHistoryView();
    else if (parts[1] === 'history') html = portalHistoryView();
    else if (parts[1] === 'invoices') html = parts[2] ? portalInvoiceDetailView(parts[2]) : portalInvoicesView();
    else if (parts[1] === 'reminders') html = portalRemindersView();
    else if (parts[1] === 'feedback') html = portalFeedbackView();
    else if (parts[1] === 'profile') html = portalProfileView();
    else html = portalNotFoundView('page');
    return {shell:'app', experience:'portal', html, title:routeTitle(path)};
  }

  if (section === 'tech') {
    currentExperience = 'tech';
    if (db.session.kind !== 'staff' || !currentStaff(db)) {
      return {shell:'app', experience:'tech', html:forbiddenView('assigned_jobs.view'), title:'Mechanic workspace · Gear Go'};
    }
    const role = currentStaff(db).role;
    if (parts[1] === 'jobs' && (!parts[2] || role === 'technician' || can('assigned_jobs.view',db))) {
      return {shell:'app', experience:'tech', html:parts[2] ? techJobView(parts[2]) : techJobsView(), title:routeTitle(path)};
    }
    if (parts[1] === 'qc') {
      if (!can('quality.submit', db) && !can('quality.manage', db)) return {shell:'app', experience:'tech', html:forbiddenView('quality.submit'), title:routeTitle(path)};
      return {shell:'app', experience:'tech', html:techQcView(), title:routeTitle(path)};
    }
    if (!parts[1]) return {shell:'app', experience:'tech', html:techTodayView(), title:routeTitle(path)};
    return {shell:'app', experience:'tech', html:opsNotFoundView('page'), title:'Not found · Gear Go'};
  }

  if (section === 'demo') {
    if (parts[1] === 'personas') return {shell:'app', experience:db.session.kind === 'customer' ? 'portal' : 'ops', html:demoPersonasView(), title:routeTitle(path)};
    return {shell:'app', experience:db.session.kind === 'customer' ? 'portal' : 'ops', html:demoControlsView(), title:routeTitle(path)};
  }

  if (section === 'ops') {
    if (db.session.kind !== 'staff' || !currentStaff(db)) {
      return {shell:'app', experience:'ops', html:forbiddenView('staff.access'), title:'Garage operations · Gear Go'};
    }
    const perm = opsRoutePermission(path);
    if (!can(perm, db)) {
      return {shell:'app', experience:currentStaff(db).role === 'technician' ? 'tech' : 'ops', html:forbiddenView(perm), title:'Access restricted · Gear Go'};
    }
    const experience = currentStaff(db).role === 'technician' ? 'tech' : 'ops';
    let html;
    if (!parts[1]) html = opsDashboardView();
    else if (parts[1] === 'bookings') html = parts[2] ? opsBookingDetailView(parts[2]) : opsBookingsView();
    else if (parts[1] === 'calendar') html = opsCalendarView();
    else if (parts[1] === 'customers') html = parts[2] ? opsCustomerDetailView(parts[2]) : opsCustomersView();
    else if (parts[1] === 'vehicles') html = parts[2] ? opsVehicleDetailView(parts[2]) : opsVehiclesView();
    else if (parts[1] === 'jobs') html = parts[2] ? opsJobDetailView(parts[2]) : opsJobsView();
    else if (parts[1] === 'workboard') html = opsWorkboardView();
    else if (parts[1] === 'inspections') html = parts[2] ? opsInspectionView(parts[2]) : opsNotFoundView('job');
    else if (parts[1] === 'approvals') html = opsApprovalsView();
    else if (parts[1] === 'estimates' && parts[2] === 'new') html = opsEstimateBuilderView();
    else if (parts[1] === 'estimates') html = parts[2] ? opsEstimateDetailView(parts[2]) : opsApprovalsView();
    else if (parts[1] === 'inventory') html = opsInventoryView();
    else if (parts[1] === 'invoices') html = parts[2] ? opsInvoiceDetailView(parts[2]) : opsInvoicesView();
    else if (parts[1] === 'receivables') html = opsReceivablesView();
    else if (parts[1] === 'communications') html = opsCommunicationsView();
    else if (parts[1] === 'reminders') html = opsRemindersView();
    else if (parts[1] === 'feedback') html = opsFeedbackView();
    else if (parts[1] === 'staff') html = opsStaffView();
    else if (parts[1] === 'reports') html = opsReportsView();
    else if (parts[1] === 'settings') html = opsSettingsView();
    else if (parts[1] === 'audit') html = opsAuditView();
    else html = opsNotFoundView('page');
    return {shell:'app', experience, html, title:routeTitle(path)};
  }

  return {shell:'site', html:siteNotFound('Page not found','The link may be incomplete. Return to the Gear Go demo home.','/demo'), title:'Page not found · Gear Go'};
}

function renderErrorView(error) {
  const detail = error && error.message ? String(error.message) : 'The demo screen could not be drawn.';
  return `<div class="card" style="max-width:720px;margin:40px auto"><div class="card-head"><div><h3 class="card-title">This screen could not be loaded</h3><p class="card-sub">Your demo data has been preserved. Reload the screen, reset the demo, or export the raw local database for recovery.</p></div><span class="badge red no-dot">Recovery</span></div><div class="alert-strip warn">${icon('alert')}<div class="grow"><strong>Technical detail:</strong> ${esc(detail)}</div></div><div class="btn-group mt-4"><button class="btn btn-dark btn-sm" data-action="recovery.reload">Reload screen</button><button class="btn btn-outline btn-sm" data-action="demo.export">Export database</button><button class="btn btn-ghost btn-sm" data-action="demo.reset" style="color:var(--red)">Reset demo</button></div><p class="tiny muted mt-4">No data was sent anywhere. If this keeps happening, reset the demo to restore the synthetic seed.</p></div>`;
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  try {
    applyAuthRedirect();
    const resolved = resolveView();
    app.innerHTML = resolved.shell === 'site' ? siteShell('', resolved.html) : appShell(resolved.experience, resolved.html);
    document.title = resolved.title || 'Gear Go Automobiles';
    if (db.ui) db.ui.lastRoute = currentRoute.path + (currentRoute.query.toString() ? `?${currentRoute.query}` : '');
    saveDB({silent:true});
    initReveals();
    if (typeof syncSiteHeader === 'function') syncSiteHeader();
    document.body.classList.remove('nav-open');
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.side-scrim')?.classList.remove('open');
    document.querySelectorAll('[data-action="sidebar.open"]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (typeof maybeAutoTour === 'function') { try { maybeAutoTour(); } catch (error) { /* best effort */ } }
  } catch (error) {
    console.error('Render recovery:', error);
    app.innerHTML = renderErrorView(error);
  }
}
