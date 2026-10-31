/* ==========================================================================
   Gear Go Automobiles — ui
   Shared presentational components, navigation, shells and charts.
   ========================================================================== */
'use strict';

const actions = {};
const formHandlers = {};
let currentRoute = {path:'/', query:new URLSearchParams(), parts:[]};
let currentExperience = 'site';

function brandBlock(onDark = false, href = '/site') {
  return `<a class="brand ${onDark ? 'on-dark' : ''}" href="#${href}" aria-label="Gear Go Automobiles home">
    <span class="brand-mark">${icon('car')}</span>
    <span>Gear Go<small>Automobiles</small></span>
  </a>`;
}

function avatar(name, colour = '#d9ff4f', cls = '') {
  return `<span class="avatar ${cls}" style="background:${colour}" aria-hidden="true">${esc(initials(name))}</span>`;
}

function badge(text, tone = 'grey', withDot = true) {
  return `<span class="badge ${tone} ${withDot ? '' : 'no-dot'}">${esc(text)}</span>`;
}

function bookingBadge(status) {
  const s = BOOKING_STATUS[status] || {label:status,tone:'grey'};
  return badge(s.label, s.tone);
}
function jobBadge(status) {
  const s = JOB_STATUS[status] || {label:status,tone:'grey'};
  return badge(s.label, s.tone);
}
function estimateBadge(status) {
  const s = ESTIMATE_STATUS[status] || {label:status,tone:'grey'};
  return badge(s.label, s.tone);
}
function invoiceBadge(inv) {
  const t = invoiceTotals(inv, db);
  const s = INVOICE_STATUS[t.status] || {label:t.status,tone:'grey'};
  return badge(s.label, s.tone);
}
function partStockBadge(part) {
  const tone = Number(part.stock) <= 0 ? 'red' : Number(part.stock) - Number(part.reserved || 0) <= 0 ? 'blue' : Number(part.stock) <= Number(part.reorder) ? 'amber' : 'green';
  return badge(PART_STATUS(part), tone);
}
function inspectionResultBadge(result) {
  const r = INSPECTION_RESULTS[result] || {label:result,tone:'grey'};
  return badge(r.label, r.tone);
}
function commStatusBadge(status) {
  const map = {delivered:['Delivered','green'],sent:['Sent · simulated','blue'],queued:['Queued · simulated','amber'],failed:['Failed · simulated','red']};
  const v = map[status] || [status,'grey'];
  return badge(v[0], v[1]);
}

function emptyState(title, text, actionHtml = '', iconName = 'clipboard') {
  return `<div class="empty"><div class="empty-icon">${icon(iconName)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${actionHtml}</div>`;
}

function sectionHead(eyebrow, title, lede = '', center = false) {
  return `<div class="section-head ${center ? 'center' : ''} reveal">
    <span class="eyebrow">${esc(eyebrow)}</span>
    <h2 class="section-title">${title}</h2>
    ${lede ? `<p class="section-lede">${esc(lede)}</p>` : ''}
  </div>`;
}

function statCard(label, value, foot = '', options = {}) {
  return `<div class="stat ${options.accent ? 'accent' : ''}">
    <div class="label">${esc(label)}</div>
    <div class="value mono">${value}</div>
    <div class="foot">${foot}</div>
    ${options.icon ? `<span class="corner">${icon(options.icon)}</span>` : ''}
  </div>`;
}

function carArt(tone = 'lime') {
  const bodyGradient = tone === 'lime' ? 'carBody' : 'carBodyCool';
  return `<svg viewBox="0 0 760 330" role="img" aria-label="Stylised premium car illustration">
    <defs>
      <linearGradient id="carBody" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f3f7e3"/><stop offset=".5" stop-color="#cfe39d"/><stop offset="1" stop-color="#9cbf64"/></linearGradient>
      <linearGradient id="carBodyCool" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#e8eff1"/><stop offset="1" stop-color="#849a9d"/></linearGradient>
      <linearGradient id="glassGrad" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#d9ff4f" stop-opacity=".6"/><stop offset="1" stop-color="#9ab877" stop-opacity=".3"/></linearGradient>
      <radialGradient id="wheelGrad"><stop offset=".55" stop-color="#1a211c"/><stop offset=".72" stop-color="#39443a"/><stop offset="1" stop-color="#0d1410"/></radialGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
    </defs>
    <ellipse cx="380" cy="288" rx="285" ry="25" fill="#000" opacity=".36" filter="url(#softShadow)"/>
    <path d="M82 238c2-28 22-49 58-58l80-19 48-55c14-16 34-25 55-25h128c24 0 46 11 60 30l38 52 78 16c28 6 44 22 48 48l3 18c1 9-5 16-14 16H94c-9 0-15-8-12-17z" fill="url(#${bodyGradient})"/>
    <path d="M247 160l39-45c11-13 27-20 44-20h106c18 0 35 8 46 22l31 42z" fill="url(#glassGrad)" stroke="#4f6342" stroke-opacity=".4"/>
    <path d="M378 96v64M462 96l29 64" stroke="#3f5137" stroke-width="2.5" opacity=".4"/>
    <path d="M92 221c90 7 207 10 322 8 100-2 198-8 289-18" fill="none" stroke="#3c4b34" stroke-width="2" opacity=".28"/>
    <path d="M643 187c25 4 43 13 53 28" fill="none" stroke="#f2f5e8" stroke-width="3" opacity=".6"/>
    <rect x="112" y="209" width="34" height="9" rx="4.5" fill="#fff" opacity=".9"/>
    <rect x="610" y="204" width="42" height="10" rx="5" fill="#d9ff4f"/>
    <path d="M89 253h642" stroke="#23301f" stroke-width="1" opacity=".25"/>
    <g transform="translate(202 259)">
      <circle r="48" fill="#0d1410"/>
      <circle r="39" fill="url(#wheelGrad)" stroke="#90a78e" stroke-width="2"/>
      <circle r="24" fill="#141c16" stroke="#a9bd9f" stroke-width="3"/>
      <circle r="7" fill="#d9ff4f"/>
      <g stroke="#9cae94" stroke-width="4"><path d="M0-22V22M-22 0H22M-15-15 15 15M15-15-15 15"/></g>
    </g>
    <g transform="translate(588 259)">
      <circle r="48" fill="#0d1410"/>
      <circle r="39" fill="url(#wheelGrad)" stroke="#90a78e" stroke-width="2"/>
      <circle r="24" fill="#141c16" stroke="#a9bd9f" stroke-width="3"/>
      <circle r="7" fill="#d9ff4f"/>
      <g stroke="#9cae94" stroke-width="4"><path d="M0-22V22M-22 0H22M-15-15 15 15M15-15-15 15"/></g>
    </g>
    <path d="M236 230h101M486 230h75" stroke="#2a3627" stroke-width="2" opacity=".25"/>
  </svg>`;
}

function miniCarArt() {
  return `<svg viewBox="0 0 400 130" aria-hidden="true"><path d="M30 92c2-16 12-27 31-32l42-9 26-28c7-8 17-12 28-12h68c12 0 24 5 31 15l20 25 41 8c15 3 24 11 26 25l1 8H28z" fill="#cfe39d"/><path d="M150 52l21-23c5-6 12-9 20-9h54c8 0 16 3 21 9l17 23z" fill="#65805d" opacity=".5"/><circle cx="113" cy="96" r="24" fill="#0d1410" stroke="#d9ff4f" stroke-width="3"/><circle cx="302" cy="96" r="24" fill="#0d1410" stroke="#d9ff4f" stroke-width="3"/><circle cx="113" cy="96" r="9" fill="#d9ff4f"/><circle cx="302" cy="96" r="9" fill="#d9ff4f"/></svg>`;
}

function siteHeader(active = '') {
  const navItem = (path, label) => `<a href="#/site${path}" class="${active === path ? 'active' : ''}">${label}</a>`;
  const signedIn = isSignedIn(db);
  const staff = currentStaff(db);
  const identityHref = db.session.kind === 'customer' && currentCustomer(db) ? '/portal' : db.session.kind === 'staff' && staff ? (staff.role === 'technician' ? '/tech' : '/ops') : '/login?next=%2Fportal';
  const identityLabel = db.session.kind === 'customer' && currentCustomer(db) ? 'My portal' : db.session.kind === 'staff' && staff ? (staff.role === 'technician' ? 'Workshop' : 'Garage') : 'Sign in';
  const solid = currentRoute.path === '/book';
  return `<header class="site-header${solid ? ' scrolled' : ''}" id="site-header" data-solid="${solid}">
    <div class="inner">
      ${brandBlock(true, '/site')}
      <nav class="site-nav" aria-label="Primary">
        ${navItem('/services','Services')}
        ${navItem('/how-it-works','How it works')}
        ${navItem('/why-us','Why choose us')}
        ${navItem('/service-area','Service area')}
        ${navItem('/contact','Contact')}
      </nav>
      <div class="header-actions">
        <button class="switch-experience" data-action="experience.open" aria-label="Switch demo experience">${icon('grid','icon-sm')} Demo mode</button>
        <a href="#${identityHref}" class="btn btn-outline">${identityLabel}</a>
        <a href="#/site/track" class="btn btn-outline">Track service</a>
        <a href="#/book" class="btn btn-lime">Book a service ${icon('arrow','icon-sm')}</a>
        <button class="mobile-toggle" data-action="mobile.open" aria-label="Open navigation" aria-expanded="false" aria-controls="mobile-menu">${icon('menu')}</button>
      </div>
    </div>
  </header>
  <div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Mobile navigation">
    <button class="mobile-close" data-action="mobile.close" aria-label="Close navigation">${icon('close')}</button>
    <div style="margin-bottom:28px">${brandBlock(true, '/site')}</div>
    <a href="#/site/services">Services</a>
    <a href="#/site/how-it-works">How it works</a>
    <a href="#/site/why-us">Why choose us</a>
    <a href="#/site/service-area">Service area</a>
    <a href="#/site/contact">Contact</a>
    <a href="#/site/track">Track service</a>
    <a href="#/site/faqs">FAQs</a>
    <a href="#${identityHref}">${identityLabel}</a>
    <a href="#/book" class="btn btn-lime">Book a service ${icon('arrow','icon-sm')}</a>
    <button class="btn btn-outline" style="color:white;border-color:rgba(255,255,255,.3)" data-action="experience.open">Switch demo experience</button>
    ${signedIn ? '<button class="btn btn-ghost" style="color:white" data-action="auth.logout">Sign out</button>' : ''}
  </div>`;
}

function siteFooter() {
  return `<footer class="site-footer">
    <div class="inner">
      <div class="footer-grid">
        <div>
          ${brandBlock(true, '/site')}
          <p class="mt-4" style="max-width:320px">${esc(db.settings.business.address)}</p>
          <div class="mt-4"><span class="demo-flag">Demo contact details</span></div>
          <p class="mt-2">${esc(db.settings.business.phone)}<br>${esc(db.settings.business.email)}</p>
        </div>
        <div>
          <h4>Explore</h4>
          <a href="#/site/services">All services</a>
          <a href="#/site/how-it-works">How it works</a>
          <a href="#/site/why-us">Why choose us</a>
          <a href="#/site/service-area">Service area</a>
          <a href="#/site/contact">Contact</a>
        </div>
        <div>
          <h4>Customer</h4>
          <a href="#/book">Book a service</a>
          <a href="#/site/track">Track a request</a>
          <a href="#${entryPath('/portal')}">Customer portal</a>
          <a href="#/site/faqs">FAQs</a>
          <a href="#/site/privacy">Privacy</a>
        </div>
        <div>
          <h4>Demo policies</h4>
          <a href="#/site/terms">Terms of use</a>
          <a href="#/site/privacy">Privacy notice</a>
          <a href="#/site/cancellation">Cancellation policy</a>
          <a href="#/demo">Prototype information</a>
        </div>
      </div>
      <div class="footer-bottom">
        <div>© ${new Date().getFullYear()} Gear Go Automobiles · Interactive product prototype</div>
        <div>Address shown is the configured business location. All customers, records and contact details are synthetic demo data.</div>
      </div>
      <div class="footer-note"><strong style="color:rgba(255,255,255,.7)">Prototype notice:</strong> This site demonstrates a proposed garage platform. It is not the live Gear Go business, does not accept real bookings at real contact details, and does not process payments or send messages. ${esc(db.settings.tax.note)}</div>
    </div>
  </footer>`;
}

function experienceFab() {
  return `<div class="experience-switcher no-print">
    <div class="exp-menu" id="exp-menu">
      <a href="#/demo" data-action="exp.go" data-route="/demo">${icon('grid','icon-sm')} Demonstration home</a>
      <hr>
      <a href="#/site" data-action="exp.customer-site">${icon('external','icon-sm')} Customer website</a>
      <a href="#/portal" data-action="exp.customer-portal">${icon('user','icon-sm')} Customer portal</a>
      <a href="#/ops" data-action="exp.ops">${icon('wrench','icon-sm')} Garage operations</a>
      <a href="#/tech" data-action="exp.tech">${icon('tools','icon-sm')} Mechanic workspace</a>
      <hr>
      <a href="#/demo/personas" data-action="exp.personas">${icon('users','icon-sm')} Switch persona</a>
      <a href="#/demo" data-action="exp.controls">${icon('settings','icon-sm')} Demo controls</a>
    </div>
    <button class="exp-fab" data-action="exp.toggle" aria-expanded="false" aria-controls="exp-menu">${icon('grid')} Demo experiences</button>
  </div>`;
}

function siteShell(active, content) {
  return `<div class="site-shell">${siteHeader(active)}<main id="main-content" tabindex="-1">${content}</main>${siteFooter()}${experienceFab()}</div>`;
}

function breadcrumbTrail(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#/demo">Demo</a>${items.map((i, idx) => `${icon('chevron','icon-sm')}${i.href && idx < items.length - 1 ? `<a href="#${i.href}">${esc(i.label)}</a>` : `<strong>${esc(i.label)}</strong>`}`).join('')}</nav>`;
}

const OPS_NAV = [
  {group:'Overview',items:[
    {label:'Dashboard',path:'/ops',icon:'chart'},
    {label:'Calendar',path:'/ops/calendar',icon:'calendar'},
    {label:'Reports',path:'/ops/reports',icon:'chart'}
  ]},
  {group:'Front desk',items:[
    {label:'Bookings',path:'/ops/bookings',icon:'calendar'},
    {label:'Customers',path:'/ops/customers',icon:'users'},
    {label:'Vehicles',path:'/ops/vehicles',icon:'car'}
  ]},
  {group:'Workshop',items:[
    {label:'Job cards',path:'/ops/jobs',icon:'clipboard',count:() => activeJobs(db).length},
    {label:'Work board',path:'/ops/workboard',icon:'grid'},
    {label:'Approvals',path:'/ops/approvals',icon:'shield',count:() => pendingApprovals(db).length},
    {label:'Inventory',path:'/ops/inventory',icon:'box'}
  ]},
  {group:'Money',items:[
    {label:'Invoices',path:'/ops/invoices',icon:'receipt'},
    {label:'Receivables',path:'/ops/receivables',icon:'wallet',count:() => db.invoices.filter(i => isOverdueInvoice(db, i)).length}
  ]},
  {group:'Customers',items:[
    {label:'Communications',path:'/ops/communications',icon:'message'},
    {label:'Reminders',path:'/ops/reminders',icon:'clock'},
    {label:'Feedback',path:'/ops/feedback',icon:'star'}
  ]},
  {group:'Administration',items:[
    {label:'Staff',path:'/ops/staff',icon:'users'},
    {label:'Settings',path:'/ops/settings',icon:'settings'},
    {label:'Audit history',path:'/ops/audit',icon:'shield'},
    {label:'Demo controls',path:'/demo',icon:'grid'}
  ]}
];

const TECH_NAV = [
  {group:'My workspace',items:[
    {label:'My day',path:'/tech',icon:'grid'},
    {label:'Assigned jobs',path:'/tech/jobs',icon:'clipboard',count:() => myJobs().filter(j => !['DELIVERED','CANCELLED'].includes(j.status)).length},
    {label:'QC queue',path:'/tech/qc',icon:'shield'},
    {label:'Demo controls',path:'/demo',icon:'grid'}
  ]}
];

const PORTAL_NAV = [
  {group:'Your garage',items:[
    {label:'Overview',path:'/portal',icon:'grid'},
    {label:'My vehicles',path:'/portal/vehicles',icon:'car'},
    {label:'Bookings',path:'/portal/bookings',icon:'calendar'},
    {label:'Approvals',path:'/portal/approvals',icon:'shield',count:() => portalApprovals().length}
  ]},
  {group:'Ownership',items:[
    {label:'Service history',path:'/portal/history',icon:'clock'},
    {label:'Invoices',path:'/portal/invoices',icon:'receipt'},
    {label:'Reminders',path:'/portal/reminders',icon:'bell'},
    {label:'Feedback',path:'/portal/feedback',icon:'star'}
  ]},
  {group:'Account',items:[
    {label:'Profile',path:'/portal/profile',icon:'user'},
    {label:'Switch demo identity',path:'/demo/personas',icon:'users'}
  ]}
];

function navAllowed(item, experience) {
  if (item.path === '/demo') return true;
  if (experience === 'portal') return db.session.kind === 'customer' && !!currentCustomer(db);
  if (experience === 'tech') {
    if (db.session.kind !== 'staff' || !currentStaff(db)) return false;
    if (item.path === '/tech/qc') return can('quality.submit', db) || can('quality.manage', db);
    return can('assigned_jobs.view', db);
  }
  return db.session.kind === 'staff' && !!currentStaff(db) && can(opsRoutePermission(item.path), db);
}

function sidebar(experience) {
  const nav = experience === 'tech' ? TECH_NAV : experience === 'portal' ? PORTAL_NAV : OPS_NAV;
  const currentPath = currentRoute.path || '/';
  const activeFor = path => path === '/ops' || path === '/tech' || path === '/portal' ? currentPath === path : currentPath.startsWith(path);
  const groupHtml = nav.map(g => {
    const items = g.items.filter(item => navAllowed(item, experience));
    if (!items.length) return '';
    return `<div class="side-group"><div class="side-label">${g.group}</div>${items.map(item => {
      const count = item.count ? item.count() : null;
      return `<a class="side-link ${activeFor(item.path) ? 'active' : ''}" href="#${item.path}">${icon(item.icon)}<span>${item.label}</span>${count ? `<span class="count">${count}</span>` : ''}</a>`;
    }).join('')}</div>`;
  }).join('');
  const identity = db.session.kind === 'customer' ? currentCustomer(db) : currentStaff(db);
  const name = identity?.name || 'Guest';
  const role = db.session.kind === 'customer' ? 'Customer' : db.session.kind === 'staff' ? ROLE_DEFS[identity?.role]?.label || 'Staff' : 'Not signed in';
  return `<aside class="sidebar" id="sidebar" aria-label="Application navigation">
    <div class="sidebar-head">${brandBlock(true, experience === 'portal' ? '/portal' : experience === 'tech' ? '/tech' : '/ops')}</div>
    <div class="sidebar-scroll">${groupHtml}</div>
    <div class="sidebar-foot">
      <button class="identity-card" data-action="experience.open" style="width:100%;text-align:left">
        ${avatar(name, experience === 'portal' ? '#d9ff4f' : (identity?.colour || '#d9ff4f'), 'sm')}
        <span class="who"><strong>${esc(name)}</strong><span>${esc(role)}</span></span>
        ${icon('chevronDown','icon-sm')}
      </button>
    </div>
  </aside>`;
}

function topbar(experience, crumbs) {
  const unread = (db.notifications || []).filter(n => !n.read).length;
  const isPortal = experience === 'portal';
  return `<header class="topbar">
    <div class="topbar-left">
      <button class="menu-btn" data-action="sidebar.open" aria-label="Open navigation" aria-expanded="false">${icon('menu')}</button>
      <div class="breadcrumbs">${crumbs || `<strong>${isPortal ? 'Customer portal' : experience === 'tech' ? 'Mechanic workspace' : 'Garage operations'}</strong>`}</div>
    </div>
    <div class="topbar-actions">
      <span class="demo-pill">Demo · ${esc(currentRoleLabel(db))}</span>
      ${!isPortal ? `<div class="topbar-search"><label class="sr-only" for="global-search">Search the demo</label>${icon('search')}<input id="global-search" type="search" placeholder="Search customers, jobs, invoices…" data-global-search autocomplete="off"></div>` : ''}
      <button class="icon-btn" data-action="notifications.open" aria-label="Notifications${unread ? `, ${unread} unread` : ''}" style="position:relative">${icon('bell')}${unread ? `<span style="position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--red)"></span>` : ''}</button>
      <button class="icon-btn" data-action="experience.open" aria-label="Switch demo identity">${db.session.kind === 'customer' ? icon('user') : icon('users')}</button>
    </div>
  </header>`;
}

function appShell(experience, content, crumbs = '') {
  return `<div class="app-shell">
    ${sidebar(experience)}
    <div class="side-scrim" data-action="sidebar.close"></div>
    <div class="main-shell">
      ${topbar(experience, crumbs)}
      <main id="main-content" tabindex="-1" class="page">${content}</main>
    </div>
    ${experienceFab()}
  </div>`;
}

function pageHead(title, sub, actionsHtml = '') {
  return `<div class="page-head"><div><h1 class="page-title">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>${actionsHtml ? `<div class="btn-group">${actionsHtml}</div>` : ''}</div>`;
}

function moneyRow(label, value, cls = '') { return `<div class="row ${cls}"><span>${label}</span><span class="mono">${value}</span></div>`; }

function barChart(data, width = 560, height = 220, colour = '#d9ff4f') {
  const max = Math.max(1, ...data.map(d => d.value));
  const padL = 38, padB = 30, padT = 16, padR = 10;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const barW = Math.min(42, innerW / data.length * .55);
  const step = innerW / Math.max(1, data.length);
  const grid = [0,.25,.5,.75,1].map(p => {
    const y = padT + innerH - p * innerH;
    return `<line x1="${padL}" x2="${width - padR}" y1="${y}" y2="${y}" stroke="#dfded4" stroke-width="1" stroke-dasharray="${p === 0 ? '0' : '3 4'}"/><text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="9" fill="#8b9187">${fmtNum(Math.round(max * p))}</text>`;
  }).join('');
  const bars = data.map((d, i) => {
    const h = Math.max(1, d.value / max * innerH);
    const x = padL + step * i + step / 2 - barW / 2;
    const y = padT + innerH - h;
    return `<g class="chart-bar"><rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${d.colour || colour}" opacity="${d.opacity || .95}"><title>${esc(d.label)}: ${d.value}</title></rect><text x="${x + barW / 2}" y="${height - 10}" text-anchor="middle" font-size="9" fill="#697066">${esc(d.short || d.label)}</text>${d.value ? `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-size="9" font-weight="700" fill="#141813">${fmtNum(d.value)}</text>` : ''}</g>`;
  }).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart">${grid}${bars}</svg></div>`;
}

function lineChart(data, width = 560, height = 220, colour = '#2f6d45') {
  const max = Math.max(1, ...data.map(d => d.value));
  const padL = 38, padB = 30, padT = 16, padR = 12;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const points = data.map((d, i) => {
    const x = padL + (innerW / Math.max(1, data.length - 1)) * i;
    const y = padT + innerH - (d.value / max) * innerH;
    return {x, y, ...d};
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${path} L${points[points.length - 1]?.x || padL},${padT + innerH} L${padL},${padT + innerH} Z`;
  const grid = [0,.25,.5,.75,1].map(p => {
    const y = padT + innerH - p * innerH;
    return `<line x1="${padL}" x2="${width - padR}" y1="${y}" y2="${y}" stroke="#dfded4" stroke-width="1" stroke-dasharray="${p === 0 ? '0' : '3 4'}"/><text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="9" fill="#8b9187">${fmtNum(Math.round(max * p))}</text>`;
  }).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart">
    ${grid}
    <path d="${area}" fill="${colour}" opacity=".08"/>
    <path d="${path}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map(p => `<g><circle cx="${p.x}" cy="${p.y}" r="4" fill="#fff" stroke="${colour}" stroke-width="2"><title>${esc(p.label)}: ${p.value}</title></circle><text x="${p.x}" y="${height - 10}" text-anchor="middle" font-size="9" fill="#697066">${esc(p.short || p.label)}</text></g>`).join('')}
  </svg></div>`;
}

function donutChart(segments, size = 160) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let start = -90;
  const r = 56, cx = 80, cy = 80, stroke = 22;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const circles = segments.map(seg => {
    const len = (seg.value / total) * circumference;
    const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.colour}" stroke-width="${stroke}" stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(seg.label)}: ${seg.value}</title></circle>`;
    offset += len;
    return circle;
  }).join('');
  return `<div class="chart-wrap" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
    <svg viewBox="0 0 160 160" style="width:${size}px;flex:none" role="img" aria-label="Donut chart">${circles}<text x="80" y="77" text-anchor="middle" font-size="22" font-weight="700" fill="#141813">${fmtNum(total)}</text><text x="80" y="94" text-anchor="middle" font-size="9" fill="#697066">TOTAL</text></svg>
    <div class="donut-legend grow">${segments.map(s => `<div class="row"><span class="swatch" style="background:${s.colour}"></span><span>${esc(s.label)}</span><span class="val">${fmtNum(s.value)}</span></div>`).join('')}</div>
  </div>`;
}
