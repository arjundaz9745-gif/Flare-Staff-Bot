async function api(path, opts={}) {
  const r = await fetch(path, { credentials:'same-origin', headers:{'Content-Type':'application/json'}, ...opts });
  const j = await r.json().catch(()=>({}));
  if (r.status===401) { document.getElementById('gate').classList.remove('hidden'); document.getElementById('app').classList.add('hidden'); document.getElementById('gateErr').textContent=j.error||'Login'; throw new Error('auth'); }
  if (!r.ok) throw new Error(j.error||r.statusText);
  return j;
}
function tab(name){
  document.querySelectorAll('[id^=tab-]').forEach(e=>e.classList.add('hidden'));
  document.getElementById('tab-'+name)?.classList.remove('hidden');
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
}
async function boot(){
  const s = await api('/api/status');
  if (!s.authed) { document.getElementById('gateErr').textContent = s.error||''; return; }
  document.getElementById('gate').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('me').textContent = (s.userTag||s.userId)+' · '+(s.online?'bot online':'bot…');
  await refreshStock();
}
async function refreshStock(){
  const j = await api('/api/stock');
  document.getElementById('stockOut').innerHTML = Object.entries(j.pay||{}).map(([k,v])=>`<div><b>${k}</b> pay ${v}</div>`).join('')||'Empty';
  document.getElementById('genOut').innerHTML = Object.entries(j.gen||{}).map(([k,v])=>`<div><b>${k}</b> gen ${v}</div>`).join('')||'Empty';
}
document.getElementById('nav').onclick = e=>{ const b=e.target.closest('button[data-tab]'); if(b) tab(b.dataset.tab); };
document.getElementById('btnStock').onclick = ()=>refreshStock();
document.getElementById('btnGenAdd').onclick = async ()=>{
  try {
    const j = await api('/api/genadd',{method:'POST',body:JSON.stringify({product:document.getElementById('genProd').value,lines:document.getElementById('genLines').value})});
    document.getElementById('genMsg').innerHTML='<span class="ok">+'+j.added+'</span>';
    document.getElementById('genLines').value='';
    refreshStock();
  } catch(e){ document.getElementById('genMsg').textContent=e.message; }
};
document.getElementById('btnEco').onclick = async ()=>{
  try {
    await api('/api/economy',{method:'POST',body:JSON.stringify({userId:document.getElementById('ecoUser').value.trim(),coins:Number(document.getElementById('ecoCoins').value||0)})});
    document.getElementById('ecoMsg').innerHTML='<span class="ok">Saved</span>';
  } catch(e){ document.getElementById('ecoMsg').textContent=e.message; }
};
document.getElementById('btnBlur').onclick = ()=>{
  document.documentElement.style.setProperty('--blur', (document.getElementById('blur').value||1)+'px');
};
boot().catch(()=>{});

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
    document.getElementById('backupMsg').innerHTML = '<span class="ok">Imported ' + (j.keys || '') + ' keys — stocks & data live.</span>';
    refreshStock();
  } catch (e) {
    document.getElementById('backupMsg').textContent = e.message;
  }
};
