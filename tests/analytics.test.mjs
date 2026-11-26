import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createAnalytics,sourceFor,publicPage,boundedCampaign}=require('../assets/analytics.js');

const APPROVED=['google-business-profile','wake-contractors','business-cards','referral-partners'];
function storage(){
  const values=new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),snapshot:()=>[...values.values()]};
}
function harness(options={}){
  const scripts=[],handlers={},nodes=new Map(), session=options.session || storage(), preferences=options.preferences || storage();
  const document={referrer:options.referrer || '',readyState:'complete',cookie:'',
    head:{appendChild(node){scripts.push(node);if(node.id)nodes.set(node.id,node);}},
    createElement:tag=>({tagName:tag.toUpperCase()}),
    getElementById:id=>nodes.get(id) || null,
    addEventListener(type,fn){(handlers[type]??=[]).push(fn);},
  };
  const window={location:new URL(options.url || 'https://critnetworking.com/'),document,navigator:options.navigator || {},sessionStorage:session,localStorage:preferences};
  const config={measurementId:options.id===undefined?'G-ABC123DEF4':options.id,allowedHosts:['critnetworking.com','www.critnetworking.com'],canonicalOrigin:'https://critnetworking.com',promptForConsent:false,allowedCampaigns:APPROVED};
  let now=1800000000000;
  const analytics=createAnalytics({window,document,navigator:window.navigator,config,sessionStorage:session,localStorage:preferences,now:()=>now});
  const commands=()=>Array.from(window.dataLayer || [],entry=>Array.from(entry));
  const events=()=>commands().filter(entry=>entry[0]==='event');
  return {analytics,window,document,scripts,handlers,session,preferences,commands,events,advance:milliseconds=>{now+=milliseconds;}};
}

test('no ID or no explicit consent means no Google tag and no queued analytics events',()=>{
  const unconfigured=harness({id:''});unconfigured.analytics.start();
  unconfigured.analytics.track('quote_submit');unconfigured.analytics.leadConfirmed({ok:true});
  unconfigured.analytics.setConsent(true);
  assert.equal(unconfigured.scripts.length,0);
  assert.equal(unconfigured.events().length,0);
  assert.equal(unconfigured.analytics.status().configured,false);
  const undecided=harness();undecided.analytics.start();undecided.analytics.track('click_to_call');
  assert.equal(undecided.scripts.length,0);
  assert.equal(undecided.window.dataLayer,undefined);
  assert.equal(undecided.analytics.status().consent,'unset');
});

test('opt-in initializes one tag with advertising off and one sanitized page view',()=>{
  const h=harness({url:'https://critnetworking.com/structured-cabling-raleigh.html?email=private%40example.test&utm_source=google&utm_medium=organic&utm_campaign=google-business-profile#token=private-token',referrer:'https://example.test/private/customer?token=secret'});
  h.analytics.start();h.analytics.setConsent(true);h.analytics.start();h.analytics.pageView();
  assert.equal(h.scripts.length,1);
  assert.equal(h.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF4');
  assert.equal(h.scripts[0].referrerPolicy,'no-referrer');
  const config=h.commands().find(entry=>entry[0]==='config')[2];
  assert.equal(config.send_page_view,false);
  assert.equal(config.allow_google_signals,false);
  assert.equal(config.allow_ad_personalization_signals,false);
  assert.equal(config.cookie_expires,90*86400);
  const events=h.events();assert.equal(events.length,1);assert.equal(events[0][1],'page_view');
  assert.equal(events[0][2].page_location,'https://critnetworking.com/structured-cabling-raleigh');
  assert.equal(events[0][2].page_referrer,'');
  assert.equal(events[0][2].campaign_name,'google-business-profile');
  for(const secret of ['private@example.test','private-token','/private/customer','?email=','token=secret'])assert.ok(!JSON.stringify(h.commands()).includes(secret));
  const defaultConsent=h.commands().find(entry=>entry[0]==='consent' && entry[1]==='default')[2];
  assert.equal(defaultConsent.analytics_storage,'denied');
  assert.ok(h.commands().filter(entry=>entry[0]==='consent').every(entry=>entry[2].ad_storage==='denied' && entry[2].ad_user_data==='denied' && entry[2].ad_personalization==='denied'));
});

test('DNT and GPC override a stored opt-in and suppress automatic attribution',()=>{
  for(const navigator of [{doNotTrack:'1'},{doNotTrack:'yes'},{globalPrivacyControl:true}]){
    const h=harness({navigator});h.analytics.setConsent(true);h.analytics.start();
    assert.equal(h.analytics.track('email_click'),false);
    assert.equal(h.analytics.attributionText(),'');
    assert.equal(h.scripts.length,0);
    assert.equal(h.events().length,0);
    assert.equal(h.analytics.status().enabled,false);
  }
});

test('withdrawing consent disables subsequent events and clears automatic source context',()=>{
  const h=harness({url:'https://critnetworking.com/?utm_source=yelp'});h.analytics.start();h.analytics.setConsent(true);
  assert.match(h.analytics.attributionText(),/Source: yelp/);
  const before=h.events().length;
  h.analytics.setConsent(false);h.analytics.track('quote_submit');h.analytics.leadConfirmed({ok:true});
  assert.equal(h.events().length,before);
  assert.equal(h.window['ga-disable-G-ABC123DEF4'],true);
  assert.equal(h.analytics.attributionText(),'');
  assert.equal(h.session.snapshot().length,0);
});

test('only explicit successful lead responses count and repeated confirmation is deduplicated',()=>{
  const h=harness();h.analytics.start();h.analytics.setConsent(true);
  h.analytics.track('quote_submit',{email:'private@example.test',phone:'private-phone',description:'private-project'});
  assert.equal(h.analytics.track('generate_lead'),false);
  assert.equal(h.analytics.track('form_submit'),false);
  assert.equal(h.analytics.leadConfirmed(),false);
  assert.equal(h.analytics.leadConfirmed({ok:false,status:500}),false);
  assert.equal(h.events().filter(event=>event[1]==='generate_lead').length,0);
  assert.equal(h.analytics.leadConfirmed({ok:true,email:'private@example.test'}),true);
  assert.equal(h.analytics.leadConfirmed({ok:true}),false);
  assert.equal(h.events().filter(event=>event[1]==='generate_lead').length,1);
  assert.equal(h.events().filter(event=>event[1]==='quote_submit').length,1);
  const sent=JSON.stringify(h.events());
  for(const secret of ['private@example.test','private-phone','private-project'])assert.ok(!sent.includes(secret));
  assert.ok(h.handlers.submit===undefined,'There must be no generic submit listener.');
});

test('coarse first-touch source persists across pages, without a custom visitor ID',()=>{
  const session=storage();
  const first=harness({id:'',session,url:'https://critnetworking.com/structured-cabling-raleigh?utm_source=hba&utm_medium=referral&utm_campaign=wake-contractors'});
  first.analytics.start();
  assert.match(first.analytics.attributionText(),/Source: hba\nMedium: referral\nCampaign: wake-contractors\nLanding page: \/structured-cabling-raleigh/);
  const second=harness({id:'',session,url:'https://critnetworking.com/?utm_source=facebook&utm_campaign=business-cards'});
  second.analytics.start();assert.match(second.analytics.attributionText(),/Source: hba/);
  assert.ok(!JSON.stringify(session.snapshot()).includes('visitor_id'));
  assert.ok(!JSON.stringify(session.snapshot()).includes('session_id'));
  second.advance(30*60000);
  assert.match(second.analytics.attributionText(),/Source: facebook/);
});

test('first-touch attribution expires at 24 hours despite regular activity',()=>{
  const h=harness({id:'',url:'https://critnetworking.com/?utm_source=hba'});h.analytics.start();
  h.window.location=new URL('https://critnetworking.com/?utm_source=google');
  for(let minute=20;minute<24*60;minute+=20){h.advance(20*60000);assert.match(h.analytics.attributionText(),/Source: hba/);}
  h.advance(20*60000);assert.match(h.analytics.attributionText(),/Source: google/);
});

test('unsupported campaign and source values cannot become personal analytics dimensions',()=>{
  assert.equal(boundedCampaign('private-person',APPROVED),'');
  assert.equal(boundedCampaign('private@example.test',APPROVED),'');
  assert.equal(boundedCampaign('wake-contractors',APPROVED),'wake-contractors');
  const result=sourceFor('?utm_source=private%40example.test&utm_medium=private-number&utm_campaign=private-name','https://google.com.evil.test/?email=private@example.test','https://critnetworking.com',APPROVED);
  assert.deepEqual(result,{source:'other',medium:'other',campaign:''});
  assert.deepEqual(sourceFor('','https://www.google.com/search?q=private-query','https://critnetworking.com',APPROVED),{source:'google',medium:'organic',campaign:''});
  assert.equal(sourceFor('','https://google.com.evil.test','https://critnetworking.com',APPROVED).source,'referral');
});

test('AI referrals use fixed provider labels without leaking URLs or matching misleading substrings',()=>{
  const providers=[
    ['chatgpt.com','chatgpt'],['chat.openai.com','chatgpt'],['perplexity.ai','perplexity'],
    ['claude.ai','claude'],['gemini.google.com','gemini'],['copilot.microsoft.com','copilot'],
  ];
  for(const [host,source] of providers){
    const result=sourceFor('','https://'+host+'/private-conversation?token=private-token','https://critnetworking.com',APPROVED);
    assert.deepEqual(result,{source,medium:'referral',campaign:''},host);
    assert.ok(!JSON.stringify(result).includes('private-'));
    assert.deepEqual(sourceFor('?utm_source='+host,'','https://critnetworking.com',APPROVED),{source,medium:'referral',campaign:''},'UTM '+host);
    assert.equal(sourceFor('?utm_source='+source,'','https://critnetworking.com',APPROVED).source,source);
    assert.equal(sourceFor('','https://'+host+'.unrelated.test/path','https://critnetworking.com',APPROVED).source,'referral');
    assert.equal(sourceFor('?utm_source='+host+'.unrelated.test','','https://critnetworking.com',APPROVED).source,'other');
  }
  for(const host of ['notchatgpt.com','fakeclaude.ai','notperplexity.ai','notgemini.google.com','notcopilot.microsoft.com']){
    const source=sourceFor('','https://'+host,'https://critnetworking.com',APPROVED).source;
    assert.ok(!['chatgpt','perplexity','claude','gemini','copilot'].includes(source),host);
  }
});

test('unknown paths, private tools and preview hosts cannot load Google Analytics',()=>{
  for(const url of ['https://critnetworking.com/private/client-name','https://critnetworking.com/netsurvey.html?customer=secret','https://critnetworking.com/redeem?token=secret','https://critnetworking.com/privacy','https://preview.example.test/','http://critnetworking.com/']){
    const h=harness({url});h.analytics.start();h.analytics.setConsent(true);h.analytics.track('quote_cta');
    assert.equal(h.scripts.length,0,url);assert.equal(h.events().length,0,url);
  }
  assert.equal(publicPage('/wifi-access-point-installation-raleigh.html?email=secret'),'/wifi-access-point-installation-raleigh');
  assert.equal(publicPage('/network-rack-installation-raleigh#customer-secret'),'/network-rack-installation-raleigh');
});

test('storage failures preserve functional forms and in-memory privacy choices',()=>{
  const blocked={getItem(){throw new Error('Storage unavailable');},setItem(){throw new Error('Storage unavailable');},removeItem(){throw new Error('Storage unavailable');}};
  const h=harness({id:'',session:blocked,preferences:blocked,url:'https://critnetworking.com/?utm_source=partner'});
  assert.doesNotThrow(()=>h.analytics.start());
  assert.match(h.analytics.attributionText(),/Source: partner/);
  h.window.location=new URL('https://critnetworking.com/?utm_source=google');
  assert.match(h.analytics.attributionText(),/Source: partner/);
  h.analytics.setConsent(false);assert.equal(h.analytics.attributionText(),'');
  assert.equal(h.analytics.track('quote_submit'),false);
});
