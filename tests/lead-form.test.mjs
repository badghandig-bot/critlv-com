import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/lead-form.js', import.meta.url), 'utf8');
function fixture({ ok = true, reject = false, query = '', heardAbout = 'referral', analyticsThrows = false, fetchGate } = {}) {
  const calls = [], events = [], data = { name:'Website Test', email:'website-test@example.com', phone:'9195550100', company:'QA fixture', description:'Test project', heardAbout, 'cab-drops':'12', 'cab-sqft':'2500' };
  const elements = new Map();
  const make = (id) => {
    const listeners = {}, classes = new Set();
    const el = { id, value:'', disabled:false, innerHTML:'Send request', style:{}, textContent:'',
      addEventListener(type, fn) { listeners[type] = fn; }, listeners,
      classList:{ toggle(name,on) { if(on) classes.add(name); else classes.delete(name); }, contains(name) {return classes.has(name);} }
    }; elements.set(id, el); return el;
  };
  for (const id of ['lead-service','cabling-details','camera-details','service-details','lead-form','lead-success','lead-error','lead-submit']) make(id);
  const select = elements.get('lead-service');
  select.options = ['', 'STRUCTURED_CABLING','VIDEO_SURVEILLANCE','SMART_HOME','AV_PAGING','NEW_CONSTRUCTION','SERVICE_MAINTENANCE','SITE_WALK','OTHER'].map(value => ({value, disabled:!value}));
  select.value = 'STRUCTURED_CABLING';
  const window = { location:{search:query}, CritAnalytics:{
    attributionText() { if(analyticsThrows) throw new Error('blocked optional script'); return 'Visit source: Google Search'; },
    track(name) { if(analyticsThrows) throw new Error('analytics unavailable'); events.push(name); },
    leadConfirmed(result) { if(analyticsThrows) throw new Error('analytics unavailable'); assert.equal(result.ok,true); events.push('generate_lead'); }
  }};
  const context = vm.createContext({ window, URLSearchParams, document:{readyState:'complete', getElementById(id){return elements.get(id);}},
    FormData:class { get(key) {return key === 'serviceCategory' ? select.value : data[key];}},
    fetch:async (url, init) => { calls.push({url,init,payload:JSON.parse(init.body)}); if(fetchGate) await fetchGate; if(reject) throw new Error('Connection failed'); return {ok,json:async()=>({error:'Please retry the request.'})}; }
  });
  vm.runInContext(source,context);
  return {calls,events,elements,select,data,submit:()=>elements.get('lead-form').listeners.submit({preventDefault(){}})};
}

test('a service-page quote link selects a real service and opens the matching detail fields', () => {
  const q = fixture({query:'?service=VIDEO_SURVEILLANCE'});
  assert.equal(q.select.value,'VIDEO_SURVEILLANCE');
  assert.equal(q.elements.get('camera-details').classList.contains('show'),true);
  assert.equal(q.elements.get('cabling-details').classList.contains('show'),false);
  const invalid = fixture({query:'?service=%3Cscript%3E'});
  assert.equal(invalid.select.value,'STRUCTURED_CABLING');
});

test('accepted quotes preserve the FieldOps payload and count a lead after the request succeeds', async () => {
  const q = fixture();
  await q.submit();
  assert.equal(q.calls.length,1);
  assert.equal(q.calls[0].url,'https://app.critlv.com/api/leads');
  assert.equal(q.calls[0].init.method,'POST');
  assert.equal(q.calls[0].payload.cablingDetails.approximateDrops,12);
  assert.equal(q.calls[0].payload.name,'Website Test');
  assert.match(q.calls[0].payload.description,/Customer-reported source: Referral/);
  assert.match(q.calls[0].payload.description,/Visit source: Google Search/);
  assert.deepEqual(q.events,['quote_submit','generate_lead']);
  assert.equal(q.elements.get('lead-success').style.display,'block');
  assert.equal(q.elements.get('lead-form').style.display,'none');
});

test('a rejected quote remains editable and never counts as a completed lead', async () => {
  const q = fixture({ok:false});
  await q.submit();
  assert.deepEqual(q.events,['quote_submit']);
  assert.equal(q.elements.get('lead-submit').disabled,false);
  assert.match(q.elements.get('lead-error').textContent,/retry/);
  assert.notEqual(q.elements.get('lead-form').style.display,'none');
  assert.notEqual(q.elements.get('lead-success').style.display,'block');
});

test('a network failure leaves the form available for a safe retry', async () => {
  const q = fixture({reject:true});
  await q.submit();
  assert.equal(q.elements.get('lead-submit').disabled,false);
  assert.match(q.elements.get('lead-error').textContent,/Connection failed/);
  assert.equal(q.events.includes('generate_lead'),false);
});

test('optional analytics failures cannot turn an accepted quote into a failed submission', async () => {
  const q = fixture({analyticsThrows:true});
  await q.submit();
  assert.equal(q.calls.length,1);
  assert.equal(q.elements.get('lead-success').style.display,'block');
  assert.equal(q.elements.get('lead-error').style.display,'none');
  assert.match(q.calls[0].payload.description,/Customer-reported source: Referral/);
});

test('duplicate submit events do not send duplicate requests or leads', async () => {
  let release;
  const fetchGate = new Promise(resolve => {release=resolve;});
  const q = fixture({fetchGate});
  const first = q.submit();
  await q.submit();
  assert.equal(q.calls.length,1);
  release();
  await first;
  await q.submit();
  assert.equal(q.calls.length,1);
  assert.equal(q.events.filter(x=>x==='generate_lead').length,1);
});

test('unknown self-reported values are not copied into operational attribution', async () => {
  const q = fixture({heardAbout:'unapproved-source@example.com'});
  await q.submit();
  assert.doesNotMatch(q.calls[0].payload.description,/unapproved-source|Customer-reported source/);
});
