#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const runDir = path.resolve(process.argv[2]);
const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
assert.equal(run.status, 'ready');
const require = createRequire(path.join(runDir, 'runtime/driver/package.json'));
const { chromium } = require('playwright');
const evidence = path.join(runDir, 'evidence');
const actions = [], network = [], errors = [], consoles = [], routes = [];
const messages = [];
const streamController = new AbortController();
let streamCapture;
const result = {status: 'FAIL', failures:[], source_commit: run.source_commit, external_boundary: run.google_keys,
  scope: [], not_verified: ['accounts', 'phone layouts', 'privacy', 'data import', 'production build']};
const scrub = value => String(value).replace(/AIza[A-Za-z0-9_-]+/g, '[Google key redacted]').replace(/\bpt_[a-zA-Z0-9.]+/g, '[participant credential redacted]').replace(/https?:\/\/\S+/g, '[url removed]');
const save = (name, value) => writeFile(path.join(evidence, name), JSON.stringify(value, null, 2));
const action = (name, data={}) => { actions.push({at:new Date().toISOString(),name,...data}); console.log(name); };
const browser = await chromium.launch({channel:'chrome', headless:true});
async function newPage(name) {
  const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page = await context.newPage();
  page.setDefaultTimeout(40000);
  if(name!=='organizer') await page.addLocatorHandler(page.getByText('Skip tutorial',{exact:true}), async()=>page.getByText('Skip tutorial',{exact:true}).click());
  page.on('pageerror', error=>errors.push({browser:name,message:scrub(error.message)}));
  page.on('console', message=>{if(message.type()==='error'||(['warning'].includes(message.type())&&/Google Maps|Places|Directions|Geocod/i.test(message.text()))) consoles.push({browser:name,type:message.type(),message:scrub(message.text())});});
  page.on('response', response=>{
    const url = new URL(response.url());
    if(url.pathname.startsWith('/api/') || /googleapis\.com$|gstatic\.com$/.test(url.hostname)) {
      network.push({browser:name,method:response.request().method(),origin:url.origin,path:url.pathname,status:response.status()});
    }
  });
  return page;
}
const page = await newPage('organizer');
let guest;
async function capture(name, current=page) {
  await current.screenshot({path:path.join(evidence,`${name}.png`),fullPage:true});
  await writeFile(path.join(evidence,`${name}.aria.txt`), scrub(await current.locator('body').ariaSnapshot()));
}
function handled(promise) { promise.catch(()=>{}); return promise; }
async function captureMessages(id, token) {
  const response = await fetch(`${run.backend_url}/api/events/${id}/stream`, {
    headers: { Authorization: `Bearer ${token}` }, signal: streamController.signal,
  });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  streamCapture = (async () => {
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const lines = buffer.slice(0, boundary).split('\n');
        buffer = buffer.slice(boundary + 2);
        const type = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (['vote:statistics', 'vote:changed', 'event:updated', 'event:published'].includes(type) && data) {
          messages.push({ type, data: JSON.parse(data) });
        }
      }
    }
  })();
  streamCapture.catch(() => {});
}
const responseFor = (current, suffix, method) => handled(current.waitForResponse(r=>new URL(r.url()).pathname.endsWith(suffix) && r.request().method()===method));
async function readEvent(id) {
  const response = await fetch(`${run.backend_url}/api/events/${id}`);
  assert.equal(response.status,200);
  const data = await response.json();
  return {id:data.id,title:data.title,publishedVenueId:data.publishedVenueId,publishedAt:data.publishedAt,
    participants:data.participants.map(p=>({id:p.id,name:p.name,address:p.address,formattedAddress:p.formattedAddress,lat:p.lat,lng:p.lng,location:p.location,isOrganizer:p.isOrganizer}))};
}
function stored(id) {
  assert.match(id,/^evt_[A-Za-z0-9_]+$/);
  const sql=`SELECT json_build_object('event',(SELECT row_to_json(e) FROM (SELECT id,published_venue_id,published_at FROM event WHERE id='${id}') e), 'participants',(SELECT json_agg(p) FROM (SELECT id,name,lat,lng,is_organizer FROM participant WHERE event_id='${id}') p), 'votes',(SELECT coalesce(json_agg(v),'[]'::json) FROM (SELECT participant_id,venue_id FROM vote WHERE event_id='${id}') v));`;
  return JSON.parse(execFileSync('psql',[run.database_url,'-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8'}).trim());
}
async function address(current,label,query,match) {
  await current.getByRole('combobox',{name:label,exact:true}).fill(query);
  const option=current.getByRole('listbox').getByRole('option').filter({hasText:match}).first();
  await option.waitFor();
  const selected=await option.innerText();
  await option.click();
  action('Select actual Google autocomplete result',{query,selected});
}
async function search(current) {
  const field=current.getByRole('combobox',{name:'Search venues',exact:true});
  await field.fill('coffee');
  await current.getByRole('option',{name:/Search.*coffee.*near your group/}).waitFor();
  const response=responseFor(current,'/api/venues/search','POST');
  await field.press('Enter');
  const received=await response;
  assert.equal(received.status(),200);
  const data=await received.json();
  const venues=Array.isArray(data)?data:data.venues;
  assert(venues?.length>0,'Actual venue search must return venues');
  return venues;
}
function card(current,name) {return current.getByRole('button').filter({has:current.getByRole('heading',{level:3,name,exact:true})});}
async function visibleRoutes(name,data) {
  const details=page.getByRole('complementary',{name,exact:true});
  await details.getByRole('heading',{name:'Travel Times',exact:true}).waitFor();
  await details.getByText('Calculating routes...',{exact:true}).waitFor({state:'hidden'});
  for(const duration of new Set(data.routes.map(route=>route.duration.text))) {
    const times=details.getByText(duration,{exact:true});
    await times.first().waitFor();
    assert.equal(await times.count(),data.routes.filter(route=>route.duration.text===duration).length);
  }
  assert.equal(await details.getByText('No route',{exact:true}).count(),0);
}
async function waitCount(current,name,label,count) {
  const control=card(current,name).getByRole('button',{name:label,exact:true});
  await control.waitFor();
  await current.waitForFunction(({name,label,count})=>{
    const heading=[...document.querySelectorAll('h3')].find(h=>h.textContent===name);
    const parent=heading?.closest('[role="button"]');
    const button=parent?.querySelector(`button[aria-label="${label}"]`);
    return button && Number(button.textContent)===count && button.getAttribute('aria-busy')!=='true';
  },{name,label,count});
}
try {
  const sessionReady=responseFor(page,'/api/auth/session','GET');
  await page.goto(run.client_url,{waitUntil:'domcontentloaded'});
  assert.equal((await sessionReady).status(),401);
  await page.getByRole('textbox',{name:'Occasion',exact:true}).fill(`Google verification ${run.run_id.slice(0,8)}`);
  await page.getByRole('textbox',{name:'Your name',exact:true}).fill('Verification organizer');
  await page.getByRole('button',{name:'Pick a date and time',exact:true}).click();
  await page.getByRole('button',{name:'09:00',exact:true}).click();
  await page.keyboard.press('Escape');
  await capture('google-00-create-form');
  action('Creation form filled with title, name, and time');
  const creation=responseFor(page,'/api/events','POST');
  await page.getByRole('button',{name:'Create Meeting',exact:true}).click();
  const created=await creation;
  assert.equal(created.status(),201);
  const createdEvent=await created.json();
  const id=createdEvent.id;
  await captureMessages(id, createdEvent.participantToken);
  result.event_id=id;
  await page.waitForURL(`${run.client_url}/meet/${id}`,{timeout:120000});
  await page.locator('.cat-portal').waitFor({state:'detached'});
  await page.getByText('Skip tutorial',{exact:true}).click();
  await page.getByText('Skip tutorial',{exact:true}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Settings',exact:true}).click({trial:true});
  await page.locator('.gm-style').first().waitFor();
  await page.getByRole('region',{name:'Map',exact:true}).waitFor();
  await capture('google-01-map');
  assert.equal(await page.getByText('Map temporarily unavailable',{exact:true}).count(),0);
  action('Google map mounted with visible map region'); result.scope.push('map mounted');

  await page.getByRole('button',{name:'Add starting location',exact:true}).click();
  await address(page,'Where are you coming from?','San Diego Central Library',/Central Library/);
  const location=responseFor(page,`/participants/${(await readEvent(id)).participants[0].id}`,'PATCH');
  await page.getByRole('button',{name:'Save my location',exact:true}).click();
  assert.equal((await location).status(),200);
  await page.getByRole('button',{name:'Save my location',exact:true}).waitFor({state:'hidden'});
  assert(stored(id).participants.every(p=>p.lat!==null&&p.lng!==null));
  action('Organizer location geocoded and persisted'); result.scope.push('organizer autocomplete and geocoding');
  await capture('google-02-organizer-location');

  guest=await newPage('guest');
  await guest.goto(`${run.client_url}/meet/${id}`,{waitUntil:'domcontentloaded'});
  await guest.getByRole('button',{name:'Join Event',exact:true}).click();
  await guest.getByLabel('Name',{exact:true}).fill('Verification guest');
  await address(guest,'Starting location','Balboa Park San Diego',/Balboa Park/);
  const joined=responseFor(guest,`/events/${id}/participants`,'POST');
  await guest.getByRole('button',{name:'Add Participant',exact:true}).click();
  assert.equal((await joined).status(),201);
  await page.getByText('Verification guest',{exact:true}).waitFor();
  const located=stored(id);
  assert.equal(located.participants.length,2);
  assert(located.participants.every(p=>p.lat!==null&&p.lng!==null));
  await save('google-participants.json',{api:await readEvent(id),database:located});
  action('Guest joins with geocoded location; organizer sees guest without reloading');
  result.scope.push('guest location and participant live update');

  await page.goto(`${run.client_url}/meet/${id}?view=venue`,{waitUntil:'domcontentloaded'});
  const venues=await search(page);
  const venue=venues.find(candidate=>venues.filter(other=>other.name===candidate.name).length===1);
  assert(venue,'Choose a uniquely named actual search result');
  result.venue={id:venue.id,name:venue.name};
  const waitRoute = mode => handled(page.waitForResponse(r=>new URL(r.url()).pathname===`/api/events/${id}/venues/${venue.id}/directions` && new URL(r.url()).searchParams.get('travelMode')===mode && r.request().method()==='GET'));
  const routeResponse=waitRoute('driving');
  await card(page,venue.name).click();
  const directions=await routeResponse;
  assert.equal(directions.status(),200);
  const routeData=await directions.json();
  routes.push(routeData);
  assert.equal(routeData.routes.length,2,'Both located people must have successful routes');
  assert(routeData.routes.every(r=>r.duration?.value>0&&r.distance?.value>0&&r.polyline?.length));
  await visibleRoutes(venue.name,routeData);
  await page.getByRole('complementary',{name:venue.name,exact:true}).waitFor();
  await capture('google-03-selected-routes');
  action('Real coffee search, venue selection, and two driving routes returned');
  result.scope.push('nearby text search','venue details','two driving routes');
  const walking=waitRoute('walking');
  await page.getByRole('button',{name:'Travel by Walk',exact:true}).click();
  const walkingResponse=await walking;
  assert.equal(walkingResponse.status(),200);
  const walkingData=await walkingResponse.json();
  routes.push(walkingData);
  assert.equal(walkingData.travelMode,'walking');
  assert.equal(walkingData.routes.length,2);
  assert(walkingData.routes.every(r=>r.duration?.value>0&&r.polyline?.length));
  await visibleRoutes(venue.name,walkingData);
  action('Walking mode returns routes for both participants');result.scope.push('two walking routes');
  await capture('google-04-walking');

  await guest.goto(`${run.client_url}/meet/${id}?view=venue`,{waitUntil:'domcontentloaded'});
  await search(guest);
  await card(guest,venue.name).waitFor();
  const voted=responseFor(page,'/votes','POST');
  await card(page,venue.name).getByRole('button',{name:'Vote for venue',exact:true}).click();
  assert.equal((await voted).status(),201);
  await waitCount(page,venue.name,'Remove vote',1);
  await waitCount(guest,venue.name,'Vote for venue',1);
  assert.equal(stored(id).votes.length,1);
  await capture('google-05-vote-live-guest',guest);
  action('Organizer vote persisted and guest sees count one without reloading');result.scope.push('vote persistence and live update');
  const unvoted=responseFor(page,`/votes/${venue.id}`,'DELETE');
  await card(page,venue.name).getByRole('button',{name:'Remove vote',exact:true}).click();
  assert.equal((await unvoted).status(),200);
  assert.equal(stored(id).votes.length,0);
  await waitCount(page,venue.name,'Vote for venue',0);
  result.scope.push('vote removal persistence');
  try {
    await waitCount(guest,venue.name,'Vote for venue',0);
    action('Vote removal persisted and guest sees count zero without reloading');result.scope.push('vote removal live update');
  } catch(error) {
    const observed=await card(guest,venue.name).getByRole('button',{name:'Vote for venue',exact:true}).innerText();
    result.failures.push({feature:'last-vote removal live update',expected:0,observed:Number(observed),error:scrub(error)});
    await capture('google-05b-stale-guest-after-removal',guest);
    await save('google-vote-removal-state.json',{database:stored(id),guest_count:Number(observed),organizer_count:Number(await card(page,venue.name).getByRole('button',{name:'Vote for venue',exact:true}).innerText())});
    action('FAIL: last vote removed from database and organizer UI, but guest retains stale count',{observed:Number(observed)});
    await guest.reload({waitUntil:'domcontentloaded'});
    await search(guest);
    await waitCount(guest,venue.name,'Vote for venue',0);
    action('Guest reload restores correct zero count; continue independent publication checks');
  }
  const restored=responseFor(page,'/votes','POST');
  await card(page,venue.name).getByRole('button',{name:'Vote for venue',exact:true}).click();
  assert.equal((await restored).status(),201);
  await waitCount(guest,venue.name,'Vote for venue',1);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Publish Event',exact:true}).click();
  await capture('google-06-publish-form');
  const publishing=responseFor(page,'/publish','POST');
  await page.getByRole('button',{name:'Publish Event',exact:true}).click();
  assert.equal((await publishing).status(),200);
  await guest.getByRole('button',{name:'Voting disabled after publish',exact:true}).first().waitFor();
  assert(await guest.getByRole('button',{name:'Voting disabled after publish',exact:true}).first().isDisabled());
  const published=stored(id);
  assert.equal(published.event.published_venue_id,venue.id);
  assert(published.event.published_at);
  await save('google-published-state.json',{api:await readEvent(id),database:published});
  await capture('google-07-published-guest',guest);
  action('Published venue persisted and guest vote controls disabled without reloading');result.scope.push('publish and live update');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Unpublish Event',exact:true}).waitFor();
  const reopening=responseFor(page,'/publish','DELETE');
  await page.getByRole('button',{name:'Unpublish Event',exact:true}).click();
  assert.equal((await reopening).status(),200);
  await guest.getByRole('button',{name:'Voting disabled after publish',exact:true}).first().waitFor({state:'hidden'});
  await card(guest,venue.name).getByRole('button',{name:'Vote for venue',exact:true}).waitFor();
  assert(await card(guest,venue.name).getByRole('button',{name:'Vote for venue',exact:true}).isEnabled());
  assert.equal(stored(id).event.published_venue_id,null);
  await capture('google-08-reopened-guest',guest);
  action('Published state survives reload; reopening clears persisted selection and restores guest controls');
  result.scope.push('published reload','unpublish and live update');
  assert.deepEqual(errors,[]);
  result.status=result.failures.length?'FAIL':'PASS';
  if(result.failures.length) process.exitCode=1;
} catch(error) {
  result.error=scrub(error);
  try{await capture('google-failure');if(guest)await capture('google-guest-failure',guest);}catch{}
  process.exitCode=1;
} finally {
  streamController.abort();
  if (streamCapture) await streamCapture.catch(() => {});
  await save('google-sse-messages.json', messages);
  await save('google-actions.json',actions);
  await save('google-network.json',network);
  await save('google-errors.json',{errors,consoles});
  await save('google-routes.json',routes);
  await browser.close();
  await save('google-result.json',result);
  console.log(JSON.stringify(result,null,2));
}
