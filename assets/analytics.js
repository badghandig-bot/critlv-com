/* CRIT Networking: bounded first-party attribution + optional consented GA4.
 * Public API deliberately accepts no arbitrary analytics parameters/form data.
 */
(function (root, factory) {
  'use strict';
  var library = factory();
  if (typeof module === 'object' && module.exports) module.exports = library;
  if (root && root.document && !root.CritAnalytics) {
    root.CritAnalytics = library.createAnalytics({window:root, document:root.document,
      navigator:root.navigator, config:root.CritAnalyticsConfig || {}});
    root.CritAnalytics.start();
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var ATTRIBUTION_KEY='crit-attribution-v1', CONSENT_KEY='crit-analytics-consent-v1';
  var IDLE_MS=30*60*1000, MAX_SESSION_MS=24*60*60*1000, CONSENT_MS=180*24*60*60*1000;
  var EVENTS=['click_to_call','email_click','quote_start','quote_cta','quote_submit'];
  var SOURCES=['direct','google','bing','duckduckgo','yahoo','brave','chatgpt','perplexity','claude','gemini','copilot','facebook','instagram','linkedin','yelp','hba','partner','newsletter','referral','other'];
  var MEDIA=['direct','organic','cpc','paid_social','social','referral','email','offline','other'];
  var PAGES={
    '/':'CRIT Networking | Raleigh Low-Voltage Contractor',
    '/what-we-offer':'Low-Voltage Services | CRIT Networking',
    '/structured-cabling-raleigh':'Structured Cabling in Raleigh | CRIT Networking',
    '/security-camera-installation-raleigh':'Security Camera Installation in Raleigh | CRIT Networking',
    '/wifi-access-point-installation-raleigh':'Wi-Fi Access Point Installation in Raleigh | CRIT Networking',
    '/network-rack-installation-raleigh':'Network Rack Installation in Raleigh | CRIT Networking',
    '/careers':'Careers | CRIT Networking',
  };
  function includes(list,value){return list.indexOf(value)!==-1;}
  function boundedCampaign(value,approved){
    return typeof value==='string' && /^[a-z0-9][a-z0-9_-]{0,47}$/.test(value) && includes(approved || [],value) ? value : '';
  }
  function publicPage(value){
    try {
      var path=new URL(value,'https://critnetworking.com').pathname;
      if(path==='/index.html')path='/';
      if(path==='/careers.html')path='/careers';
      if(path==='/what-we-offer.html')path='/what-we-offer';
      if(/^\/(?:structured-cabling-raleigh|security-camera-installation-raleigh|wifi-access-point-installation-raleigh|network-rack-installation-raleigh)\.html$/.test(path))path=path.slice(0,-5);
      return Object.prototype.hasOwnProperty.call(PAGES,path)?path:null;
    }catch(_error){return null;}
  }
  function privacySignal(nav){return !!(nav && (nav.doNotTrack==='1' || nav.doNotTrack==='yes' || nav.globalPrivacyControl===true));}
  function sourceFor(search,referrer,origin,approvedCampaigns){
    var parameters=new URLSearchParams(search || ''), raw=(parameters.get('utm_source') || '').toLowerCase();
    var source='direct', medium='direct';
    if(raw){
      var aliases={'chatgpt.com':'chatgpt','chat.openai.com':'chatgpt','perplexity.ai':'perplexity','claude.ai':'claude','gemini.google.com':'gemini','copilot.microsoft.com':'copilot'};
      source=includes(SOURCES,raw)?raw:Object.prototype.hasOwnProperty.call(aliases,raw)?aliases[raw]:raw==='google_business_profile'?'google':raw==='email'?'newsletter':'other';
    }else if(referrer){
      try{
        var from=new URL(referrer), site=new URL(origin);
        if(from.origin!==site.origin && !((from.hostname==='www.critnetworking.com' || from.hostname==='critnetworking.com') && (site.hostname==='www.critnetworking.com' || site.hostname==='critnetworking.com'))){
          var host=from.hostname.toLowerCase();
          source=/(^|\.)chatgpt\.com$/.test(host) || host==='chat.openai.com'?'chatgpt':
            /(^|\.)perplexity\.ai$/.test(host)?'perplexity':/(^|\.)claude\.ai$/.test(host)?'claude':
            host==='gemini.google.com'?'gemini':host==='copilot.microsoft.com'?'copilot':
            /(^|\.)google\.(com|[a-z]{2,3}|co\.[a-z]{2})$/.test(host)?'google':
            /(^|\.)bing\.com$/.test(host)?'bing':/(^|\.)duckduckgo\.com$/.test(host)?'duckduckgo':
            /(^|\.)search\.yahoo\.com$/.test(host)?'yahoo':/(^|\.)search\.brave\.com$/.test(host)?'brave':
            /(^|\.)facebook\.com$/.test(host)?'facebook':/(^|\.)instagram\.com$/.test(host)?'instagram':
            /(^|\.)linkedin\.com$/.test(host)?'linkedin':/(^|\.)yelp\.com$/.test(host)?'yelp':'referral';
        }
      }catch(_error){/* Unknown referrers are not stored. */}
    }
    medium=includes(['google','bing','duckduckgo','yahoo','brave'],source)?'organic':
      includes(['facebook','instagram','linkedin'],source)?'social':source==='newsletter'?'email':source==='direct'?'direct':source==='other'?'other':'referral';
    var suppliedMedium=(parameters.get('utm_medium') || '').toLowerCase();
    if(includes(MEDIA,suppliedMedium))medium=suppliedMedium;
    return {source:source,medium:medium,campaign:boundedCampaign(parameters.get('utm_campaign'),approvedCampaigns)};
  }

  function createAnalytics(options){
    options=options || {};
    var win=options.window, doc=options.document || (win && win.document), nav=options.navigator || (win && win.navigator) || {};
    var config=options.config || {}, clock=options.now || Date.now;
    var measurementId=typeof config.measurementId==='string' && /^G-[A-Z0-9]{6,20}$/.test(config.measurementId)?config.measurementId:'';
    var allowedHosts=Array.isArray(config.allowedHosts)?config.allowedHosts:['critnetworking.com','www.critnetworking.com'];
    var campaigns=(Array.isArray(config.allowedCampaigns)?config.allowedCampaigns:[]).filter(function(value){return typeof value==='string' && /^[a-z0-9][a-z0-9_-]{0,47}$/.test(value);});
    var origin='https://critnetworking.com';
    try{var configured=new URL(config.canonicalOrigin || origin);if(configured.protocol==='https:' && includes(allowedHosts,configured.hostname) && !configured.username && !configured.password)origin=configured.origin;}catch(_error){}
    var sessionStore=options.sessionStorage, preferenceStore=options.localStorage;
    if(sessionStore===undefined){try{sessionStore=win.sessionStorage;}catch(_error){sessionStore=null;}}
    if(preferenceStore===undefined){try{preferenceStore=win.localStorage;}catch(_error){preferenceStore=null;}}
    var memoryAttribution=null, memoryConsent=null, started=false, initialized=false, scriptRequested=false;
    var pageSent=false, quoteStarted=false, leadReported=false;

    function locationInfo(){
      try{return new URL(win.location.href);}catch(_error){return new URL(origin);}
    }
    function currentPage(){return publicPage(locationInfo().href);}
    function productionHost(){var location=locationInfo();return location.protocol==='https:' && includes(allowedHosts,location.hostname);}
    function readConsent(){
      if(memoryConsent)return memoryConsent;
      try{
        var stored=JSON.parse(preferenceStore && preferenceStore.getItem(CONSENT_KEY) || 'null');
        if(stored && includes(['granted','denied'],stored.value) && Number.isFinite(stored.updated_at) && clock()>=stored.updated_at && clock()-stored.updated_at<CONSENT_MS)return stored.value;
      }catch(_error){}
      return 'unset';
    }
    function optedOut(){return privacySignal(nav) || readConsent()==='denied';}
    function consented(){return readConsent()==='granted' && !privacySignal(nav);}
    function configuredHere(){return !!measurementId && productionHost() && currentPage()!==null;}
    function active(){return configuredHere() && consented();}
    function clearAttribution(){memoryAttribution=null;try{if(sessionStore)sessionStore.removeItem(ATTRIBUTION_KEY);}catch(_error){}}
    function attribution(){
      if(optedOut() || currentPage()===null)return null;
      var stamp=clock(), stored=memoryAttribution;
      if(!stored){try{stored=JSON.parse(sessionStore && sessionStore.getItem(ATTRIBUTION_KEY) || 'null');}catch(_error){}}
      if(stored && includes(SOURCES,stored.source) && includes(MEDIA,stored.medium) && (!stored.campaign || boundedCampaign(stored.campaign,campaigns)) && publicPage(stored.landing_page)===stored.landing_page && Number.isFinite(stored.started_at) && Number.isFinite(stored.last_seen) && stamp>=stored.started_at && stamp>=stored.last_seen && stored.last_seen>=stored.started_at && stamp-stored.last_seen<IDLE_MS && stamp-stored.started_at<MAX_SESSION_MS){
        stored.last_seen=stamp;
      }else{
        var location=locationInfo(), first=sourceFor(location.search,doc && doc.referrer,location.origin,campaigns);
        stored={source:first.source,medium:first.medium,campaign:first.campaign,landing_page:currentPage() || '/',started_at:stamp,last_seen:stamp};
      }
      memoryAttribution=stored;
      try{if(sessionStore)sessionStore.setItem(ATTRIBUTION_KEY,JSON.stringify(stored));}catch(_error){}
      return {source:stored.source,medium:stored.medium,campaign:stored.campaign,landing_page:stored.landing_page};
    }
    function safeParameters(){
      var page=currentPage(), first=attribution() || {source:'direct',medium:'direct',campaign:'',landing_page:page || '/'};
      return {send_to:measurementId,page_location:origin+(page || '/'),page_title:PAGES[page] || PAGES['/'],page_referrer:'',
        campaign_source:first.source,campaign_medium:first.medium,campaign_name:first.campaign,
        campaign_id:'',campaign_term:'',campaign_content:'',first_landing_page:first.landing_page};
    }
    function command(){
      win.dataLayer=win.dataLayer || [];
      if(typeof win.gtag!=='function')win.gtag=function(){win.dataLayer.push(arguments);};
      win.gtag.apply(win,arguments);
    }
    function initializeTag(){
      if(!active())return false;
      win['ga-disable-'+measurementId]=false;
      if(initialized)return true;
      initialized=true;
      command('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      command('set','ads_data_redaction',true);
      command('set','url_passthrough',false);
      command('js',new Date(clock()));
      command('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      command('config',measurementId,Object.assign(safeParameters(),{send_page_view:false,allow_google_signals:false,
        allow_ad_personalization_signals:false,cookie_expires:90*24*60*60,cookie_update:false,cookie_flags:'SameSite=Lax;Secure'}));
      var script=doc.createElement('script');
      script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(measurementId);
      script.referrerPolicy='no-referrer';script.id='crit-ga4-tag';
      doc.head.appendChild(script);scriptRequested=true;
      return true;
    }
    function send(name){
      if(!active() || !initializeTag())return false;
      var params=safeParameters();
      if(name==='generate_lead')params.lead_source=params.campaign_source;
      command('event',name,params);
      return true;
    }
    function pageView(){if(pageSent || !send('page_view'))return false;pageSent=true;return true;}
    function track(name){
      if(!includes(EVENTS,name))return false;
      if(name==='quote_start' && quoteStarted)return false;
      var sent=send(name);if(sent && name==='quote_start')quoteStarted=true;
      return sent;
    }
    function leadConfirmed(response){
      // Call only after the real lead API responds successfully. A button click,
      // submit attempt, thrown request, or non-2xx response is never a lead.
      if(leadReported || !response || response.ok!==true)return false;
      leadReported=true;
      return send('generate_lead');
    }
    function attributionText(){
      var first=attribution();if(!first)return '';
      return 'Website source (first touch; approximate):\nSource: '+first.source+'\nMedium: '+first.medium+
        (first.campaign?'\nCampaign: '+first.campaign:'')+'\nLanding page: '+first.landing_page;
    }
    function removePrompt(){var prompt=doc && doc.getElementById('crit-analytics-prompt');if(prompt)prompt.remove();}
    function clearOwnCookies(){
      if(!doc || !measurementId)return;
      var host=locationInfo().hostname, names=['_ga','_ga_'+measurementId.slice(2)];
      names.forEach(function(name){['',host,'.critnetworking.com'].forEach(function(domain){
        try{doc.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+(domain?'; Domain='+domain:'');}catch(_error){}
      });});
    }
    function setConsent(allow){
      memoryConsent=allow===true?'granted':'denied';
      try{if(preferenceStore)preferenceStore.setItem(CONSENT_KEY,JSON.stringify({value:memoryConsent,updated_at:clock()}));}catch(_error){}
      if(!consented()){
        if(measurementId)win['ga-disable-'+measurementId]=true;
        clearAttribution();clearOwnCookies();
        if(initialized)command('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      }else{
        if(initialized){win['ga-disable-'+measurementId]=false;command('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});}
        pageView();
      }
      removePrompt();return status();
    }
    function status(){return {configured:!!measurementId,enabled:active(),consent:readConsent(),privacy_signal:privacySignal(nav),production_host:productionHost(),script_requested:scriptRequested};}

    function addStyles(){
      if(doc.getElementById('crit-analytics-styles'))return;
      var style=doc.createElement('style');style.id='crit-analytics-styles';
      style.textContent='.crit-privacy{font:14px/1.6 system-ui,sans-serif;color:#f5f5f5;background:#172024;border:1px solid #45535b;border-radius:12px;padding:22px;box-shadow:0 16px 48px #0004;max-width:440px;box-sizing:border-box}.crit-privacy h2{font-size:18px;line-height:1.3;margin:0 0 10px;color:#fff}.crit-privacy p{margin:10px 0;color:#d0d9de}.crit-privacy-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:17px}.crit-privacy button{font:600 13px/1.3 system-ui,sans-serif;cursor:pointer;border:1px solid #71828b;border-radius:6px;background:transparent;color:#fff;padding:11px 14px;min-height:40px}.crit-privacy button[data-allow]{background:#f2c84b;border-color:#f2c84b;color:#172024}.crit-privacy button:disabled{opacity:.5;cursor:default}.crit-privacy button:focus-visible{outline:3px solid #7be6f0;outline-offset:3px}#crit-analytics-prompt{position:fixed;bottom:18px;left:18px;right:18px;z-index:1000}dialog.crit-privacy{width:calc(100% - 32px);max-width:510px;margin:auto;padding:26px}dialog.crit-privacy::backdrop{background:#0009}.crit-privacy-small{font-size:12px!important;color:#afbec6!important}@media(max-width:520px){#crit-analytics-prompt{bottom:10px;left:10px;right:10px}.crit-privacy{padding:18px}.crit-privacy-actions button{flex:1}.crit-privacy p{font-size:13px}}';
      doc.head.appendChild(style);
    }
    function showPrompt(){
      if(!doc || !doc.body || !configuredHere() || privacySignal(nav) || readConsent()!=='unset' || doc.getElementById('crit-analytics-prompt'))return false;
      addStyles();var box=doc.createElement('section');box.id='crit-analytics-prompt';box.className='crit-privacy';
      box.setAttribute('role','region');box.setAttribute('aria-label','Optional analytics');
      box.innerHTML='<h2>Help us improve the site?</h2><p>Optional Google Analytics cookies help us understand visits and quote requests. Your contact details and form answers are not included in our analytics events.</p><div class="crit-privacy-actions"><button type="button" data-allow>Allow analytics</button><button type="button" data-deny>No thanks</button><button type="button" data-details>Details</button></div>';
      box.querySelector('[data-allow]').onclick=function(){setConsent(true);};
      box.querySelector('[data-deny]').onclick=function(){setConsent(false);};
      box.querySelector('[data-details]').onclick=openPreferences;
      doc.body.appendChild(box);return true;
    }
    function openPreferences(){
      if(!doc || !doc.body)return false;
      var existing=doc.getElementById('crit-analytics-preferences');if(existing){if(typeof existing.showModal==='function' && !existing.open)existing.showModal();return true;}
      addStyles();var dialog=doc.createElement('dialog'), focusBefore=doc.activeElement;
      dialog.id='crit-analytics-preferences';dialog.className='crit-privacy';dialog.setAttribute('aria-labelledby','crit-privacy-title');
      var current=status();
      dialog.innerHTML='<h2 id="crit-privacy-title">Your analytics choices</h2><p>'+(current.configured?'You can allow optional Google Analytics cookies to help us measure visits, contact clicks and successful quote requests.':'Optional Google Analytics is currently off on this site.')+'</p><p>We send only known page names, approved campaign labels and selected actions. Our analytics events do not include names, email addresses, phone numbers or project descriptions.</p><p class="crit-privacy-small">A short source label may accompany a quote you choose to submit. Declining analytics or using Do Not Track or Global Privacy Control also turns that source label off. Your quote form continues to work.</p>'+(current.privacy_signal?'<p>Your browser privacy signal is active. Optional analytics stays off.</p>':'')+'<div class="crit-privacy-actions">'+(current.configured?'<button type="button" data-allow '+(current.privacy_signal?'disabled':'')+'>Allow analytics</button>':'')+'<button type="button" data-deny>Keep analytics off</button><button type="button" data-close>Close</button></div>';
      function close(){if(typeof dialog.close==='function')dialog.close();dialog.remove();if(focusBefore && typeof focusBefore.focus==='function')focusBefore.focus();}
      var allow=dialog.querySelector('[data-allow]');if(allow)allow.onclick=function(){setConsent(true);close();};
      dialog.querySelector('[data-deny]').onclick=function(){setConsent(false);close();};
      dialog.querySelector('[data-close]').onclick=close;
      dialog.addEventListener('cancel',function(event){event.preventDefault();close();});
      doc.body.appendChild(dialog);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
      return true;
    }
    function bind(){
      if(!doc || typeof doc.addEventListener!=='function')return;
      doc.addEventListener('click',function(event){
        var target=event.target && typeof event.target.closest==='function'?event.target.closest('a[href], [data-crit-event], [data-crit-privacy]'):null;
        if(!target)return;
        if(target.hasAttribute('data-crit-privacy')){event.preventDefault();openPreferences();return;}
        var declared=target.getAttribute('data-crit-event');
        if(declared){track(declared);return;}
        var href=target.getAttribute('href') || '';
        if(/^tel:/i.test(href)){track('click_to_call');return;}
        if(/^mailto:/i.test(href)){track('email_click');return;}
        try{var url=new URL(href,locationInfo().href);if(url.hash==='#contact' && includes(allowedHosts,url.hostname))track('quote_cta');}catch(_error){}
      });
      doc.addEventListener('focusin',function(event){
        var target=event.target;
        if(target && typeof target.closest==='function' && target.closest('#lead-form') && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))track('quote_start');
      });
    }
    function start(){
      if(started)return status();started=true;
      if(optedOut()){if(measurementId)win['ga-disable-'+measurementId]=true;clearAttribution();}
      else attribution();
      bind();pageView();
      if(config.promptForConsent!==false){
        if(doc && doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',showPrompt,{once:true});else showPrompt();
      }
      return status();
    }
    return {start:start,track:track,pageView:pageView,leadConfirmed:leadConfirmed,attributionText:attributionText,
      setConsent:setConsent,status:status,openPreferences:openPreferences,showPrompt:showPrompt};
  }
  return {createAnalytics:createAnalytics,sourceFor:sourceFor,publicPage:publicPage,boundedCampaign:boundedCampaign,privacySignal:privacySignal};
});
