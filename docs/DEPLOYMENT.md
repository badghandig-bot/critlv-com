# CRIT Networking deployment and activation

## Correct destination

The requested destination is `https://critnetworking.com/`, historically served by the Cloudflare Worker named `critnetworking`. Confirm the current Worker/domain association in the owner's Cloudflare dashboard before publishing. The separate `critlv` Worker is the legacy domain redirect, and FieldOps at `app.critlv.com` must not receive this build.

The root `wrangler.jsonc` and `_redirects` remain dedicated to that legacy redirect. Do not deploy the repository root as the canonical site's static directory: its catch-all redirect would point the canonical domain at itself. The new explicit build produces `dist/` with only public HTML/assets and canonical page redirects.

After confirming the Cloudflare account and Worker:

```sh
npm run build
npm test
npx wrangler deploy --config wrangler.critnetworking.jsonc
```

The production profile also runs the build before a Wrangler deployment. It does not add or transfer custom domains, change DNS, or alter account permissions. Select the existing production account through the normal authenticated Cloudflare workflow; do not guess an account ID or put a credential in source control.

The generated output contains 301 redirects from legacy `.html` URLs to their clean canonical paths and a real 404 page. It deliberately excludes local scripts, tests, documentation, repository state, runtime credentials and the root legacy redirect rule. Existing Google verification HTML is preserved.

## Analytics activation

1. Create or select the owner's GA4 property and a web stream for `https://critnetworking.com`. Google may require the owner to accept its terms when first creating an Analytics account.
2. Turn **Enhanced Measurement off** for this web stream. The site explicitly sends only sanitized, approved events; automatic form, outbound, search, and history events could duplicate or bypass those limits.
3. Copy the actual `G-…` measurement ID into `assets/analytics-config.js`. Keep `allowedHosts` restricted to the public CRIT domain. Advertising features remain off.
4. Rebuild and deploy. Allow optional analytics in a controlled public-site visit, then check GA4 Realtime/DebugView for the clean page/event. Mark `generate_lead` as a key event. Do not create a real lead just to test tracking unless the owner asks for that operational test; mocked tests cover success and failure paths.
5. Use Acquisition for traffic sources and Engagement/Events for intent actions. Phone/email clicks are intent, not proof a conversation occurred. This release does not measure booked revenue or completed calls.

Coarse first-party source context already accompanies an operational quote when the visitor has not opted out; the explicit “How did you hear about CRIT?” answer is kept distinct. No new database or fake dashboard totals were added.

## Search Console activation

A URL-prefix property for `https://critnetworking.com/` was prepared under the signed-in `critnetworking@gmail.com` account. The new homepage contains the exact public HTML verification tag returned by that property. It remains **unverified until the tag is published and Google verifies it**. Keep the pre-existing verification file too, to preserve any other authorized owner.

After publication, use HTML-tag verification in the prepared property, then submit `https://critnetworking.com/sitemap.xml`. Confirm the seven canonical URLs are reachable. Search Console provides Google search impressions, clicks, queries and CTR; GA4 covers opted-in activity after arrival. Neither code deployment nor sitemap submission guarantees indexing or traffic.

## Verification performed in source

Automated checks cover event privacy, consent and browser privacy signals; first-touch bounds and approved campaign names; accepted versus rejected lead requests; duplicate submission protection; service prefills; canonical metadata and structured data; internal links and assets; sitemap membership; production redirects; and build exclusions. Browser review checks the actual layout, navigation, quote presets, and privacy controls. The API tests use mocks, not live customer records or external messages.

## References

- https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/
- https://developers.cloudflare.com/workers/static-assets/redirects/
- https://developers.google.com/analytics/devguides/collection/ga4/events
- https://support.google.com/analytics/answer/9304153
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
