/* ==========================================================================
   Gear Go Automobiles — core
   Constants, helpers, icon set, seed configuration, permissions and domain
   calculations. Loaded first; exposes shared globals to later modules.
   ========================================================================== */
'use strict';
const APP_VERSION = '1.1.0';
const SCHEMA_VERSION = 2;
const LS_KEY = 'geargo.prototype.v1';
const LS_BACKUP_KEY = 'geargo.prototype.v1.backup';
const IST = 'Asia/Kolkata';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = prefix => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const clone = obj => JSON.parse(JSON.stringify(obj));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const by = (key, dir = 1) => (a, b) => {
  const av = typeof a[key] === 'string' ? a[key].toLowerCase() : a[key];
  const bv = typeof b[key] === 'string' ? b[key].toLowerCase() : b[key];
  return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
};

const inrFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2Formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFormatter = new Intl.NumberFormat('en-IN');
const fmtINR = n => inrFormatter.format(Number(n) || 0);
const fmtINR2 = n => inr2Formatter.format(Number(n) || 0);
const fmtNum = n => numFormatter.format(Number(n) || 0);
const pad2 = n => String(n).padStart(2, '0');
const dateKeyOf = date => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};
const todayKey = () => dateKeyOf(new Date());
const dateFromKey = key => new Date(`${key}T12:00:00+05:30`);
const addDays = (key, n) => {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + n);
  return dateKeyOf(d);
};
const dayOffsetKey = n => addDays(todayKey(), n);
const isoAt = (offsetDays, hour = 10, minute = 0) => {
  const key = dayOffsetKey(offsetDays);
  return new Date(`${key}T${pad2(hour)}:${pad2(minute)}:00+05:30`).toISOString();
};
const isoFromKey = (key, time = '10:00') => new Date(`${key}T${time}:00+05:30`).toISOString();
const fmtDate = (iso, opts = {}) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric', ...opts }).format(d);
};
const fmtDateShort = iso => fmtDate(iso, { day: 'numeric', month: 'short' });
const fmtDateTime = iso => iso ? `${fmtDate(iso, { day: 'numeric', month: 'short' })} · ${new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))}` : '—';
const fmtTime = (isoOrTime) => {
  if (!isoOrTime) return '—';
  let d = isoOrTime.includes('T') ? new Date(isoOrTime) : new Date(`${todayKey()}T${isoOrTime}:00+05:30`);
  if (isNaN(d)) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
};
const fmtDay = key => new Intl.DateTimeFormat('en-IN', { timeZone: IST, weekday: 'long' }).format(dateFromKey(key));
const fmtDateKey = key => new Intl.DateTimeFormat('en-IN', { timeZone: IST, day: 'numeric', month: 'long', year: 'numeric' }).format(dateFromKey(key));
const timeAgo = iso => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return fmtDate(iso);
};
const daysBetween = (a, b) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
const getGreeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: 'numeric', hour12: false }).format(new Date()));
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};
const isValidMobile = v => /^[6-9]\d{9}$/.test(String(v || '').replace(/\D/g, '').replace(/^(0|91)/, '').slice(-10));
const cleanMobile = v => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};
const fmtMobile = v => {
  const d = cleanMobile(v);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : v;
};
const normaliseReg = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const fmtReg = v => {
  const n = normaliseReg(v);
  if (!n) return '—';
  const m = n.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/);
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`.replace(/\s+/g, ' ').trim();
  const bh = n.match(/^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/);
  if (bh) return `${bh[1]} ${bh[2]} ${bh[3]} ${bh[4]}`;
  return n;
};
const isValidReg = v => {
  const n = normaliseReg(v);
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(n) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(n);
};
const cleanName = v => String(v || '').replace(/\s+/g, ' ').trim();
const isBlank = v => !String(v ?? '').trim();
const percent = (n, d) => d ? Math.round((n / d) * 100) : 0;

const ICONS = {
  car:'<path d="M5 17h14M6 17l-1.5-5.5a3 3 0 0 1 .6-2.6L7.6 5.6A3 3 0 0 1 10 4.5h4a3 3 0 0 1 2.4 1.1l2.5 3.3a3 3 0 0 1 .6 2.6L18 17"/><path d="M4 17h16v2H4zM7.5 12h9M8 17v2M16 17v2"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>',
  gauge:'<path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l4-4"/><path d="M3 12h2M19 12h2M12 3v2"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.7-.5-.5-2.7 2.7-2.3z"/>',
  spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  shield:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="m9 12 2 2 4-4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  receipt:'<path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 21a6.5 6.5 0 0 1 13 0"/><path d="M16 5a3 3 0 0 1 0 6M18 21a5.5 5.5 0 0 0-3-5"/>',
  phone:'<path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  tag:'<path d="M20 12 12 20l-8-8V4h8z"/><circle cx="8" cy="8" r="1.5"/>',
  message:'<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/>',
  whatsapp:'<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.5 8.5c.5 3 2 4.5 5 5l1-1 2 1c0 1.5-1 2.5-2.5 2.5-3.5 0-7.5-4-7.5-7.5 0-1.5 1-2.5 2.5-2.5l1 2z"/>',
  camera:'<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  print:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  send:'<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  rotate:'<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  alert:'<path d="M12 3 2 21h20z"/><path d="M12 9v5M12 17v.1"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>',
  star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9z"/>',
  play:'<path d="m8 5 11 7-11 7z"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2 5.5M20 4v7h-7"/>',
  external:'<path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  filter:'<path d="M3 4h18l-7 8v7l-4 2v-9z"/>',
  droplet:'<path d="M12 3c3 4 6 7 6 10a6 6 0 0 1-12 0c0-3 3-6 6-10z"/>',
  battery:'<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 10v4M6 10v4M10 10v4"/>',
  snow:'<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11"/>',
  paint:'<path d="M12 3 4 8v11h16V8z"/><path d="m4 8 8 5 8-5M12 13v6"/>',
  sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
  tools:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4"/><path d="m17 3 4 4-3 3-4-4z"/>',
  wallet:'<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M16 12h4M3 9h18"/><circle cx="16" cy="12" r="1"/>',
  card:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  upi:'<path d="M7 4 3 12l4 8M17 4l4 8-4 8M9 4l-3 8 3 8M15 4l3 8-3 8"/>',
  cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.1M18 15h.1"/>',
  bank:'<path d="M3 10 12 3l9 7M5 10v9M19 10v9M9 10v9M15 10v9M2 21h20"/>',
  recycle:'<path d="m7 19-4-7 4-7M3 12h8M17 5h-8L5 12M21 12l-4 7-8-1"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  route:'<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h7"/>',
  clockAlert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l2 2M12 16v.1"/>',
  clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
  fuel:'<path d="M3 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M3 12h10M14 8h2l3 3v7a2 2 0 0 0 4 0v-7l-3-3"/><path d="M2 21h12"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;

const SERVICE_SEED = [
  {id:'svc_periodic',name:'Periodic car servicing',category:'Maintenance',icon:'gauge',price:1499,from:true,duration:'3–4 hours',enabled:true,specialist:false,short:'Oil, filters, fluids and a multi-point safety check for everyday reliability.',description:'A scheduled service that covers the essentials for your car’s health. We inspect the vehicle, replace engine oil and filters as required, check fluids and give you a clear report before any additional work is approved.',includes:['Engine oil and filter replacement (as applicable)','Air and cabin filter check','Fluid level top-up and inspection','Brake, tyre, battery and light check','Written multi-point inspection report'],concerns:['Routine maintenance','Reduced mileage','General inspection'],factors:['Engine size and oil grade','Parts required for your model','Condition found during inspection','Additional work only with your approval'],addons:[{name:'Cabin filter replacement',price:499},{name:'Wheel alignment & balancing',price:899},{name:'Engine bay cleaning',price:399}],faqs:[{q:'Is the price fixed?',a:'The starting price is an illustrative demo value for a standard package. The final estimate depends on your vehicle and what the inspection finds.'},{q:'Will you do extra work without asking?',a:'No paid additional work is started unless it is included in an estimate you approve.'}]},
  {id:'svc_mechanical',name:'Mechanical repairs',category:'Repairs',icon:'wrench',price:null,duration:'Inspection required',enabled:true,specialist:false,short:'Diagnosis and repair for noises, vibrations, leaks and drivability concerns.',description:'If something feels different, we start with a structured inspection and explain what we found before recommending a repair. You approve the estimate before paid work begins.',includes:['Road test and basic inspection','Component-level diagnosis as needed','Findings explained in plain language','Repair estimate for your approval'],concerns:['Unusual engine noise','Vehicle vibration','General inspection'],factors:['Fault complexity','Parts availability','Workshop capacity','Approved repair scope'],addons:[{name:'Post-repair road test',price:0},{name:'Underbody inspection',price:499}],faqs:[{q:'Can you repair without a diagnosis?',a:'No. We inspect first so the estimate is based on evidence, not guesswork.'},{q:'How long will it take?',a:'We give an expected completion time with the estimate once the fault is understood.'}]},
  {id:'svc_brakes',name:'Brake & suspension checks',category:'Safety',icon:'shield',price:699,duration:'45–90 minutes',enabled:true,specialist:false,short:'A safety-focused inspection of braking, steering and suspension components.',description:'Brake noise or a soft pedal should not be ignored. We inspect pads, discs, fluid, suspension and steering components, then document anything that needs attention.',includes:['Brake pad and disc inspection','Brake fluid condition check','Suspension and steering visual check','Tyre condition and wear pattern check','Photo-backed findings'],concerns:['Brake noise','Vehicle vibration','General inspection'],factors:['Parts required','Wear severity','Vehicle model','Additional repair approval'],addons:[{name:'Brake fluid replacement',price:899},{name:'Wheel balancing',price:499}],faqs:[{q:'Do you replace parts automatically?',a:'No. Replacement is recommended in the estimate and requires your approval.'},{q:'Is a brake inspection safe to drive after?',a:'We will clearly flag any safety concern and advise you before the vehicle is released.'}]},
  {id:'svc_diagnostics',name:'Engine diagnostics',category:'Diagnostics',icon:'spark',price:799,duration:'1–2 hours',enabled:true,specialist:false,short:'Scanning, testing and a plain-language explanation of warning lights and faults.',description:'A diagnostic session uses scanning and physical checks to understand what the vehicle is reporting. You receive the findings, likely causes and a recommended next step.',includes:['OBD diagnostic scan','Warning light investigation','Basic electrical and sensor checks','Findings explained in writing','Repair estimate if required'],concerns:['Warning light on dashboard','Unusual engine noise','Reduced mileage'],factors:['Fault complexity','Scan depth','Vehicle-specific procedures','Parts required for repair'],addons:[{name:'Road-test diagnosis',price:299},{name:'Battery health test',price:0}],faqs:[{q:'Does a scan tell you exactly what is broken?',a:'Not always. The scan is a starting point and may need physical testing to confirm the cause.'},{q:'Is the diagnostic fee adjustable against repair?',a:'That is a business policy to confirm. This prototype does not assume a waiver.'}]},
  {id:'svc_electrical',name:'Electrical repairs',category:'Repairs',icon:'battery',price:null,duration:'Inspection required',enabled:true,specialist:false,short:'Battery, starting, charging, lighting and wiring concerns diagnosed carefully.',description:'Electrical faults can have several causes. We test the battery, starting and charging systems, inspect visible wiring and explain the evidence before recommending work.',includes:['Battery and charging system test','Starting symptom inspection','Fuse and visible wiring check','Electrical fault diagnosis'],concerns:['Battery not starting','Warning light on dashboard','General inspection'],factors:['Fault location','Parts required','Vehicle electrical architecture','Approved repair scope'],addons:[{name:'Battery terminal clean',price:299},{name:'Alternator test',price:399}],faqs:[{q:'Can you test my battery before booking?',a:'A quick battery health check can be booked. A full electrical diagnosis may take longer.'},{q:'Do you use original or equivalent parts?',a:'The estimate will identify the proposed part and specification for your approval.'}]},
  {id:'svc_ac',name:'AC & cooling services',category:'Comfort',icon:'snow',price:699,duration:'1–2 hours',enabled:true,specialist:false,short:'Cooling performance checks, leak inspection and cabin comfort restoration.',description:'If the AC is not cooling, we check the system, airflow, filters and visible components. We explain whether the issue needs a service, a part or further leak testing.',includes:['Cooling performance check','Cabin filter inspection','Visible leak and component check','Vent temperature test','Estimate for required work'],concerns:['AC not cooling','General inspection'],factors:['System type and refrigerant','Leak testing required','Parts availability','Vehicle model'],addons:[{name:'AC gas top-up',price:1299},{name:'Cabin disinfection',price:599}],faqs:[{q:'Does a service always include gas?',a:'No. Gas is added only when required and included in the approved estimate.'},{q:'How do I know if there is a leak?',a:'A performance check and leak inspection are needed. We explain the findings before repair.'}]},
  {id:'svc_battery',name:'Battery & starting issues',category:'Safety',icon:'battery',price:499,duration:'30–60 minutes',enabled:true,specialist:false,short:'Fast checks for a weak battery, starting trouble or charging warning.',description:'We test battery health, terminals, starting and charging behaviour. If a replacement is needed, the proposed specification and price go into the estimate for approval.',includes:['Battery health and charge test','Terminal and connection inspection','Starting and charging checks','Replacement recommendation if required'],concerns:['Battery not starting','Warning light on dashboard'],factors:['Battery specification','Warranty terms','Vehicle electrical demand','Approved replacement'],addons:[{name:'Jump-start assistance',price:0},{name:'Terminal service',price:299}],faqs:[{q:'Can you come to my location?',a:'Roadside assistance and pickup are configurable capabilities. Ask the garage; this prototype treats them as subject to availability.'},{q:'Is the battery price included?',a:'The inspection fee is illustrative. A battery replacement is quoted separately.'}]},
  {id:'svc_accident',name:'Accidental damage inspection',category:'Bodywork',icon:'camera',price:null,duration:'Inspection required',enabled:true,specialist:true,short:'Documented damage assessment with repair options and insurance coordination if available.',description:'Accident damage needs an in-person assessment. We document visible damage, flag safety concerns and prepare a repair scope. Insurance coordination is subject to availability and is not a guarantee of claim approval.',includes:['Exterior damage documentation','Basic safety checks','Photo evidence','Repair scope and estimate preparation'],concerns:['Accident damage','General inspection'],factors:['Damage extent','Parts and paint requirements','Insurance assessment','Repair authorisation'],addons:[{name:'Insurance paperwork assistance',price:0},{name:'Courtesy vehicle coordination',price:0}],faqs:[{q:'Do you guarantee insurance approval?',a:'No. Insurance decisions belong to the insurer. This prototype does not integrate with insurers.'},{q:'Can you repair cosmetic damage only?',a:'Yes, after inspection. We separate safety-related and cosmetic recommendations.'}]},
  {id:'svc_dent',name:'Denting & painting',category:'Bodywork',icon:'paint',price:null,duration:'Inspection required',enabled:true,specialist:true,short:'Panel repair and paintwork assessed for finish, colour match and scope.',description:'Denting and painting are quoted after assessing the panel and finish required. Colour matching and drying time affect the estimate.',includes:['Panel and paint condition assessment','Repair scope discussion','Colour match check where possible','Estimate and completion window'],concerns:['Accident damage','General inspection'],factors:['Panel damage','Paint type and colour','Parts removal','Drying and finish time'],addons:[{name:'Headlight restoration',price:799},{name:'Underbody anti-rust coat',price:1499}],faqs:[{q:'Can you match my exact colour?',a:'We assess the colour and finish during inspection. Exact match limitations are explained before work.'},{q:'Will there be a paint warranty?',a:'Any warranty terms must be confirmed by the business. The prototype does not assume a warranty.'}]},
  {id:'svc_wash',name:'Car washing',category:'Care',icon:'droplet',price:399,duration:'45–75 minutes',enabled:true,specialist:false,short:'A careful exterior wash with attention to paint, glass, wheels and trim.',description:'A straightforward exterior wash. If you would like interior cleaning or detailing, those can be added separately.',includes:['Exterior foam wash','Wheel and tyre cleaning','Glass cleaning','Quick interior vacuum'],concerns:['Routine maintenance','General inspection'],factors:['Vehicle size','Condition','Selected add-ons'],addons:[{name:'Interior vacuum & wipe',price:499},{name:'Wax finish',price:699}],faqs:[{q:'Do I need an appointment?',a:'Appointments help us manage capacity. Walk-ins are subject to availability.'},{q:'Is this a paint-correction service?',a:'No. Detailing and polishing are separate services.'}]},
  {id:'svc_interior',name:'Interior cleaning',category:'Care',icon:'sparkle',price:1299,duration:'2–3 hours',enabled:true,specialist:false,short:'Deep cabin cleaning for seats, carpets, panels, glass and vents.',description:'A deeper clean for the cabin, useful after daily use or before a long trip. We confirm the scope based on materials and condition.',includes:['Interior vacuum','Seat and carpet cleaning as applicable','Dashboard and panel wipe-down','Interior glass and vent cleaning'],concerns:['Routine maintenance','General inspection'],factors:['Seat material','Condition and stains','Vehicle size','Drying time'],addons:[{name:'AC vent disinfection',price:599},{name:'Boot deep clean',price:399}],faqs:[{q:'How long does it take to dry?',a:'Drying time depends on the cleaning method and weather. We advise before you collect.'},{q:'Can strong odours be removed?',a:'We assess the cause first. Some odours need a separate treatment.'}]},
  {id:'svc_detailing',name:'Detailing & polishing',category:'Care',icon:'sparkle',price:2999,duration:'4–6 hours',enabled:true,specialist:true,short:'Paint decontamination, polish and finish enhancement based on condition.',description:'A condition-led detail rather than a one-size-fits-all package. We inspect the paint first and explain what can realistically be improved.',includes:['Paint condition assessment','Surface decontamination','Machine polish as appropriate','Interior finishing add-on available'],concerns:['General inspection','Routine maintenance'],factors:['Paint condition','Vehicle size','Correction level','Time and product requirements'],addons:[{name:'Ceramic protection consultation',price:0},{name:'Engine bay detail',price:999}],faqs:[{q:'Will polishing remove every scratch?',a:'No. We explain what is safely achievable before starting. Deep scratches may need paintwork.'},{q:'Is a warranty included?',a:'Protection and warranty terms are business-specific and must be confirmed.'}]}
];

const ROLE_DEFS = {
  owner:{label:'Owner / Administrator',tone:'dark',perms:['*'],desc:'Full business access, configuration and audit.'},
  manager:{label:'Service Manager',tone:'blue',perms:['customers.view','customers.create','customers.edit','vehicles.view','vehicles.edit','bookings.view','bookings.manage','job_cards.view','job_cards.create','job_cards.assign','tasks.manage','inspections.manage','estimates.create','estimates.send','approvals.view','invoices.view','payments.view','reports.view','inventory.manage','communications.manage','reminders.manage','feedback.manage','staff.view','calendar.manage','quality.manage','delivery.manage'],desc:'Operations, workshop, approvals, scheduling and reports.'},
  front_desk:{label:'Front Desk / Advisor',tone:'green',perms:['customers.view','customers.create','customers.edit','vehicles.view','vehicles.edit','bookings.view','bookings.manage','job_cards.view','job_cards.create','inspections.manage','estimates.create','estimates.send','approvals.view','communications.manage','collection.manage','invoices.view','payments.view'],desc:'Bookings, check-in, job creation and customer communication.'},
  technician:{label:'Technician',tone:'amber',perms:['assigned_jobs.view','inspections.manage','tasks.manage','findings.create','parts.use','time.record','quality.submit'],desc:'Assigned work, inspections, findings and quality submission only.'},
  finance:{label:'Finance',tone:'purple',perms:['customers.view','vehicles.view','bookings.view','job_cards.view','invoices.view','invoices.create','payments.record','payments.view','reports.view','receivables.manage','feedback.view'],desc:'Invoicing, payment recording, receivables and financial reports.'},
  customer:{label:'Customer',tone:'lime',perms:['portal.self'],desc:'Own vehicles, approvals, invoices and service history.'}
};

const BOOKING_STATUS = {
  new_request:{label:'New request',tone:'blue',next:['pending_confirmation','confirmed','rejected','cancelled']},
  pending_confirmation:{label:'Pending confirmation',tone:'amber',next:['confirmed','rejected','cancelled']},
  confirmed:{label:'Confirmed',tone:'green',next:['checked_in','reschedule_requested','rescheduled','cancelled','no_show']},
  reschedule_requested:{label:'Reschedule requested',tone:'amber',next:['rescheduled','confirmed','cancelled']},
  rescheduled:{label:'Rescheduled',tone:'blue',next:['checked_in','cancelled','no_show']},
  checked_in:{label:'Checked in',tone:'purple',next:['converted']},
  converted:{label:'Converted to job card',tone:'dark',next:[]},
  cancelled:{label:'Cancelled',tone:'red',next:[]},
  no_show:{label:'No show',tone:'grey',next:['confirmed','cancelled']},
  rejected:{label:'Unavailable',tone:'red',next:[]}
};

const JOB_STATUS = {
  DRAFT:{label:'Draft',tone:'grey',next:['CHECKED_IN','CANCELLED']},
  CHECKED_IN:{label:'Checked in',tone:'blue',next:['INSPECTION_PENDING','INSPECTION_IN_PROGRESS','ESTIMATE_PREPARATION','APPROVED','IN_PROGRESS','CANCELLED']},
  INSPECTION_PENDING:{label:'Inspection pending',tone:'amber',next:['INSPECTION_IN_PROGRESS','CANCELLED']},
  INSPECTION_IN_PROGRESS:{label:'Inspection in progress',tone:'purple',next:['ESTIMATE_PREPARATION','APPROVED','CANCELLED']},
  ESTIMATE_PREPARATION:{label:'Estimate preparation',tone:'amber',next:['AWAITING_APPROVAL','APPROVED','CANCELLED']},
  AWAITING_APPROVAL:{label:'Awaiting customer approval',tone:'amber',next:['APPROVED','IN_PROGRESS','CANCELLED']},
  APPROVED:{label:'Approved · ready for work',tone:'green',next:['IN_PROGRESS','AWAITING_PARTS','CANCELLED']},
  IN_PROGRESS:{label:'In progress',tone:'blue',next:['AWAITING_PARTS','QUALITY_CHECK','CANCELLED']},
  AWAITING_PARTS:{label:'Awaiting parts',tone:'amber',next:['IN_PROGRESS','CANCELLED']},
  QUALITY_CHECK:{label:'Quality check',tone:'purple',next:['WORK_COMPLETED','IN_PROGRESS','CANCELLED']},
  WORK_COMPLETED:{label:'Work completed',tone:'green',next:['READY_FOR_COLLECTION','QUALITY_CHECK']},
  READY_FOR_COLLECTION:{label:'Ready for collection',tone:'green',next:['DELIVERED','WORK_COMPLETED']},
  DELIVERED:{label:'Delivered',tone:'dark',next:['IN_PROGRESS']},
  CANCELLED:{label:'Cancelled',tone:'red',next:[]}
};

const ESTIMATE_STATUS = {
  DRAFT:{label:'Draft',tone:'grey'},
  SENT:{label:'Awaiting customer',tone:'amber'},
  VIEWED:{label:'Viewed · awaiting decision',tone:'blue'},
  PARTIALLY_APPROVED:{label:'Partially approved',tone:'purple'},
  APPROVED:{label:'Approved',tone:'green'},
  REJECTED:{label:'Declined',tone:'red'},
  EXPIRED:{label:'Expired',tone:'grey'},
  SUPERSEDED:{label:'Superseded',tone:'grey'},
  CANCELLED:{label:'Cancelled',tone:'red'}
};

const INVOICE_STATUS = {
  DRAFT:{label:'Draft',tone:'grey'},
  ISSUED:{label:'Issued',tone:'blue'},
  PARTIALLY_PAID:{label:'Partially paid',tone:'amber'},
  PAID:{label:'Paid',tone:'green'},
  OVERDUE:{label:'Overdue',tone:'red'},
  VOID:{label:'Void',tone:'red'}
};

const PART_STATUS = part => {
  if (Number(part.stock) <= 0) return 'Out of stock';
  if (Number(part.stock) - Number(part.reserved || 0) <= 0) return 'Fully reserved';
  if (Number(part.stock) <= Number(part.reorder)) return 'Low stock';
  return 'In stock';
};
const PAYMENT_METHODS = {cash:'Cash',upi:'UPI',bank_transfer:'Bank transfer',card:'Card terminal',other:'Other'};
const CHANNEL_LABELS = {in_app:'In-app',sms:'SMS',email:'Email',whatsapp:'WhatsApp',phone:'Phone call'};
const COMMUNICATION_TYPES = {
  customer_enquiry:'Customer enquiry',booking_confirmation:'Booking confirmation',appointment_reminder:'Appointment reminder',reschedule:'Reschedule update',inspection_ready:'Inspection report available',estimate_ready:'Estimate ready',approval_request:'Approval request',approval_reminder:'Approval reminder',additional_work:'Additional work approval',progress_update:'Repair progress update',delay_notice:'Delay notification',completion:'Completion notification',payment_reminder:'Payment reminder',feedback_request:'Feedback request',service_reminder:'Service reminder'
};

const CONCERNS = [
  {id:'noise',label:'Unusual engine noise',service:'svc_mechanical',icon:'wrench'},
  {id:'ac',label:'AC not cooling',service:'svc_ac',icon:'snow'},
  {id:'brake',label:'Brake noise or soft pedal',service:'svc_brakes',icon:'shield'},
  {id:'battery',label:'Battery not starting',service:'svc_battery',icon:'battery'},
  {id:'warning',label:'Warning light on dashboard',service:'svc_diagnostics',icon:'alert'},
  {id:'mileage',label:'Reduced mileage',service:'svc_diagnostics',icon:'chart'},
  {id:'vibration',label:'Vehicle vibration',service:'svc_brakes',icon:'route'},
  {id:'accident',label:'Accident damage',service:'svc_accident',icon:'camera'},
  {id:'routine',label:'Routine maintenance',service:'svc_periodic',icon:'gauge'},
  {id:'inspection',label:'General inspection',service:'svc_diagnostics',icon:'search'},
  {id:'unsure',label:"I'm not sure what my car needs",service:'svc_diagnostics',icon:'info'}
];

const ADDONS = [
  {id:'add_cabin',name:'Cabin filter replacement',price:499},
  {id:'add_align',name:'Wheel alignment & balancing',price:899},
  {id:'add_acgas',name:'AC gas top-up',price:1299},
  {id:'add_wax',name:'Wax finish',price:699},
  {id:'add_vac',name:'Interior vacuum & wipe',price:499}
];

const INSPECTION_TEMPLATE = [
  {cat:'Engine',key:'engine_oil',label:'Engine oil condition'},
  {cat:'Engine',key:'engine_belts',label:'Belts and hoses'},
  {cat:'Engine',key:'engine_leaks',label:'Visible fluid leaks'},
  {cat:'Fluids',key:'coolant',label:'Coolant level and condition'},
  {cat:'Fluids',key:'brake_fluid',label:'Brake fluid'},
  {cat:'Brakes',key:'front_pads',label:'Front brake pads'},
  {cat:'Brakes',key:'rear_brakes',label:'Rear brakes'},
  {cat:'Tyres',key:'tyre_tread',label:'Tyre tread and wear pattern'},
  {cat:'Tyres',key:'spare',label:'Spare wheel condition'},
  {cat:'Suspension',key:'front_suspension',label:'Front suspension components'},
  {cat:'Steering',key:'steering',label:'Steering play and response'},
  {cat:'Battery',key:'battery_health',label:'Battery health and terminals'},
  {cat:'Electrical',key:'lights',label:'Headlights and indicators'},
  {cat:'Electrical',key:'horn',label:'Horn and wipers'},
  {cat:'AC',key:'ac_performance',label:'AC cooling performance'},
  {cat:'Exterior',key:'body',label:'Body panels and glass'},
  {cat:'Interior',key:'interior',label:'Interior condition'},
  {cat:'Safety',key:'safety',label:'General safety observations'}
];

const INSPECTION_RESULTS = {
  good:{label:'Good',tone:'green'},
  monitor:{label:'Monitor',tone:'blue'},
  attention:{label:'Attention recommended',tone:'amber'},
  urgent:{label:'Urgent attention recommended',tone:'red'},
  not_inspected:{label:'Not inspected',tone:'grey'},
  na:{label:'Not applicable',tone:'grey'}
};

function can(permission, db) {
  if (!db) return false;
  const identity = db.session || {};
  if (identity.kind === 'customer') return false;
  const staff = db.staff.find(s => s.id === identity.staffId);
  if (!staff || !staff.active) return false;
  const perms = ROLE_DEFS[staff.role]?.perms || [];
  return perms.includes('*') || perms.includes(permission);
}

function currentStaff(db) {
  return db?.staff?.find(s => s.id === db.session?.staffId) || null;
}
function currentCustomer(db) {
  return db?.customers?.find(c => c.id === db.session?.customerId) || null;
}
function currentUserLabel(db) {
  if (db.session.kind === 'customer') {
    const c = currentCustomer(db);
    return c ? c.name : 'Customer';
  }
  if (db.session.kind === 'staff') {
    const s = currentStaff(db);
    return s ? s.name : 'Guest';
  }
  return 'Guest';
}
function currentRoleLabel(db) {
  if (db.session.kind === 'customer') return 'Customer';
  if (db.session.kind === 'staff') {
    const s = currentStaff(db);
    return s ? ROLE_DEFS[s.role].label : 'Not signed in';
  }
  return 'Not signed in';
}
function isSignedIn(db) {
  return db.session.kind === 'customer' ? !!currentCustomer(db) : db.session.kind === 'staff' ? !!currentStaff(db) : false;
}
function safeReturnTo(value, fallback = '/portal') {
  const next = String(value || '').trim();
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) return fallback;
  return next;
}
function loginPath(next = '/portal', as = '') {
  const params = new URLSearchParams({next: safeReturnTo(next)});
  const suggestion = String(as || '');
  if (/^(staff|customer):[A-Za-z0-9_]+$/.test(suggestion)) params.set('as', suggestion);
  return `/login?${params.toString()}`;
}
function loginIntent(next) {
  const safe = safeReturnTo(next, '/portal');
  if (safe.startsWith('/ops') || safe.startsWith('/tech')) return 'staff';
  if (safe.startsWith('/portal')) return 'customer';
  return 'all';
}
function loginDestination(kind, next, person = null) {
  if (kind === 'customer') {
    const safe = safeReturnTo(next, '/portal');
    if (safe === '/demo' || safe.startsWith('/demo/')) return safe;
    return safe.startsWith('/portal') ? safe : '/portal';
  }
  const safe = safeReturnTo(next, '/ops');
  if (safe === '/demo' || safe.startsWith('/demo/')) return safe;
  if (person && person.role === 'technician') return safe.startsWith('/tech') ? safe : '/tech';
  return safe.startsWith('/ops') ? safe : '/ops';
}
function entryPath(target = '/portal') {
  const staff = db.session.kind === 'staff' ? currentStaff(db) : null;
  const customer = db.session.kind === 'customer' ? currentCustomer(db) : null;
  if (target.startsWith('/portal')) return customer ? target : loginPath(target);
  if (target.startsWith('/tech')) return staff && staff.role === 'technician' ? target : loginPath(target);
  return staff && staff.role !== 'technician' ? target : loginPath(target);
}

function requirePermission(permission) {
  if (!can(permission, db)) {
    denyAccess(permission);
    return false;
  }
  return true;
}

function isAssignedTechnician(job) {
  if (db.session.kind !== 'staff' || currentStaff(db)?.role !== 'technician') return true;
  return !!job && (job.techIds || []).includes(db.session.staffId);
}

function estimateLineCalc(line, taxRate, taxEnabled = true) {
  const qty = Math.max(0, Number(line.qty) || 0);
  const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
  const base = round2(qty * unitPrice);
  const discount = round2(base * (clamp(Number(line.discountPct) || 0, 0, 100) / 100));
  const taxable = round2(base - discount);
  const rate = Number(line.taxRate ?? taxRate) || 0;
  const tax = taxEnabled ? round2(taxable * rate / 100) : 0;
  return {base, discount, taxable, tax, total: round2(taxable + tax), rate};
}

function documentTotals(lines, taxRate, taxEnabled = true) {
  let base = 0, discount = 0, taxable = 0, tax = 0, total = 0;
  (lines || []).forEach(line => {
    const c = estimateLineCalc(line, taxRate, taxEnabled);
    base += c.base; discount += c.discount; taxable += c.taxable; tax += c.tax; total += c.total;
  });
  return {base:round2(base), discount:round2(discount), taxable:round2(taxable), tax:round2(tax), total:round2(total)};
}

function estimateTotals(est, db) {
  return documentTotals(est.lines || [], db.settings.tax.rate, db.settings.tax.enabled);
}

function invoiceTotals(inv, db) {
  const totals = documentTotals(inv.lines || [], db.settings.tax.rate, db.settings.tax.enabled);
  const paid = (inv.payments || []).filter(p => !p.reversed).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = round2(totals.total - paid);
  const status = inv.status === 'VOID' ? 'VOID' : balance <= 0.49 ? 'PAID' : new Date(inv.dueDate || inv.date) < new Date() ? 'OVERDUE' : paid > 0 ? 'PARTIALLY_PAID' : 'ISSUED';
  return {...totals, paid:round2(paid), balance:Math.max(0, balance), status};
}

function estimateAuthorizedTotal(est, db) {
  const taxRate = db.settings.tax.rate, enabled = db.settings.tax.enabled;
  const ids = approvedLineIds(est);
  return (est.lines || []).filter(l => ids.has(l.id)).reduce((sum, l) => sum + estimateLineCalc(l, taxRate, enabled).total, 0);
}

function approvedLineIds(est) {
  if (['REJECTED','SUPERSEDED','CANCELLED','EXPIRED'].includes(est.status)) return new Set();
  if (est.status === 'APPROVED') return new Set(est.lines.map(l => l.id));
  const set = new Set();
  (est.decisions || []).forEach(d => {
    if (d.decision === 'approve') (d.lineIds || []).forEach(id => set.add(id));
    if (d.decision === 'decline') (d.lineIds || []).forEach(id => set.delete(id));
  });
  return set;
}

function declinedLineIds(est) {
  const set = new Set();
  (est.decisions || []).forEach(d => {
    if (d.decision === 'decline') (d.lineIds || []).forEach(id => set.add(id));
  });
  return set;
}

function getCustomer(db, id) { return db.customers.find(c => c.id === id); }
function getVehicle(db, id) { return db.vehicles.find(v => v.id === id); }
function getJob(db, id) { return db.jobs.find(j => j.id === id); }
function getBooking(db, id) { return db.bookings.find(b => b.id === id); }
function getEstimate(db, id) { return db.estimates.find(e => e.id === id); }
function getInvoice(db, id) { return db.invoices.find(i => i.id === id); }
function getInspection(db, id) { return db.inspections.find(i => i.id === id); }
function getStaff(db, id) { return db.staff.find(s => s.id === id); }
function getPart(db, id) { return db.parts.find(p => p.id === id); }
function serviceById(db, id) { return db.settings.services.find(s => s.id === id); }
function customerVehicles(db, cid) { return db.vehicles.filter(v => v.customerId === cid); }
function customerBookings(db, cid) { return db.bookings.filter(b => b.customerId === cid).sort(by('createdAt', -1)); }
function customerJobs(db, cid) { return db.jobs.filter(j => j.customerId === cid); }
function customerInvoices(db, cid) { return db.invoices.filter(i => i.customerId === cid); }
function jobEstimates(db, jid) { return db.estimates.filter(e => e.jobId === jid).sort(by('createdAt', 1)); }
function jobInvoices(db, jid) { return db.invoices.filter(i => i.jobId === jid); }
function pendingApprovals(db) {
  return db.estimates.filter(e => ['SENT','VIEWED','PARTIALLY_APPROVED'].includes(e.status)).sort(by('createdAt', 1));
}
function activeJobs(db) { return db.jobs.filter(j => !['DELIVERED','CANCELLED'].includes(j.status)); }
function jobVehicle(db, job) { return getVehicle(db, job.vehicleId); }
function jobCustomer(db, job) { return getCustomer(db, job.customerId); }
function jobInspection(db, job) { return db.inspections.find(i => i.jobId === job.id); }
function jobPrimaryEstimate(db, job) { return db.estimates.find(e => e.jobId === job.id && e.kind === 'primary'); }
function jobInvoice(db, job) { return db.invoices.find(i => i.jobId === job.id && i.status !== 'VOID'); }
function isOverdueInvoice(db, inv) { const t = invoiceTotals(inv, db); return t.balance > 0.49 && new Date(inv.dueDate || inv.date) < new Date() && inv.status !== 'VOID'; }
function currentSeasonJobs(db) { return db.jobs; }

function latestCommunication(db, entityType, entityId) {
  return db.communications.filter(c => c.entityType === entityType && c.entityId === entityId).sort(by('at', -1))[0];
}

function slotCapacity(db, date, slot) {
  const settings = db.settings.booking;
  const booked = db.bookings.filter(b => b.date === date && b.slot === slot && !['cancelled','no_show','rejected','rescheduled'].includes(b.status)).length;
  return {booked, capacity:settings.capacity, available:booked < settings.capacity};
}

function dateIsClosed(db, date) {
  const d = dateFromKey(date);
  const dow = Number(new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short' }).format(d) === 'Sun');
  if (db.settings.business.weeklyClosed.includes(new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short' }).format(d))) return true;
  return db.settings.business.holidays.some(h => h.date === date);
}

function slotsForDate(db, date) {
  if (dateIsClosed(db, date)) return [];
  const slots = [];
  const openMin = Number(db.settings.booking.open.split(':')[0]) * 60 + Number(db.settings.booking.open.split(':')[1] || 0);
  const closeMin = Number(db.settings.booking.close.split(':')[0]) * 60 + Number(db.settings.booking.close.split(':')[1] || 0);
  const step = Number(db.settings.booking.slotMinutes) || 60;
  for (let t = openMin; t + step <= closeMin; t += step) {
    const value = `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
    slots.push({value, label:fmtTime(value), ...(slotCapacity(db,date,value))});
  }
  return slots;
}

function availableBookingDates(db, count = 14) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const key = dayOffsetKey(i);
    if (!dateIsClosed(db, key)) out.push(key);
  }
  return out;
}

function findCustomerMatches(db, mobile, name = '', reg = '') {
  const m = cleanMobile(mobile);
  const matches = [];
  db.customers.forEach(c => {
    let score = 0;
    if (c.mobile === m) score += 5;
    if (name && c.name.toLowerCase() === name.toLowerCase()) score += 2;
    customerVehicles(db, c.id).forEach(v => { if (reg && normaliseReg(v.reg) === normaliseReg(reg)) score += 6; });
    if (score) matches.push({customer:c, score});
  });
  return matches.sort((a, b) => b.score - a.score);
}

function nextNumber(db, key, prefix) {
  const value = Number(db.settings.numbering[key] || 1000) + 1;
  db.settings.numbering[key] = value;
  return `${prefix}${value}`;
}

function bookingRef(db) { return `GG-BK-${db.settings.numbering.booking}`; }
function jobNumber(db) { return `GG-JC-${db.settings.numbering.job}`; }
function estimateNumber(db) { return `GG-EST-${db.settings.numbering.estimate}`; }
function invoiceNumber(db) { return `GG-INV-${db.settings.numbering.invoice}`; }

function audit(db, action, entityType, entityId, summary, options = {}) {
  const actor = db.session.kind === 'customer' ? (currentCustomer(db)?.name || 'Customer') : (currentStaff(db)?.name || 'Demo user');
  const role = db.session.kind === 'customer' ? 'Customer' : (ROLE_DEFS[currentStaff(db)?.role]?.label || 'Demo user');
  db.audit.unshift({id:uid('aud'), at:new Date().toISOString(), actor, role, action, entityType, entityId, summary, before:options.before || null, after:options.after || null, reason:options.reason || null});
  if (db.audit.length > 800) db.audit.length = 800;
}

function sessionStorageGuard() {
  try {
    const k = '__gg_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}
