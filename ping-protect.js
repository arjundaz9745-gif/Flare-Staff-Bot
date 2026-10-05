/**
 * Flare Staff Bot — Protected User Ping System
 * Drop-in module. Wire into messageCreate (see INSTALL at bottom).
 *
 * Rules:
 *  - Anyone who pings a protected user gets: 1st = WARNING, 2nd+ = TIMEOUT
 *  - Staff role 1555427835143782460 is exempt (silent)
 *  - Self-ping by protected user is ignored
 *  - Bots are ignored
 */

const fs = require('fs');
const path = require('path');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ── Config (override with env) ──
const PROTECTED_PING_IDS = String(
  process.env.PROTECTED_PING_IDS ||
    '1398979148063571989,1421520192017661963,1521860662127755394'
)
  .split(/[,;\s]+/)
  .map((s) => s.trim())
  .filter((s) => /^\d{15,20}$/.test(s));

const PING_TIMEOUT_MS = parseInt(process.env.PING_PROTECT_TIMEOUT_MS || String(60 * 60 * 1000), 10); // 1 hour default
const PING_STRIKE_RESET_MS = parseInt(process.env.PING_PROTECT_RESET_MS || String(24 * 60 * 60 * 1000), 10); // 24h
const PING_DELETE_MSG = process.env.PING_PROTECT_DELETE_MSG !== 'false'; // delete the ping message
const DATA_FILE = process.env.PING_PROTECT_DATA || path.join(__dirname, 'data', 'ping-strikes.json');

const protectedSet = new Set(PROTECTED_PING_IDS);

// Staff with this role are fully exempt (no warn / no timeout / no message)
const STAFF_EXEMPT_ROLE_IDS = String(
  process.env.PING_STAFF_EXEMPT_ROLES || '1555427835143782460'
)
  .split(/[,;\s]+/)
  .map((s) => s.trim())
  .filter((s) => /^\d{15,20}$/.test(s));

// strikes[authorId] = { count, lastAt }
let strikes = {};

function loadStrikes() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      strikes = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {};
    }
  } catch {
    strikes = {};
  }
}

function saveStrikes() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(strikes, null, 2));
  } catch (e) {
    console.error('[ping-protect] save', e.message);
  }
}

loadStrikes();

function getStrike(authorId) {
  const now = Date.now();
  let s = strikes[authorId];
  if (!s) return { count: 0, lastAt: 0 };
  if (s.lastAt && now - s.lastAt > PING_STRIKE_RESET_MS) {
    // expired
    delete strikes[authorId];
    saveStrikes();
    return { count: 0, lastAt: 0 };
  }
  return s;
}

function addStrike(authorId) {
  const prev = getStrike(authorId);
  const next = { count: (prev.count || 0) + 1, lastAt: Date.now() };
  strikes[authorId] = next;
  saveStrikes();
  return next;
}

function formatDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/**
 * Call this from messageCreate (after basic bot/guild checks).
 * @param {import('discord.js').Message} message
 * @returns {Promise<boolean>} true if this message was handled (warned/timed out)
 */
async function handleProtectedPing(message) {
  if (!message.guild || message.author.bot) return false;
  if (!message.mentions?.users?.size) return false;

  // Which protected users were pinged?
  const hitIds = [];
  for (const [id] of message.mentions.users) {
    if (protectedSet.has(String(id)) && String(id) !== String(message.author.id)) {
      hitIds.push(String(id));
    }
  }
  if (!hitIds.length) return false;

  const member = message.member;
  if (!member) return false;

  // Staff role(s) — silent exempt (no warn, no timeout, no reply)
  const isExemptStaff = STAFF_EXEMPT_ROLE_IDS.some(
    (rid) => member.roles?.cache?.has(rid)
  );
  if (isExemptStaff) return false;

  const strike = addStrike(message.author.id);
  const me = message.guild.members.me;
  const canTimeout =
    me?.permissions?.has(PermissionFlagsBits.ModerateMembers) &&
    member.moderatable;

  const targets = hitIds.map((id) => `<@${id}>`).join(', ');

  if (PING_DELETE_MSG) {
    await message.delete().catch(() => {});
  }

  if (strike.count === 1) {
    // ── FIRST: WARNING ──
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('⚠️ Ping Warning')
      .setDescription(
        [
          `${message.author}, do **not** ping ${targets}.`,
          '',
          'This is your **first warning**.',
          `Next time you ping them → **timeout (${formatDuration(PING_TIMEOUT_MS)})**.`,
          '',
          '_Do not ping protected users._'
        ].join('\n')
      )
      .setFooter({ text: 'FlareCore · Protected Ping System' })
      .setTimestamp();

    await message.channel
      .send({ content: `<@${message.author.id}>`, embeds: [embed] })
      .catch(() => {});

    console.log(
      `[ping-protect] WARN ${message.author.tag} (${message.author.id}) → ${hitIds.join(',')}`
    );
    return true;
  }

  // ── SECOND+: TIMEOUT ──
  let timeoutOk = false;
  if (canTimeout) {
    try {
      await member.timeout(
        PING_TIMEOUT_MS,
        `Pinged protected user(s): ${hitIds.join(', ')} (strike ${strike.count})`
      );
      timeoutOk = true;
    } catch (e) {
      console.error('[ping-protect] timeout failed', e.message);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('⏱️ Ping Timeout')
    .setDescription(
      [
        `**${message.author.tag}** pinged protected user(s): ${targets}`,
        '',
        timeoutOk
          ? `Timed out for **${formatDuration(PING_TIMEOUT_MS)}** (strike #${strike.count}).`
          : `Could not timeout (missing permission / hierarchy). Strike #${strike.count} recorded.`,
        '',
        '_Repeated pings = timeout._'
      ].join('\n')
    )
    .setFooter({ text: 'FlareCore · Protected Ping System' })
    .setTimestamp();

  await message.channel
    .send({ content: `<@${message.author.id}>`, embeds: [embed] })
    .catch(() => {});

  console.log(
    `[ping-protect] TIMEOUT ${message.author.tag} (${message.author.id}) strike=${strike.count} ok=${timeoutOk}`
  );
  return true;
}

function registerPingProtect(client) {
  client.on('messageCreate', async (message) => {
    try {
      await handleProtectedPing(message);
    } catch (e) {
      console.error('[ping-protect]', e.message);
    }
  });
  console.log(
    '[ping-protect] active for',
    PROTECTED_PING_IDS.length,
    'users · timeout',
    formatDuration(PING_TIMEOUT_MS)
  );
}

module.exports = {
  handleProtectedPing,
  registerPingProtect,
  PROTECTED_PING_IDS
};

/*
 ═══════════════════════════════════════════════════════════
  INSTALL (Flare-Staff-Bot index.js)
 ═══════════════════════════════════════════════════════════

  1) Put this file next to index.js as:  ping-protect.js
     (or systems/ping-protect.js and fix the require path)

  2) Near the top of index.js with other requires:
     const { registerPingProtect } = require('./ping-protect');

  3) After client is created / near other client.on listeners:
     registerPingProtect(client);

  4) Env (optional):
     PROTECTED_PING_IDS=1398979148063571989,1421520192017661963,1521860662127755394
     PING_PROTECT_TIMEOUT_MS=3600000
     PING_PROTECT_RESET_MS=86400000
     PING_PROTECT_DELETE_MSG=true

  Bot needs: Moderate Members permission, role ABOVE people it times out.
 ═══════════════════════════════════════════════════════════
*/
