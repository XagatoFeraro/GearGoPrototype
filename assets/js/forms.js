/* ==========================================================================
   Gear Go Automobiles — forms
   Delegated form submit handlers and workflow mutations.
   ========================================================================== */
'use strict';

Object.assign(formHandlers, {
  'contact.submit': (form) => {
    const v = formValues(form);
    const errors = [];
    if (cleanName(v.name).length < 2) errors.push('Enter your full name.');
    if (!isValidMobile(v.mobile)) errors.push('Enter a valid 10-digit Indian mobile number.');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.push('Enter a valid email address or leave it blank.');
    if (!v.message || v.message.length < 10) errors.push('Please describe how we can help.');
    if (!v.privacy) errors.push('Please acknowledge this is a demo enquiry.');
    if (errors.length) return formFail(form, errors, ['name','mobile','email','message','privacy']);
    const customer = db.customers.find(c => cleanMobile(c.mobile) === cleanMobile(v.mobile));
    const at = new Date().toISOString();
    logCommunication({
      type:'customer_enquiry', entityType:'contact', entityId:uid('enq'), customerId:customer?.id || null,
      channel:v.email ? 'email' : 'whatsapp', recipient:v.email || cleanMobile(v.mobile),
      subject:`Website enquiry · ${v.subject || 'General enquiry'}`,
      body:`${cleanName(v.name)} (${cleanMobile(v.mobile)}) wrote: ${v.message}`
    });
    db.notifications.unshift({id:uid('ntf'),read:false,at,text:`New website enquiry from ${cleanName(v.name)}.`,href:'/ops/communications'});
    audit(db,'contact.enquiry','communication',null,`Demo website enquiry logged from ${cleanName(v.name)}`,{reason:v.subject || 'General enquiry'});
    persist('Demo enquiry logged','No real message was sent. It is visible in Communications.','success');
    form.reset();
    render();
  },
  'track.lookup': (form) => {
    const v = formValues(form);
    const ref = String(v.ref || '').trim().toUpperCase();
    if (!ref) return formFail(form, ['Enter a booking or job reference.'], ['ref']);
    go(`/site/track?ref=${encodeURIComponent(ref)}&found=1`);
  },
  'booking.service': (form) => {
    const draft = ensureBookingDraft();
    draft.addons = formAll(form, 'addons');
    if (!draft.services.length) return formFail(form, ['Choose at least one service.']);
    draft.step = 2;
    saveDB({silent:true});
    go('/book?step=2');
  },
  'booking.vehicle': (form) => {
    const draft = ensureBookingDraft();
    const v = formValues(form);
    if (draft.vehicleMode === 'existing') {
      if (!getVehicle(db, draft.existingVehicleId)) return formFail(form, ['Select a vehicle to continue.']);
    } else {
      const errors = [];
      if (!isValidReg(v.reg)) errors.push('Enter a valid registration number.');
      if (!v.make || v.make.length < 2) errors.push('Enter the vehicle make.');
      if (!v.model || v.model.length < 2) errors.push('Enter the vehicle model.');
      if (!v.year || Number(v.year) < 1990 || Number(v.year) > new Date().getFullYear() + 1) errors.push('Enter a valid manufacturing year.');
      if (isBlank(v.odometer) || Number(v.odometer) < 0) errors.push('Enter the odometer reading.');
      if (errors.length) return formFail(form, errors, ['reg','make','model','year','odometer']);
      draft.vehicle = {
        reg:normaliseReg(v.reg), make:cleanName(v.make), model:cleanName(v.model), variant:cleanName(v.variant),
        year:String(Number(v.year)), fuel:v.fuel || 'Petrol', transmission:v.transmission || 'Manual',
        odometer:String(Number(v.odometer)), nickname:cleanName(v.nickname)
      };
    }
    draft.step = 3;
    saveDB({silent:true});
    go('/book?step=3');
  },
  'booking.customer': (form) => {
    const draft = ensureBookingDraft();
    const v = formValues(form);
    const errors = [];
    if (cleanName(v.name).length < 2) errors.push('Enter your full name.');
    if (!isValidMobile(v.mobile)) errors.push('Enter a valid 10-digit Indian mobile number.');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.push('Enter a valid email address or leave it blank.');
    if (!v.privacy) errors.push('Please acknowledge the demo privacy notice.');
    if (errors.length) return formFail(form, errors, ['name','mobile','email','privacy']);
    draft.customer = {
      name:cleanName(v.name), mobile:cleanMobile(v.mobile), email:String(v.email || '').trim(),
      channel:v.channel || 'whatsapp', notes:String(v.notes || '').trim()
    };
    draft.consent = !!v.consent;
    draft.privacy = true;
    draft.step = 4;
    saveDB({silent:true});
    go('/book?step=4');
  },
  'booking.appointment': (form) => {
    const draft = ensureBookingDraft();
    const v = formValues(form);
    if (!draft.date) return formFail(form, ['Choose a preferred date.']);
    if (!draft.slot) return formFail(form, ['Choose an available time.']);
    const slot = slotsForDate(db, draft.date).find(item => item.value === draft.slot);
    if (!slot || !slot.available) return formFail(form, ['That slot is no longer available. Choose another time.']);
    draft.altPreference = String(v.altPreference || '').trim();
    draft.step = 5;
    saveDB({silent:true});
    go('/book?step=5');
  },
  'booking.submit': (form) => {
    const draft = ensureBookingDraft();
    const v = formValues(form);
    if (!v.terms) return formFail(form, ['Please accept the appointment request terms.'], ['terms']);
    if (!v.accuracy) return formFail(form, ['Please confirm the details are accurate.'], ['accuracy']);
    draft.terms = true;
    draft.accuracy = true;
    const result = submitBooking();
    if (!result.ok) {
      toast('Request not submitted', result.errors[0] || 'Please review the request.', 'error');
      render();
      return;
    }
    go(`/book?confirm=${encodeURIComponent(result.booking.ref)}`);
  },
  'portal.estimate.decision': () => {
    toast('Choose an action','Tick the work you want, then use Approve selected work or Decline selected. No decision was saved.','info');
  },
  'portal.reminder.prefs': (form) => {
    const customer = currentCustomer(db);
    if (!customer) return;
    const v = formValues(form);
    customer.consents = customer.consents || {};
    customer.consents.service = !!v.serviceReminders;
    customer.consents.marketing = !!v.marketing;
    customer.marketingOptOut = !v.marketing;
    customer.channel = v.channel || customer.channel;
    customer.updatedAt = new Date().toISOString();
    audit(db,'portal.reminder_preferences','customer',customer.id,`${customer.name} updated reminder and channel preferences`);
    persist('Preferences saved','Marketing remains optional and separate from service updates.','success');
    render();
  },
  'portal.feedback': (form) => {
    const customer = currentCustomer(db);
    if (!customer) return;
    const v = formValues(form);
    const job = getJob(db, v.jobId);
    if (!job || job.customerId !== customer.id || job.status !== 'DELIVERED') return formFail(form, ['Choose one of your completed demo visits.'], ['jobId']);
    if (db.feedback.some(f => f.jobId === job.id && f.customerId === customer.id)) return formFail(form, ['Feedback has already been submitted for this visit.'], ['jobId']);
    if (!v.comment) return formFail(form, ['Add a short comment.'], ['comment']);
    const feedback = {
      id:uid('fb'), jobId:job.id, customerId:customer.id,
      ratings:{overall:Number(v.overall) || 5, quality:Number(v.quality) || 5, communication:Number(v.communication) || 5, value:Number(v.value) || 5},
      comment:String(v.comment).trim(), category:v.category || 'Service quality',
      publicConsent:!!v.publicConsent, status:'new', response:'', at:new Date().toISOString()
    };
    db.feedback.unshift(feedback);
    db.notifications.unshift({id:uid('ntf'),read:false,at:feedback.at,text:`New ${feedback.ratings.overall}/5 feedback from ${customer.name}.`,href:'/ops/feedback'});
    audit(db,'feedback.created','feedback',feedback.id,`Feedback submitted for ${job.number}`);
    persist('Feedback submitted',feedback.publicConsent ? 'Staff moderation is still required before public display.' : 'Thank you. Your feedback is private in this demo.','success');
    render();
  },
  'portal.profile': (form) => {
    const customer = currentCustomer(db);
    if (!customer) return;
    const v = formValues(form);
    const errors = [];
    if (cleanName(v.name).length < 2) errors.push('Enter your full name.');
    if (!isValidMobile(v.mobile)) errors.push('Enter a valid 10-digit Indian mobile number.');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.push('Enter a valid email address or leave it blank.');
    if (v.pincode && !/^\d{6}$/.test(v.pincode)) errors.push('Enter a valid 6-digit PIN code.');
    if (db.customers.some(c => c.id !== customer.id && cleanMobile(c.mobile) === cleanMobile(v.mobile))) errors.push('That mobile number is already linked to another demo customer.');
    if (errors.length) return formFail(form, errors, ['name','mobile','email','pincode']);
    customer.name = cleanName(v.name);
    customer.mobile = cleanMobile(v.mobile);
    customer.email = String(v.email || '').trim();
    customer.address = {...(customer.address || {}), line:String(v.line || '').trim(), locality:String(v.locality || '').trim(), city:String(v.city || '').trim(), pincode:String(v.pincode || '').trim()};
    customer.updatedAt = new Date().toISOString();
    audit(db,'customer.profile_updated','customer',customer.id,`${customer.name} updated their contact profile`);
    persist('Profile saved','Your details were updated in this local demo.','success');
    render();
  },
  'portal.consents': (form) => {
    const customer = currentCustomer(db);
    if (!customer) return;
    const v = formValues(form);
    customer.consents = customer.consents || {};
    customer.consents.service = !!v.service;
    customer.consents.marketing = !!v.marketing;
    customer.marketingOptOut = !v.marketing;
    customer.updatedAt = new Date().toISOString();
    audit(db,'customer.consents_updated','customer',customer.id,`${customer.name} updated communication consents`);
    persist('Consents updated','Marketing consent is recorded separately from essential service updates.','success');
    render();
  },
  'portal.clarify': (form) => {
    const est = portalOwned(db.estimates, form.dataset.id);
    if (!est) return;
    const v = formValues(form);
    if (!v.comment) return formFail(form, ['Enter your question.'], ['comment']);
    const customer = currentCustomer(db);
    const now = new Date().toISOString();
    est.decisions = est.decisions || [];
    est.decisions.push({at:now,actor:customer?.name || 'Customer',actorType:'customer',decision:'clarification',lineIds:[],comment:String(v.comment).trim()});
    if (['SENT','VIEWED'].includes(est.status)) est.status = 'VIEWED';
    est.viewedAt = est.viewedAt || now;
    audit(db,'approval.clarification','estimate',est.id,`${customer?.name || 'Customer'} asked a question on ${est.ref}`,{reason:String(v.comment).trim()});
    db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`Question on estimate ${est.ref} from ${customer?.name || 'customer'}.`,href:`/ops/estimates/${est.id}`});
    persist('Question recorded','The garage can review it in the demo. No real message was sent.','success');
    closeModal();
    render();
  },
  'portal.reschedule': (form) => {
    const booking = portalOwned(db.bookings, form.dataset.id);
    if (!booking) return;
    const v = formValues(form);
    const errors = [];
    if (!v.date || v.date < todayKey()) errors.push('Choose a valid future date.');
    if (!v.slot) errors.push('Choose a preferred time.');
    if (v.date && dateIsClosed(db, v.date)) errors.push('The garage is closed on that date. Choose another day.');
    if (errors.length) return formFail(form, errors, ['date','slot']);
    const now = new Date().toISOString();
    booking.status = 'reschedule_requested';
    booking.requestedDate = v.date;
    booking.requestedSlot = v.slot;
    booking.rescheduleNote = String(v.note || '').trim();
    booking.updatedAt = now;
    addBookingHistory(booking,'Reschedule requested by customer',`${fmtDateKey(v.date)} at ${fmtTime(v.slot)}${v.note ? ` · ${v.note}` : ''}`);
    audit(db,'booking.reschedule_requested','booking',booking.id,`Customer requested reschedule of ${booking.ref}`,{reason:String(v.note || '').trim()});
    db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`Reschedule requested for ${booking.ref}.`,href:`/ops/bookings/${booking.id}`});
    persist('Reschedule requested','The original appointment remains in place until staff confirm availability.','success');
    closeModal();
    render();
  },
  'ops.booking.search': (form) => applyOpsSearch(form),
  'ops.customer.search': (form) => applyOpsSearch(form),
  'ops.vehicle.search': (form) => applyOpsSearch(form),
  'ops.job.search': (form) => applyOpsSearch(form),
  'ops.inventory.search': (form) => applyOpsSearch(form),
  'ops.invoice.search': (form) => applyOpsSearch(form),
  'ops.audit.search': (form) => applyOpsSearch(form),
  'ops.calendar.date': (form) => {
    const v = formValues(form);
    const query = new URLSearchParams(currentRoute.query);
    if (v.date) query.set('date', v.date);
    else query.delete('date');
    go(`/ops/calendar?${query.toString()}`);
  },
  'ops.booking.internal': (form) => {
    const booking = getBooking(db, form.dataset.id);
    if (!booking) return;
    const v = formValues(form);
    if (!v.note) return formFail(form, ['Enter an internal note.'], ['note']);
    const stamp = `${new Date().toLocaleString('en-IN',{timeZone:IST})} · ${currentStaff(db)?.name || 'Staff'}: ${v.note}`;
    booking.internalNotes = [booking.internalNotes, stamp].filter(Boolean).join('\n');
    booking.updatedAt = new Date().toISOString();
    audit(db,'booking.note_added','booking',booking.id,`Internal note added to ${booking.ref}`);
    persist('Note added','This note is internal to garage operations.','success');
    render();
  },
  'ops.booking.reschedule': (form) => {
    const booking = getBooking(db, form.dataset.id);
    if (!booking) return;
    const v = formValues(form);
    const errors = [];
    if (!v.date || v.date < todayKey()) errors.push('Choose a valid future date.');
    if (!v.slot) errors.push('Choose a time.');
    if (!v.reason) errors.push('Record a reason for the reschedule.');
    if (v.date && dateIsClosed(db, v.date)) errors.push('The garage is closed on that date.');
    if (errors.length) return formFail(form, errors, ['date','slot','reason']);
    const activeBookings = db.bookings.filter(b => b.id !== booking.id && b.date === v.date && b.slot === v.slot && !['cancelled','no_show','rejected','rescheduled'].includes(b.status)).length;
    if (activeBookings >= db.settings.booking.capacity) return formFail(form, ['That slot is at demo capacity. Choose another time.'], ['slot']);
    const now = new Date().toISOString();
    const before = {date:booking.date,slot:booking.slot};
    booking.date = v.date;
    booking.slot = v.slot;
    booking.status = 'rescheduled';
    booking.updatedAt = now;
    delete booking.requestedDate;
    delete booking.requestedSlot;
    addBookingHistory(booking,'Rescheduled by staff',`${fmtDateKey(v.date)} at ${fmtTime(v.slot)} · ${v.reason}`);
    logCommunication({type:'reschedule',entityType:'booking',entityId:booking.id,customerId:booking.customerId,channel:getCustomer(db,booking.customerId)?.channel || 'whatsapp',recipient:getCustomer(db,booking.customerId)?.mobile,subject:'Your appointment was rescheduled',body:`Demo reschedule for ${booking.ref}: ${fmtDateKey(v.date)} at ${fmtTime(v.slot)}.`,status:'delivered'});
    audit(db,'booking.rescheduled','booking',booking.id,`${booking.ref} rescheduled`,{reason:v.reason,before,after:{date:v.date,slot:v.slot}});
    db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`${booking.ref} rescheduled to ${fmtDateKey(v.date)} at ${fmtTime(v.slot)}.`,href:`/ops/bookings/${booking.id}`});
    persist('Booking rescheduled','The new slot is saved in the demo.','success');
    closeModal();
    render();
  },
  'ops.booking.checkin': (form) => {
    const booking = getBooking(db, form.dataset.id);
    if (!booking) return;
    if (booking.jobId) return formFail(form, ['This booking already has a job card.']);
    if (['cancelled','no_show','rejected'].includes(booking.status)) return formFail(form, ['This booking cannot be checked in.']);
    const vehicle = getVehicle(db, booking.vehicleId);
    if (!vehicle) return formFail(form, ['The booking vehicle record is missing.']);
    const v = formValues(form);
    const odometer = Number(v.odometer);
    if (isBlank(v.odometer) || !Number.isFinite(odometer) || odometer < 0) return formFail(form, ['Enter a valid odometer reading.'], ['odometer']);
    if (odometer < Number(vehicle.odometer || 0)) return formFail(form, ['Odometer cannot be lower than the last recorded reading.'], ['odometer']);
    const now = new Date().toISOString();
    const job = createJob({
      customerId:booking.customerId, vehicleId:booking.vehicleId, odometer, fuel:v.fuel,
      concerns:booking.concerns, note:v.note, bookingId:booking.id,
      keys:v.keys || '1 key received', exterior:v.exterior || 'Not recorded'
    });
    vehicle.odometer = odometer;
    booking.status = 'converted';
    booking.jobId = job.id;
    booking.updatedAt = now;
    addBookingHistory(booking,'Checked in','Job card and inspection created');
    audit(db,'booking.checked_in','booking',booking.id,`${booking.ref} checked in as ${job.number}`);
    audit(db,'job.created','job',job.id,`Job ${job.number} created from booking ${booking.ref}`);
    db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`${booking.ref} checked in as ${job.number}.`,href:`/ops/jobs/${job.id}`});
    persist('Vehicle checked in','A job card and blank inspection checklist were created.','success');
    closeModal();
    go(`/ops/jobs/${job.id}`);
  },
  'ops.booking.new': (form) => {
    const v = formValues(form);
    const customer = getCustomer(db, v.customerId);
    const vehicle = getVehicle(db, v.vehicleId);
    const services = formAll(form, 'services');
    const errors = [];
    if (!customer) errors.push('Choose a customer.');
    if (!vehicle || vehicle.customerId !== customer?.id) errors.push('Choose a vehicle linked to the customer.');
    if (!v.date || v.date < todayKey()) errors.push('Choose a valid future date.');
    if (!v.slot) errors.push('Choose a time.');
    if (!services.length) errors.push('Choose at least one service.');
    if (v.date && dateIsClosed(db, v.date)) errors.push('The garage is closed on that date.');
    if (errors.length) return formFail(form, errors, ['customerId','vehicleId','date','slot','services']);
    const slot = slotsForDate(db, v.date).find(item => item.value === v.slot);
    if (!slot || !slot.available) return formFail(form, ['That slot is at demo capacity. Choose another time.'], ['slot']);
    if (db.bookings.some(b => b.vehicleId === vehicle.id && b.date === v.date && b.slot === v.slot && !['cancelled','no_show','rejected'].includes(b.status))) return formFail(form, ['This vehicle already has an active request in that slot.'], ['slot']);
    const now = new Date().toISOString();
    const ref = bookingRef(db);
    ++db.settings.numbering.booking;
    const booking = {
      id:uid('bk'), ref, customerId:customer.id, vehicleId:vehicle.id, services,
      concerns:[], addons:[], inspectionRequested:services.some(id => !serviceById(db,id)?.price),
      appointmentType:'drop_off', date:v.date, slot:v.slot, altPreference:'',
      status:'new_request', source:'Front desk', notes:String(v.notes || '').trim(), internalNotes:'',
      jobId:null, createdAt:now, updatedAt:now,
      history:[{at:now,label:'Booking request created by staff',detail:'Created from the demo operations console'}]
    };
    db.bookings.unshift(booking);
    logCommunication({type:'booking_confirmation',entityType:'booking',entityId:booking.id,customerId:customer.id,channel:customer.channel || 'whatsapp',recipient:customer.mobile,subject:'We received your service request',body:`Demo request ${ref} for ${fmtDateKey(v.date)} at ${fmtTime(v.slot)}.`,status:'queued'});
    audit(db,'booking.created','booking',booking.id,`Staff created booking ${ref} for ${customer.name}`);
    db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`New staff booking ${ref} for ${customer.name}.`,href:`/ops/bookings/${booking.id}`});
    persist('Booking created','The request is awaiting confirmation.','success');
    closeModal();
    go(`/ops/bookings/${booking.id}`);
  },
  'ops.job.new': (form) => {
    const v = formValues(form);
    const customer = getCustomer(db, v.customerId);
    const vehicle = getVehicle(db, v.vehicleId);
    const errors = [];
    if (!customer) errors.push('Choose a customer.');
    if (!vehicle || vehicle.customerId !== customer?.id) errors.push('Choose a vehicle linked to the customer.');
    const odometer = Number(v.odometer);
    if (isBlank(v.odometer) || !Number.isFinite(odometer) || odometer < Number(vehicle?.odometer || 0)) errors.push('Enter an odometer reading at or above the last recorded value.');
    if (errors.length) return formFail(form, errors, ['customerId','vehicleId','odometer']);
    const concerns = String(v.concerns || '').split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
    const now = new Date().toISOString();
    const job = createJob({customerId:customer.id,vehicleId:vehicle.id,odometer,fuel:v.fuel,concerns,note:v.note,exterior:'Recorded at check-in'});
    vehicle.odometer = odometer;
    audit(db,'job.created','job',job.id,`Job ${job.number} created for ${customer.name}`);
    db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`${job.number} created for ${customer.name}.`,href:`/ops/jobs/${job.id}`});
    persist('Job created','A blank inspection checklist is ready.','success');
    closeModal();
    go(`/ops/jobs/${job.id}`);
  },
  'ops.job.assign': (form) => {
    const job = getJob(db, form.dataset.id);
    if (!job) return;
    const v = formValues(form);
    const techIds = formAll(form, 'tech').filter(id => {
      const staff = getStaff(db, id);
      return staff && staff.role === 'technician' && staff.active;
    });
    let expectedAt = null;
    if (v.expectedAt) {
      const parsed = new Date(v.expectedAt);
      if (Number.isNaN(parsed.getTime())) return formFail(form, ['Enter a valid expected completion time.'], ['expectedAt']);
      expectedAt = parsed.toISOString();
    }
    job.techIds = techIds;
    job.expectedAt = expectedAt;
    job.updatedAt = new Date().toISOString();
    const names = techIds.map(id => getStaff(db,id)?.name).filter(Boolean).join(', ') || 'Unassigned';
    audit(db,'job.assigned','job',job.id,`${job.number} assigned to ${names}`);
    db.notifications.unshift({id:uid('ntf'),read:false,at:new Date().toISOString(),text:`${job.number} assignment updated: ${names}.`,href:`/ops/jobs/${job.id}`});
    persist('Assignment saved',`${job.number} is assigned to ${names}.`,'success');
    closeModal();
    render();
  },
  'ops.job.delay': (form) => {
    const job = getJob(db, form.dataset.id);
    if (!job) return;
    const v = formValues(form);
    if (!v.expectedAt) return formFail(form, ['Choose a new expected completion time.'], ['expectedAt']);
    if (!v.reason) return formFail(form, ['Record a reason for the delay.'], ['reason']);
    const parsed = new Date(v.expectedAt);
    if (Number.isNaN(parsed.getTime())) return formFail(form, ['Enter a valid expected completion time.'], ['expectedAt']);
    const now = new Date().toISOString();
    job.expectedAt = parsed.toISOString();
    job.delayReason = String(v.reason).trim();
    job.updatedAt = now;
    addCustomerUpdate(job,`Expected completion updated to ${fmtDateTime(job.expectedAt)}. Reason: ${job.delayReason}`);
    logCommunication({type:'delay_notice',entityType:'job',entityId:job.id,customerId:job.customerId,channel:getCustomer(db,job.customerId)?.channel || 'whatsapp',recipient:getCustomer(db,job.customerId)?.mobile,subject:'Service timeline update',body:`Demo delay notice for ${job.number}. New expected completion: ${fmtDateTime(job.expectedAt)}.`,status:'queued'});
    audit(db,'job.delay_updated','job',job.id,`${job.number} ETA updated`,{reason:job.delayReason});
    db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`${job.number} ETA updated.`,href:`/ops/jobs/${job.id}`});
    persist('Timeline updated','The customer-visible ETA and simulated notice were updated.','success');
    closeModal();
    render();
  },
  'ops.job.note': (form) => {
    const job = getJob(db, form.dataset.id);
    if (!job) return;
    const v = formValues(form);
    if (!v.note) return formFail(form, ['Enter an internal note.'], ['note']);
    job.internalNotes = job.internalNotes || [];
    job.internalNotes.push({at:new Date().toISOString(),text:String(v.note).trim(),by:currentStaff(db)?.name || 'Staff'});
    job.updatedAt = new Date().toISOString();
    audit(db,'job.note_added','job',job.id,`Internal note added to ${job.number}`);
    persist('Note added','This note is internal to garage operations.','success');
    closeModal();
    render();
  },
  'ops.job.customerUpdate': (form) => {
    const job = getJob(db, form.dataset.id);
    if (!job) return;
    const v = formValues(form);
    if (!v.text) return formFail(form, ['Write the customer update.'], ['text']);
    addCustomerUpdate(job,String(v.text).trim());
    job.updatedAt = new Date().toISOString();
    audit(db,'job.customer_update','job',job.id,`Customer update posted on ${job.number}`);
    persist('Customer update posted','The update is visible in the customer portal.','success');
    closeModal();
    render();
  },
  'ops.task.new': (form) => {
    if (!requirePermission('tasks.manage')) return;
    const job = getJob(db, form.dataset.id);
    if (!job) return;
    if (!isAssignedTechnician(job)) return denyAccess('assigned_jobs.view');
    const v = formValues(form);
    if (!v.title) return formFail(form, ['Enter a task title.'], ['title']);
    const task = {
      id:uid('task'), title:String(v.title).trim(), status:'pending', assigneeId:v.assigneeId || null,
      estimateLineId:null, startedAt:null, completedAt:null, note:String(v.note || '').trim(),
      minutes:Number(v.minutes) || 0, blockedBy:null, partId:null
    };
    job.tasks = job.tasks || [];
    job.tasks.push(task);
    job.updatedAt = new Date().toISOString();
    audit(db,'task.created','job',job.id,`Task “${task.title}” added to ${job.number}`);
    persist('Task added','The task is visible on the job card.','success');
    closeModal();
    render();
  },
  'ops.inspection.save': (form) => {
    if (!requirePermission('inspections.manage')) return;
    const job = getJob(db, form.dataset.job);
    if (job && !isAssignedTechnician(job)) return denyAccess('assigned_jobs.view');
    const result = saveInspectionForm(form);
    if (!result.ok) return formFail(form, ['The inspection could not be saved.']);
    const savedJob = job || getJob(db, getInspection(db, form.dataset.inspection)?.jobId);
    if (savedJob) audit(db,'inspection.saved','job',savedJob.id,`Inspection progress saved for ${savedJob.number}`);
    persist('Inspection saved','The checklist was updated in this demo.','success');
    render();
  },
  'ops.estimate.save': () => saveEstimate(false),
  'ops.qc.record': (form) => {
    if (!can('quality.manage', db) && !can('quality.submit', db)) return denyAccess('quality.submit');
    const job = getJob(db, form.dataset.id);
    if (!job) return;
    if (!isAssignedTechnician(job)) return denyAccess('assigned_jobs.view');
    if (job.status !== 'QUALITY_CHECK') return formFail(form, ['QC can only be recorded while the job is in the quality-check stage.']);
    const v = formValues(form);
    const result = v.result === 'fail' ? 'fail' : 'pass';
    if (result === 'fail' && !v.notes) return formFail(form, ['Add a note explaining the rework required.'], ['notes']);
    const now = new Date().toISOString();
    const items = String(v.notes || '').split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
    job.qualityChecks = job.qualityChecks || [];
    job.qualityChecks.push({at:now,result,items,notes:String(v.notes || '').trim(),by:db.session.staffId});
    job.updatedAt = now;
    if (result === 'pass') {
      consumeReservationsForJob(job, null, 'Quality check passed');
      job.status = 'WORK_COMPLETED';
      job.actualCompletedAt = job.actualCompletedAt || now;
      addCustomerUpdate(job,'Quality check passed. Your vehicle is being prepared for the next step.');
    } else {
      job.status = 'IN_PROGRESS';
      job.delayReason = String(v.notes || 'QC rework').trim();
      addCustomerUpdate(job,'Our quality check found an issue. The team is reworking it before release.');
    }
    audit(db,'qc.recorded','job',job.id,`QC ${result} recorded for ${job.number}`,{reason:String(v.notes || '').trim()});
    db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`QC ${result} recorded for ${job.number}.`,href:`/ops/jobs/${job.id}`});
    persist(`QC ${result === 'pass' ? 'passed' : 'failed'}`,result === 'pass' ? 'The job moved to work completed.' : 'The job returned to in-progress.','success');
    closeModal();
    render();
  },
  'ops.delivery': (form) => {
    if (!can('delivery.manage', db) && !can('collection.manage', db)) return denyAccess('delivery.manage');
    const job = getJob(db, form.dataset.id);
    if (!job) return;
    if (job.status !== 'READY_FOR_COLLECTION') return formFail(form, ['Only a vehicle that is ready for collection can be released.']);
    const v = formValues(form);
    if (!v.confirm) return formFail(form, ['Confirm the demo handover.'], ['confirm']);
    const invoice = jobInvoice(db, job);
    const balance = invoice ? invoiceTotals(invoice, db).balance : 0;
    if (balance > 0.49 && !v.reason) return formFail(form, ['Record an override reason for the outstanding balance.'], ['reason']);
    const now = new Date().toISOString();
    consumeReservationsForJob(job, null, 'Vehicle delivered');
    job.status = 'DELIVERED';
    job.deliveredAt = now;
    job.actualCompletedAt = job.actualCompletedAt || now;
    job.updatedAt = now;
    addCustomerUpdate(job,'Vehicle handover recorded. Thank you for choosing Gear Go Automobiles.');
    audit(db,'job.delivered','job',job.id,`${job.number} released to customer`,{reason:String(v.reason || '').trim()});
    if (balance > 0.49) audit(db,'delivery.balance_override','invoice',invoice.id,`Balance override recorded on ${invoice.ref}`,{reason:String(v.reason).trim()});
    db.notifications.unshift({id:uid('ntf'),read:false,at:now,text:`${job.number} marked delivered.`,href:`/ops/jobs/${job.id}`});
    persist('Handover recorded','This is a simulated release. No real vehicle was handed over.','success');
    closeModal();
    render();
  },
  'ops.invoice.new': (form) => {
    const v = formValues(form);
    const customer = getCustomer(db, v.customerId);
    const vehicle = getVehicle(db, v.vehicleId);
    const errors = [];
    if (!customer) errors.push('Choose a customer.');
    if (!vehicle || vehicle.customerId !== customer?.id) errors.push('Choose a vehicle linked to the customer.');
    if (!v.description) errors.push('Enter a line description.');
    if (!(Number(v.qty) > 0)) errors.push('Quantity must be greater than zero.');
    if (!(Number(v.unitPrice) >= 0)) errors.push('Unit price cannot be negative.');
    if (errors.length) return formFail(form, errors, ['customerId','vehicleId','description','qty','unitPrice']);
    const now = new Date().toISOString();
    const ref = invoiceNumber(db);
    ++db.settings.numbering.invoice;
    const invoice = {
      id:uid('inv'), ref, jobId:null, customerId:customer.id, vehicleId:vehicle.id, estimateId:null,
      date:todayKey(), dueDate:v.dueDate || addDays(todayKey(),7),
      lines:[{id:uid('el'),type:v.type || 'Service',description:String(v.description).trim(),category:v.type || 'Service',qty:Number(v.qty),unit:'item',unitPrice:Number(v.unitPrice),discountPct:0,taxRate:null,partId:null}],
      discount:0, status:'ISSUED', notes:'Created manually in the demo operations console.',
      terms:db.settings.approval.collectionPolicy, createdBy:db.session.staffId, payments:[], voidReason:null, createdAt:now
    };
    db.invoices.unshift(invoice);
    logCommunication({type:'completion',entityType:'invoice',entityId:invoice.id,customerId:customer.id,channel:customer.channel || 'whatsapp',recipient:customer.mobile,subject:'Invoice available in your portal',body:`Demo invoice ${ref} has been issued. No real message was sent.`,status:'queued'});
    audit(db,'invoice.created','invoice',invoice.id,`Invoice ${ref} created for ${customer.name}`);
    persist('Invoice created','The invoice is ready in this demo.','success');
    closeModal();
    go(`/ops/invoices/${invoice.id}`);
  },
  'ops.payment.record': (form) => {
    const invoice = getInvoice(db, form.dataset.id);
    if (!invoice) return;
    if (invoice.status === 'VOID') return formFail(form, ['Void invoices cannot receive payments.']);
    const v = formValues(form);
    const t = invoiceTotals(invoice, db);
    const amount = Number(v.amount);
    if (!Number.isFinite(amount) || amount <= 0) return formFail(form, ['Enter a payment amount greater than zero.'], ['amount']);
    if (amount > t.balance + 0.01) return formFail(form, [`Amount cannot exceed the outstanding balance of ${fmtINR(t.balance)}.`], ['amount']);
    const now = new Date().toISOString();
    invoice.payments = invoice.payments || [];
    invoice.payments.push({id:uid('pay'),amount:round2(amount),method:v.method || 'cash',reference:String(v.reference || '').trim(),at:now,by:db.session.staffId,notes:String(v.notes || '').trim(),reversed:false});
    audit(db,'payment.recorded','invoice',invoice.id,`Payment of ${fmtINR(amount)} recorded on ${invoice.ref}`);
    persist('Payment recorded','No money moved. This is a synthetic offline receipt.','success');
    closeModal();
    render();
  },
  'ops.communicate': (form) => {
    const type = form.dataset.entity;
    const id = form.dataset.id;
    const customer = communicationCustomer(type, id);
    if (!customer) return formFail(form, ['The linked customer record could not be found.']);
    const v = formValues(form);
    if (!v.body) return formFail(form, ['Write the demo message body.'], ['body']);
    const channel = v.channel || customer.channel || 'whatsapp';
    const template = db.settings.templates[v.type];
    logCommunication({
      type:v.type || 'progress_update', entityType:type, entityId:id, customerId:customer.id,
      channel, recipient:channel === 'email' ? customer.email : customer.mobile,
      subject:template?.subject || COMMUNICATION_TYPES[v.type] || 'Demo communication',
      body:String(v.body).trim(), status:'queued'
    });
    audit(db,'communication.logged','customer',customer.id,`${COMMUNICATION_TYPES[v.type] || v.type} logged for ${customer.name}`);
    persist('Message logged','Nothing was sent. The record is visible in Communications.','success');
    closeModal();
    render();
  },
  'ops.part.adjust': (form) => {
    if (!requirePermission('inventory.manage')) return;
    const part = getPart(db, form.dataset.id);
    if (!part) return;
    const v = formValues(form);
    const qty = Number(v.qty);
    if (!Number.isFinite(qty) || qty === 0) return formFail(form, ['Enter a non-zero quantity change.'], ['qty']);
    if (!v.reason) return formFail(form, ['Record a reason for the stock movement.'], ['reason']);
    let delta = qty;
    if (v.type === 'receive') delta = Math.abs(qty);
    if (v.type === 'consume') delta = -Math.abs(qty);
    if (v.type === 'adjust' && !Number.isInteger(qty)) return formFail(form, ['Use a whole-number change for a manual adjustment.'], ['qty']);
    if (Number(part.stock) + delta < 0) return formFail(form, ['Stock cannot fall below zero.'], ['qty']);
    part.stock = Number(part.stock) + delta;
    logStockMovement(part.id, {type:v.type || 'adjust',qty:delta,stockDelta:delta,reason:String(v.reason).trim()});
    if (delta > 0) allocateShortages(part.id);
    syncPartReserved(part.id);
    audit(db,'inventory.adjusted','part',part.id,`Stock for ${part.name} changed by ${delta > 0 ? '+' : ''}${delta}`,{reason:v.reason});
    persist('Stock updated',`${part.name} now has ${part.stock} unit(s).`,'success');
    closeModal();
    render();
  },
  'ops.part.new': (form) => {
    if (!requirePermission('inventory.manage')) return;
    const v = formValues(form);
    const errors = [];
    if (!v.name) errors.push('Enter the part name.');
    if (!v.sku) errors.push('Enter a SKU.');
    if (v.sku && db.parts.some(p => String(p.sku).toLowerCase() === String(v.sku).toLowerCase())) errors.push('That SKU already exists.');
    if (Number(v.cost) < 0 || Number(v.price) < 0) errors.push('Prices cannot be negative.');
    if (Number(v.stock) < 0 || Number(v.reorder) < 0) errors.push('Stock levels cannot be negative.');
    if (errors.length) return formFail(form, errors, ['name','sku','cost','stock']);
    const part = {
      id:uid('part'), sku:String(v.sku).trim().toUpperCase(), name:String(v.name).trim(),
      category:v.category || 'General', compatibility:'', supplier:v.supplier || '',
      cost:Number(v.cost) || 0, price:Number(v.price) || 0, stock:Number(v.stock) || 0,
      reserved:0, reorder:Number(v.reorder) || 0, location:v.location || '', active:true,
      movements:[], createdAt:new Date().toISOString()
    };
    db.parts.unshift(part);
    audit(db,'part.created','part',part.id,`Part ${part.name} added to inventory`);
    persist('Part added','The part is available in demo inventory.','success');
    closeModal();
    render();
  },
  'ops.customer.new': (form) => {
    const v = formValues(form);
    const errors = [];
    if (cleanName(v.name).length < 2) errors.push('Enter the customer name.');
    if (!isValidMobile(v.mobile)) errors.push('Enter a valid 10-digit mobile number.');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.push('Enter a valid email address or leave it blank.');
    if (db.customers.some(c => cleanMobile(c.mobile) === cleanMobile(v.mobile))) errors.push('A customer with that mobile number already exists.');
    if (errors.length) return formFail(form, errors, ['name','mobile','email']);
    const customer = {
      id:uid('cus'), ref:`GG-C-${++db.settings.numbering.customer}`, name:cleanName(v.name),
      mobile:cleanMobile(v.mobile), email:String(v.email || '').trim(), channel:v.channel || 'whatsapp',
      address:{line:'',locality:String(v.locality || '').trim(),city:String(v.city || '').trim(),pincode:''},
      type:'Individual', consents:{service:!!v.consent,marketing:false}, marketingOptOut:true,
      status:'active', guest:false, notes:'', createdAt:new Date().toISOString()
    };
    db.customers.unshift(customer);
    audit(db,'customer.created','customer',customer.id,`Customer ${customer.name} created by staff`);
    persist('Customer created',`${customer.ref} is ready for vehicles and bookings.`,'success');
    closeModal();
    go(`/ops/customers/${customer.id}`);
  },
  'ops.customer.edit': (form) => {
    const customer = getCustomer(db, form.dataset.id);
    if (!customer) return;
    const v = formValues(form);
    const errors = [];
    if (cleanName(v.name).length < 2) errors.push('Enter the customer name.');
    if (!isValidMobile(v.mobile)) errors.push('Enter a valid 10-digit mobile number.');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.push('Enter a valid email address or leave it blank.');
    if (db.customers.some(c => c.id !== customer.id && cleanMobile(c.mobile) === cleanMobile(v.mobile))) errors.push('Another customer already uses that mobile number.');
    if (errors.length) return formFail(form, errors, ['name','mobile','email']);
    customer.name = cleanName(v.name);
    customer.mobile = cleanMobile(v.mobile);
    customer.email = String(v.email || '').trim();
    customer.address = {...(customer.address || {}), locality:String(v.locality || '').trim(), city:String(v.city || '').trim()};
    customer.status = v.status || customer.status;
    customer.consents = customer.consents || {};
    customer.consents.service = !!v.service;
    customer.consents.marketing = !!v.marketing;
    customer.marketingOptOut = !v.marketing;
    customer.notes = String(v.notes || '').trim();
    customer.updatedAt = new Date().toISOString();
    audit(db,'customer.updated','customer',customer.id,`Customer ${customer.name} updated`);
    persist('Customer saved','Contact details and consents were updated.','success');
    closeModal();
    render();
  },
  'ops.vehicle.new': (form) => {
    const v = formValues(form);
    const customer = getCustomer(db, v.customerId);
    const reg = normaliseReg(v.reg);
    const errors = [];
    if (!customer) errors.push('Choose a vehicle owner.');
    if (!isValidReg(v.reg)) errors.push('Enter a valid registration number.');
    if (db.vehicles.some(x => normaliseReg(x.reg) === reg)) errors.push('That registration already exists.');
    if (!v.make || !v.model) errors.push('Enter the make and model.');
    if (!v.year || Number(v.year) < 1990 || Number(v.year) > new Date().getFullYear() + 1) errors.push('Enter a valid manufacturing year.');
    if (Number(v.odometer) < 0) errors.push('Odometer cannot be negative.');
    if (errors.length) return formFail(form, errors, ['customerId','reg','make','model','year']);
    const vehicle = {
      id:uid('veh'), ref:`GG-V-${++db.settings.numbering.vehicle}`, reg, make:cleanName(v.make), model:cleanName(v.model),
      variant:cleanName(v.variant), year:Number(v.year), fuel:v.fuel || 'Petrol', transmission:v.transmission || 'Manual',
      odometer:Number(v.odometer) || 0, customerId:customer.id, color:'', nickname:'',
      status:'active', notes:'', createdAt:new Date().toISOString()
    };
    db.vehicles.unshift(vehicle);
    audit(db,'vehicle.created','vehicle',vehicle.id,`Vehicle ${fmtReg(reg)} added for ${customer.name}`);
    persist('Vehicle added','The vehicle is linked to the customer.','success');
    closeModal();
    go(`/ops/vehicles/${vehicle.id}`);
  },
  'ops.vehicle.edit': (form) => {
    const vehicle = getVehicle(db, form.dataset.id);
    if (!vehicle) return;
    const v = formValues(form);
    const reg = normaliseReg(v.reg);
    const errors = [];
    if (!isValidReg(v.reg)) errors.push('Enter a valid registration number.');
    if (db.vehicles.some(x => x.id !== vehicle.id && normaliseReg(x.reg) === reg)) errors.push('That registration is already linked to another vehicle.');
    if (!v.make || !v.model) errors.push('Enter the make and model.');
    if (!v.year || Number(v.year) < 1990 || Number(v.year) > new Date().getFullYear() + 1) errors.push('Enter a valid manufacturing year.');
    if (Number(v.odometer) < 0) errors.push('Odometer cannot be negative.');
    if (errors.length) return formFail(form, errors, ['reg','make','model','year','odometer']);
    const owner = getCustomer(db, v.customerId);
    vehicle.reg = reg;
    vehicle.make = cleanName(v.make);
    vehicle.model = cleanName(v.model);
    vehicle.variant = cleanName(v.variant);
    vehicle.year = Number(v.year);
    vehicle.odometer = Number(v.odometer) || 0;
    vehicle.customerId = owner?.id || vehicle.customerId;
    vehicle.status = v.status || vehicle.status;
    vehicle.notes = String(v.notes || '').trim();
    vehicle.updatedAt = new Date().toISOString();
    audit(db,'vehicle.updated','vehicle',vehicle.id,`Vehicle ${fmtReg(reg)} updated`);
    persist('Vehicle saved','The vehicle record was updated.','success');
    closeModal();
    render();
  },
  'ops.staff.new': (form) => {
    const v = formValues(form);
    const errors = [];
    if (cleanName(v.name).length < 2) errors.push('Enter the staff member name.');
    if (!ROLE_DEFS[v.role] || v.role === 'customer') errors.push('Choose a valid staff role.');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.push('Enter a valid email address or leave it blank.');
    if (errors.length) return formFail(form, errors, ['name','role','email']);
    const palette = ['#d9ff4f','#9ee7ff','#ffcf7a','#f4a7c0','#b8a7ff','#8fe0c0'];
    const staff = {
      id:uid('st'), name:cleanName(v.name), role:v.role, title:v.title || ROLE_DEFS[v.role]?.label || '',
      phone:String(v.phone || '').trim(), email:String(v.email || '').trim(),
      colour:palette[db.staff.length % palette.length], active:true, joinedAt:new Date().toISOString()
    };
    db.staff.push(staff);
    audit(db,'staff.created','staff',staff.id,`Staff member ${staff.name} added as ${ROLE_DEFS[staff.role]?.label || staff.role}`);
    persist('Staff member added','They can be selected in the demo persona switcher.','success');
    closeModal();
    render();
  },
  'ops.staff.edit': (form) => {
    const staff = getStaff(db, form.dataset.id);
    if (!staff) return;
    const v = formValues(form);
    const errors = [];
    if (cleanName(v.name).length < 2) errors.push('Enter the staff member name.');
    if (!ROLE_DEFS[v.role] || v.role === 'customer') errors.push('Choose a valid staff role.');
    if (errors.length) return formFail(form, errors, ['name','role']);
    staff.name = cleanName(v.name);
    staff.role = v.role;
    staff.title = String(v.title || '').trim();
    staff.phone = String(v.phone || '').trim();
    staff.updatedAt = new Date().toISOString();
    audit(db,'staff.updated','staff',staff.id,`Staff member ${staff.name} updated`);
    persist('Staff member saved','Role changes apply immediately in this demo.','success');
    closeModal();
    render();
  },
  'ops.feedback.respond': (form) => {
    const feedback = db.feedback.find(f => f.id === form.dataset.id);
    if (!feedback) return;
    const v = formValues(form);
    if (!v.response) return formFail(form, ['Write a response.'], ['response']);
    feedback.response = String(v.response).trim();
    feedback.respondedAt = new Date().toISOString();
    if (feedback.status === 'new') feedback.status = 'reviewed';
    audit(db,'feedback.responded','feedback',feedback.id,'Demo response added to customer feedback');
    persist('Response saved','The response is visible on the feedback record.','success');
    closeModal();
    render();
  },
  'ops.reminder.new': (form) => {
    const v = formValues(form);
    const customer = getCustomer(db, v.customerId);
    const vehicle = getVehicle(db, v.vehicleId);
    const errors = [];
    if (!customer) errors.push('Choose a customer.');
    if (!vehicle || vehicle.customerId !== customer?.id) errors.push('Choose a vehicle linked to the customer.');
    if (!v.dueDate) errors.push('Choose a due date.');
    if (!v.reason) errors.push('Enter the reminder reason.');
    if (errors.length) return formFail(form, errors, ['customerId','vehicleId','dueDate','reason']);
    const reminder = {
      id:uid('rem'), customerId:customer.id, vehicleId:vehicle.id, type:'Manual', dueDate:v.dueDate,
      reason:String(v.reason).trim(), channel:customer.channel || 'whatsapp', status:'pending',
      notes:'Created manually in the demo operations console.', createdAt:new Date().toISOString()
    };
    db.reminders.unshift(reminder);
    audit(db,'reminder.created','reminder',reminder.id,`Manual reminder created for ${customer.name}`);
    persist('Reminder created','It is pending and can be sent as a simulated message.','success');
    closeModal();
    render();
  },
  'ops.settings.save': (form) => {
    const v = formValues(form);
    const errors = [];
    if (!v.businessName) errors.push('Business name is required.');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.push('Enter a valid business email.');
    if (!v.bookingOpen || !v.bookingClose || v.bookingOpen >= v.bookingClose) errors.push('Booking opening time must be before closing time.');
    if (Number(v.capacity) < 1 || Number(v.capacity) > 10) errors.push('Slot capacity must be between 1 and 10.');
    if (Number(v.slotMinutes) < 30 || Number(v.slotMinutes) > 120) errors.push('Slot duration must be between 30 and 120 minutes.');
    if (Number(v.taxRate) < 0 || Number(v.taxRate) > 28) errors.push('Tax rate must be between 0 and 28 percent.');
    if (Number(v.validityDays) < 1) errors.push('Estimate validity must be at least one day.');
    if (errors.length) return formFail(form, errors, ['businessName','email','bookingOpen','capacity','taxRate']);
    const now = new Date().toISOString();
    db.settings.business.name = String(v.businessName).trim();
    db.settings.business.address = String(v.address || '').trim();
    db.settings.business.phone = String(v.phone || '').trim();
    db.settings.business.whatsapp = String(v.phone || db.settings.business.whatsapp).trim();
    db.settings.business.email = String(v.email || '').trim();
    db.settings.business.gstin = String(v.gstin || '').trim();
    db.settings.business.tagline = String(v.tagline || '').trim();
    db.settings.booking.open = v.bookingOpen;
    db.settings.booking.close = v.bookingClose;
    db.settings.booking.capacity = Number(v.capacity);
    db.settings.booking.slotMinutes = Number(v.slotMinutes);
    db.settings.approval.validityDays = Number(v.validityDays);
    db.settings.approval.collectionPolicy = String(v.collectionPolicy || '').trim();
    db.settings.approval.safetyPolicy = String(v.safetyPolicy || '').trim();
    db.settings.tax.enabled = !!v.taxEnabled;
    db.settings.tax.rate = Number(v.taxRate);
    db.settings.tax.label = String(v.taxLabel || '').trim();
    Object.keys(db.settings.templates).forEach(key => {
      const subject = v[`tpl_${key}_subject`];
      const body = v[`tpl_${key}_body`];
      if (typeof subject === 'string') db.settings.templates[key].subject = subject.trim();
      if (typeof body === 'string') db.settings.templates[key].body = body.trim();
    });
    const numberMap = {booking:'numBooking',job:'numJob',estimate:'numEstimate',invoice:'numInvoice',customer:'numCustomer',vehicle:'numVehicle'};
    Object.entries(numberMap).forEach(([key, field]) => {
      const value = Number(v[field]);
      if (Number.isFinite(value) && value >= 1) db.settings.numbering[key] = Math.floor(value);
    });
    db.settings.updatedAt = now;
    audit(db,'settings.updated','settings',null,'Demo business, booking, tax and template settings updated');
    persist('Settings saved','Changes apply to this browser only.','success');
    render();
  }
});

