import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const output = path.join(root, 'dist');
export const publicFiles = [
  'index.html', 'careers.html', 'what-we-offer.html',
  'structured-cabling-raleigh.html', 'security-camera-installation-raleigh.html',
  'wifi-access-point-installation-raleigh.html', 'network-rack-installation-raleigh.html',
  'privacy.html', 'redeem.html', 'netsurvey.html', 'robots.txt', 'sitemap.xml',
  'googlefc1784d816b4d01d.html'
];

export async function build() {
  // This directory is generated. The legacy root _redirects is deliberately
  // excluded: its catch-all belongs only to the separate critlv.com Worker.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const file of publicFiles) await cp(path.join(root, file), path.join(output, file));
  await cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
  await cp(path.join(root, 'config/production-redirects'), path.join(output, '_redirects'));
  await cp(path.join(root, 'config/production-headers'), path.join(output, '_headers'));
  // A real 404 prevents missing service URLs from silently returning the homepage.
  await writeFile(path.join(output, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found — CRIT Networking</title><body style="font:18px system-ui;margin:4rem;line-height:1.6"><h1>Page not found</h1><p><a href="/">Return to CRIT Networking</a> or <a href="/#contact">request a quote</a>.</p></body></html>');
  console.log(`Built ${publicFiles.length} public files plus assets in dist/.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
