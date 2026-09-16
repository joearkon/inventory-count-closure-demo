(() => {
  const store = new URLSearchParams(location.search).get('store') || 'STORE001';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const tests = [
    ['zh-CN','中文','调 2kg 黑糖珍珠去 STORE002。','open_transfer',['黑糖珍珠','STORE002']],
    ['zh-CN','中文','查一下牛奶库存。','show_inventory',['牛奶']],
    ['zh-CN','中文','报损 2L 牛奶，原因过期。','open_scrap',['牛奶','过期']],
    ['en-US','English','Transfer 2 kg of brown sugar pearls to STORE002.','open_transfer',['STORE002']],
    ['en-US','English','Show me the milk inventory.','show_inventory',['milk']],
    ['en-US','English','Record 2 liters of expired milk as waste.','open_scrap',['milk']],
    ['id-ID','Bahasa Indonesia','Pindahkan 2 kg mutiara gula merah ke STORE002.','open_transfer',['STORE002']],
    ['id-ID','Bahasa Indonesia','Tampilkan stok susu.','show_inventory',['susu']],
    ['id-ID','Bahasa Indonesia','Catat susu kedaluwarsa 2 liter sebagai kerusakan.','open_scrap',['susu']]
  ].map(([lang,label,prompt,expected,keywords], index) => ({ id:index + 1, lang,label,prompt,expected,keywords,status:'pending',transcript:'',actual:'',error:'' }));
  let active = null, recognition = null;
  $('back-link').href = `/store/?store=${encodeURIComponent(store)}`;

  function render() {
    $('cases').innerHTML = tests.map((test) => `<article class="case"><div class="case-head"><div><h2>${test.id}. ${esc(test.label)} · ${esc(test.expected)}</h2><span class="muted">${esc(test.lang)} · 关键词：${esc(test.keywords.join(' / '))}</span></div><span class="status ${test.status}">${test.status === 'pass' ? '通过' : test.status === 'fail' ? '未通过' : test.status === 'running' ? '录音中' : '待测'}</span></div><div class="prompt">${esc(test.prompt)}</div><button class="btn" data-record="${test.id}" ${active ? 'disabled' : ''}>${test.status === 'running' ? '正在聆听…' : '开始这条录音'}</button><div class="result"><div><label>转写结果</label>${esc(test.transcript || '—')}</div><div><label>助手判定</label>${esc(test.error || test.actual || '—')}</div></div></article>`).join('');
    const done = tests.filter((test) => ['pass','fail'].includes(test.status)), passed = done.filter((test) => test.status === 'pass');
    $('done').textContent = done.length; $('passed').textContent = passed.length; $('accuracy').textContent = done.length ? `${Math.round(passed.length / done.length * 100)}%` : '--'; $('export').disabled = !done.length;
    document.querySelectorAll('[data-record]').forEach((button) => button.onclick = () => start(tests.find((test) => test.id === Number(button.dataset.record))));
  }

  async function evaluate(test, transcript) {
    const response = await fetch('/api/store-agent', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ message:transcript, store_code:store, session_id:`voice-qa-${Date.now()}-${test.id}`, lang:test.lang }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '助手接口错误');
    test.actual = data.action?.type || 'none';
    const normalized = transcript.toLowerCase(), keywordHit = test.keywords.some((word) => normalized.includes(String(word).toLowerCase()));
    test.status = test.actual === test.expected && keywordHit ? 'pass' : 'fail';
  }

  function start(test) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { test.status = 'fail'; test.error = '当前浏览器不支持 Web Speech Recognition'; return render(); }
    active = test; test.status = 'running'; test.error = ''; test.transcript = ''; render();
    recognition = new Recognition(); recognition.lang = test.lang; recognition.interimResults = true; recognition.continuous = false;
    recognition.onresult = (event) => { let text = ''; for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript; test.transcript = text; render(); };
    recognition.onerror = (event) => { test.status = 'fail'; test.error = `语音错误：${event.error || 'unknown'}`; active = null; render(); };
    recognition.onend = async () => { if (!active) return; active = null; try { if (!test.transcript.trim()) throw new Error('没有识别到语音'); await evaluate(test, test.transcript.trim()); } catch (error) { test.status = 'fail'; test.error = error.message; } render(); };
    try { recognition.start(); } catch (error) { test.status = 'fail'; test.error = error.message; active = null; render(); }
  }

  $('support-check').onclick = async () => {
    const speech = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition), media = Boolean(navigator.mediaDevices?.getUserMedia);
    if (!speech || !media) { $('support-note').textContent = `不完整：语音识别 ${speech ? '支持' : '不支持'}，媒体设备 ${media ? '支持' : '不支持'}`; return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio:true }); const tracks = stream.getAudioTracks(); $('support-note').textContent = tracks.length ? `可用：${tracks[0].label || '已授权麦克风'}` : '未检测到麦克风'; tracks.forEach((track) => track.stop()); }
    catch (error) { $('support-note').textContent = `麦克风不可用：${error.name || error.message}`; }
  };
  $('export').onclick = () => {
    const report = { generated_at:new Date().toISOString(), store_code:store, browser:navigator.userAgent, completed:tests.filter((test) => ['pass','fail'].includes(test.status)).length, passed:tests.filter((test) => test.status === 'pass').length, cases:tests };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type:'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `voice-qa-${store}-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
  };
  render();
})();
