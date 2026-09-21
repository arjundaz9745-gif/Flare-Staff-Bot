async function api(path, opts = {}) {
  const r = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) {
    document.getElementById('gate').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('gateErr').textContent = j.error || 'Login required';
    throw new Error('auth');
  }
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

function tab(name) {
  document.querySelectorAll('.panel').forEach((e) => e.classList.add('hidden'));
  document.getElementById('tab-' + name)?.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === name)
  );
  closeMenu();
  if (name === 'overview') loadOverview();
  if (name === 'stock' || name === 'gen') refreshStock();
  if (name === 'methods') loadMethods();
  if (name === 'giveaways') loadGiveaways();
  if (name === 'warnings') loadWarnings();
}

function openMenu() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('scrim').classList.remove('hidden');
}
function closeMenu() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('scrim').classList.add('hidden');
}

async function boot() {
  const s = await api('/api/status');
  if (!s.authed) {
    document.getElementById('gateErr').textContent = s.error || '';
    return;
  }
  document.getElementById('gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const label = (s.userTag || s.userId) + ' · ' + (s.online ? 'bot online' : 'bot…');
  document.getElementById('sideUser').textContent = s.userTag || s.userId || '—';
  document.getElementById('topStatus').textContent = label;
  await loadOverview();
}

async function loadOverview() {
  const j = await api('/api/overview');
  const el = document.getElementById('overviewStats');
  const items = [
    ['Pay items', j.payTotal ?? 0],
    ['Gen items', j.genTotal ?? 0],
    ['Methods set', j.methodsSet ?? 0],
    ['Active GWs', j.giveaways ?? 0],
    ['Warned users', j.warnUsers ?? 0],
    ['Coin users', j.coinUsers ?? 0]
  ];
  el.innerHTML = items
    .map(([label, value]) => `<div class="stat"><div class="label">\( {label}</div><div class="value"> \){value}</div></div>`)
    .join('');
}

async function refreshStock() {
  const j = await api('/api/stock');
  const pay = j.pay || {};
  const gen = j.gen || {};
  document.getElementById('stockOut').innerHTML =
    Object.entries(pay)
      .map(([k, v]) => `<div class="stock-card"><b>\( {k}</b><div class="n"> \){v}</div></div>`)
      .join('') || '<p class="muted">Empty</p>';
  document.getElementById('genOut').innerHTML =
    Object.entries(gen)
      .map(([k, v]) => `<div class="stock-card"><b>\( {k}</b><div class="n"> \){v}</div></div>`)
      .join('') || '<p class="muted">Empty</p>';
}

async function loadMethods() {
  const j = await api('/api/methods');
  const methods = j.methods || {};
  const keys = Object.keys(methods);
  const box = document.getElementById('methodsOut');
  if (!keys.length) {
    box.innerHTML = '<p class="muted">No method products.</p>';
    return;
  }
  box.innerHTML = keys
    .map((k) => {
      const val = methods[k] || '';
      return `<div class="card method-row" data-key="${k}">
        <strong>${k}</strong>
        <textarea rows="3" id="m-\( {k}" placeholder="Method text…"> \){val.replace(/</g, '&lt;')}</textarea>
        <div class="actions">
          <button type="button" class="btn primary btn-save-m" data-key="${k}">Save</button>
          <button type="button" class="btn ghost btn-clear-m" data-key="${k}">Clear</button>
        </div>
        <p class="msg" id="mm-${k}"></p>
      </div>`;
    })
    .join('');
}

async function loadGiveaways() {
  const j = await api('/api/giveaways');
  const list = j.giveaways || [];
  const el = document.getElementById('gwOut');
  if (!list.length) {
    el.innerHTML = '<p class="muted">No active / stored giveaways.</p>';
    return;
  }
  el.innerHTML = list
    .map(
      (g) => `<div class="list-item">
      <strong>${g.prize || 'Giveaway'}</strong>
      <div class="meta">Winners: ${g.winners ?? '?'} · Entries: ${(g.entries || []).length} · Ends: ${g.ends ? new Date(g.ends).toLocaleString() : '—'}</div>
      <div class="meta">ID: ${g.id} · Channel: ${g.channelId || '—'}</div>
    </div>`
    )
    .join('');
}

async function loadWarnings() {
  const j = await api('/api/warnings');
  const list = j.users || [];
  const el = document.getElementById('warnOut');
  if (!list.length) {
    el.innerHTML = '<p class="muted">No warnings stored.</p>';
    return;
  }
  el.innerHTML = list
    .map(
      (u) => `<div class="list-item">
      <strong>User ${u.userId}</strong>
      <div class="meta">${u.count} warning(s)</div>
      <div class="meta">${(u.lastReason || '').slice(0, 120)}</div>
    </div>`
    )
    .join('');
}

document.getElementById('menuBtn').onclick = openMenu;
document.getElementById('scrim').onclick = closeMenu;
document.querySelector('.side-nav').onclick = (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) tab(b.dataset.tab);
};

document.getElementById('btnStock').onclick = () => refreshStock();
document.getElementById('btnGenRefresh').onclick = () => refreshStock();
document.getElementById('btnGwRefresh').onclick = () => loadGiveaways();
document.getElementById('btnWarnRefresh').onclick = () => loadWarnings();

document.getElementById('btnGenAdd').onclick = async () => {
  try {
    const j = await api('/api/genadd', {
      method: 'POST',
      body: JSON.stringify({
        product: document.getElementById('genProd').value,
        lines: document.getElementById('genLines').value
      })
    });
    document.getElementById('genMsg').innerHTML = '<span class="ok">+' + j.added + ' (total ' + j.total + ')</span>';
    document.getElementById('genLines').value = '';
    refreshStock();
  } catch (e) {
    document.getElementById('genMsg').textContent = e.message;
  }
};

document.getElementById('btnPayAdd').onclick = async () => {
  try {
    const j = await api('/api/payadd', {
      method: 'POST',
      body: JSON.stringify({
        product: document.getElementById('payProd').value,
        lines: document.getElementById('payLines').value
      })
    });
    document.getElementById('payMsg').innerHTML = '<span class="ok">+' + j.added + ' (total ' + j.total + ')</span>';
    document.getElementById('payLines').value = '';
    refreshStock();
  } catch (e) {
    document.getElementById('payMsg').textContent = e.message;
  }
};

document.getElementById('methodsOut').onclick = async (e) => {
  const save = e.target.closest('.btn-save-m');
  const clear = e.target.closest('.btn-clear-m');
  const key = (save || clear)?.dataset?.key;
  if (!key) return;
  const ta = document.getElementById('m-' + key);
  const msg = document.getElementById('mm-' + key);
  try {
    if (clear) ta.value = '';
    await api('/api/methods', {
      method: 'POST',
      body: JSON.stringify({ product: key, text: ta.value })
    });
    msg.innerHTML = '<span class="ok">Saved</span>';
    loadOverview();
  } catch (err) {
    msg.textContent = err.message;
  }
};

document.getElementById('btnEco').onclick = async () => {
  try {
    await api('/api/economy', {
      method: 'POST',
      body: JSON.stringify({
        userId: document.getElementById('ecoUser').value.trim(),
        coins: Number(document.getElementById('ecoCoins').value || 0)
      })
    });
    document.getElementById('ecoMsg').innerHTML = '<span class="ok">Saved</span>';
  } catch (e) {
    document.getElementById('ecoMsg').textContent = e.message;
  }
};

document.getElementById('btnBlur').onclick = () => {
  document.documentElement.style.setProperty('--blur', (document.getElementById('blur').value || 1) + 'px');
};

document.getElementById('btnExport').onclick = async () => {
  const r = await fetch('/api/export', { credentials: 'same-origin' });
  if (r.status === 401) return alert('Login required');
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flare-full-export.json';
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById('btnImport').onclick = async () => {
  const f = document.getElementById('importFile').files[0];
  if (!f) {
    document.getElementById('backupMsg').textContent = 'Choose a JSON file first';
    return;
  }
  try {
    const text = await f.text();
    const j = await api('/api/import', { method: 'POST', body: text });
    document.getElementById('backupMsg').innerHTML =
      '<span class="ok">Imported ' + (j.keys || '') + ' keys</span>';
    refreshStock();
    loadOverview();
  } catch (e) {
    document.getElementById('backupMsg').textContent = e.message;
  }
};

boot().catch(() => {});
