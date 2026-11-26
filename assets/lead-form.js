(function () {
  'use strict';
  function safeAnalytics(method, value) {
    try {
      if (window.CritAnalytics && typeof window.CritAnalytics[method] === 'function') {
        window.CritAnalytics[method](value);
      }
    } catch (_) { /* Analytics cannot block the lead workflow. */ }
  }
  function initLeadForm() {
  // --- CABLING DETAILS TOGGLE --------------------------------------------
  const serviceSelect = document.getElementById('lead-service');
  const cablingDetails = document.getElementById('cabling-details');
  const cameraDetails = document.getElementById('camera-details');
  const serviceDetails = document.getElementById('service-details');
  if (serviceSelect) {
    const updateServiceDetails = function () {
      if (cablingDetails) cablingDetails.classList.toggle('show', serviceSelect.value === 'STRUCTURED_CABLING');
      if (cameraDetails) cameraDetails.classList.toggle('show', serviceSelect.value === 'VIDEO_SURVEILLANCE');
      if (serviceDetails) serviceDetails.classList.toggle('show', serviceSelect.value === 'SERVICE_MAINTENANCE');
    };
    serviceSelect.addEventListener('change', updateServiceDetails);
    const preset = new URLSearchParams(window.location.search).get('service');
    if (preset && Array.from(serviceSelect.options).some(option => option.value === preset && !option.disabled)) {
      serviceSelect.value = preset;
    }
    updateServiceDetails();
  }

  // --- LEAD FORM SUBMIT --------------------------------------------------
  const form = document.getElementById('lead-form');
  const successDiv = document.getElementById('lead-success');
  const errorDiv = document.getElementById('lead-error');
  const submitBtn = document.getElementById('lead-submit');

  if (form && successDiv && errorDiv && submitBtn) {
    const originalLabel = submitBtn.innerHTML;
    let submitting = false;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (submitting) return;
      submitting = true;
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending…';

      const fd = new FormData(form);
      const serviceCategory = String(fd.get('serviceCategory') || '');
      const payload = {
        name: String(fd.get('name') || '').trim(),
        email: String(fd.get('email') || '').trim(),
        phone: String(fd.get('phone') || '').trim(),
        company: String(fd.get('company') || '').trim(),
        serviceCategory: serviceCategory,
        industrySource: String(fd.get('industrySource') || '').trim() || null,
        description: String(fd.get('description') || '').trim(),
      };

      if (serviceCategory === 'STRUCTURED_CABLING') {
        const cab = {};
        const buildingType = String(fd.get('cab-building') || '').trim();
        const sqft = String(fd.get('cab-sqft') || '').trim();
        const drops = String(fd.get('cab-drops') || '').trim();
        const closets = String(fd.get('cab-closets') || '').trim();
        const ceiling = String(fd.get('cab-ceiling') || '').trim();
        const deadline = String(fd.get('cab-deadline') || '').trim();
        const special = String(fd.get('cab-special') || '').trim();
        const isNew = fd.get('cab-newconstruction') === 'on';
        if (buildingType) cab.buildingType = buildingType;
        if (sqft) cab.approximateSqFt = parseInt(sqft, 10);
        if (drops) cab.approximateDrops = parseInt(drops, 10);
        if (closets) cab.numClosets = parseInt(closets, 10);
        if (ceiling) cab.ceilingHeight = ceiling;
        if (deadline) cab.deadlineWeeks = deadline;
        if (special) cab.specialRequirements = special;
        if (isNew) cab.isNewConstruction = true;
        if (Object.keys(cab).length > 0) payload.cablingDetails = cab;
      }

      if (serviceCategory === 'VIDEO_SURVEILLANCE') {
        const camLines = [];
        const property = String(fd.get('cam-property') || '').trim();
        const floors = String(fd.get('cam-floors') || '').trim();
        const sqft = String(fd.get('cam-sqft') || '').trim();
        const ceiling = String(fd.get('cam-ceiling') || '').trim();
        const count = String(fd.get('cam-count') || '').trim();
        const fullSystem = String(fd.get('cam-fullsystem') || '').trim();
        const farthest = String(fd.get('cam-farthest') || '').trim();
        if (property) camLines.push('Property type: ' + property);
        if (floors) camLines.push('Floors: ' + floors);
        if (sqft) camLines.push('Approx. sq ft: ' + sqft);
        if (ceiling) camLines.push('Ceiling type: ' + ceiling);
        if (count) camLines.push('Cameras: ' + count);
        if (fullSystem) camLines.push('Full system (NVR + switch): ' + fullSystem);
        if (farthest) camLines.push('Farthest camera from network/modem: ' + farthest);
        if (camLines.length > 0) {
          const block = 'Security camera details:\n' + camLines.join('\n');
          payload.description = payload.description
            ? payload.description + '\n\n' + block
            : block;
        }
      }

      if (serviceCategory === 'SERVICE_MAINTENANCE') {
        const svcLines = [];
        const property = String(fd.get('svc-property') || '').trim();
        const urgency = String(fd.get('svc-urgency') || '').trim();
        if (property) svcLines.push('Property type: ' + property);
        if (urgency) svcLines.push('Urgency: ' + urgency);
        if (svcLines.length > 0) {
          const block = 'Service / repair details:\n' + svcLines.join('\n');
          payload.description = payload.description
            ? payload.description + '\n\n' + block
            : block;
        }
      }

      // Source context travels with the operational request. Form values never
      // go to analytics. Explicitly reported source is kept separate from visits.
      const sourceNames = {
        google_search: 'Google Search', google_maps: 'Google Maps / Business Profile',
        yelp: 'Yelp', social: 'Social media', ai_assistant: 'AI assistant',
        referral: 'Referral', returning_customer: 'Returning customer', other: 'Other'
      };
      const reportedSource = sourceNames[String(fd.get('heardAbout') || '')];
      const sourceLines = [];
      if (reportedSource) sourceLines.push('Customer-reported source: ' + reportedSource);
      try {
        const automatic = window.CritAnalytics && window.CritAnalytics.attributionText();
        if (automatic) sourceLines.push(automatic);
      } catch (_) { /* Optional analytics must never interrupt a quote. */ }
      if (sourceLines.length) payload.description = [payload.description, sourceLines.join('\n')].filter(Boolean).join('\n\n');
      safeAnalytics('track', 'quote_submit');

      try {
        const res = await fetch('https://app.critlv.com/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          let msg = 'Could not send. Please try again or call (754) 348-0736.';
          try {
            const data = await res.json();
            if (data && data.error) msg = data.error;
          } catch (e2) {}
          throw new Error(msg);
        }
        safeAnalytics('leadConfirmed', { ok: res.ok });
        form.style.display = 'none';
        successDiv.style.display = 'block';
      } catch (err) {
        submitting = false;
        errorDiv.textContent = err && err.message ? err.message : 'Could not send. Please try again.';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalLabel;
      }
    });
  }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLeadForm);
  else initLeadForm();
})();
