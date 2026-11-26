# CRIT Networking marketing website

Public domain: **https://critnetworking.com/**. Source repository: **badghandig-bot/critlv-com**.

This is the public marketing website. Quote requests continue to use the existing `https://app.critlv.com/api/leads` service. The employee/client FieldOps application is a separate project.

## SEO and lead reporting update

- Four original service pages for Raleigh and Wake County: structured cabling, security cameras, Wi-Fi/access points, and network racks/closets.
- Crawlable navigation, unique metadata, extensionless canonical URLs, truthful structured data, and a seven-page sitemap.
- Updated homepage language reflecting owner-scoped, technician-installed and owner-reviewed projects.
- Shared quote handling on the homepage and What We Offer, including service-page prefills, optional customer-reported source, and coarse first-touch source context.
- Optional consented GA4 events for public page views, phone/email intent, quote interactions, and accepted quote requests. Failed or duplicate requests do not become extra leads.
- Working privacy controls. Personal form fields, coupon pages, the network drawing tool, and arbitrary URLs are excluded from optional analytics.

See [docs/ANALYTICS.md](docs/ANALYTICS.md) for the event definitions, campaign links, and account configuration.

## Build and check

Node.js 20 or newer is sufficient. There are no required build dependencies.

```sh
npm run build
npm test
npm run dev
```

`scripts/dev-server.mjs` serves the built static output for local review, with noindex headers. The optional `/__preview__/mobile` route frames the actual site at a 390px viewport for browser QA; it is not in the production output. Build again after source changes before refreshing a running preview.

## Production deployment

Read [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) before publishing. The existing default Wrangler configuration and root `_redirects` belong to the **legacy critlv.com redirect Worker**. The canonical site's separate configuration is `wrangler.critnetworking.jsonc`; it publishes only the generated `dist/` assets and excludes that legacy catch-all.

Account activation is separate from code: a blank GA4 measurement ID intentionally sends no data to Google. Search Console verification is not complete merely because its public verification token is present in HTML.
