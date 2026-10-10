const $ = id => document.getElementById(id);
let snapshot = null, paused = false, busy = false, lastError = false;
const statuses = {matched:'Hash cocok',pending:'Belum tersalin',tampered:'Data berubah',mismatch:'Cloud berbeda',incomplete:'Rantai belum lengkap',unavailable:'Belum terverifikasi'};
const chainLabels = {genesis:'Awal rantai',linked:'Terhubung',broken:'Rantai terputus',missing:'Pendahulu belum diterima','outside-window':'Pendahulu di luar jendela'};
const time = s => new Date(s*1000).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Jakarta'});
const number = n => (n/100).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:2});
function node(tag,text,className) { const el = document.createElement(tag); el.textContent = text; if(className) el.className=className; return el; }
function renderLocations() {
  $('locations').replaceChildren();
  for(const device of ['A','B','C']) {
    const r=snapshot?.records.find(r=>r.device===device), online=r&&!lastError&&(Date.now()/1000-r.timestamp<20);
    const card=node('article','', 'location'), top=node('div','', 'location-top');
    top.append(node('h2',`Lokasi ${device}`),node('span',online?'Data terkini':r?'Data lama':'Menunggu',`state ${online?'live':''}`));
    const reading=node('p',r?number(r.temp_centi):'--','reading'); reading.append(node('span',' °C'));
    const bottom=node('div','','location-bottom'); bottom.append(node('span',r?`Pukul ${time(r.timestamp)} WIB`:'Belum ada pembacaan'),node('span',r?statuses[r.integrity]:'Belum diperiksa'));
    card.append(top,reading,node('p',r?`Kelembapan ${number(r.humidity_centi)} %`:'Kelembapan belum tersedia','muted'),bottom);$('locations').append(card);
  }
}
function selected(){return (snapshot?.records||[]).filter(r=>r.device===$('location').value);}
function renderChart(rows) {
  const target=$('chart'), metric=$('metric').value, unit=metric==='temp_centi'?'°C':'%';
  if(!rows.length){target.replaceChildren(node('p','Grafik akan muncul setelah pembacaan diterima.','empty'));return;}
  const data=[...rows].sort((a,b)=>a.timestamp-b.timestamp||a.seq-b.seq), ys=data.map(r=>r[metric]/100);
  const lo=Math.floor(Math.min(...ys))-1,hi=Math.ceil(Math.max(...ys))+1;
  const start=data[0].timestamp,span=data.at(-1).timestamp-start;
  const points=ys.map((v,i)=>`${62+(span?(data[i].timestamp-start)/span*778:0)},${180-(v-lo)/(hi-lo)*150}`);
  const ticks=[lo,(hi+lo)/2,hi].map(v=>{const y=180-(v-lo)/(hi-lo)*150;return `<line x1="62" y1="${y}" x2="840" y2="${y}" stroke="var(--line)"/><text x="4" y="${y+4}" fill="var(--muted)" font-size="13">${v.toFixed(1)}</text>`;}).join('');
  target.innerHTML=`<svg viewBox="0 0 870 230" role="img" aria-label="${ys.length} pembacaan ${metric==='temp_centi'?'suhu':'kelembapan'} lokasi ${$('location').value}, minimum ${Math.min(...ys).toFixed(1)}, maksimum ${Math.max(...ys).toFixed(1)} ${unit}">${ticks}<polyline points="${points.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="3"/>${points.map(p=>{const[x,y]=p.split(',');return `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"/>`;}).join('')}<text x="62" y="215" fill="var(--muted)" font-size="13">${time(data[0].timestamp)} WIB</text><text x="840" y="215" text-anchor="end" fill="var(--muted)" font-size="13">${time(data.at(-1).timestamp)} WIB</text></svg>`;
}
function openDetail(r){
  $('detail-fields').replaceChildren();
  const fields=[['ID pembacaan',r.id],['Integritas',statuses[r.integrity]],['Hash SHA-256',r.hash],['Hash sebelumnya',r.prev_hash],['Rantai D1',chainLabels[r.primary_chain]||'Tidak tersedia'],['Rantai Neon',chainLabels[r.backup_chain]||'Tidak tersedia']];
  for(const [label,value] of fields)$('detail-fields').append(node('dt',label),node('dd',value,label.includes('Hash')?'hash':''));
  $('detail').showModal();
}
function renderHistory(){
  const rows=selected();renderChart(rows);$('readings').replaceChildren();$('empty').hidden=!!rows.length;$('export').disabled=!rows.length;
  for(const r of rows.slice(0,12)){
    const tr=node('tr','');
    for(const value of [`${time(r.timestamp)} WIB`,`${number(r.temp_centi)} °C`,`${number(r.humidity_centi)} %`,`${r.primary_present?'Ada':'Belum'} / ${r.backup_present?'Ada':'Belum'}`])tr.append(node('td',value));
    tr.append(node('td',statuses[r.integrity],r.integrity==='matched'?'matched':['tampered','mismatch'].includes(r.integrity)?'problem':''));
    const td=node('td',''),button=node('button','Periksa hash');button.type='button';button.onclick=()=>openDetail(r);td.append(button);tr.append(td);$('readings').append(tr);
  }
}
function render(){
  renderLocations();renderHistory();
  const labels={online:'Terhubung',unavailable:'Tidak dapat diakses','not-configured':'Belum dikonfigurasi'};
  for(const side of ['primary','backup'])$(side).textContent=snapshot?labels[snapshot.clouds[side]]:'Memeriksa…';
  const records=snapshot?.records||[], matched=records.filter(r=>r.integrity==='matched').length, problems=records.filter(r=>['tampered','mismatch'].includes(r.integrity)).length;
  $('integrity').textContent=records.length?`${matched} / ${records.length} hash cocok antar-cloud${problems?` · ${problems} perlu diperiksa`:''}`:'Menunggu pembacaan sensor';
  $('integrity').className=problems?'problem':matched?'matched':'';
}
async function refresh(){
  if(busy)return;busy=true;$('refresh').disabled=true;
  try{
    const response=await fetch('/api/snapshot',{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('API belum tersedia');
    snapshot=await response.json();lastError=false;
    $('error').hidden=true;$('updated').textContent=`Diperbarui ${new Date().toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta'})} WIB`;
    $('connection').textContent=snapshot.source?`Sumber baca: ${snapshot.source} · ${paused?'Pembaruan dijeda':'Pembaruan otomatis aktif'}`:'Penyimpanan belum dapat diakses';
    if(!snapshot.source){$('error').hidden=false;$('error').textContent='D1 dan Neon belum dapat diakses. Periksa konfigurasi database.';}
    render();
  }catch{
    lastError=true;$('error').hidden=false;$('error').textContent='Pembaruan gagal. Data sebelumnya tetap ditampilkan; waktu pembacaan tidak diperbarui.';
    $('primary').textContent='Status belum dapat diperbarui';$('backup').textContent='Status belum dapat diperbarui';
    $('connection').textContent='Koneksi API bermasalah';renderLocations();
  }finally{busy=false;$('refresh').disabled=false;}
}
$('refresh').onclick=refresh;
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Lanjutkan pembaruan':'Jeda pembaruan';$('connection').textContent=paused?'Pembaruan otomatis dijeda':'Pembaruan otomatis aktif';if(!paused)refresh();};
$('location').onchange=renderHistory;$('metric').onchange=renderHistory;$('close').onclick=()=>$('detail').close();
$('export').onclick=()=>{
  const rows=selected(),keys=['id','device','session','seq','timestamp','temp_centi','humidity_centi','prev_hash','hash','integrity'];
  const csv=[keys.join(','),...rows.map(r=>keys.map(k=>`"${String(r[k]).replaceAll('"','""')}"`).join(','))].join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`tp2-lokasi-${$('location').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
render();refresh();setInterval(()=>{renderLocations();if(!paused&&!document.hidden)refresh();},5000);
