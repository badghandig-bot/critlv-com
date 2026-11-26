import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {before, test} from 'node:test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ORIGIN = 'https://critnetworking.com';
const SERVICES = [
  '/structured-cabling-raleigh',
  '/security-camera-installation-raleigh',
  '/wifi-access-point-installation-raleigh',
  '/network-rack-installation-raleigh',
];
const INDEXABLE = ['/', '/careers', '/what-we-offer', ...SERVICES];
const NONINDEXABLE = ['/privacy', '/redeem', '/netsurvey'];
const PAGES = [...INDEXABLE, ...NONINDEXABLE];
const htmlCache = new Map();

before(() => {
  assert.ok(existsSync(path.join(DIST, 'index.html')),
    'Build the deployable site with node scripts/build-site.mjs before running integration checks.');
});

function read(relative) {
  return readFileSync(path.join(DIST, relative), 'utf8');
}

function decode(value = '') {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function attribute(tag, name) {
  const match = tag.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(["\\\'])([\\s\\S]*?)\\1', 'i'));
  return match ? decode(match[2]) : null;
}

function tags(html, tagName) {
  return [...html.matchAll(new RegExp('<' + tagName + '\\b[^>]*>', 'gi'))].map(match => match[0]);
}

function pageFile(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/\/$/, '') || '/';
  const relative = clean === '/' ? 'index.html' : clean.slice(1);
  const candidates = [relative, relative + '.html', path.join(relative, 'index.html')];
  return candidates.find(candidate => {
    const file = path.resolve(DIST, candidate);
    return file.startsWith(DIST + path.sep) && existsSync(file) && statSync(file).isFile();
  });
}

function page(urlPath) {
  if (htmlCache.has(urlPath)) return htmlCache.get(urlPath);
  const file = pageFile(urlPath);
  assert.ok(file, `Published route ${urlPath} must resolve to a built file`);
  const html = read(file);
  htmlCache.set(urlPath, html);
  return html;
}

function canonical(html) {
  const links = tags(html, 'link').filter(tag => attribute(tag, 'rel') === 'canonical');
  assert.equal(links.length, 1, 'Each page must declare exactly one canonical URL');
  return attribute(links[0], 'href');
}

function meta(html, name, key = 'name') {
  return tags(html, 'meta').find(tag => attribute(tag, key) === name);
}

function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(nodes)];
}

function structuredData(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(match => attribute(match[1], 'type') === 'application/ld+json')
    .map(match => JSON.parse(match[2]));
}

function visibleMarkup(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function allFiles(directory, prefix = '') {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const relative = path.join(prefix, entry.name);
    return entry.isDirectory() ? allFiles(path.join(directory, entry.name), relative) : [relative];
  });
}

test('the deployment includes public assets and verification, not repository or account material', () => {
  const files = allFiles(DIST);
  for (const file of files) {
    assert.doesNotMatch(file, /(^|[\\/])(?:\.git|\.env(?:\..*)?|node_modules|tests|scripts|config|docs)(?:[\\/]|$)/,
      `Private/source-only material must not deploy: ${file}`);
    assert.doesNotMatch(path.basename(file), /^(?:wrangler.*|package(?:-lock)?\.json|AGENTS\.md|README.*|.*\.zip)$/i,
      `Source configuration must not deploy: ${file}`);
  }
  const verification = 'googlefc1784d816b4d01d.html';
  assert.equal(read(verification), readFileSync(path.join(ROOT, verification), 'utf8'),
    'Preserve the existing public Search Console verification file byte for byte');
  assert.ok(existsSync(path.join(DIST, '_redirects')));
  assert.notEqual(read('_redirects'), readFileSync(path.join(ROOT, '_redirects'), 'utf8'),
    'The canonical production site must not inherit the legacy catch-all redirect');
});

test('every public page has one canonical and the service landing pages have distinct search identities', () => {
  const titles = new Set();
  for (const route of PAGES) {
    const html = page(route);
    assert.equal(canonical(html), ORIGIN + route, `${route}: clean production canonical`);
    const titleTags = [...html.matchAll(/<title>([\s\S]*?)<\/title>/gi)];
    assert.equal(titleTags.length, 1, `${route}: exactly one document title`);
    const title = decode(titleTags[0][1]).trim();
    assert.ok(title.length > 12, `${route}: descriptive document title`);
    assert.ok(!titles.has(title), `${route}: duplicate document title`);
    titles.add(title);
    if (SERVICES.includes(route)) {
      assert.match(title, /Raleigh/i);
      assert.match(title, /CRIT Networking/i);
      const description = attribute(meta(html, 'description') || '', 'content');
      assert.ok(description && description.length > 60, `${route}: meaningful search description`);
      assert.equal(attribute(meta(html, 'og:url', 'property') || '', 'content'), ORIGIN + route);
      assert.equal(tags(visibleMarkup(html), 'h1').length, 1, `${route}: one clear page heading`);
      const image = attribute(meta(html, 'og:image', 'property') || '', 'content');
      assert.ok(image, `${route}: share-preview image`);
      const imageUrl = new URL(image);
      assert.equal(imageUrl.origin, ORIGIN);
      assert.ok(pageFile(imageUrl.pathname), `${route}: share image exists in deployment`);
    }
  }
});

test('service structured data is valid JSON and agrees with the page and provider', () => {
  for (const route of SERVICES) {
    const graphs = structuredData(page(route));
    assert.ok(graphs.length, `${route}: structured data exists`);
    const graphNodes = graphs.flatMap(nodes);
    const service = graphNodes.find(node => node['@type'] === 'Service' && node.url === ORIGIN + route);
    assert.ok(service, `${route}: a Service describes this page's actual canonical URL`);
    assert.ok(service.name && service.description && service.serviceType);
    assert.equal(service.provider?.name, 'CRIT Networking');
    assert.equal(service.provider?.url, ORIGIN + '/');
    assert.equal(String(service.provider?.telephone).replace(/\D/g, ''), '17543480736');
    assert.ok(service.areaServed?.length, `${route}: actual service area is supplied`);
    for (const node of graphNodes) {
      assert.ok(!Object.hasOwn(node, 'aggregateRating'), 'Do not manufacture customer-rating markup');
      for (const key of ['url', 'item']) {
        if (typeof node[key] !== 'string' || !node[key].startsWith(ORIGIN)) continue;
        const target = new URL(node[key]);
        assert.ok(pageFile(target.pathname), `${route}: JSON-LD links to deployed ${node[key]}`);
      }
    }
  }
});

test('sitemap contains exactly the intended indexable canonical pages', () => {
  const xml = read('sitemap.xml');
  assert.match(xml, /<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/);
  const urls = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map(match => decode(match[1].trim()));
  assert.equal(new Set(urls).size, urls.length, 'Sitemap URLs must not be duplicated');
  assert.deepEqual([...urls].sort(), INDEXABLE.map(route => ORIGIN + route).sort());
  for (const href of urls) {
    const url = new URL(href);
    assert.equal(url.origin, ORIGIN);
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    const html = page(url.pathname);
    assert.equal(canonical(html), href);
    assert.doesNotMatch(attribute(meta(html, 'robots') || '', 'content') || '', /noindex/i);
  }
  assert.match(read('robots.txt'), /Sitemap:\s*https:\/\/critnetworking\.com\/sitemap\.xml/);
  assert.doesNotMatch(read('robots.txt'), /^\s*Disallow:\s*\/\s*$/m, 'Do not block the public site');
});

test('private utility and coupon pages stay out of indexing while remaining reachable', () => {
  for (const route of NONINDEXABLE) {
    const html = page(route);
    assert.match(attribute(meta(html, 'robots') || '', 'content') || '', /(?:^|[,\s])noindex(?:$|[,\s])/i,
      `${route}: explicit noindex directive`);
  }
});

test('internal links, document anchors and locally loaded page assets resolve in the final build', () => {
  for (const route of PAGES) {
    const html = visibleMarkup(page(route));
    for (const tag of tags(html, 'a')) {
      const href = attribute(tag, 'href');
      if (!href || href === '#' || /^(?:mailto|tel):/i.test(href)) continue;
      assert.doesNotMatch(href, /^(?:javascript|data):/i, `${route}: unsafe navigation target`);
      const url = new URL(href, ORIGIN + route);
      if (url.origin !== ORIGIN) continue;
      const targetFile = pageFile(url.pathname);
      assert.ok(targetFile, `${route} links to missing ${href}`);
      if (url.hash) {
        const id = decodeURIComponent(url.hash.slice(1));
        const targets = tags(visibleMarkup(read(targetFile)), '[a-z][a-z0-9:-]*');
        assert.ok(targets.some(target => attribute(target, 'id') === id || attribute(target, 'name') === id),
          `${route} links to missing anchor ${href}`);
      }
    }
    for (const tag of [...tags(page(route), 'script'), ...tags(html, 'img'), ...tags(html, 'link')]) {
      const src = attribute(tag, 'src') || (attribute(tag, 'rel') === 'stylesheet' ? attribute(tag, 'href') : null);
      if (!src || src.startsWith('data:')) continue;
      const url = new URL(src, ORIGIN + route);
      if (url.origin === ORIGIN) assert.ok(pageFile(url.pathname), `${route} requires missing asset ${src}`);
    }
  }
});

test('production redirects do not send canonical visitors into a loop', () => {
  const rules = read('_redirects').split(/\r?\n/).map(line => line.trim())
    .filter(line => line && !line.startsWith('#')).map(line => {
      const [source, target, status] = line.split(/\s+/);
      assert.ok(source && target, `Invalid production redirect: ${line}`);
      const absolute = /^https?:\/\//.test(source);
      const expression = source.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*)');
      return {source, target, status: Number(status || 302), absolute, matcher: new RegExp('^' + expression + '$')};
    });
  for (const route of PAGES) {
    for (const start of [ORIGIN + route, ORIGIN + (route === '/' ? '/index.html' : route + '.html')]) {
      let current = new URL(start);
      const seen = new Set();
      for (let hops = 0; hops < 8; hops += 1) {
        assert.ok(!seen.has(current.href), `Redirect loop for ${start}: ${current.href}`);
        seen.add(current.href);
        const rule = rules.find(rule => rule.status >= 300 && rule.status < 400 &&
          rule.matcher.test(rule.absolute ? current.origin + current.pathname : current.pathname));
        if (!rule) break;
        const match = (rule.absolute ? current.origin + current.pathname : current.pathname).match(rule.matcher);
        current = new URL(rule.target.replaceAll(':splat', match?.[1] || ''), current);
      }
      assert.equal(current.origin, ORIGIN, `${start}: retain the real production domain`);
      assert.ok(pageFile(current.pathname), `${start}: redirect ends at a deployed page`);
    }
  }
});

test('analytics recognizes every canonical marketing route and excludes arbitrary private paths', () => {
  const context = {module: {exports: {}}, URL, URLSearchParams};
  vm.runInNewContext(read('assets/analytics.js'), context, {filename: 'analytics.js'});
  const {publicPage} = context.module.exports;
  assert.equal(typeof publicPage, 'function');
  for (const route of INDEXABLE) {
    assert.ok(publicPage(ORIGIN + route), `Analytics must recognize canonical landing page ${route}`);
  }
  for (const route of ['/private-customer', '/api/leads', '/reset-password', '/unknown']) {
    assert.equal(publicPage(ORIGIN + route), null, `Do not turn arbitrary/private routes into analytics dimensions`);
  }
});

test('tracked marketing pages expose privacy choices and ship no pretend account identifiers', () => {
  for (const route of INDEXABLE) {
    const html = visibleMarkup(page(route));
    assert.ok(tags(html, 'a').some(tag => {
      const href = attribute(tag, 'href');
      if (!href) return false;
      const url = new URL(href, ORIGIN + route);
      return url.origin === ORIGIN && ['/privacy', '/privacy.html'].includes(url.pathname);
    }), `${route}: visible link to the privacy notice`);
  }
  const context = {window: {}};
  vm.runInNewContext(read('assets/analytics-config.js'), context, {filename: 'analytics-config.js'});
  const config = context.window.CritAnalyticsConfig;
  assert.ok(config);
  assert.equal(config.canonicalOrigin, ORIGIN);
  assert.ok(config.measurementId === '' || /^G-[A-Z0-9]{6,20}$/.test(config.measurementId),
    'An unset GA4 property is blank; an active property must have a real measurement-ID shape');
  assert.doesNotMatch(config.measurementId, /PLACEHOLDER|YOUR|EXAMPLE|G-X{6,}|G-1234567890/,
    'Never ship a sample analytics identifier as if reporting were active');
});

test('both quote pages keep the existing FieldOps endpoint and a single shared submit handler', () => {
  const script = read('assets/lead-form.js');
  const destinations = [...script.matchAll(/\bfetch\(\s*(["'])(https?:\/\/[^"']+)\1/g)]
    .map(match => match[2]);
  assert.deepEqual(destinations, ['https://app.critlv.com/api/leads'],
    'Operational quote submission stays with the existing FieldOps API');
  for (const route of ['/', '/what-we-offer']) {
    const html = page(route);
    assert.equal(tags(html, 'form').filter(tag => attribute(tag, 'id') === 'lead-form').length, 1);
    assert.equal(tags(html, 'script').filter(tag => attribute(tag, 'src') === '/assets/lead-form.js').length, 1,
      `${route}: load the shared quote handler exactly once`);
    assert.doesNotMatch(html, /fetch\(\s*["']https:\/\/app\.critlv\.com\/api\/leads["']/,
      `${route}: an old inline submit handler must not make duplicate quote requests`);
  }
});
