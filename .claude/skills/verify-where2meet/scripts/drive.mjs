#!/usr/bin/env node
// Drives one feature journey in Chromium and saves a screenshot, an ARIA snapshot and a JSON result.
// Usage: node scripts/drive.mjs <flow> [--phone] [--out <dir>]
// Flows: create-event, join-and-vote, blog-post, city-page.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flow = args[0];
const phone = args.includes('--phone');
const outIndex = args.indexOf('--out');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = outIndex > 0 ? args[outIndex + 1] : `/tmp/verify-where2meet/evidence/${stamp}-${flow}${phone ? '-phone' : ''}`;
const web = `http://localhost:${process.env.W2M_WEB_PORT ?? 3001}`;

function loadPlaywright() {
  const tools = '/tmp/verify-where2meet/tools';
  const candidates = [
    process.env.W2M_PLAYWRIGHT,
    join(process.cwd(), 'node_modules/playwright'),
    join(homedir(), 'victor/victor-ui/node_modules/playwright'),
    join(tools, 'node_modules/playwright'),
  ].filter(Boolean);
  const require = createRequire(import.meta.url);
  for (const dir of candidates) {
    if (existsSync(join(dir, 'package.json'))) return require(dir);
  }
  console.error(`drive: no Playwright found, installing into ${tools}`);
  mkdirSync(tools, { recursive: true });
  execFileSync('npm', ['install', '--prefix', tools, '--no-save', 'playwright@1.63.0'], { stdio: 'inherit' });
  execFileSync(join(tools, 'node_modules/.bin/playwright'), ['install', 'chromium'], { stdio: 'inherit' });
  return require(join(tools, 'node_modules/playwright'));
}

const viewport = phone ? { width: 390, height: 844 } : { width: 1280, height: 900 };

async function newPage(browser) {
  const context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone });
  // The organizer tutorial overlay swallows clicks on the event page, so start as a returning visitor.
  await context.addInitScript(() => {
    localStorage.setItem('tutorial-storage', JSON.stringify({ state: { hasSeenOrganizerTutorial: true }, version: 0 }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  return page;
}

async function capture(page, name) {
  await page.screenshot({ path: join(out, `${name}.png`) });
  writeFileSync(join(out, `${name}.aria.txt`), await page.locator('body').ariaSnapshot());
}

async function pickFutureTime(page) {
  await page.getByRole('button', { name: 'Pick a date and time' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose a date and time' });
  await dialog.getByRole('button', { name: 'Go to the Next Month' }).click();
  await dialog.getByRole('gridcell').getByRole('button').and(page.locator(':not([disabled])')).first().click();
  await dialog.getByRole('button', { name: '18:00', exact: true }).click();
  await page.keyboard.press('Escape');
}

async function createEvent(page, title) {
  await page.goto(`${web}/`, { waitUntil: 'networkidle' });
  if (phone) {
    const name = page.getByRole('textbox', { name: 'Event name' });
    await name.fill(title);
    await name.press('Enter');
    await page.getByRole('button', { name: 'Start planning' }).click();
  } else {
    await page.getByRole('textbox', { name: 'Occasion' }).fill(title);
    await pickFutureTime(page);
    await page.getByRole('textbox', { name: 'Your name' }).fill('Verifier Host');
    await page.getByRole('button', { name: 'Create Meeting' }).click();
  }
  await page.waitForURL(/\/meet\/evt_/);
  await page.getByText('Opening the map').waitFor({ state: 'hidden' });
  await page.waitForFunction((t) => document.title.startsWith(t), title);
  await dismiss(page, 'Not now');
  return page.url().split('/meet/')[1].split(/[?#]/)[0];
}

async function dismiss(page, name) {
  const button = page.getByRole('button', { name, exact: true });
  await button.waitFor({ timeout: 3_000 }).then(() => button.click(), () => {});
}

async function inviteLink(page) {
  await page.getByRole('banner').getByRole('button', { name: /^Share/ }).click();
  const link = page.getByText(/\/m\/[A-Za-z0-9]+$/).first();
  await link.waitFor();
  return (await link.textContent()).trim();
}

const title = `Verify ${stamp.slice(5, 19)}`;

const flows = {
  async 'create-event'(browser) {
    const page = await newPage(browser);
    const eventId = await createEvent(page, title);
    const invite = await inviteLink(page);
    await capture(page, 'event');
    return { title, eventId, invite };
  },

  async 'join-and-vote'(browser) {
    const host = await newPage(browser);
    const eventId = await createEvent(host, title);
    const invite = await inviteLink(host);
    const guest = await newPage(browser);
    await guest.goto(invite, { waitUntil: 'networkidle' });
    await guest.getByRole('dialog').getByRole('button', { name: 'Join this plan' }).click();
    await dismiss(guest, 'Not now');
    const form = guest.getByRole('form', { name: 'Join the plan' });
    await form.getByRole('textbox', { name: 'Your name' }).fill('Verifier Guest');
    await form.getByRole('combobox', { name: 'Where are you coming from?' }).fill('Times Square, New York');
    await guest.getByRole('listbox').getByRole('option').first().click();
    await form.getByRole('button', { name: 'Join plan' }).click();
    await form.waitFor({ state: 'detached' });
    await capture(guest, 'joined');
    await guest.getByRole('banner').getByRole('button', { name: 'Cafe' }).click();
    const vote = guest.getByRole('button', { name: 'Vote for venue' }).first();
    const found = await vote.waitFor({ timeout: 30_000 }).then(() => true, () => false);
    if (!found) {
      await capture(guest, 'vote');
      const panel = await guest.getByRole('complementary').first().innerText();
      throw new Error(`no venue to vote for. Venues panel says: ${panel.replace(/\s+/g, ' ').slice(0, 200)}`);
    }
    await vote.click();
    await guest.getByRole('button', { name: 'Remove vote' }).first().waitFor();
    await capture(guest, 'vote');
    return { title, eventId, invite, guest: 'Verifier Guest' };
  },

  async 'blog-post'(browser) {
    const page = await newPage(browser);
    const path = '/blog/new-york/where-to-study-with-friends-new-york';
    const res = await page.goto(`${web}${path}`, { waitUntil: 'networkidle' });
    const picks = page.getByRole('region', { name: /^Our picks in / });
    const cards = await picks.getByRole('listitem').count();
    const cta = page.getByRole('link', { name: /^Plan this with your group/ });
    await cta.scrollIntoViewIfNeeded();
    await capture(page, 'post');
    return { path, status: res.status(), placeCards: cards, ctaHref: await cta.getAttribute('href') };
  },

  async 'city-page'(browser) {
    const page = await newPage(browser);
    const path = '/blog/new-york';
    const res = await page.goto(`${web}${path}`, { waitUntil: 'networkidle' });
    const towns = await page.locator('main li > strong > a[href^="/blog/"]').allTextContents();
    const guides = page.getByRole('heading', { level: 2, name: /^Guides for / });
    const posts = await guides.locator('xpath=following-sibling::ul[1]/li').count();
    await capture(page, 'city');
    return { path, status: res.status(), heading: await page.getByRole('heading', { level: 1 }).textContent(), towns, posts };
  },
};

if (!flows[flow]) {
  console.error(`drive: unknown flow "${flow}". Flows: ${Object.keys(flows).join(', ')}`);
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
try {
  const result = { flow, phone, out, ...(await flows[flow](browser)) };
  writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const pages = browser.contexts().flatMap((c) => c.pages());
  if (pages.length) await capture(pages.at(-1), 'failure').catch(() => {});
  console.error(`drive: ${flow} failed, evidence in ${out}\n${error.stack}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
