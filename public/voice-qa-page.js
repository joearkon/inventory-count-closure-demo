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
  let active = null, mediaRecorder = null, activeStream = null, audioChunks = [], stopTimer = null;
  $('back-link').href = `/store/?store=${encodeURIComponent(store)}`;

  function render() {
    $('cases').innerHTML = tests.map((test) => {
      const recording = active === test && test.status === 'recording', transcribing = active === test && test.status === 'transcribing';
      const statusText = test.status === 'pass' ? '通过' : test.status === 'fail' ? '未通过' : recording ? '录音中' : transcribing ? '转写中' : '待测';
      return `<article class="case"><div class="case-head"><div><h2>${test.id}. ${esc(test.label)} · ${esc(test.expected)}</h2><span class="muted">${esc(test.lang)} · 关键词：${esc(test.keywords.join(' / '))}</span></div><span class="status ${test.status}">${statusText}</span></div><div class="prompt">${esc(test.prompt)}</div><button class="btn" data-record="${test.id}" ${(active && active !== test) || transcribing ? 'disabled' : ''}>${recording ? '停止并转写' : transcribing ? '正在转写…' : '开始录音'}</button><div class="result"><div><label>转写结果</label>${esc(test.transcript || '—')}</div><div><label>助手判定</label>${esc(test.error || test.actual || '—')}</div></div></article>`;
    }).join('');
    const done = tests.filter((test) => ['pass','fail'].includes(test.status)), passed = done.filter((test) => test.status === 'pass');
    $('done').textContent = done.length; $('passed').textContent = passed.length; $('accuracy').textContent = done.length ? `${Math.round(passed.length / done.length * 100)}%` : '--'; $('export').disabled = !done.length;
    document.querySelectorAll('[data-record]').forEach((button) => button.onclick = () => toggleRecording(tests.find((test) => test.id === Number(button.dataset.record))));
  }

  async function evaluate(test, transcript) {
    const response = await fetch('/api/store-agent', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ message:transcript, store_code:store, session_id:`voice-qa-${Date.now()}-${test.id}`, lang:test.lang }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '助手接口错误');
    test.actual = data.action?.type || 'none';
    const normalized = transcript.toLowerCase(), keywordHit = test.keywords.some((word) => normalized.includes(String(word).toLowerCase()));
    test.status = test.actual === test.expected && keywordHit ? 'pass' : 'fail';
  }

  function stopTracks() {
    clearTimeout(stopTimer); stopTimer = null;
    activeStream?.getTracks().forEach((track) => track.stop()); activeStream = null; mediaRecorder = null; audioChunks = [];
  }

  async function transcribe(test, blob) {
    test.status = 'transcribing'; render();
    const controller = new AbortController(), timeoutId = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(`/api/voice-transcribe?lang=${encodeURIComponent(test.lang)}`, { method:'POST', headers:{ 'content-type':blob.type || 'audio/webm', 'x-speech-language':test.lang }, body:blob, signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '语音转写失败');
      test.transcript = String(data.transcript || '').trim();
      if (!test.transcript) throw new Error('没有识别到有效语音');
      await evaluate(test, test.transcript);
    } catch (error) {
      test.status = 'fail'; test.error = error.name === 'AbortError' ? '语音转写超时，请重试。' : error.message;
    } finally { clearTimeout(timeoutId); active = null; stopTracks(); render(); }
  }

  function stopRecording() {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
  }

  async function startRecording(test) {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { test.status = 'fail'; test.error = '当前浏览器不支持录音，请改用最新版 Chrome 或 Edge。'; return render(); }
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } });
      const mimeType = ['audio/webm;codecs=opus','audio/webm','audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      mediaRecorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined); audioChunks = []; active = test;
      test.status = 'recording'; test.error = ''; test.transcript = '';
      mediaRecorder.ondataavailable = (event) => { if (event.data?.size) audioChunks.push(event.data); };
      mediaRecorder.onerror = (event) => { test.status = 'fail'; test.error = `录音错误：${event.error?.message || 'unknown'}`; active = null; stopTracks(); render(); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type:mediaRecorder?.mimeType || mimeType || 'audio/webm' });
        if (blob.size < 512) { test.status = 'fail'; test.error = '录音内容过短，请重新录音。'; active = null; stopTracks(); return render(); }
        transcribe(test, blob);
      };
      mediaRecorder.start(250); stopTimer = setTimeout(stopRecording, 15000); render();
    } catch (error) { test.status = 'fail'; test.error = `麦克风不可用：${error.name || error.message}`; active = null; stopTracks(); render(); }
  }

  function toggleRecording(test) {
    if (active === test && test.status === 'recording') return stopRecording();
    if (!active) startRecording(test);
  }

  async function probeMicrophone(timeoutMs = 8000) {
    let timeoutId, timedOut = false;
    const request = navigator.mediaDevices.getUserMedia({ audio:true });
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        const error = new Error('浏览器未返回麦克风权限结果'); error.name = 'TimeoutError'; reject(error);
      }, timeoutMs);
    });
    try { return await Promise.race([request, timeout]); }
    finally {
      clearTimeout(timeoutId);
      if (timedOut) request.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => {});
    }
  }

  $('support-check').onclick = async () => {
    const recorder = Boolean(window.MediaRecorder), media = Boolean(navigator.mediaDevices?.getUserMedia);
    if (!recorder || !media) { $('support-note').textContent = `不完整：录音 ${recorder ? '支持' : '不支持'}，媒体设备 ${media ? '支持' : '不支持'}`; return; }
    const button = $('support-check'); button.disabled = true; $('support-note').textContent = '正在检查，请在浏览器中允许麦克风…';
    try { const stream = await probeMicrophone(); const tracks = stream.getAudioTracks(); $('support-note').textContent = tracks.length ? `可用：${tracks[0].label || '已授权麦克风'}` : '未检测到麦克风'; tracks.forEach((track) => track.stop()); }
    catch (error) { $('support-note').textContent = error.name === 'TimeoutError' ? '检查超时：当前内置浏览器未返回麦克风权限结果，请改用 Chrome 或 Edge 验收。' : `麦克风不可用：${error.name || error.message}`; }
    finally { button.disabled = false; }
  };
  $('export').onclick = () => {
    const report = { generated_at:new Date().toISOString(), store_code:store, browser:navigator.userAgent, transcription_engine:'@cf/openai/whisper-large-v3-turbo', completed:tests.filter((test) => ['pass','fail'].includes(test.status)).length, passed:tests.filter((test) => test.status === 'pass').length, cases:tests };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type:'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `voice-qa-${store}-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
  };
  render();
})();
