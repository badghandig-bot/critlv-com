# CRIT website analytics

## What works now

The website has a small analytics interface with a deliberately blank GA4 measurement ID. A blank ID sends no events to Google and loads no Google tag. No analytics property, traffic history or connection is implied by installing these files.

Known source labels can accompany a quote request immediately, even before GA4 is configured. They contain only source, medium, an approved campaign label and a known public landing path. They are held in this browser tab for up to 30 minutes of inactivity, with a 24-hour maximum. There is no custom visitor identifier. Declining analytics, Do Not Track or Global Privacy Control also suppresses these source labels.

When the visitor's preference is **unset**, this coarse first-party quote context is available automatically; Google Analytics remains unloaded until an explicit opt-in. Source context is transmitted to CRIT only when the visitor actually submits a quote request. An explicitly selected “How did you hear about us?” answer is separate, user-provided lead information and may still accompany the request when automatic attribution is off.

## HTML integration

Load these scripts in order, preferably using `defer`:

```html
<script defer src="/assets/analytics-config.js"></script>
<script defer src="/assets/analytics.js"></script>
```

Add an accessible footer control:

```html
<button type="button" data-crit-privacy>Analytics choices</button>
```

The module automatically recognizes phone links, email links, links to `#contact`, and the first field focus in `#lead-form`. It does **not** read field values, attach a generic form-submit listener, or assume a clicked link generated a lead.

In each quote form's existing submit handler, append the source block to the payload description before the request:

```js
const source = window.CritAnalytics?.attributionText();
if (source) payload.description = [payload.description, source].filter(Boolean).join('\n\n');
window.CritAnalytics?.track('quote_submit');

const res = await fetch('https://app.critlv.com/api/leads', { /* existing options */ });
if (!res.ok) { /* keep the existing failure handling */ }
// Only after the actual success check:
window.CritAnalytics?.leadConfirmed({ok: res.ok});
```

`leadConfirmed` ignores missing/false success values and repeated calls for the same page. `track('generate_lead')` is rejected. The API accepts no caller-provided analytics fields: do not pass form values, contact details, lead IDs or an API response body.

## Connect a real GA4 stream

1. Use the owner's actual GA4 property and web stream for `https://critnetworking.com`. Copy its real `G-…` measurement ID into `assets/analytics-config.js`. Do not use a sample ID.
2. Turn **Enhanced Measurement off for this web stream**. The site sends its own clean page views and selected actions. In particular, automatic form interactions, site search, outbound clicks and history-based page views must not add unsanitized URL/form metadata or duplicate events.
3. Do not add a second Google tag or Google Tag Manager installation for the same stream. Review any Google Ads destination or user-provided-data collection separately; this implementation does not enable either.
4. Mark `generate_lead` as a key event. It records confirmed lead-API success, not qualified leads, contracts or revenue. No lead value is invented.
5. If the `first_landing_page` event parameter is needed in custom reporting, register it as an event-scoped custom dimension. Built-in traffic acquisition reports use the source/medium/campaign fields.
6. Check Realtime or DebugView with one consented test visit. Test success and failure paths using a mocked API or a clearly authorized test lead; do not send fabricated customer requests into the live lead system merely to test analytics.

Google Analytics is loaded only after an explicit opt-in. Advertising consent remains denied, advertising personalization and Google signals are disabled, and the optional Analytics cookie lifetime is limited to 90 days without automatic extension. The choice is remembered for 180 days. Browser privacy signals take precedence over an earlier opt-in.

### Events

| Event | Meaning |
| --- | --- |
| `page_view` | A known public page viewed after consent; canonical URL excludes query and fragment. |
| `click_to_call` | A phone link was clicked; it does not prove a call connected. |
| `email_click` | An email link was clicked; it does not prove an email was sent. |
| `quote_cta` | A link to the contact/quote section was clicked. |
| `quote_start` | First interaction with a field in the quote form on this page. |
| `quote_submit` | The existing quote handler attempted a submission. |
| `generate_lead` | The actual lead endpoint returned success and the success hook ran. |

Known marketing-page paths and fixed page titles are defined in `assets/analytics.js`. Privacy, redemption, network-survey and unknown paths are not measured. The Privacy page may load the module solely to make the preferences control work. `page_referrer` is deliberately empty, and raw referrer URLs, query strings, fragments, ad-click IDs, search terms and user-entered fields are not included in the events sent by this module. Google Analytics itself still receives ordinary network/device information for consented requests; these reports should not be described as fully anonymous or complete counts of visitors.

## Campaign labels

Only approved values in `allowedCampaigns` are included. The initial labels are `google-business-profile`, `wake-contractors`, `business-cards`, and `referral-partners`. Add other short non-personal labels there before using them in a link. For example:

```text
https://critnetworking.com/structured-cabling-raleigh?utm_source=google&utm_medium=organic&utm_campaign=google-business-profile
```

Recognized sources include `google`, `bing`, `duckduckgo`, `yahoo`, `brave`, `chatgpt`, `perplexity`, `claude`, `gemini`, `copilot`, `facebook`, `instagram`, `linkedin`, `yelp`, `hba`, `partner`, and `newsletter`. AI-provider referrals use the fixed provider label with a default `referral` medium; conversation URLs and their query values are discarded. Known provider-domain UTM sources, such as `utm_source=chatgpt.com`, normalize to the same provider label. Unsupported sources become `other`; unsupported campaign values are discarded. Never put customer names, emails, phone numbers, addresses or private identifiers in campaign labels.

## Public API

`window.CritAnalytics` exposes `track(name)`, `leadConfirmed({ok:true})`, `attributionText()`, `openPreferences()`, `setConsent(boolean)`, `status()`, `pageView()` and idempotent `start()`.

`status().configured` means an ID exists. `status().script_requested` means the browser attempted to load the tag. Neither proves Google received an event. Hosted previews and unknown paths are excluded from Google collection by default.

## Primary references

- [Google: basic consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Google: consent implementation](https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic)
- [Google: manual page views and Enhanced Measurement](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Google: GA4 configuration fields](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [Google: recommended `generate_lead` event](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [Google: programmatic collection opt-out](https://developers.google.com/tag-platform/security/guides/privacy)
