/* ==========================================================================
   Gear Go Automobiles — public site
   Marketing pages, policies, public tracking and 404s.
   ========================================================================== */
'use strict';

const SERVICE_IMAGES = {
  svc_periodic: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=70',
  svc_mechanical: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=70',
  svc_brakes: 'https://images.unsplash.com/photo-1544636331-e26879cd4b9?auto=format&fit=crop&w=900&q=70',
  svc_diagnostics: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=900&q=70',
  svc_electrical: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=900&q=70',
  svc_ac: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=70',
  svc_battery: 'https://images.unsplash.com/photo-1544636331-e26879cd4b9?auto=format&fit=crop&w=900&q=70',
  svc_accident: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=900&q=70',
  svc_dent: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=900&q=70',
  svc_wash: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=900&q=70',
  svc_interior: 'https://images.unsplash.com/photo-1544636331-e26879cd4b9?auto=format&fit=crop&w=900&q=70',
  svc_detailing: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=70'
};

function siteHome() {
  const featured = db.settings.services.slice(0, 6);
  const servicesHtml = featured.map((s, i) => `<a class="service-card reveal" href="#/site/services/${s.id}">
    <span class="num">0${i + 1}</span>
    ${SERVICE_IMAGES[s.id] ? `<img class="service-card-img" src="${esc(SERVICE_IMAGES[s.id])}" alt="${esc(s.name)}" loading="lazy">` : ''}
    <span class="service-icon">${icon(s.icon)}</span>
    <h3>${esc(s.name)}</h3>
    <p>${esc(s.short)}</p>
    <div class="meta"><span class="price">${s.price ? `From ${fmtINR(s.price)}` : 'Inspection required'}</span><span class="arrow">${icon('arrow','icon-sm')}</span></div>
  </a>`).join('');
  const liveJob = db.jobs.find(j => j.id === 'job_rahul');
  const liveVehicle = liveJob ? getVehicle(db, liveJob.vehicleId) : null;
  return `<section class="hero">
    <div class="hero-inner">
      <div class="hero-copy">
        <span class="eyebrow" style="color:var(--lime)">Aya Nagar · serving Delhi NCR</span>
        <h1>Your car deserves <em>better care.</em></h1>
        <p class="hero-lede">Transparent pricing, professional attention, and service updates that keep you in control. See what we found, approve what you need, and follow every step.</p>
        <div class="hero-actions">
          <a href="#/book" class="btn btn-lime">Book a service ${icon('arrow','icon-sm')}</a>
          <a href="#/site/services" class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.28)">Explore services</a>
          <a href="https://wa.me/${String(db.settings.business.ownerWhatsApp || '').replace(/\D/g,'')}?text=${encodeURIComponent('Hi ' + db.settings.business.name + ' — I would like to book a service for my car.')} class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.28)" target="_blank" rel="noopener">WhatsApp ${icon('whatsapp','icon-sm')}</a>
        </div>
        <div class="hero-meta">
          <div class="item">${icon('pin')}<span><strong>Aya Nagar, New Delhi</strong>Phase 4, H Block, behind Fitness Club Gym</span></div>
          <div class="item">${icon('shield')}<span><strong>Approval before paid work</strong>Documented, versioned decisions</span></div>
          <div class="item">${icon('phone')}<span><strong>${esc(db.settings.business.phone)}</strong>Demo contact number</span></div>
        </div>
      </div>
      <div class="hero-art">
        <div class="hero-glow"></div>
        <div class="hero-car"><img src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1400&q=70" alt="Premium car being serviced at the garage"></div>
        <div class="hero-note">${icon('shield')}<span><strong>Estimate-first workshop</strong><span>No surprise additions</span></span></div>
        <div class="live-card">
          <div class="head">
            <div>${badge('Live demo job','lime')}</div>
            <span class="tiny muted mono">${esc(liveJob?.number || 'GG-JC-2082')}</span>
          </div>
          <div class="flex between gap-2">
            <div><div style="font-size:12.5px;font-weight:700">${esc(liveVehicle?.make || 'Maruti')} ${esc(liveVehicle?.model || 'Baleno')}</div><div class="tiny muted">${esc(fmtReg(liveVehicle?.reg || ''))} · ${esc(liveVehicle?.fuel || 'Petrol')}</div></div>
            ${jobBadge(liveJob?.status || 'IN_PROGRESS')}
          </div>
          <div class="live-progress"><span></span></div>
          <div class="flex between tiny muted" style="margin-top:6px"><span>Repair in progress</span><span>ETA today · 4:00 pm</span></div>
          <div class="live-lines"><div class="live-line w70"></div><div class="live-line w50"></div></div>
          <a href="#${entryPath('/portal')}" class="link tiny" style="display:inline-block;margin-top:11px">Open customer experience →</a>
        </div>
      </div>
    </div>
  </section>
  <div class="trust-strip"><div class="inner">
    <div class="item">${icon('checkCircle')} Documented inspection findings</div>
    <div class="item">${icon('shield')} Customer approvals recorded</div>
    <div class="item">${icon('receipt')} Itemised invoices</div>
    <div class="item">${icon('clock')} Updates without repeated calls</div>
    <div class="item">${icon('car')} Service history kept with the vehicle</div>
  </div></div>
  <section class="section white" style="padding-top:0">
    <div class="section-inner">
      <div class="stat-grid reveal">
        ${statCard('Happy customers', '2M+', 'Across the network', {icon:'check'})}
        ${statCard('Cars serviced', '25L+', 'Lifetime benchmark', {icon:'car'})}
        ${statCard('Average rating', '4.0', 'From 150,000+ reviews', {icon:'star',accent:true})}
        ${statCard('Touch points', '1,000+', 'Handled in India', {icon:'shield'})}
      </div>
      <p class="small muted mt-6" style="max-width:620px;margin-left:auto;margin-right:auto">Demo benchmarks inspired by the garage group’s published experience. Illustrative only — this prototype is not the live business.</p>
    </div>
  </section>
  <section class="section">
    <div class="section-inner">
      <div class="flex between wrap" style="align-items:flex-end">
        ${sectionHead('What we do','Complete care, clearly explained.','From a routine service to a specific repair, every recommendation is documented and every paid addition needs your approval.')}
        <a href="#/site/services" class="btn btn-outline">View all ${db.settings.services.length} services ${icon('arrow','icon-sm')}</a>
      </div>
      <div class="service-grid">${servicesHtml}</div>
      <p class="tiny muted mt-6">Pricing shown is illustrative demo data configured for this prototype, not Gear Go’s actual rates. Final work is quoted after inspection.</p>
    </div>
  </section>
  <section class="section cream">
    <div class="section-inner home-split">
      <div class="reveal">
        <span class="eyebrow">A service you can see</span>
        <h2 class="section-title">No mystery. No surprise line items.</h2>
        <p class="section-lede">The proposed customer experience turns workshop findings into a clear, photo-backed report. Each recommendation shows what was observed, why it matters and what it may cost.</p>
        <div class="checklist mt-6">
          <div class="row"><span class="check-icon">${icon('check')}</span><div><strong>See the evidence behind each finding</strong><span>Observed facts stay separate from technician recommendations.</span></div></div>
          <div class="row"><span class="check-icon">${icon('check')}</span><div><strong>Approve all, some, or none</strong><span>Declined work is never treated as authorised and your previous approvals remain intact.</span></div></div>
          <div class="row"><span class="check-icon">${icon('check')}</span><div><strong>Follow the repair milestone by milestone</strong><span>Status updates, expected completion and the next action are always visible.</span></div></div>
          <div class="row"><span class="check-icon">${icon('check')}</span><div><strong>Keep every record against the vehicle</strong><span>Estimates, invoices, payments and service history stay together.</span></div></div>
        </div>
        <div class="btn-group mt-6"><a href="#${entryPath('/portal')}" class="btn btn-dark">Explore the customer portal ${icon('arrow','icon-sm')}</a><a href="#/site/how-it-works" class="btn btn-outline">How it works</a></div>
      </div>
      <div class="home-visual reveal">
        <div class="flex between"><span class="badge dark no-dot">Inspection report · demo</span><span class="tiny" style="color:rgba(255,255,255,.5)">Updated ${fmtDateShort(isoAt(-3,11,0))}</span></div>
        <div class="report-card mt-4">
          <div class="flex between mb-2"><div><div class="tiny" style="color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.08em">Vehicle</div><div style="font-weight:700;font-size:14px">Hyundai Creta · DL 3C CD 5678</div></div>${badge('3 findings','amber')}</div>
          <div class="finding-row"><span class="finding-dot" style="background:#ffb3a8"></span><div><h4>Front brake pads worn</h4><p>Pads measured at approximately 2.5 mm. Replacement recommended after specification confirmation.</p><span class="badge red" style="margin-top:5px">High priority</span></div></div>
          <div class="finding-row"><span class="finding-dot" style="background:#ffd166"></span><div><h4>Brake fluid condition</h4><p>Moisture level elevated. Recommend replacement with the brake work.</p><span class="badge amber" style="margin-top:5px">Needs approval</span></div></div>
          <div class="finding-row"><span class="finding-dot" style="background:#9bc9ff"></span><div><h4>Inner tyre wear</h4><p>Monitoring recommended. Alignment check may help prevent uneven wear.</p></div></div>
        </div>
        <div class="flex between mt-4"><span class="tiny" style="color:rgba(255,255,255,.5)">Estimate total shown in portal</span><strong style="font-family:var(--font-display);color:var(--lime);font-size:20px">${fmtINR(documentTotals(db.estimates.find(e=>e.id==='est_priya')?.lines || [], db.settings.tax.rate, db.settings.tax.enabled).total)}</strong></div>
      </div>
    </div>
  </section>
  <section class="section white">
    <div class="section-inner">
      ${sectionHead('Why this is different','Built around the questions customers actually ask.','Not just software for the garage. A clearer relationship between the garage, the vehicle and the person waiting for it.', true)}
      <div class="trust-grid mt-8">
        <div class="trust-item reveal">${icon('file','icon-lg')}<div><h3>What did you inspect?</h3><p>Every finding is documented against a category, result and plain-language explanation.</p></div></div>
        <div class="trust-item reveal">${icon('shield','icon-lg')}<div><h3>Will the price change?</h3><p>Additional work needs a separate supplementary estimate and a fresh approval.</p></div></div>
        <div class="trust-item reveal">${icon('clock','icon-lg')}<div><h3>When will it be ready?</h3><p>Expected completion is visible, with a reason and updated ETA if the job is delayed.</p></div></div>
        <div class="trust-item reveal">${icon('receipt','icon-lg')}<div><h3>What am I paying for?</h3><p>Labour, parts, consumables, demo tax settings and payment history are itemised.</p></div></div>
        <div class="trust-item reveal">${icon('car','icon-lg')}<div><h3>Do you remember my car?</h3><p>Customers can keep multiple vehicles and see each vehicle’s independent service history.</p></div></div>
        <div class="trust-item reveal">${icon('message','icon-lg')}<div><h3>Do I have to keep calling?</h3><p>Simulated updates show what changed and what needs the customer’s attention next.</p></div></div>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="section-inner">
      ${sectionHead('How it works','Eight clear steps, from request to record.','The exact process can be configured by the garage. This prototype shows the intended flow.')}
      <div class="process-grid mt-8">
        ${[
          ['calendar','Book or contact','Choose a service and request an available slot.'],
          ['car','Bring or collect','Drop off, or request pickup where the capability is enabled.'],
          ['clipboard','Check in & inspect','Record condition, concerns and documented findings.'],
          ['shield','Review & approve','See the estimate and choose what work is authorised.'],
          ['wrench','Track the repair','Milestones, parts and delays are visible without calling.'],
          ['checkCircle','Completion update','Quality-checked work and a clear collection status.'],
          ['receipt','Pay & collect','An itemised invoice with offline payment recording.'],
          ['star','Feedback & reminder','Share feedback and keep future service guidance.']
        ].map((x, i) => `<div class="process-card ${i === 3 ? 'highlight' : ''} reveal"><span class="process-icon">${icon(x[0])}</span><h3>${x[1]}</h3><p>${x[2]}</p></div>`).join('')}
      </div>
      <div class="center mt-8"><a href="#/site/how-it-works" class="btn btn-dark">See the full journey ${icon('arrow','icon-sm')}</a></div>
    </div>
  </section>
  <section class="section dark area-section">
    <div class="section-inner home-split">
      <div>
        <span class="eyebrow" style="color:var(--lime)">Where we serve</span>
        <h2 class="section-title">Rooted in Aya Nagar.<br>Connected across NCR.</h2>
        <p class="section-lede">The garage is configured in Aya Nagar, New Delhi. Customers from nearby South Delhi and Gurugram localities can request service. Pickup, drop-off, towing and insurance coordination are represented as configurable capabilities — not guaranteed promises.</p>
        <div class="area-list">
          ${db.settings.business.serviceAreas.slice(0, 10).map(a => `<span class="chip">${esc(a)}</span>`).join('')}
          <a href="#/site/service-area" class="chip" style="border-color:var(--lime);color:var(--lime)">All areas ${icon('arrow','icon-sm')}</a>
        </div>
        <div class="btn-group mt-6"><a href="#/site/contact" class="btn btn-lime">Get directions ${icon('external','icon-sm')}</a><a href="#/site/contact" class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)">Contact the garage</a></div>
      </div>
      <div class="map-art reveal">
        <svg viewBox="0 0 600 380" aria-hidden="true">
          <rect width="600" height="380" fill="#131c16"/>
          <g stroke="#2c3a2e" stroke-width="1">
            ${Array.from({length:10},(_, i) => `<line x1="0" y1="${i*42}" x2="600" y2="${i*42}"/><line x1="${i*65}" y1="0" x2="${i*65}" y2="380"/>`).join('')}
          </g>
          <path d="M-20 280C110 240 160 180 255 190s170 55 360-30" fill="none" stroke="#4d624c" stroke-width="18" opacity=".5"/>
          <path d="M-20 280C110 240 160 180 255 190s170 55 360-30" fill="none" stroke="#8ba887" stroke-width="1.5" stroke-dasharray="8 8"/>
          <path d="M100-10c20 110 70 150 50 220s-20 100 50 180" fill="none" stroke="#4d624c" stroke-width="10" opacity=".4"/>
          <path d="M420-10c-20 80-15 120 10 170s40 150-20 230" fill="none" stroke="#4d624c" stroke-width="7" opacity=".35"/>
          <circle cx="200" cy="155" r="4" fill="#8ba887"/><circle cx="365" cy="225" r="4" fill="#8ba887"/><circle cx="470" cy="125" r="4" fill="#8ba887"/>
          <text x="195" y="145" font-size="9" fill="#6e836b">Chhatarpur</text><text x="365" y="245" font-size="9" fill="#6e836b">Saket</text><text x="455" y="115" font-size="9" fill="#6e836b">Vasant Kunj</text>
          <text x="70" y="330" font-size="9" fill="#6e836b">Gurugram</text><text x="480" y="330" font-size="9" fill="#6e836b">Faridabad</text>
          <circle cx="290" cy="205" r="80" fill="none" stroke="#d9ff4f" stroke-width="1" stroke-dasharray="4 6" opacity=".45"/>
        </svg>
        <div class="map-pin"><span class="dot">${icon('pin')}</span><span>Gear Go Automobiles · Aya Nagar</span></div>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="section-inner">
      <div class="flex between wrap" style="align-items:flex-end">
        ${sectionHead('Demo feedback','An experience designed to earn trust.','These are synthetic demo records created to illustrate the feedback workflow. They are not verified public reviews.')}
        <span class="demo-flag">Synthetic demo data</span>
      </div>
      <div class="card-grid">
        ${db.feedback.filter(f => f.publicConsent).slice(0,3).map(f => `<div class="feature-card reveal">
          <div class="rating">${Array.from({length:5},(_,i) => `<span class="${i < f.ratings.overall ? 'filled' : ''}">${icon('star')}</span>`).join('')}</div>
          <p class="mt-4" style="color:var(--ink-soft);font-size:13.5px;line-height:1.65">“${esc(f.comment)}”</p>
          <div class="flex gap-2 mt-4">${avatar(getCustomer(db, f.customerId)?.name || 'Customer')}<div><strong style="display:block;font-size:12px">${esc(getCustomer(db, f.customerId)?.name || 'Demo customer')}</strong><span class="tiny muted">Completed service · demo feedback</span></div></div>
        </div>`).join('') || `<div class="feature-card"><p class="muted">No demo feedback is marked for public display yet.</p></div>`}
      </div>
    </div>
  </section>
  <section class="section cream">
    <div class="section-inner" style="max-width:940px">
      ${sectionHead('Common questions','Answers that match how the prototype works.','',true)}
      <div class="faq-list">
        ${[
          ['Do I need an appointment?','Appointments help the garage manage capacity. Walk-ins can be recorded, but they are subject to availability. This prototype uses a configurable slot capacity and clearly marks unavailable slots.'],
          ['Can I book without creating an account?','Yes. Guest booking is supported. You receive a reference and can track the request. A staff member can later match the guest record to a returning customer to avoid duplication.'],
          ['Will extra work happen without my approval?','No. Recommended paid work is shown in an estimate and requires an explicit customer decision. Additional findings need a separate supplementary estimate; previous approvals remain preserved.'],
          ['How is the estimate prepared?','A technician records inspection findings, then staff prepare an itemised estimate with labour, parts and consumables. Taxes use a configurable demo setting and final business rates must be confirmed.'],
          ['Can I pay online in this prototype?','No. The prototype only records payments made outside the software, such as cash, UPI, card terminal or bank transfer. It does not move money.'],
          ['Is pickup and drop-off available?','Pickup, drop-off, towing and insurance coordination are configurable capabilities. In this demo some are marked subject to availability, not guaranteed.']
        ].map(([q,a]) => `<div class="faq-item"><button class="faq-q" data-action="faq.toggle" aria-expanded="false"><span>${esc(q)}</span>${icon('plus','icon-sm')}</button><div class="faq-a">${esc(a)}</div></div>`).join('')}
      </div>
      <div class="center mt-8"><a href="#/site/faqs" class="btn btn-outline">Read all FAQs</a></div>
    </div>
  </section>
  <section class="quote-band">
    <div class="inner">
      <div><h2>Ready to see what your car actually needs?</h2><p>Start with a service request. You will see the estimate before any paid work begins.</p></div>
      <div><a href="#/book" class="btn btn-dark">Book a service ${icon('arrow','icon-sm')}</a></div>
    </div>
  </section>`;
}

function siteServices() {
  const services = db.settings.services;
  return `<section class="page-hero compact-hero"><div class="inner">
    <div class="breadcrumb-site" style="color:rgba(255,255,255,.55)"><a href="#/site">Home</a>${icon('chevron','icon-sm')}<span>Services</span></div>
    <span class="eyebrow" style="color:var(--lime)">Service catalogue</span>
    <h1>Care for the way you actually drive.</h1>
    <p>Twelve service areas, each with a clear scope, what affects the price, and a booking path that starts with inspection where needed.</p>
  </div></section>
  <section class="section">
    <div class="section-inner">
      <div class="flex between wrap mb-6"><p class="small muted" style="max-width:640px">All prices and durations are illustrative demo values configured for this prototype. Specialist work, pickup, towing and insurance coordination are subject to availability and confirmation.</p><span class="demo-flag">Illustrative demo pricing</span></div>
      <div class="service-grid">
        ${services.map((s, i) => `<a class="service-card reveal" href="#/site/services/${s.id}">
          <span class="num">${pad2(i + 1)}</span>
          ${SERVICE_IMAGES[s.id] ? `<img class="service-card-img" src="${esc(SERVICE_IMAGES[s.id])}" alt="${esc(s.name)}" loading="lazy">` : ''}
          <span class="service-icon">${icon(s.icon)}</span>
          <div class="flex gap-2 wrap" style="margin-bottom:8px">${badge(s.category,'grey',false)}${s.specialist ? badge('Specialist · subject to availability','amber',false) : ''}${!s.enabled ? badge('Currently unavailable','red',false) : ''}</div>
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.short)}</p>
          <div class="meta"><span class="price">${s.price ? `From ${fmtINR(s.price)}` : 'Inspection required'} · ${esc(s.duration)}</span><span class="arrow">${icon('arrow','icon-sm')}</span></div>
        </a>`).join('')}
      </div>
      <div class="inline-note mt-8">${icon('info')}<div>This catalogue is configurable. Only services enabled in demo settings can be booked. Prices are not claims about Gear Go’s actual rates, and every repair is quoted after inspection.</div></div>
    </div>
  </section>`;
}

function siteServiceDetail(id) {
  const s = serviceById(db, id);
  if (!s) return siteNotFound('Service not found','That service is not configured in this demo.');
  const related = db.settings.services.filter(x => x.id !== s.id && x.category === s.category).slice(0,3);
  const fallbackRelated = db.settings.services.filter(x => x.id !== s.id).slice(0,3);
  const rel = related.length ? related : fallbackRelated;
  return `<section class="page-hero"><div class="inner">
    <div class="breadcrumb-site" style="color:rgba(255,255,255,.55)"><a href="#/site">Home</a>${icon('chevron','icon-sm')}<a href="#/site/services">Services</a>${icon('chevron','icon-sm')}<span>${esc(s.name)}</span></div>
    <span class="eyebrow" style="color:var(--lime)">${esc(s.category)} · demo service</span>
    <h1>${esc(s.name)}</h1>
    <p>${esc(s.description)}</p>
    <div class="hero-actions"><a href="#/book?service=${s.id}" class="btn btn-lime" ${!s.enabled?'aria-disabled="true"':''}>${s.enabled ? 'Book this service' : 'Currently unavailable'} ${icon('arrow','icon-sm')}</a><a href="#/site/contact" class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)">Ask a question</a></div>
  </div></section>
  <section class="section">
    <div class="section-inner service-detail-grid">
      <div class="service-detail-body">
        <div class="flex gap-2 wrap mb-4">${badge(s.duration,'blue',false)}${s.specialist ? badge('Specialist work · confirmation required','amber',false) : badge('Bookable in demo','green',false)}${badge('Inspection may change scope','grey',false)}</div>
        <h2>What this service may include</h2>
        <ul>${s.includes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <h2>What can affect the final price</h2>
        <ul>${s.factors.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <h2>Common customer concerns</h2>
        <div class="flex wrap gap-2 mt-2">${s.concerns.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>
        <h2>Available add-ons</h2>
        <div class="card-grid two-up">
          ${s.addons.map(a => `<div class="card" style="padding:14px"><div class="flex between gap-2"><strong style="font-size:12.5px">${esc(a.name)}</strong><span class="mono" style="font-weight:700;font-size:12.5px">${a.price ? fmtINR(a.price) : 'On inspection'}</span></div><p class="tiny muted mt-1">Optional. Added to the booking request; final inclusion is confirmed with the estimate.</p></div>`).join('')}
        </div>
        <h2>FAQs</h2>
        <div class="faq-list">${s.faqs.map(f => `<div class="faq-item"><button class="faq-q" data-action="faq.toggle" aria-expanded="false"><span>${esc(f.q)}</span>${icon('plus','icon-sm')}</button><div class="faq-a">${esc(f.a)}</div></div>`).join('')}</div>
        <h2>Related services</h2>
        <div class="related-services">${rel.map(r => `<a class="related-service" href="#/site/services/${r.id}">${esc(r.name)} <span class="muted" style="font-weight:400">· ${r.price ? 'from '+fmtINR(r.price) : 'inspection'}</span></a>`).join('')}</div>
      </div>
      <aside class="service-aside">
        <div class="card">
          <span class="eyebrow">At a glance</span>
          <div class="detail-list mt-4">
            <div class="detail-row"><span class="k">Indicative price</span><span class="v mono">${s.price ? fmtINR(s.price) + (s.from ? '+' : '') : 'Inspection required'}</span></div>
            <div class="detail-row"><span class="k">Typical duration</span><span class="v">${esc(s.duration)}</span></div>
            <div class="detail-row"><span class="k">Category</span><span class="v">${esc(s.category)}</span></div>
            <div class="detail-row"><span class="k">Availability</span><span class="v">${s.enabled ? 'Bookable in demo' : 'Disabled in demo'}</span></div>
          </div>
          <div class="inline-note warn mt-4">${icon('info')}<div>Illustrative demo pricing only. Work begins only after an estimate is approved.</div></div>
          <a href="#/book?service=${s.id}" class="btn btn-dark btn-block mt-4">${s.enabled ? 'Start booking' : 'Unavailable'} ${icon('arrow','icon-sm')}</a>
          <a href="#/site/contact" class="btn btn-outline btn-block mt-2">Contact the garage</a>
        </div>
        <div class="card mt-4">
          <div class="card-title">Have a specific concern?</div>
          <p class="small muted mt-2" style="line-height:1.6">You do not need to know the exact service. Start with “I’m not sure what my car needs” and we will suggest an inspection path.</p>
          <a href="#/book?unsure=1" class="link small">Start with a concern →</a>
        </div>
      </aside>
    </div>
  </section>`;
}

function siteHowItWorks() {
  return `<section class="page-hero"><div class="inner">
    <span class="eyebrow" style="color:var(--lime)">The customer journey</span>
    <h1>You stay in control at every step.</h1>
    <p>The proposed platform connects discovery, booking, inspection, approval, repair tracking, billing and future reminders into one continuous experience.</p>
    <div class="hero-actions"><a href="#/book" class="btn btn-lime">Try the booking journey ${icon('arrow','icon-sm')}</a><a href="#${entryPath('/portal')}" class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)">Explore customer portal</a></div>
  </div></section>
  <section class="section">
    <div class="section-inner" style="max-width:940px">
      <div class="process-flow">
        ${[
          ['Book or contact','Choose a service and share the concern. You can book as a guest, without a password.','The booking request is created immediately and visible to the front desk.'],
          ['Bring or request collection','Drop off at Aya Nagar, or ask about a pickup option where available.','Pickup and drop-off are configurable capabilities, not guaranteed for every booking.'],
          ['Check in and inspect','The team records your vehicle condition, odometer, belongings and concerns before inspection.','You receive a reference and can see the job status.'],
          ['Review the estimate','Findings are documented with explanations. Labour, parts, tax and exclusions are itemised.','Nothing paid begins until you explicitly approve. Viewing is not approval.'],
          ['Track the repair','Milestones show what is happening. If more work is discovered, a separate approval request is raised.','Approved scope and earlier decisions remain preserved.'],
          ['Quality check','A quality checklist is completed before release. If it fails, rework is recorded.','You see a completion update only when the operational process supports it.'],
          ['Pay and collect','Your invoice shows everything you paid for. Offline payments are recorded against it.','The demo does not process real payments; it records what the garage received.'],
          ['Feedback and reminder','Share feedback after an eligible completed service and keep future guidance against the vehicle.','Reminders are configurable and distinguish service messages from marketing.']
        ].map((x, i) => `<div class="flow-step reveal"><div class="flow-num">${i + 1}</div><div><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p><p class="tiny muted mt-2">${esc(x[2])}</p></div></div>`).join('')}
      </div>
      <div class="quote-band" style="border-radius:18px;margin-top:40px;padding:40px">
        <div class="inner"><div><h2 style="font-size:30px">Want to see it in action?</h2><p>Try a real prototype journey using synthetic customer and vehicle details.</p></div><a href="#/book" class="btn btn-dark">Book a service ${icon('arrow','icon-sm')}</a></div>
      </div>
    </div>
  </section>`;
}

function siteWhyUs() {
  return `<section class="page-hero"><div class="inner">
    <span class="eyebrow" style="color:var(--lime)">Why choose Gear Go</span>
    <h1>Trust is built in the details.</h1>
    <p>Customers worry about hidden costs, unnecessary repairs, delayed delivery and unclear invoices. The product is designed to answer those worries before they become phone calls.</p>
  </div></section>
  <section class="section">
    <div class="section-inner">
      <div class="card-grid">
        ${[
          ['clipboard','Documented inspection','Findings are recorded by category and result. Uninspected items never appear as passed.'],
          ['shield','Explicit approvals','The customer approves selected items. A verbal “okay” in the workshop does not silently become authorised work.'],
          ['layers','Versioned estimates','If scope changes after approval, the new estimate preserves earlier decisions instead of overwriting them.'],
          ['clock','Visible progress','The customer sees applicable milestones, the last update, the ETA and the next action.'],
          ['receipt','Itemised invoices','Parts, labour and consumables are separated. Payments recorded by the garage update the balance.'],
          ['car','Vehicle-linked history','Bookings, inspections, jobs, invoices and reminders stay linked to the vehicle and customer.'],
          ['lock','Role-aware access','Technicians see assigned work, finance sees money, customers see only their own records.'],
          ['message','Simulated communication','Updates are modelled with templates and delivery status. No real message is sent by this prototype.'],
          ['chart','Explainable analytics','Owner metrics are calculated from the same underlying demo records, with invoiced revenue distinguished from collected payments.']
        ].map(x => `<div class="feature-card reveal"><span class="icon-box">${icon(x[0])}</span><h3>${x[1]}</h3><p>${x[2]}</p></div>`).join('')}
      </div>
      <div class="inline-note mt-8">${icon('info')}<div><strong>Prototype honesty:</strong> These are proposed product capabilities demonstrated with simulated data. They are not independently verified business achievements, certifications or guarantees.</div></div>
    </div>
  </section>`;
}

function siteServiceArea() {
  return `<section class="page-hero compact-hero"><div class="inner">
    <span class="eyebrow" style="color:var(--lime)">Service area</span>
    <h1>Aya Nagar base. NCR reach.</h1>
    <p>Service availability depends on the selected capability, workshop capacity and confirmation by the garage. This demo treats pickup, towing and insurance coordination as configurable, not guaranteed.</p>
  </div></section>
  <section class="section">
    <div class="section-inner home-split">
      <div>
        <div class="card">
          <span class="eyebrow">Garage location</span>
          <h2 class="section-title" style="font-size:32px">Gear Go Automobiles</h2>
          <p class="section-lede" style="margin-top:10px">${esc(db.settings.business.address)}</p>
          <div class="detail-list mt-4">
            <div class="detail-row"><span class="k">Opening hours</span><span class="v">Mon–Fri 9:00–19:00<br>Sat 9:00–17:00 · Sun closed</span></div>
            <div class="detail-row"><span class="k">Demo phone</span><span class="v">${esc(db.settings.business.phone)}</span></div>
            <div class="detail-row"><span class="k">Pickup / drop-off</span><span class="v">Request only · subject to availability</span></div>
            <div class="detail-row"><span class="k">Towing</span><span class="v">Subject to availability</span></div>
            <div class="detail-row"><span class="k">Insurance coordination</span><span class="v">Subject to availability · no insurer integration</span></div>
          </div>
          <div class="btn-group mt-4"><a class="btn btn-dark" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(db.settings.business.address)}" target="_blank" rel="noopener">Open directions ${icon('external','icon-sm')}</a><a class="btn btn-outline" href="#/site/contact">Contact</a></div>
        </div>
        <div class="inline-note mt-4">${icon('info')}<div>No location or service-area verification is implied. The address is the configured business location for this prototype; availability must be confirmed by the garage.</div></div>
      </div>
      <div>
        <div class="map-art" style="min-height:330px">
          <svg viewBox="0 0 600 380" aria-hidden="true"><rect width="600" height="380" fill="#131c16"/><g stroke="#2c3a2e">${Array.from({length:10},(_, i) => `<line x1="0" y1="${i*42}" x2="600" y2="${i*42}"/><line x1="${i*65}" y1="0" x2="${i*65}" y2="380"/>`).join('')}</g><path d="M-20 280C110 240 160 180 255 190s170 55 360-30" fill="none" stroke="#4d624c" stroke-width="18" opacity=".5"/><circle cx="290" cy="205" r="90" fill="none" stroke="#d9ff4f" stroke-width="1" stroke-dasharray="4 6" opacity=".4"/></svg>
          <div class="map-pin"><span class="dot">${icon('pin')}</span><span>Aya Nagar · New Delhi 110047</span></div>
        </div>
        <div class="card mt-4">
          <div class="card-title">Configured areas</div>
          <div class="area-list">${db.settings.business.serviceAreas.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>
          <p class="tiny muted mt-4">Localities are examples of the served market. A booking from any area still requires garage confirmation and capacity.</p>
        </div>
      </div>
    </div>
  </section>`;
}

function siteContact() {
  return `<section class="page-hero compact-hero"><div class="inner">
    <span class="eyebrow" style="color:var(--lime)">Contact</span>
    <h1>Talk to the garage.</h1>
    <p>For this prototype, all contact details are demo-only. Use the form to see how a customer enquiry would be recorded.</p>
  </div></section>
  <section class="section">
    <div class="section-inner contact-grid">
      <div>
        <div class="contact-methods">
          <div class="contact-method"><span class="icon-box">${icon('pin')}</span><div><strong>Workshop</strong><span>${esc(db.settings.business.address)}</span></div></div>
          <div class="contact-method"><span class="icon-box">${icon('phone')}</span><div><strong>Call · demo number</strong><a href="tel:${db.settings.business.phone.replace(/\s/g,'')}">${esc(db.settings.business.phone)}</a><span class="tiny muted" style="display:block">Not a real contact number</span></div></div>
          <div class="contact-method"><span class="icon-box">${icon('whatsapp')}</span><div><strong>WhatsApp · simulated</strong><button class="link" style="border:0;background:none;padding:0" data-action="demo.whatsapp">Preview demo message</button><span class="tiny muted" style="display:block">No real WhatsApp message is sent</span></div></div>
          <div class="contact-method"><span class="icon-box">${icon('mail')}</span><div><strong>Email · demo</strong><span>${esc(db.settings.business.email)}</span></div></div>
          <div class="contact-method"><span class="icon-box">${icon('user')}</span><div><strong>Garage owner · ${esc(db.settings.business.ownerName)}</strong><a href="tel:${db.settings.business.ownerPhone.replace(/\s/g,'')}">${esc(db.settings.business.ownerPhone)}</a><a href="https://wa.me/${db.settings.business.ownerWhatsApp.replace(/\D/g,'')}" target="_blank" rel="noopener">WhatsApp ${esc(db.settings.business.ownerWhatsApp)}</a><span class="tiny muted" style="display:block">Owner direct contact. Demo details only.</span></div></div>
        </div>
        <div class="hours-grid">
          ${Object.entries(db.settings.business.hours).map(([d, v]) => `<div class="hours-row"><span>${d === 'mon' ? 'Monday' : d === 'tue' ? 'Tuesday' : d === 'wed' ? 'Wednesday' : d === 'thu' ? 'Thursday' : d === 'fri' ? 'Friday' : d === 'sat' ? 'Saturday' : 'Sunday'}</span><strong>${v}</strong></div>`).join('')}
        </div>
        <div class="inline-note warn mt-6">${icon('alert')}<div>Do not use these demo details for a real booking. This prototype is not connected to Gear Go’s live phone, WhatsApp or email.</div></div>
      </div>
      <div class="contact-panel">
        <span class="eyebrow">Send a demo enquiry</span>
        <h2 class="section-title" style="font-size:28px;margin:10px 0 6px">How can we help?</h2>
        <p class="small muted mb-6">Submissions are stored locally as demo communication history. Nothing is sent.</p>
        <form data-form="contact.submit" novalidate>
          <div class="form-grid">
            <div class="field"><label for="contact-name">Full name *</label><input class="input" id="contact-name" name="name" autocomplete="name" maxlength="80" required></div>
            <div class="field"><label for="contact-mobile">Mobile number *</label><input class="input" id="contact-mobile" name="mobile" inputmode="tel" maxlength="15" placeholder="10-digit Indian mobile" required></div>
            <div class="field full"><label for="contact-email">Email (optional)</label><input class="input" id="contact-email" name="email" type="email" autocomplete="email" maxlength="120"></div>
            <div class="field full"><label for="contact-subject">Topic</label><select class="select" id="contact-subject" name="subject"><option>General enquiry</option><option>Booking help</option><option>Estimate or invoice question</option><option>Pickup / towing availability</option><option>Feedback</option></select></div>
            <div class="field full"><label for="contact-message">Message *</label><textarea class="textarea" id="contact-message" name="message" maxlength="900" placeholder="Tell us what you need help with" required></textarea><span class="hint">Please do not enter real personal or payment information.</span></div>
            <div class="field full"><label class="check"><input type="checkbox" name="privacy" required> I understand this is a demo and no real message will be sent. *</label></div>
          </div>
          <div class="form-actions"><button class="btn btn-dark" type="submit">Send demo enquiry ${icon('arrow','icon-sm')}</button></div>
        </form>
      </div>
    </div>
  </section>`;
}

function siteFaqs() {
  const faqs = [
    ['Do I need an appointment?','Appointments help the garage manage capacity. Walk-in records are supported in the demo, but availability must be confirmed. Slots are generated from configured weekday hours and capacity.'],
    ['Can I book without creating an account?','Yes. Guest booking is supported. You receive a booking reference and staff can later match you to an existing customer record, or create one if needed. You do not need a password.'],
    ['How is the estimate prepared?','A technician completes an inspection, records findings and recommends action. Staff prepare an itemised estimate. Demo tax and prices are configurable and must not be treated as the garage’s actual rates.'],
    ['Will additional work be done without my approval?','No. Recommended paid work needs an explicit customer decision. Additional work discovered later needs a separate supplementary estimate. Viewing or ignoring an estimate is not approval.'],
    ['Can I track my vehicle’s service status?','Yes. The customer portal and public tracking experience show applicable milestones, expected completion and the next action. Internal notes and audit history are not exposed.'],
    ['Can I see previous service records?','Registered customers can see records linked to their vehicles. Guest records can be matched by staff later. Historical records remain available even if a vehicle is inactive.'],
    ['What happens if more repairs are discovered?','The technician records a finding. Staff create a supplementary estimate, the customer decides, and the original approved scope remains unchanged.'],
    ['How can I pay?','This prototype does not process payments. Staff can record an offline payment such as cash, UPI, bank transfer or card terminal. Recording a payment is not the same as processing it.'],
    ['Is pickup and drop-off available?','It is represented as a configurable capability and is subject to availability. The prototype does not guarantee pickup, towing or insurance coordination.'],
    ['Can I cancel or reschedule a booking?','Yes, subject to the configured policy. A reschedule request is recorded and staff confirm the new slot. A cancelled booking cannot be converted to a job card.'],
    ['What if the repair takes longer than expected?','The job can be marked delayed with a reason and revised ETA. A customer-visible update can be recorded and a simulated notification previewed.'],
    ['How can I contact the garage?','Use the demo contact form, call the garage owner, or message on WhatsApp through the demo numbers shown on the contact page. These are simulation controls, not live contact channels.'],
    ['Are the prices final?','No. All prices are illustrative demo values. Final costs must come from an inspection and an approved estimate configured by the real business.'],
    ['Can the garage access my data?','In this prototype, demo staff can access customer records as part of the simulated workflow. Role restrictions are client-side only and are not a production security boundary.']
  ];
  return `<section class="page-hero compact-hero"><div class="inner"><span class="eyebrow" style="color:var(--lime)">FAQs</span><h1>Questions, answered honestly.</h1><p>These answers describe how the prototype actually behaves. They do not create real-world legal or warranty commitments.</p></div></section>
  <section class="section"><div class="section-inner" style="max-width:920px"><div class="faq-list">${faqs.map(([q,a]) => `<div class="faq-item"><button class="faq-q" data-action="faq.toggle" aria-expanded="false"><span>${esc(q)}</span>${icon('plus','icon-sm')}</button><div class="faq-a">${esc(a)}</div></div>`).join('')}</div>
  <div class="inline-note mt-8">${icon('info')}<div>Still unsure? Use the demo contact form or switch to the customer portal to explore your own demo service records.</div></div></div></section>`;
}

function sitePolicy(slug) {
  const titleMap = {terms:'Terms of use',privacy:'Privacy notice',cancellation:'Cancellation & service policy'};
  const title = titleMap[slug] || 'Policy';
  const content = slug === 'privacy' ? `
    <p>This privacy notice describes how the <strong>demonstration prototype</strong> handles data. It is not a production privacy policy and has not been legally reviewed.</p>
    <h2>What is stored</h2><p>All demo records — names, phone numbers, vehicle details, notes, estimates, invoices and payments — are synthetic. They are stored in your browser’s localStorage on this device. Nothing is sent to a server by this prototype.</p>
    <h2>Contact details</h2><p>Phone numbers use clearly labelled, synthetic formats. Do not enter real personal information into forms. There is no real SMS, WhatsApp, email or payment integration.</p>
    <h2>What production would require</h2><ul><li>Server-side authentication and session management</li><li>Database encryption, access controls and backups</li><li>Consent records, retention rules and deletion processes</li><li>Privacy and legal review before launch</li><li>Secure file storage if inspection photographs are enabled</li></ul>
    <h2>Your demo controls</h2><p>You can erase local demo data at any time using Demo Controls → Reset demo data. Clearing browser site data will also remove it.</p>`
    : slug === 'cancellation' ? `
    <p>The following is a <strong>proposed demo policy</strong> for the prototype. It is not a confirmed Gear Go business policy.</p>
    <h2>Appointment requests</h2><p>A submitted request is subject to garage confirmation. The requested slot is not a guaranteed repair completion time. Separate concepts apply to appointment time, check-in, estimated completion and actual completion.</p>
    <h2>Rescheduling</h2><p>Customers can request a reschedule. Staff confirm an available alternative. If a slot becomes unavailable, the request is flagged and alternatives are offered.</p>
    <h2>Cancellation</h2><p>A booking can be cancelled before conversion. A converted booking must retain its job-card history. Cancelling a job after work starts requires a recorded reason and an operational review.</p>
    <h2>Declined or additional work</h2><p>Additional work is never performed without a customer-approved supplementary estimate. If a safety-critical recommendation is declined, the demo requires an operational review before the vehicle is released. This is a configurable operational policy, not a legal determination.</p>
    <h2>Payments</h2><p>The prototype records payments; it does not process or refund money. Real payment and refund terms must be supplied by the business.</p>`
    : `
    <p>These terms describe use of the <strong>interactive demonstration prototype</strong>. They do not form a contract for real garage services.</p>
    <h2>Purpose</h2><p>The prototype demonstrates proposed workflows for Gear Go Automobiles. Records, prices, durations, policies and communications are illustrative and may change.</p>
    <h2>No live services</h2><p>Submitting a form does not create a real booking. The demo phone number, email and WhatsApp actions are not monitored. No payment is taken and no vehicle service is arranged.</p>
    <h2>Estimates and invoices</h2><p>Estimate and invoice figures are generated from demo line items and a configurable demo tax setting. They are not quotations, tax advice or valid financial documents.</p>
    <h2>Warranties and claims</h2><p>No warranty, certification, manufacturer authorisation or service guarantee is made or implied by this prototype.</p>
    <h2>Data</h2><p>Demo state is stored locally in the browser. It is not production-grade, tamper-proof, backed up or synchronised across devices.</p>`;
  return `<section class="page-hero compact-hero"><div class="inner"><div class="breadcrumb-site" style="color:rgba(255,255,255,.55)"><a href="#/site">Home</a>${icon('chevron','icon-sm')}<span>${esc(title)}</span></div><span class="eyebrow" style="color:var(--lime)">Demo policy</span><h1>${esc(title)}</h1><p>Clearly labelled proposed content for the prototype. Not legal advice or a confirmed business policy.</p></div></section>
  <section><div class="content-page"><div class="policy-flag"><strong>Prototype policy:</strong> This page is demonstration content. Real terms, privacy practices, cancellation rules and warranty commitments must be reviewed and confirmed by the business and its advisers.</div>${content}<p class="tiny muted mt-8">Last updated in this demo: ${fmtDate(isoAt(0,9,0))}. These policies are stored as static demo content and are not configurable through settings in this prototype.</p></div></section>`;
}

function siteTrack() {
  const query = currentRoute.query;
  const ref = query.get('ref') || '';
  const result = query.get('found') === '1';
  const booking = db.bookings.find(b => b.ref.toUpperCase() === ref.toUpperCase());
  const job = booking?.jobId ? getJob(db, booking.jobId) : db.jobs.find(j => j.number.toUpperCase() === ref.toUpperCase());
  const linkedBooking = job ? getBooking(db, job.bookingId) : booking;
  const customer = linkedBooking ? getCustomer(db, linkedBooking.customerId) : job ? getCustomer(db, job.customerId) : null;
  const vehicle = linkedBooking ? getVehicle(db, linkedBooking.vehicleId) : job ? getVehicle(db, job.vehicleId) : null;
  let resultHtml = '';
  if (result && (booking || job)) {
    const jobObj = job || (booking.jobId ? getJob(db, booking.jobId) : null);
    resultHtml = `<div class="card mt-6">
      <div class="flex between wrap gap-4"><div><span class="eyebrow">Demo record found</span><h2 class="card-title" style="font-size:22px;margin-top:8px">${esc(vehicle?.make)} ${esc(vehicle?.model)}</h2><p class="small muted">${esc(fmtReg(vehicle?.reg))} · ${esc(customer?.name)}</p></div>${jobObj ? jobBadge(jobObj.status) : bookingBadge(booking.status)}</div>
      <div class="detail-list mt-6">
        <div class="detail-row"><span class="k">Reference</span><span class="v mono">${esc(booking?.ref || jobObj?.number || ref)}</span></div>
        <div class="detail-row"><span class="k">Vehicle</span><span class="v">${esc(vehicle?.make)} ${esc(vehicle?.model)} · ${esc(fmtReg(vehicle?.reg))}</span></div>
        <div class="detail-row"><span class="k">Requested service</span><span class="v">${esc((booking?.services || jobObj?.services || []).map(id => serviceById(db,id)?.name).filter(Boolean).join(', '))}</span></div>
        <div class="detail-row"><span class="k">Appointment</span><span class="v">${linkedBooking ? `${fmtDateKey(linkedBooking.date)} · ${fmtTime(linkedBooking.slot)}` : '—'}</span></div>
        <div class="detail-row"><span class="k">Current status</span><span class="v">${esc(jobObj ? JOB_STATUS[jobObj.status].label : BOOKING_STATUS[booking.status].label)}</span></div>
        <div class="detail-row"><span class="k">Expected completion</span><span class="v">${jobObj?.expectedAt ? fmtDateTime(jobObj.expectedAt) : 'To be confirmed'}</span></div>
      </div>
      <div class="inline-note mt-4">${icon('info')}<div>Public tracking deliberately shows limited information. For inspection reports, estimates and invoices, <a class="link" href="#${entryPath('/portal')}">sign in to the customer portal</a> as the matching demo persona.</div></div>
      ${customer ? `<a href="#/demo/personas" class="btn btn-dark mt-4" data-action="track.portal" data-customer="${customer.id}">Open as ${esc(customer.name)} ${icon('arrow','icon-sm')}</a>` : ''}
    </div>`;
  } else if (result) {
    resultHtml = `<div class="card mt-6">${emptyState('No demo record found','Check the reference and try again. Trial references: GG-BK-1041, GG-BK-1042, GG-JC-2082 or GG-JC-2090.','<a class="btn btn-outline btn-sm" href="#/site/track">Try another reference</a>','search')}</div>`;
  }
  return `<section class="page-hero compact-hero"><div class="inner"><span class="eyebrow" style="color:var(--lime)">Track service</span><h1>Know where things stand.</h1><p>Enter a demo booking or job reference to see its current customer-visible status. No login is required for limited tracking.</p></div></section>
  <section class="section"><div class="section-inner" style="max-width:680px">
    <div class="card">
      <form data-form="track.lookup" novalidate>
        <div class="field"><label for="track-ref">Booking or job reference</label><input class="input" id="track-ref" name="ref" value="${esc(ref)}" placeholder="e.g. GG-BK-1041 or GG-JC-2082" autocomplete="off" required><span class="hint">Demo references are case-insensitive. Try GG-BK-1041 (new request) or GG-JC-2090 (ready for collection).</span></div>
        <div class="form-actions"><button class="btn btn-dark" type="submit">Track request ${icon('search','icon-sm')}</button></div>
      </form>
    </div>
    ${resultHtml}
    <div class="card mt-6" style="background:var(--paper)">
      <div class="flex gap-3"><span class="icon-box" style="width:38px;height:38px;border-radius:9px;background:var(--white);display:grid;place-items:center;border:1px solid var(--line)">${icon('lock')}</span><div><strong style="font-size:13px">Privacy in the prototype</strong><p class="tiny muted mt-1" style="line-height:1.6">Tracking returns only limited demo status. Detailed inspections, estimates and financial records require selecting the matching demo customer identity in the portal.</p></div></div>
    </div>
  </div></section>`;
}

function siteNotFound(title, message) {
  return `<section class="page-hero compact-hero"><div class="inner"><span class="eyebrow" style="color:var(--lime)">Not found</span><h1>${esc(title)}</h1><p>${esc(message)}</p><div class="hero-actions"><a href="#/site" class="btn btn-lime">Back to website</a><a href="#/demo" class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,.3)">Demo controls</a></div></div></section>`;
}

