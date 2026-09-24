require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ChannelType,
  PermissionsBitField,
  AttachmentBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '';
const PREFIX = process.env.PREFIX || '$';
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID || '1540362727581818947';
const FLARE_GUILD_ID = process.env.GUILD_ID || process.env.FLARE_GUILD_ID || '1540362727514701894';
const DEFAULT_GUILD_ID = FLARE_GUILD_ID;

const PORT = process.env.PORT || 3000;

// Staff role hierarchy for $staffstats (highest first)
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID || '1540362727514701895'; // foundz.exe / Owner
const CO_OWNER_ROLE_ID = process.env.CO_OWNER_ROLE_ID || '1540615105039827065'; // Ownz
const MANAGER_ROLE_ID = process.env.MANAGER_ROLE_ID || '1540362727514701898'; // Maneger
const HEAD_ADMIN_ROLE_ID = process.env.HEAD_ADMIN_ROLE_ID || '1540362727514701897'; // Director
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || '1540362727535419449'; // Moderator
const STAFF_TEAM_ROLE_ID = process.env.STAFF_TEAM_ROLE_ID || '1540362727543799901'; // Staff
const REWARD_STAFF_ROLE_ID = process.env.REWARD_STAFF_ROLE_ID || '1540362727543799901';
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || ''; // optional: auto-prompt in new tickets

// Anti-raid settings
const ANTIRAID_LOG_CHANNEL_ID = process.env.ANTIRAID_LOG_CHANNEL_ID || ''; // optional log channel
const TEAMUP_CATEGORY_ID = process.env.TEAMUP_CATEGORY_ID || ''; // optional category for teamup tickets
const MASS_PING_LIMIT = 3;          // same user mentioned this many times
const MASS_PING_WINDOW_MS = 15000;  // within 15 seconds
const MASS_PING_TIMEOUT_MS = 3 * 24 * 60 * 60 * 1000; // 3 days


// Product stock keys (Ultimate multi-stock)
const PRODUCT_STOCKS = {
  // original finite stock
  mcfa: { label: 'MCFA', emoji: '🟩', cmd: ['mcfa'], type: 'stock' },
  nitro: { label: 'NITRO', emoji: '💜', cmd: ['nitro'], type: 'stock' },
  netflix: { label: 'NETFLIX', emoji: '🎬', cmd: ['netflix'], type: 'stock' },
  crunchyroll: { label: 'CRUNCHYROLL', emoji: '🍥', cmd: ['crunchyroll', 'cruncyroll', 'cr'], type: 'stock' },
  steam: { label: 'STEAM', emoji: '🎮', cmd: ['steam'], type: 'stock' },
  // new = full methods (unlimited same text)
  mcredeem: { label: 'McRedeem Code', emoji: '🎟️', cmd: ['mcredeem', 'mcredeemcode', 'redeem'], type: 'method' },
  mccode: { label: 'McCode Method', emoji: '📜', cmd: ['mccode', 'mccodemethod', 'mccodes'], type: 'method' },
  xbox: { label: 'Xbox Codes', emoji: '🎮', cmd: ['xbox', 'xboxcodes', 'xboxcode'], type: 'method' },
  xboxmethod: { label: 'XboxCode Method', emoji: '📘', cmd: ['xboxmethod', 'xboxcodemethod'], type: 'method' },
  nitromethod: { label: 'Nitro Method', emoji: '💎', cmd: ['nitromethod', 'nitrom'], type: 'method' },
  xboxgift: { label: 'Xbox Gift Card Method', emoji: '🎁', cmd: ['xboxgift', 'xboxgiftcard', 'xboxgiftmethod'], type: 'method' },
  netflixnocc: { label: 'Netflix Method NoCC', emoji: '📺', cmd: ['netflixnocc', 'netflixmethod', 'nfnocc'], type: 'method' }
};

const VOUCH_CHANNEL_ID = process.env.VOUCH_CHANNEL_ID || ''; // disabled for Flare
const PROOF_CHANNEL_ID = process.env.PROOF_CHANNEL_ID || ''; // disabled for Flare
const SALARY_ADD_CHANNEL_ID = process.env.SALARY_ADD_CHANNEL_ID || '';
const BIRTHDAY_USER_ID = process.env.BIRTHDAY_USER_ID || '1540362727514701895';
const FALCON_BOT_ID = process.env.FALCON_BOT_ID || '899899858981371935'; // Falcon™

const FREE_GEN_ROLE_ID = process.env.FREE_GEN_ROLE_ID || '1550508537766215773';
const PAID_GEN_ROLE_ID = process.env.PAID_GEN_ROLE_ID || '1550509503710240953';
const FREE_STATUS_TEXT = process.env.FREE_STATUS_TEXT || 'Legit mcfas on discord.gg/r9spJKVbsM';
const MEDIA_ROLE_ID = process.env.MEDIA_ROLE_ID || '1540362727560843365';
const OUR_BOTS_ROLE_ID = process.env.OUR_BOTS_ROLE_ID || '1540362727560843367';
const OWNZ_ROLE_ID = process.env.OWNZ_ROLE_ID || '1540615105039827065';
const DIRECTOR_ROLE_ID = process.env.DIRECTOR_ROLE_ID || '1540362727514701897';
const FLARE_WEB = 'https://flaredrop.base44.app';
const STAFF_APPLY_PING_ROLES = [OWNER_ROLE_ID, CO_OWNER_ROLE_ID].filter(Boolean);

function ensureStocks(d) {
  if (!d.stocks || typeof d.stocks !== 'object') d.stocks = {};
  if (!d.genStocks || typeof d.genStocks !== 'object') d.genStocks = {};
  if (!d.methods || typeof d.methods !== 'object') d.methods = {};
  for (const key of Object.keys(PRODUCT_STOCKS)) {
    if (PRODUCT_STOCKS[key].type === 'method') {
      if (typeof d.methods[key] !== 'string') d.methods[key] = '';
    } else {
      if (!Array.isArray(d.stocks[key])) d.stocks[key] = [];
      if (!Array.isArray(d.genStocks[key])) d.genStocks[key] = [];
    }
  }
  // migrate legacy
  if (Array.isArray(d.mcfaStock) && d.mcfaStock.length && d.stocks.mcfa.length === 0) {
    d.stocks.mcfa = d.mcfaStock.slice();
  }
  if (Array.isArray(d.customStock) && d.customStock.length && (!d.stocks.custom || !d.stocks.custom.length)) {
    d.stocks.custom = d.customStock.slice();
  }
  d.mcfaStock = d.stocks.mcfa || [];
  d.customStock = d.stocks.custom || [];
  if (d.staffApplyOpen == null) d.staffApplyOpen = true;
  if (!d.staffApplications) d.staffApplications = {};
      if (!d.giveaways) d.giveaways = {};
      if (!d.warnings) d.warnings = {};
  return d;
}

/** pool: 'normal' (pay/claim) or 'gen' (fgen/pgen) */
function getStock(key, pool = 'normal') {
  ensureStocks(data);
  if (pool === 'gen') return data.genStocks[key] || [];
  return data.stocks[key] || [];
}

function setStock(key, arr, pool = 'normal') {
  ensureStocks(data);
  if (pool === 'gen') {
    data.genStocks[key] = arr;
  } else {
    data.stocks[key] = arr;
    if (key === 'mcfa') data.mcfaStock = arr;
    if (key === 'custom') data.customStock = arr;
  }
}

function resolveProductKey(name) {
  const n = String(name || '').toLowerCase();
  for (const [key, meta] of Object.entries(PRODUCT_STOCKS)) {
    if (key === n || meta.cmd.includes(n) || meta.label.toLowerCase() === n) return key;
  }
  return null;
}

function buildStockListEmbed() {
  ensureStocks(data);
  const lines = Object.entries(PRODUCT_STOCKS).map(([key, meta]) => {
    const n = (data.stocks[key] || []).length;
    return `${meta.emoji} **${meta.label}**  |  \`${n}\``;
  });
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📦 CURRENT STOCK STATUS')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'USE $BUY <PRODUCT> OR $PAY / $<product> @user — Flare Drop' })
    .setTimestamp();
}

function isTicketChannel(ch) {
  if (!ch || !ch.name) return false;
  const name = ch.name.toLowerCase();
  return (
    name.startsWith('ticket') ||
    name.startsWith('claim') ||
    name.includes('ticket') ||
    (TICKET_CATEGORY_ID && ch.parentId === TICKET_CATEGORY_ID)
  );
}


const DATA_PATH = process.env.RENDER
  ? path.join('/tmp', 'flare-bot-data.json')
  : path.join(__dirname, 'data.json');

if (!TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN');
  process.exit(1);
}


const DASHBOARD_ADMIN_PASSWORD = process.env.DASHBOARD_ADMIN_PASSWORD || 'ultimate-admin';
const OAUTH_CLIENT_ID = (process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || '').trim();
const OAUTH_CLIENT_SECRET = (process.env.DISCORD_CLIENT_SECRET || process.env.CLIENT_SECRET || '').trim();
const OAUTH_REDIRECT_URI = (process.env.OAUTH_REDIRECT_URI || process.env.REDIRECT_URI || '').trim();
const dashSessions = new Map();

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('=') || '');
  }
  return '';
}
function publicBase(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}
function redirectUri(req) {
  if (OAUTH_REDIRECT_URI) return OAUTH_REDIRECT_URI;
  return `${publicBase(req)}/auth/callback`;
}
async function memberCanAccessDashboard(userId) {
  try {
    const guild = client.guilds.cache.get(FLARE_GUILD_ID) || await client.guilds.fetch(FLARE_GUILD_ID).catch(() => null);
    if (!guild) return false;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;
    if (isStaff(member) || canViewStock(member)) return true;
    if (guild.ownerId === userId) return true;
    return false;
  } catch (_) {
    return false;
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathName = url.pathname;
    const json = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    const parseBody = async () => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
    };
    try {
      if (pathName === '/' || pathName === '/dashboard') {
        let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
        // Force password login UI even if public/index.html is outdated
        if (html.includes('Login with Discord') || html.includes('Discord login required')) {
          html = html.replace(
            /<p class="muted">Staff dashboard · Discord login required<\/p>\s*<a class="btn primary" href="\/auth\/login">Login with Discord<\/a>\s*<p id="gateErr" class="err"><\/p>/,
            `<p class="muted">Staff dashboard · Admin password</p>
      <input id="gatePassword" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;max-width:280px;margin:0 auto 10px;display:block;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.35);color:#fff;box-sizing:border-box" />
      <button type="button" class="btn primary" id="gateLoginBtn">Login</button>
      <p id="gateErr" class="err"></p>`
          );
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        });
        res.end(html);
        return;
      }
      if (pathName === '/styles.css') {
        res.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'no-store' });
        res.end(fs.readFileSync(path.join(__dirname, 'public', 'styles.css'), 'utf8'));
        return;
      }
      if (pathName === '/app.js') {
        let js = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
        if (!js.includes('doPasswordLogin')) {
          js += `
async function doPasswordLogin() {
  var password = (document.getElementById('gatePassword') || {}).value || '';
  var err = document.getElementById('gateErr');
  if (!password) { if (err) err.textContent = 'Enter password'; return; }
  try {
    var r = await fetch('/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    });
    var j = await r.json().catch(function(){ return {}; });
    if (!r.ok) throw new Error(j.error || 'Wrong password');
    if (err) err.textContent = '';
    location.reload();
  } catch (e) {
    if (err) err.textContent = e.message || 'Wrong password';
  }
}
document.addEventListener('DOMContentLoaded', function() {
  var b = document.getElementById('gateLoginBtn');
  if (b) b.addEventListener('click', function(){ doPasswordLogin(); });
  var p = document.getElementById('gatePassword');
  if (p) p.addEventListener('keydown', function(e){ if (e.key === 'Enter') doPasswordLogin(); });
});
`;
        }
        res.writeHead(200, {
          'Content-Type': 'application/javascript',
          'Cache-Control': 'no-store'
        });
        res.end(js);
        return;
      }
      if (
        pathName === '/logo.png' ||
        pathName === '/bg-desktop.jpg' ||
        pathName === '/bg-desktop.jpeg' ||
        pathName === '/bg-mobile.jpg' ||
        pathName === '/bg-mobile.jpeg'
      ) {
        const name = pathName.slice(1);
        let f = path.join(__dirname, 'public', name);
        if (!fs.existsSync(f) && name.endsWith('.jpg')) {
          f = path.join(__dirname, 'public', name.replace(/\.jpg$/, '.jpeg'));
        }
        if (!fs.existsSync(f)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        const type = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
        res.writeHead(200, { 'Content-Type': type });
        res.end(fs.readFileSync(f));
        return;
      }
      // Admin password login (Discord OAuth disabled for dashboard)
      if (pathName === '/auth/login' && req.method === 'GET') {
        res.writeHead(302, { Location: '/' });
        res.end();
        return;
      }
      if (pathName === '/auth/login' && req.method === 'POST') {
        let body = {};
        try {
          body = await parseBody(req);
        } catch (_) {}
        const password = String(body.password || body.pass || '');
        if (!password || password !== DASHBOARD_ADMIN_PASSWORD) {
          return json(401, { error: 'Wrong password' });
        }
        const sid = 'admin';
        dashSessions.set(sid, { tag: 'Admin', at: Date.now(), via: 'password' });
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `flare_uid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
        });
        res.end(JSON.stringify({ ok: true, tag: 'Admin' }));
        return;
      }
      if (pathName === '/auth/callback') {
        res.writeHead(302, { Location: '/' });
        res.end();
        return;
      }
      if (pathName === '/auth/logout') {
        const uid = getCookie(req, 'flare_uid');
        if (uid) dashSessions.delete(uid);
        res.writeHead(302, { Location: '/', 'Set-Cookie': 'flare_uid=; Path=/; Max-Age=0' });
        res.end();
        return;
      }
      const uid = getCookie(req, 'flare_uid');
      const authed = !!(uid && dashSessions.has(uid));
      if (pathName === '/api/status') {
        return json(200, {
          online: !!client.user,
          tag: client.user?.tag,
          authed: !!authed,
          userId: authed ? uid : null,
          userTag: authed ? dashSessions.get(uid)?.tag : null,
          error: undefined,
          hint: authed ? undefined : 'Enter admin password to login'
        });
      }
      if (!authed && pathName.startsWith('/api/')) return json(401, { error: 'Login required' });
      if (pathName === '/api/stock') {
        ensureStocks(data);
        const pay = {}, gen = {};
        for (const key of Object.keys(PRODUCT_STOCKS)) {
          if (PRODUCT_STOCKS[key].type === 'method') {
            pay[key] = getMethodText(key) ? '∞' : 0;
            gen[key] = pay[key];
          } else {
            pay[key] = getStock(key).length;
            gen[key] = getStock(key, 'gen').length;
          }
        }
        return json(200, { pay, gen });
      }
      if (pathName === '/api/genadd' && req.method === 'POST') {
        const body = await parseBody();
        const product = resolveProductKey(body.product);
        if (!product || PRODUCT_STOCKS[product]?.type === 'method') return json(400, { error: 'Bad product' });
        const lines = String(body.lines || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const arr = getStock(product, 'gen');
        let added = 0;
        for (const a of lines) {
          if (!arr.includes(a)) { arr.push(a); added++; }
        }
        setStock(product, arr, 'gen');
        saveData();
        return json(200, { added, total: arr.length });
      }
      if (pathName === '/api/export' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="flare-full-export.json"'
        });
        res.end(JSON.stringify(data, null, 2));
        return;
      }
      if (pathName === '/api/import' && req.method === 'POST') {
        const body = await parseBody();
        if (!body || typeof body !== 'object') return json(400, { error: 'Invalid JSON' });
        // merge full export into live data
        for (const k of Object.keys(body)) {
          data[k] = body[k];
        }
        ensureStocks(data);
        saveData();
        return json(200, { ok: true, keys: Object.keys(body).length });
      }
      if (pathName === '/api/economy' && req.method === 'POST') {
        const body = await parseBody();
        if (!data.coins) data.coins = {};
        data.coins[body.userId] = Math.max(0, parseInt(body.coins, 10) || 0);
        saveData();
        return json(200, { ok: true });
      }
      if (pathName === '/api/overview') {
        ensureStocks(data);
        let payTotal = 0, genTotal = 0, methodsSet = 0;
        for (const key of Object.keys(PRODUCT_STOCKS)) {
          if (PRODUCT_STOCKS[key].type === 'method') {
            if (getMethodText(key)) methodsSet++;
          } else {
            payTotal += getStock(key).length;
            genTotal += getStock(key, 'gen').length;
          }
        }
        const gw = Object.keys(data.giveaways || {}).length;
        const warnUsers = Object.keys(data.warnings || {}).length;
        const coinUsers = Object.keys(data.coins || {}).length;
        return json(200, { payTotal, genTotal, methodsSet, giveaways: gw, warnUsers, coinUsers });
      }
      if (pathName === '/api/payadd' && req.method === 'POST') {
        const body = await parseBody();
        const product = resolveProductKey(body.product);
        if (!product || PRODUCT_STOCKS[product]?.type === 'method') return json(400, { error: 'Bad product' });
        const lines = String(body.lines || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const arr = getStock(product);
        let added = 0;
        for (const a of lines) {
          if (!arr.includes(a)) { arr.push(a); added++; }
        }
        setStock(product, arr);
        saveData();
        return json(200, { added, total: arr.length });
      }
      if (pathName === '/api/methods') {
        ensureStocks(data);
        if (req.method === 'GET') {
          const methods = {};
          for (const key of Object.keys(PRODUCT_STOCKS)) {
            if (PRODUCT_STOCKS[key].type === 'method') methods[key] = getMethodText(key) || '';
          }
          return json(200, { methods });
        }
        if (req.method === 'POST') {
          const body = await parseBody();
          const product = resolveProductKey(body.product);
          if (!product || PRODUCT_STOCKS[product]?.type !== 'method') return json(400, { error: 'Bad product' });
          if (!data.methods) data.methods = {};
          data.methods[product] = String(body.text || '').trim();
          saveData();
          return json(200, { ok: true });
        }
      }
      if (pathName === '/api/giveaways') {
        const list = Object.entries(data.giveaways || {}).map(([id, g]) => ({
          id,
          prize: g.prize,
          winners: g.winners,
          ends: g.ends,
          channelId: g.channelId,
          entries: g.entries || [],
          hostId: g.hostId
        }));
        return json(200, { giveaways: list });
      }
      if (pathName === '/api/warnings') {
        const users = Object.entries(data.warnings || {}).map(([userId, arr]) => ({
          userId,
          count: (arr || []).length,
          lastReason: (arr && arr.length ?
