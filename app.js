/* SPY GAME v1.3 - iPad司会室 / 外部ライブラリ不要・GitHub Pages対応 */
(() => {
  'use strict';
  const STORAGE_KEY = 'spy-game-family-host-v1';
  const NAV = [
    {id:'home', icon:'⌂', name:'司会ホーム'},
    {id:'memory', icon:'▦', name:'色の記憶'},
    {id:'draw', icon:'✎', name:'絵しりとり'},
    {id:'word', icon:'♠', name:'文字数しりとり'},
    {id:'number', icon:'⇅', name:'数字並びチャレンジ'},
    {id:'kana', icon:'あ', name:'人間ひらがなクイズ'},
    {id:'shape', icon:'◯', name:'図形で伝えろ！'},
    {id:'results', icon:'◎', name:'結果・スパイ投票'},
    {id:'settings', icon:'⚙', name:'設定・ルール'}
  ];
  const COLORS = ['あか','きいろ','みどり','あお','ぴんく'];
  const MODES = ['順手','順手','順手','逆手','逆手'];
  const KANA = [...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'];
  const SHAPE_PROMPTS=['うさぎ','ぞう','くま','ねこ','いえ','くるま','ゆきだるま','きのこ','かめ','さかな','ちょうちょ','ぺんぎん','ぶた','ふね','ろけっと','めがね','かさ','ひよこ','きりん','じてんしゃ','ひこうき','はさみ','たこ','かたつむり'];
  const EMPTY_TIMER = seconds => ({durationMs:seconds*1000,remainingMs:seconds*1000,startedAt:null,running:false,expired:false});
  const defaultState = () => ({
    version:1, page:'home', players:['プレイヤー1','プレイヤー2','プレイヤー3','プレイヤー4','プレイヤー5'],
    config:{memorySeconds:20,memoryPass:12,drawSeconds:30,drawPass:3,wordSeconds:300,numberSeconds:90,sound:true},
    memory:{phase:'ready',timer:EMPTY_TIMER(20),score:null,notes:'',history:[]},
    draw:{phase:'ready',order:[],modes:[],current:0,timer:EMPTY_TIMER(30),timeFlags:[],score:null,history:[]},
    word:{phase:'ready',mode:'physical',order:[],current:0,timer:EMPTY_TIMER(300),deck:[],selectedNumber:null,selectedColor:null,turns:[],history:[]},
    number:{phase:'ready',timer:EMPTY_TIMER(90),lineup:Array.from({length:5},()=>({person:'',card:''})),success:null,expired:false,history:[]},
    kana:{current:null,correct:0,seen:[],skipped:0,history:[]},
    shape:{current:null,seen:[],visible:false,helper:'',correct:0,attempts:0,history:[]},
    spy:{mode:'physical',spyIndex:null,dealStep:0,secretOpened:false,votes:[null,null,null,null,null],tallyOpen:false,actual:null,revealed:false}
  });
  const getEl = id => document.getElementById(id);
  const esc = input => String(input??'').replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const pad = n => String(n).padStart(2,'0');
  const durationString = ms => {const t=Math.max(0,Math.ceil(ms/1000));return `${pad(Math.floor(t/60))}:${pad(t%60)}`;};
  const todayString = () => new Date().toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const shuffled = list => {const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const suitIcon = color => color==='red'?'♥':'♠';
  const colorName = color => color==='red'?'赤・カタカナ語':'黒・カタカナ語以外';
  const getTimer = key => state[key].timer;
  function left(t){if(!t)return 0;return Math.max(0,(t.remainingMs||0)-(t.running?Date.now()-(t.startedAt||Date.now()):0));}
  function start(t){if(!t.running&&left(t)>0){t.remainingMs=left(t);t.startedAt=Date.now();t.running=true;t.expired=false;}}
  function stop(t){t.remainingMs=left(t);t.startedAt=null;t.running=false;}
  function reset(t,seconds){Object.assign(t,EMPTY_TIMER(seconds));}
  function activeOtherTimer(key){return ['memory','draw','word','number'].some(k=>k!==key && getTimer(k).running);}
  function pauseOtherTimers(key){['memory','draw','word','number'].filter(k=>k!==key).forEach(k=>{if(getTimer(k).running)stop(getTimer(k));});}
  function expired(t){return left(t)===0 && (t.expired||t.running);}
  function usableState(obj){try{
    const s=defaultState();if(!obj||obj.version!==1)return s;
    const merged={...s,...obj,config:{...s.config,...obj.config},memory:{...s.memory,...obj.memory},draw:{...s.draw,...obj.draw},word:{...s.word,...obj.word},number:{...s.number,...obj.number},kana:{...s.kana,...obj.kana},shape:{...s.shape,...obj.shape},spy:{...s.spy,...obj.spy}};
    if(!Array.isArray(merged.players)||merged.players.length!==5)merged.players=s.players;
    if(!Array.isArray(merged.kana.seen))merged.kana.seen=[];
    if(!Array.isArray(merged.kana.history))merged.kana.history=[];
    if(!Array.isArray(merged.shape.seen))merged.shape.seen=[];
    if(!Array.isArray(merged.shape.history))merged.shape.history=[];
    if(!Array.isArray(merged.number.lineup)||merged.number.lineup.length!==5)merged.number.lineup=s.number.lineup;
    if(!Array.isArray(merged.number.history))merged.number.history=[];
    if(!Number.isInteger(merged.kana.correct)||merged.kana.correct<0)merged.kana.correct=0;
    if(merged.kana.current!==null&&!KANA.includes(merged.kana.current))merged.kana.current=null;
    if(!NAV.some(x=>x.id===merged.page))merged.page='home';
    for(const k of ['memory','draw','word','number'])if(!merged[k].timer||typeof merged[k].timer.remainingMs!=='number')merged[k].timer=s[k].timer;
    for(const k of ['memory','draw','word','number'])if(!Array.isArray(merged[k].history))merged[k].history=[];
    return merged;
  }catch{return defaultState();}}
  let state;try{state=usableState(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'));}catch{state=defaultState();}
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{toast('端末の保存容量またはブラウザ設定を確認してください');}}
  function toast(message){const el=getEl('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>el.classList.remove('show'),3000);}
  let soundContext=null;
  function unlockSound(){if(!state.config.sound)return;try{const AudioCtor=window.AudioContext||window.webkitAudioContext;if(AudioCtor){soundContext=soundContext||new AudioCtor();soundContext.resume().catch(()=>{});}}catch{}}
  function sound(){if(!state.config.sound)return;try{
    const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)return;
    soundContext=soundContext||new AudioCtor();soundContext.resume().catch(()=>{});
    const now=soundContext.currentTime;
    for(let i=0;i<3;i++){const osc=soundContext.createOscillator();const gain=soundContext.createGain();osc.type='sine';osc.frequency.value=i===2?660:880;gain.gain.setValueAtTime(.0001,now+i*.23);gain.gain.exponentialRampToValueAtTime(.10,now+i*.23+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.23+.18);osc.connect(gain);gain.connect(soundContext.destination);osc.start(now+i*.23);osc.stop(now+i*.23+.2);}
  }catch{}}
  function confirmModal(title,message,yesLabel,yesAction){
    const modal=getEl('modalContent');modal.innerHTML=`<div class="eyebrow">確認</div><div class="modal-title">${esc(title)}</div><p>${esc(message)}</p><div class="action-row"><button class="btn ghost grow" data-action="close-modal">キャンセル</button><button class="btn primary grow" data-action="confirm-modal">${esc(yesLabel)}</button></div>`;
    confirmModal.yesAction=yesAction;getEl('modalBackdrop').hidden=false;
  }
  function showModal(title,html,close='閉じる'){
    getEl('modalContent').innerHTML=`<div class="eyebrow">SPY GAME</div><div class="modal-title">${esc(title)}</div>${html}<div class="action-row"><button class="btn primary full" data-action="close-modal">${esc(close)}</button></div>`;
    getEl('modalBackdrop').hidden=false;
  }
  function closeModal(){getEl('modalBackdrop').hidden=true;confirmModal.yesAction=null;}
  function saveAndRender(message){persist();render();if(message)toast(message);}
  function nav(page){if(!NAV.some(x=>x.id===page))return;state.page=page;saveAndRender();window.scrollTo({top:0,behavior:'instant'});}
  const resultPill=ok=>`<span class="pill ${ok?'green':'gold'}">${ok?'✓ チャレンジ成功':'△ 未達成'}</span>`;
  function pageHeader(eyebrow,title,lead){return `<div class="eyebrow">${eyebrow}</div><h1 class="heading">${title}</h1><p class="lead">${lead}</p>`;}
  function note(text,kind=''){return `<div class="notice ${kind}"><span class="notice-icon">${kind==='warn'?'!':kind==='good'?'✓':'ⓘ'}</span><span>${text}</span></div>`;}
  function timerPanel(id,label,key){
    const t=getTimer(key);const remain=left(t);const p=t.durationMs?remain/t.durationMs*100:0;
    return `<div class="timer-panel" id="${id}"><div class="timer-label">${esc(label)}</div><div class="timer-value ${remain===0?'warn':''}" data-timer-value="${key}">${durationString(remain)}</div><div class="timer-bar"><div class="timer-fill ${remain<=10000?'warn':''}" data-timer-fill="${key}" style="width:${p}%"></div></div><div class="micro" data-timer-status="${key}">${t.running?'カウントダウン中':remain===0?'時間終了':'開始前・一時停止中'}</div></div>`;
  }
  function steps(labels,current){return `<div class="stepper">${labels.map((x,i)=>`<span class="step ${i===current?'current':i<current?'done':''}">${i<current?'✓ ':''}${esc(x)}</span>`).join('')}</div>`;}
  function sideInfo(title,items){return `<section class="card soft"><h3 class="card-title">${title}</h3><dl class="game-details">${items.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl></section>`;}
  function counts(key){const h=state[key].history;return {rounds:h.length,wins:h.filter(r=>r.success).length};}
  function screenHome(){
    const games=[
      ['01','▦','色の記憶','15枚の色を覚えて再現。子どもが配置を作る。','memory'],
      ['02','✎','順手・逆手 絵しりとり','描き方を抽選、絵は紙に残す。','draw'],
      ['03','♠','文字数しばりしりとり','トランプ2〜6、2巡10手番。','word'],
      ['04','⇅','数字並びチャレンジ','自分のカードだけ見て小さい順に並ぶ。','number'],
      ['05','あ','人間ひらがなクイズ','子ども2人が体で表現。お題と正解数を表示。','kana'],
      ['06','◯','図形で伝えろ！','お題を見て図形を並べ、大人4人が当てる。','shape']
    ];
    const played=['memory','draw','word','number'].reduce((n,k)=>n+counts(k).rounds,0)+state.kana.history.length+state.shape.history.length;
    const wins=['memory','draw','word','number'].reduce((n,k)=>n+counts(k).wins,0)+state.kana.history.filter(r=>r.success).length+state.shape.history.filter(r=>r.success).length;
    return `<section class="hero"><div><div class="eyebrow">NOVEMBER 22 · FAMILY EVENT</div><h1 class="hero-title">SPY GAME 司会室</h1><p>大人5人＋子ども2人。<br>抽選・時間管理・お題表示をiPadにまとめた6競技版。</p><div class="action-row"><button class="btn primary" data-nav="memory">競技をはじめる →</button><button class="btn ghost" data-nav="settings">参加者・ルール</button></div></div><div class="bigstar" aria-hidden="true">✦</div></section>
      <h2 class="section-title">競技メニュー（6種）</h2>
      <div class="grid grid-3">${games.map(([no,icon,name,desc,key])=>gameTile(no,icon,name,desc,key,{rounds:(state[key].history||[]).length})).join('')}</div>
      <h2 class="section-title">本日の進行状況</h2><div class="grid grid-3"><div class="stat"><div class="num">${played}</div><div class="desc">保存済みのラウンド</div></div><div class="stat"><div class="num mint">${wins}</div><div class="desc">チャレンジ成功</div></div><div class="stat"><div class="num">5 <span class="small">人</span></div><div class="desc">大人の参加者</div></div></div>
      <div class="section-gap">${note('紙に残した絵・しりとりの回答は、最後のスパイ推理で確認。写真撮影機能はありません。色の記憶は正解配置を一度だけ別のカメラで撮影してください。')}</div>
      <div class="action-row"><button class="btn ghost" data-nav="results">結果・スパイ投票 →</button><button class="btn ghost" data-action="show-rules">ルールを確認</button></div>`;
  }
  function gameTile(number,icon,name,desc,id,score){return `<article class="card game-tile"><div class="row between" style="width:100%"><div class="game-num">MISSION ${number}</div><span class="pill">${score.rounds}回実施</span></div><div class="emoji">${icon}</div><div class="game-name">${name}</div><p>${desc}</p><button class="btn primary full" data-nav="${id}">進行画面を開く →</button></article>`;}
  function drawKana(){
    const k=state.kana;
    const pool=KANA.filter(char=>!k.seen.includes(char));
    const candidates=pool.length?pool:KANA;
    const index=Math.floor(Math.random()*candidates.length);
    k.current=candidates[index];
    k.seen=pool.length?[...k.seen,k.current]:[k.current];
  }
  function screenKana(){
    const k=state.kana;
    return `${pageHeader('MISSION 05 · KIDS','人間ひらがなクイズ','子ども2人が体でひらがなを表現。司会者と黒子だけがお題を確認。時間は別のタイマーで管理。')}
      <section class="card kana-stage">
        <div class="kana-top"><span class="pill">子ども2人 ＋ 黒子1人</span><div class="kana-progress ${k.correct>=7?'reached':''}">正解 <strong>${k.correct}</strong><span> / 7 問</span></div></div>
        <div class="kana-panel" aria-label="現在のひらがなのお題">
          <div class="kana-caption">${k.current===null?'ボタンを押して最初のお題を表示':'いまのお題'}</div>
          <div class="kana-letter" aria-live="polite">${k.current??'？'}</div>
          <div class="kana-support">${k.correct>=7?'目標の7問正解に到達！': '回答者4人には画面を見せないでね'}</div>
        </div>
        <div class="kana-controls">
          <button class="btn mint-btn kana-main-btn" data-action="kana-correct" ${k.current===null?'disabled':''}>✓ 正解！ ＋1・次の文字</button>
          <button class="btn primary kana-main-btn" data-action="kana-next">↻ ${k.current===null?'最初のお題を抽選':'パス・再抽選'}</button>
        </div>
        <div class="kana-footer"><span>全46文字からランダム抽選。同じ文字は46文字を使い切るまで出ません。</span><div class="row wrap"><button class="btn primary tiny" data-action="kana-save" ${k.current===null?'disabled':''}>結果を保存</button><button class="btn ghost tiny" data-action="kana-reset">正解数をリセット</button></div></div>${simpleHistory('kana','人間ひらがな')}
      </section>`;
  }
  function screenNumber(){
    const n=state.number,c=state.config;
    const stepsHTML=steps(['準備','並ぶ','カード公開・採点'],n.phase==='ready'?0:n.phase==='play'?1:2);
    let main='';
    if(n.phase==='ready')main=`<section class="card"><h2 class="card-title">自分の数字だけを確認して並ぼう</h2><p class="small">A〜K（1〜13）から異なる5枚を実際のトランプで配る。ほかの人にカードを見せない。数字や「偶数」「1けた」など具体的な手掛かりは禁止。大まかな大小の相談はOK。</p>${timerPanel('numberTimer','残り時間','number')}<div class="action-row"><button class="btn primary big full" data-action="number-start">${c.numberSeconds}秒チャレンジ開始 →</button></div></section>`;
    if(n.phase==='play')main=`<section class="card"><h2 class="card-title">大人5人で小さい順に並ぶ</h2>${timerPanel('numberTimer','並び替えの残り時間','number')}<div class="section-gap">${note('カードは伏せたまま。直接数字を伝えず、左から小さい順に並んでください。')}</div><div class="action-row"><button class="btn ghost grow" data-action="number-toggle">${n.timer.running?'一時停止':'再開'}</button><button class="btn primary grow big" data-action="number-reveal">並びが決まった・カード公開 →</button></div></section>`;
    if(n.phase==='check'){
      const completed=n.lineup.every(x=>x.card!=='' && Number.isInteger(Number(x.card))); const values=n.lineup.map(x=>Number(x.card));
      main=`<section class="card"><h2 class="card-title">左から順番にカードの数字を入力</h2><p class="small">5人が並んだ順に、公開したカードを選んでください。名前は任意。入力せず「成功／失敗を手動記録」もできます。</p><div class="number-lineup">${n.lineup.map((r,i)=>`<div class="number-position"><div class="micro">左から${i+1}番目</div><select class="select" data-number-person="${i}"><option value="">名前（任意）</option>${state.players.map((name,j)=>`<option value="${j}" ${String(r.person)===String(j)?'selected':''}>${esc(name)}</option>`).join('')}</select><select class="select" data-number-card="${i}"><option value="">カード</option>${Array.from({length:13},(_,j)=>j+1).map(v=>`<option value="${v}" ${String(r.card)===String(v)?'selected':''}>${v===1?'A':v===11?'J':v===12?'Q':v===13?'K':v}</option>`).join('')}</select></div>`).join('')}</div><div class="action-row"><button class="btn primary full big" data-action="number-check" ${!completed?'disabled':''}>数字で正誤を判定する</button></div><div class="action-row"><button class="btn mint-btn grow" data-action="number-manual" data-value="success">✓ 成功として記録</button><button class="btn danger-btn grow" data-action="number-manual" data-value="fail">✕ 失敗として記録</button></div>${n.expired?note('制限時間が終了しています。自動判定は未達成になります。','warn'):''}</section>`;
    }
    if(n.phase==='done')main=`<section class="card"><div class="eyebrow">RESULT</div><h2 class="card-title">数字並びチャレンジ</h2><div class="result-score ${n.success?'mint':'danger'}">${n.success?'成功！':'未達成'}</div>${n.lineup.some(x=>x.card!=='')?`<p class="small">左から：${n.lineup.map(x=>x.card||'？').join(' ・ ')}</p>`:''}<p class="small">制限時間内に小さい順で並べたら成功。並び方はここで振り返れます。</p><button class="btn primary full big" data-action="number-save">結果を保存して終了</button></section>`;
    return `${pageHeader('MISSION 04 · CARDS','数字並びチャレンジ','自分のカードだけ見て、話し合いながら小さい順に並ぶ。数字そのものや数字を特定するヒントは禁止。')}${stepsHTML}${main}${simpleHistory('number','数字並び')}${n.phase!=='ready'?`<div class="action-row"><button class="btn ghost tiny" data-action="number-reset">この回をやり直す</button></div>`:''}`;
  }
  function drawShape(){const t=state.shape;const pool=SHAPE_PROMPTS.filter(w=>!t.seen.includes(w));const choices=pool.length?pool:SHAPE_PROMPTS;t.current=choices[Math.floor(Math.random()*choices.length)];t.seen=pool.length?[...t.seen,t.current]:[t.current];t.visible=false;}
  function screenShape(){const t=state.shape;const remaining=Math.max(0,5-t.attempts);const finished=t.attempts>=5;
    return `${pageHeader('MISSION 06 · SHAPES','図形で伝えろ！','子ども2人が主役。補助の大人が特別図形を2個選び、子どもたちはその2個を必ず使って表現する。')}
      <section class="card shape-stage"><div class="row between wrap"><span class="pill">大人1人：図形指定＆アドバイス</span><span class="pill">残りの大人4人：回答</span></div>
      <div class="shape-progress"><div>正解 <strong>${t.correct}</strong> 問</div><div>出題 <strong>${t.attempts}</strong> / 5問</div></div>
      <div class="settings-row"><label class="input-label" for="shapeHelper">補助役の大人（任意）</label><select class="select" id="shapeHelper" data-shape-helper><option value="">自分たちで決める</option>${state.players.map((name,i)=>`<option value="${i}" ${String(t.helper)===String(i)?'selected':''}>${esc(name)}</option>`).join('')}</select></div>
      <div class="shape-prompt ${t.visible?'show':''}"><div class="micro">${t.current===null?'まず「お題を抽選」を押す':t.visible?'子ども2人と補助役だけが見る':'回答者に見せないでね'}</div><div class="shape-word">${t.current===null?'？':t.visible?esc(t.current):'ひみつ'}</div></div>
      <div class="shape-actions"><button class="btn ghost" data-action="shape-toggle" ${t.current===null?'disabled':''}>${t.visible?'🙈 お題を隠す':'👁 お題を大きく表示'}</button><button class="btn primary" data-action="shape-next" ${finished?'disabled':''}>${t.current===null?'🎲 最初のお題を抽選':'↻ パス・次のお題'}</button></div>
      <div class="action-row"><button class="btn mint-btn grow big" data-action="shape-correct" ${(t.current===null||finished)?'disabled':''}>✓ 正解！ ＋1・次へ</button><button class="btn danger-btn grow big" data-action="shape-fail" ${(t.current===null||finished)?'disabled':''}>✕ 不正解・次へ</button></div>
      ${finished?`<div class="notice ${t.correct>=3?'good':'warn'} section-gap"><span class="notice-icon">${t.correct>=3?'✓':'!'}</span><span>5問終了：${t.correct} / 5問正解。参考成功ラインは3問以上です。</span></div>`:`<p class="small">残り${remaining}問。パスは1問消費。時間は外部のタイマーで計測してもOK。お題は24種類から重複なしで抽選します。</p>`}
      <div class="action-row"><button class="btn primary" data-action="shape-save" ${t.attempts===0?'disabled':''}>この回の結果を保存</button><button class="btn ghost" data-action="shape-reset">最初からやり直す</button></div>
      </section>
      <section class="card soft section-gap"><h3 class="card-title">使える図形と進め方</h3><p class="small">○△□は自由に使用。大人は事前に準備した特別図形（アルファベット形など）から2個選んで渡す。子ども2人は指定された2個を必ず使う。図形を並べるのは子どもだけ。大人のアドバイスはOK、直接並べる・答えを言う・文字としてアルファベットを使うのは禁止。</p></section>${simpleHistory('shape','図形で伝えろ！')}`;
  }
  function simpleHistory(key,label){const h=state[key].history;if(!h?.length)return '';return `<section class="card soft section-gap"><h3 class="card-title">${label}の履歴</h3>${h.slice().reverse().map((r,i)=>`<div class="history-row"><b>${h.length-i}回目</b><div class="muted">${esc(r.date)}</div><strong>${r.summary|| (r.correct+'問正解')}</strong>${resultPill(r.success)}</div>`).join('')}</section>`;}
  function screenMemory(){
    const m=state.memory,c=state.config;const phaseIndex={ready:0,memorize:1,place:2,score:3}[m.phase]??0;
    let main='';
    if(m.phase==='ready')main=`<div class="grid"><section class="card"><div class="eyebrow">SETUP</div><h2 class="card-title">子どもたちに問題を作ってもらう</h2><ol class="help-list"><li>A3台紙に15枚を自由に並べる。</li><li>子どもか司会者が、<strong>正解の写真を1枚だけ</strong>撮る（アプリに登録する必要なし）。</li><li>大人5人に見せる準備をする。記憶中の相談・分担は禁止。</li></ol><div class="action-row"><button class="btn primary big full" data-action="memory-start">${c.memorySeconds}秒の記憶タイマーを開始 →</button></div></section>${sideInfo('ゲームの条件', [['カード','15枚（5色・各色最大4枚）'],['配置','A3・3行×5列'],['記憶',`${c.memorySeconds}秒・相談禁止`],['手札','大人5人に各3枚・非公開'],['配置','表向き・1人1枚ずつ3巡'],['成功',`${c.memoryPass} / 15 マス以上正解`]])}</div>`;
    if(m.phase==='memorize')main=`${timerPanel('memoryClock','配置を覚える時間','memory')}<div class="action-row"><button class="btn ${m.timer.running?'ghost':'primary'} grow" data-action="memory-toggle">${m.timer.running?'Ⅱ 一時停止':'▶ 記憶タイマー再開'}</button><button class="btn primary grow" data-action="memory-next">暗記終了・カードを回収 →</button></div><div class="section-gap">${note('大人同士の相談や「上の列を覚えて！」といった担当分けは禁止。20秒後、同じ15枚を回収して混ぜます。')}</div>`;
    if(m.phase==='place')main=`<section class="card"><div class="eyebrow">TEAM CHALLENGE</div><h2 class="card-title">カードを配って再現！</h2><div class="name-list">${state.players.map((n,i)=>`<div class="name-card"><div class="name">${esc(n)}</div><div class="sub">3枚ずつ</div></div>`).join('')}</div><ol class="help-list"><li>先ほどの15枚を混ぜ、1人3枚ずつランダムに配る。</li><li>手札は他人に見せない。置くときは<strong>表向き</strong>。</li><li>1人1枚ずつ順番に置き、合計3巡する。</li><li>配置中は相談OK。一度置いたカードは動かせない。</li></ol><div class="action-row"><button class="btn primary big full" data-action="memory-check">配置が終わった → 採点へ</button></div></section>`;
    if(m.phase==='score')main=`<section class="card"><div class="eyebrow">RESULT</div><h2 class="card-title">正解したマスを数える</h2><p class="small">写真の正解配置と、実際の15マスを比べてね。色と位置が一致したマスだけを数える。</p><div class="count-grid">${Array.from({length:16},(_,i)=>`<button class="count-btn ${m.score===i?'selected':''}" data-action="memory-score" data-value="${i}">${i}</button>`).join('')}</div><div class="section-gap">${m.score===null?note(`成功ライン：15マス中${c.memoryPass}マス以上`):`<div class="row between wrap"><div><div class="micro">正解数</div><div class="result-score">${m.score}<span class="small"> / 15</span></div></div>${resultPill(m.score>=c.memoryPass)}</div>`}</div><div class="action-row"><button class="btn primary big full" data-action="memory-save" ${m.score===null?'disabled':''}>この結果を保存して終了</button></div></section>`;
    return `${pageHeader('MISSION 01 · MEMORY','色の記憶ゲーム','子どもたちが作った配置を、大人5人で思い出そう。スパイは間違った場所への誘導もできる。')}${steps(['準備','20秒暗記','配布・配置','採点'],phaseIndex)}${main}${memoryHistory()}${m.phase!=='ready'?`<div class="action-row"><button class="btn ghost tiny" data-action="memory-reset">この回を最初からやり直す</button></div>`:''}`;
  }
  function memoryHistory(){const h=state.memory.history;if(!h.length)return '';
    return `<section class="section-gap card soft"><h3 class="card-title">これまでの記録</h3>${h.slice().reverse().map((r,i)=>`<div class="history-row"><b>${h.length-i}回目</b><div class="muted">${esc(r.date)}</div><strong>${r.score} / 15</strong>${resultPill(r.success)}</div>`).join('')}</section>`;
  }
  function screenDraw(){
    const d=state.draw,c=state.config;const phaseIndex={ready:0,planned:1,play:2,score:3}[d.phase]??0;
    let main='';
    if(d.phase==='ready')main=`<div class="grid"><section class="card"><div class="eyebrow">DRAW LOTS</div><h2 class="card-title">順番と描き方を抽選</h2><p class="small">大人5人の順番をシャッフルし、順手3枚・逆手2枚をランダム配布。途中で何を描いたか、紙を残して検証しよう。</p><div class="action-row"><button class="btn primary big full" data-action="draw-plan">順番と描き方を抽選する →</button></div></section>${sideInfo('ルール', [['順手','いつもの利き手で描く'],['逆手','利き手と反対で描く'],['時間',`1人${c.drawSeconds}秒`],['参加','大人5人・絵だけ使用'],['禁止','文字・数字・口頭ヒント'],['成功の目安',`4つのつながりのうち${c.drawPass}以上（仮）`]])}</div>`;
    if(d.phase==='planned')main=`<section class="card"><div class="eyebrow">READY</div><h2 class="card-title">この順番で絵をつなぐ</h2>${drawOrderCards(d)}<div class="section-gap">${note('最初の人だけ子どもが決めたスタートのお題を見ます。2人目以降は、直前の人が描いた絵だけを見て、しりとりになる絵を描きます。各自の紙の裏に「描いたつもりの言葉」を記録。')}</div><div class="action-row"><button class="btn primary big grow" data-action="draw-begin">1人目の進行へ →</button><button class="btn ghost" data-action="draw-plan">再抽選</button></div></section>`;
    if(d.phase==='play'){
      const idx=d.current;const player=d.order[idx];const mode=d.modes[idx];
      main=`${drawOrderCards(d)}<div class="section-gap grid"><section class="card"><div class="eyebrow">${idx+1} / 5人目</div><div class="draw-person">${esc(state.players[player])}</div><div class="draw-big">${mode==='逆手'?'✋ 逆手で描く':'✎ 順手で描く'}</div><p class="small">${idx===0?'子どもの出したスタートのお題を、絵にしてね。':'直前の人の絵だけを見て、しりとりになる言葉の絵を描いてね。'}</p></section><section class="card soft">${timerPanel('drawClock',`描画時間 ${c.drawSeconds}秒`,'draw')}<div class="action-row"><button class="btn ${d.timer.running?'ghost':'primary'} full" data-action="draw-toggle">${d.timer.running?'Ⅱ 一時停止':'▶ タイマー開始'}</button></div></section></div><div class="action-row"><button class="btn primary big grow" data-action="draw-next">${idx===4?'5人終了・答え合わせへ':'描けた！次の人へ →'}</button><button class="btn ghost" data-action="draw-back" ${idx===0?'disabled':''}>ひとつ戻る</button></div>${note('各人の紙は回収して保管。あとから5枚を並べて、どこで言葉が変わったかを見返します。')}`;
    }
    if(d.phase==='score')main=`<section class="card"><div class="eyebrow">REVIEW</div><h2 class="card-title">5枚の絵を並べて確認</h2>${drawOrderCards(d)}<p class="small section-gap">前の絵から次の絵へ、しりとりが成立した箇所を数えてください。5枚の絵には<strong>4つのつながり</strong>があります。</p><div class="count-grid" style="grid-template-columns:repeat(5,minmax(0,1fr))">${Array.from({length:5},(_,i)=>`<button class="count-btn ${d.score===i?'selected':''}" data-action="draw-score" data-value="${i}">${i}</button>`).join('')}</div>${d.score===null?`<div class="section-gap">${note(`成功の目安：4つ中${c.drawPass}つながり以上（変更可能）`)}</div>`:`<div class="section-gap row between wrap"><div><div class="micro">成立したつながり</div><div class="result-score">${d.score} <span class="small">/ 4</span></div></div>${resultPill(d.score>=c.drawPass)}</div>`}<div class="section-gap">${d.timeFlags.some(v=>v)?note('30秒を超過した手番があります。成立数とは別に記録に残します。','warn'):''}</div><div class="action-row"><button class="btn primary big full" data-action="draw-save" ${d.score===null?'disabled':''}>この結果を保存して終了</button></div></section>`;
    return `${pageHeader('MISSION 02 · DRAWING','順手・逆手 絵しりとり','引いたカードで描き方が変わる。紙に残った5人の絵から、スパイの手がかりを探そう。')}${steps(['抽選','順番確認','5人で描く','検証・採点'],phaseIndex)}${main}${drawHistory()}${d.phase!=='ready'?`<div class="action-row"><button class="btn ghost tiny" data-action="draw-reset">この回を最初からやり直す</button></div>`:''}`;
  }
  function drawOrderCards(d){return `<div class="pick-list">${d.order.map((p,i)=>`<div class="pick-box ${d.phase==='play'&&i===d.current?'active':''}"><span>${i+1}人目 ${d.timeFlags[i]?'⏱':''}</span><strong>${esc(state.players[p])}</strong><span class="mode ${d.modes[i]==='逆手'?'reverse':''}">${d.modes[i]==='逆手'?'✋ 逆手':'✎ 順手'}</span></div>`).join('')}</div>`;}
  function drawHistory(){const h=state.draw.history;if(!h.length)return '';
    return `<section class="section-gap card soft"><h3 class="card-title">これまでの記録</h3>${h.slice().reverse().map((r,i)=>`<div class="history-row"><b>${h.length-i}回目</b><div class="muted">${esc(r.date)} ${r.over?'・時間超過あり':''}</div><strong>${r.score} / 4</strong>${resultPill(r.success)}</div>`).join('')}</section>`;}
  function screenWord(){
    const w=state.word,c=state.config;const phaseIndex={ready:0,play:1,done:2}[w.phase]??0;
    let main='';
    if(w.phase==='ready')main=`<div class="grid"><section class="card"><div class="eyebrow">2 ROUNDS / 10 TURNS</div><h2 class="card-title">全員で時間内に10回つなげ！</h2><p class="small">子どもが最初の言葉を決めます。トランプの2〜6を使い、カードの色で言葉の種類が決まります。大人は<strong>相談禁止</strong>。何を答えたかは紙に記録します。</p><div class="section-gap"><label class="input-label">トランプの引き方</label><div class="seg"><button class="btn ${w.mode==='physical'?'primary':'ghost'}" data-action="word-mode" data-value="physical">🃏 実物のカード</button><button class="btn ${w.mode==='digital'?'primary':'ghost'}" data-action="word-mode" data-value="digital">▣ アプリで抽選</button></div></div><div class="section-gap"><label class="input-label" for="wordDuration">全員共通の制限時間</label><select id="wordDuration" class="select" data-setting="wordSeconds">${[180,240,300,360,420,480].map(s=>`<option value="${s}" ${c.wordSeconds===s?'selected':''}>${s/60}分</option>`).join('')}</select></div><div class="action-row"><button class="btn primary big full" data-action="word-begin">2巡チャレンジを開始 →</button></div></section>${sideInfo('文字数しりとりのルール', [['数字','2〜6＝指定する文字数'],['♥ ♦ 赤','カタカナ語（外来語）'],['♠ ♣ 黒','カタカナ語以外の日本語'],['相談','全面禁止'],['手番','5人×2巡＝10回'],['記録','答えは紙に書いてから発表']])}</div>`;
    if(w.phase==='play'){
      const name=state.players[w.order[w.current%5]];
      const card=w.selectedNumber!==null&&w.selectedColor;
      const seconds=left(w.timer);
      main=`${timerPanel('wordClock','全員共通の残り時間','word')}<div class="action-row"><button class="btn ${w.timer.running?'ghost':'primary'}" data-action="word-toggle">${w.timer.running?'Ⅱ 一時停止':'▶ 再開'}</button><span class="pill">${w.current} / 10 回完了</span></div><div class="section-gap card"><div class="row between wrap"><div><div class="eyebrow">${Math.floor(w.current/5)+1}巡目 · ${w.current%5+1}人目</div><div class="draw-person">${esc(name)}</div><p class="small">カードを確認したら、自分だけで考えて紙に書いて発表！</p></div>${card?playingCard(w.selectedNumber,w.selectedColor):'<span class="pill">カード待ち</span>'}</div>
      <div class="divider"></div>${w.mode==='digital'?`<div class="row wrap between"><strong>アプリでカードを引く</strong><span class="micro">20枚から重複なしで10枚使用</span></div><div class="action-row"><button class="btn primary" data-action="word-draw" ${card?'disabled':''}>🃏 カードを1枚引く</button></div>`:`<label class="input-label">実物のカード：数字と色を指定</label><div class="row wrap gap-lg"><div><div class="micro" style="margin-bottom:8px">数字</div><div class="choice-group">${[2,3,4,5,6].map(n=>`<button class="choice ${w.selectedNumber===n?'selected':''}" data-action="word-number" data-value="${n}">${n}</button>`).join('')}</div></div><div><div class="micro" style="margin-bottom:8px">色</div><div class="choice-group"><button class="choice red ${w.selectedColor==='red'?'selected':''}" data-action="word-color" data-value="red">♥ ♦ 赤</button><button class="choice black ${w.selectedColor==='black'?'selected':''}" data-action="word-color" data-value="black">♠ ♣ 黒</button></div></div></div>`}
      ${card?`<div class="section-gap">${note(`指定：<strong>${w.selectedNumber}文字の${colorName(w.selectedColor)}</strong>。最後が「ん」になる言葉、同じ言葉の再使用は禁止。`)}</div>`:''}
      <div class="action-row"><button class="btn mint-btn grow big" data-action="word-pass" ${!card?'disabled':''}>✓ 正しくつながった → 次へ</button><button class="btn danger-btn grow big" data-action="word-fail" ${!card?'disabled':''}>✕ 失敗を記録 → 次へ</button></div><div class="action-row"><button class="btn ghost tiny" data-action="word-finish">途中終了・結果確認</button><button class="btn ghost tiny" data-action="word-back" ${w.current===0?'disabled':''}>1手番戻す</button></div></div>${wordTurnHistory(w)}${seconds===0?`<div class="section-gap">${note('全員共通の制限時間が終了しました。ここまでの結果を確認して終了できます。','warn')}</div>`:''}`;
    }
    if(w.phase==='done'){
      const stats=wordScore();const good=stats.success;
      main=`<section class="card"><div class="eyebrow">TEAM RESULT</div><h2 class="card-title">文字数しりとり 結果</h2><div class="grid grid-3"><div class="stat"><div class="num">${stats.completed}<span style="font-size:15px"> / 10</span></div><div class="desc">終了した手番</div></div><div class="stat"><div class="num">${stats.valid}</div><div class="desc">正しい回答</div></div><div class="stat"><div class="num">${durationString(stats.elapsed)}</div><div class="desc">全体の経過時間</div></div></div><div class="section-gap">${resultPill(good)}<p class="small">${good?'全員で制限時間内に10回つなげました！':'10回すべて正解し、制限時間内に完了した場合に成功です。'}</p></div>${wordTurnHistory(w)}<div class="action-row"><button class="btn primary big full" data-action="word-save">結果を保存して終了</button></div></section>`;
    }
    return `${pageHeader('MISSION 03 · WORD CHAIN','文字数しばりしりとり','2〜6のトランプと赤黒の条件で、全員が相談なしで2巡。紙に残った言葉がスパイ推理の証拠になる。')}${steps(['準備','10手番チャレンジ','結果確認'],phaseIndex)}${main}${wordHistory()}${w.phase!=='ready'?`<div class="action-row"><button class="btn ghost tiny" data-action="word-reset">この回を最初からやり直す</button></div>`:''}`;
  }
  function playingCard(number,color){return `<div class="playing-card ${color}"><div class="suit">${suitIcon(color)} ${number}</div><div class="large">${number}</div><div class="suit bottom">${suitIcon(color)} ${number}</div></div>`;}
  function wordTurnHistory(w){if(!w.turns.length)return '';
    return `<div class="section-gap"><div class="subhead">この回の進行記録（言葉は紙に記入）</div><div class="card soft" style="padding:10px 20px"><table class="data-table"><thead><tr><th>順番</th><th>プレイヤー</th><th>カード</th><th>結果</th><th>所要</th></tr></thead><tbody>${w.turns.map((t,i)=>`<tr><td>${i+1}</td><td>${esc(state.players[t.player])}</td><td><span style="color:${t.color==='red'?'#ffaab6':'#f3f3f3'}">${suitIcon(t.color)} ${t.number}</span></td><td>${t.valid?'✓':'✕'}</td><td>${durationString(t.elapsed)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function wordHistory(){const h=state.word.history;if(!h.length)return '';
    return `<section class="section-gap card soft"><h3 class="card-title">これまでの記録</h3>${h.slice().reverse().map((r,i)=>`<div class="history-row"><b>${h.length-i}回目</b><div class="muted">${esc(r.date)}</div><strong>${r.valid} / 10</strong>${resultPill(r.success)}</div>`).join('')}</section>`;
  }
  function wordScore(){const w=state.word;const completed=w.turns.length;const valid=w.turns.filter(t=>t.valid).length;const elapsed=w.timer.durationMs-left(w.timer);const success=completed===10&&valid===10&&elapsed<=w.timer.durationMs&&!w.timer.expired;
    return {completed,valid,elapsed,success};
  }
  function screenSettings(){const c=state.config;
    return `${pageHeader('PREFERENCES','参加者・ルール設定','iPadに保存します。ホーム画面に追加しても、データは利用中の端末・アプリの保存領域にだけ残ります。')}
      <div class="grid"><section class="card"><h2 class="card-title">大人5人の名前</h2><p class="small">司会も参加する場合は5人に含めて登録。表示名は自由に変更できます。</p><div class="section-gap">${state.players.map((p,i)=>`<div class="settings-row"><label class="input-label" for="player-${i}">大人 ${i+1}</label><input class="input" id="player-${i}" data-player="${i}" maxlength="18" value="${esc(p)}"></div>`).join('')}</div></section>
      <section class="card"><h2 class="card-title">タイマー・判定ライン</h2>
      <div class="settings-row"><label class="input-label" for="memorySeconds">色の記憶：暗記時間</label><select class="select" id="memorySeconds" data-setting="memorySeconds">${[15,20,25,30,40,45,60].map(v=>`<option value="${v}" ${c.memorySeconds===v?'selected':''}>${v}秒</option>`).join('')}</select></div>
      <div class="settings-row"><label class="input-label" for="memoryPass">色の記憶：成功ライン（15枚中）</label><select class="select" id="memoryPass" data-setting="memoryPass">${Array.from({length:9},(_,i)=>i+7).map(v=>`<option value="${v}" ${c.memoryPass===v?'selected':''}>${v}枚以上</option>`).join('')}</select></div>
      <div class="settings-row"><label class="input-label" for="drawSeconds">絵しりとり：1人の持ち時間</label><select class="select" id="drawSeconds" data-setting="drawSeconds">${[20,25,30,40,45,60].map(v=>`<option value="${v}" ${c.drawSeconds===v?'selected':''}>${v}秒</option>`).join('')}</select></div>
      <div class="settings-row"><label class="input-label" for="drawPass">絵しりとり：成功ライン（4つのつながり中・暫定）</label><select class="select" id="drawPass" data-setting="drawPass">${[1,2,3,4].map(v=>`<option value="${v}" ${c.drawPass===v?'selected':''}>${v}つながり以上</option>`).join('')}</select></div>
      <div class="settings-row"><label class="input-label" for="wordSecondsSetting">文字数しりとり：全体の制限時間</label><select class="select" id="wordSecondsSetting" data-setting="wordSeconds">${[180,240,300,360,420,480].map(v=>`<option value="${v}" ${c.wordSeconds===v?'selected':''}>${v/60}分</option>`).join('')}</select></div>
      <div class="settings-row"><label class="input-label" for="numberSecondsSetting">数字並び：全体の制限時間</label><select class="select" id="numberSecondsSetting" data-setting="numberSeconds">${[45,60,75,90,120,150,180].map(v=>`<option value="${v}" ${c.numberSeconds===v?'selected':''}>${v}秒</option>`).join('')}</select></div>
      <div class="settings-row"><label class="toggle"><input type="checkbox" data-setting="sound" ${c.sound?'checked':''}><span>タイマー終了音を鳴らす（iPadの音量・消音設定にも依存）</span></label></div></section></div>
      <h2 class="section-title">当日のルール</h2>${rulesContent()}
      <h2 class="section-title">データの管理</h2><section class="card soft"><p class="small">進行状況と結果はこのブラウザ／ホーム画面アプリの保存領域に保持。Safariの履歴・Webサイトデータを消すと消える場合があります。</p><div class="action-row"><button class="btn ghost" data-action="export-data">記録をJSONで書き出す</button><button class="btn danger-btn" data-action="all-reset">進行状況と結果をすべて初期化</button></div></section>`;
  }
  function rulesContent(){return `<div class="grid grid-3"><section class="card flat"><div class="eyebrow">01 · MEMORY</div><h3 class="card-title">色の記憶</h3><p class="small">子どもがA3台紙に15枚のカードを配置し、正解写真を1枚撮影。大人は20秒暗記（相談・役割分担なし）。カードを回収して5人に3枚ずつランダム配布。手札非公開、順番に表向きで1枚ずつ3巡。配置中は相談可・置き直し不可。15枚中12枚以上で成功（設定変更可）。</p></section><section class="card flat"><div class="eyebrow">02 · DRAWING</div><h3 class="card-title">順手・逆手 絵しりとり</h3><p class="small">5人の順番を抽選。順手3・逆手2を抽選し、各自30秒で絵だけを描く。2人目以降は前の人の絵だけを見て、しりとりになる絵を描く。絵の裏に自分の答えを記載。5枚の紙を残して、4箇所のつながりを検証。成功ラインは仮設定。</p></section><section class="card flat"><div class="eyebrow">03 · WORD CHAIN</div><h3 class="card-title">文字数しばりしりとり</h3><p class="small">トランプの2〜6で文字数指定。赤は外来語のカタカナ語、黒はそれ以外の日本語。大人5人が相談せず2巡、合計10手番。答えを紙に書いてから読み上げ、全員共通の制限時間内に10回正しくつながれば成功。小さい文字・長音「ー」も各1文字として数える。</p></section><section class="card flat"><div class="eyebrow">04 · NUMBERS</div><h3 class="card-title">数字並びチャレンジ</h3><p class="small">トランプA〜Kから重複なしで大人5人に1枚ずつ配る。自分の数字だけを確認。カードを見せず、具体的な数字・一桁／偶数など数を絞る情報は口にしない。あいまいな大小の話はOK。制限時間内に小さい順で並べば成功。90秒は仮設定。</p></section><section class="card flat"><div class="eyebrow">05 · KIDS</div><h3 class="card-title">人間ひらがなクイズ</h3><p class="small">子ども2人が床上のポーズでひらがなを表現し、黒子役の大人1人が安全に補助。大人4人が回答する。46文字からランダム抽選し、濁点・半濁点・小文字はなし。パス可。5分間で7問正解が目標。タイマーは外部で管理し、iPadでは文字表示と正解数だけを扱う。</p></section><section class="card flat"><div class="eyebrow">06 · SHAPES</div><h3 class="card-title">図形で伝えろ！</h3><p class="small">子ども2人と補助役の大人だけがお題を見る。補助役は事前に用意した特別図形から2個選び、子どもは必ず両方使用。○△□は自由。大人は口頭アドバイスOK、配置は子どもだけ。残る大人4人がお題を当てる。5問中3問正解は仮の成功ライン。</p></section></div>`;}
  function screenResults(){const m=counts('memory'),d=counts('draw'),w=counts('word'),n=counts('number');const s=state.spy;
    return `${pageHeader('FINAL REPORT','結果・スパイ投票','各競技の記録を振り返り、最後に「誰がスパイだったのか」を投票！')}
      <div class="notice"><span class="notice-icon">あ</span><span>人間ひらがな：現在 <strong>${state.kana.correct} / 7問</strong>　／　図形で伝えろ！：現在 <strong>${state.shape.correct} / ${state.shape.attempts}問</strong></span></div><div class="grid grid-3 section-gap"><div class="stat"><div class="num">${m.wins} <span class="small">/ ${m.rounds}</span></div><div class="desc">色の記憶 成功</div></div><div class="stat"><div class="num">${d.wins} <span class="small">/ ${d.rounds}</span></div><div class="desc">絵しりとり 成功</div></div><div class="stat"><div class="num">${w.wins} <span class="small">/ ${w.rounds}</span></div><div class="desc">文字数しりとり 成功</div></div><div class="stat"><div class="num">${n.wins} <span class="small">/ ${n.rounds}</span></div><div class="desc">数字並び 成功</div></div><div class="stat"><div class="num">${state.kana.history.filter(r=>r.success).length} <span class="small">/ ${state.kana.history.length}</span></div><div class="desc">人間ひらがな 成功</div></div><div class="stat"><div class="num">${state.shape.history.filter(r=>r.success).length} <span class="small">/ ${state.shape.history.length}</span></div><div class="desc">図形で伝えろ！ 成功</div></div></div>
      <h2 class="section-title">役職の決め方</h2><section class="card"><div class="seg"><button class="btn ${s.mode==='physical'?'primary':'ghost'}" data-action="spy-mode" data-value="physical">実物の役職カードを配る</button><button class="btn ${s.mode==='app'?'primary':'ghost'}" data-action="spy-mode" data-value="app">iPadで秘密の役職を配る</button></div>
      ${s.mode==='physical'?`<div class="section-gap">${note('役職は紙のカードで配布。司会者はスパイの正体を知らなくても進行できます。最後に本人が名乗るまでアプリには記録しません。')}</div>`:`<div class="section-gap">${renderDeal()}</div>`}</section>
      <h2 class="section-title">スパイは誰だ？ 投票</h2><section class="card"><p class="small">紙に残した絵や回答を見返し、全員で推理。各人が「スパイだと思う人」を選んで投票します。</p><div class="grid">${state.players.map((p,i)=>`<div><label class="input-label">${esc(p)} の投票</label><select class="select" data-vote="${i}"><option value="">まだ選ばない</option>${state.players.map((n,j)=>`<option value="${j}" ${s.votes[i]===j?'selected':''}>${esc(n)}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="action-row"><button class="btn primary grow" data-action="spy-tally">${s.tallyOpen?'集計を更新':'投票を開票する →'}</button><button class="btn ghost" data-action="spy-reset-votes">投票をやり直す</button></div>
      ${s.tallyOpen?renderTally():''}</section>
      <h2 class="section-title">スパイの正体発表</h2><section class="card"><p class="small">投票を開票してから正体を発表するのがおすすめ。実物カード方式では、スパイ本人が名乗った後に記録できます。</p>
      ${s.mode==='physical'?`<label class="input-label" for="spyActual">実際のスパイ（発表後に選択）</label><select id="spyActual" class="select" data-spy-actual><option value="">未選択</option>${state.players.map((p,i)=>`<option value="${i}" ${s.actual===i?'selected':''}>${esc(p)}</option>`).join('')}</select>`:''}
      <div class="action-row"><button class="btn danger-btn big" data-action="spy-reveal" ${(s.mode==='physical'&&s.actual===null)||(s.mode==='app'&&s.spyIndex===null)?'disabled':''}>正体を発表する！</button></div>
      ${s.revealed?`<div class="section-gap center"><div class="eyebrow">THE SPY WAS...</div><div class="result-score danger">${esc(state.players[s.mode==='app'?s.spyIndex:s.actual]||'未登録')}</div>${s.tallyOpen?`<p class="small">${renderVoteOutcome()}</p>`:''}</div>`:''}</section>
      <div class="action-row"><button class="btn ghost" data-action="copy-results">結果をまとめてコピー</button><button class="btn ghost" data-nav="settings">設定・ルールを開く</button></div>`;
  }
  function renderDeal(){const s=state.spy;
    if(s.spyIndex===null)return `<p class="small">大人5人がiPadを順番に自分だけ見て、秘密の役職を確認します。司会者も参加する場合、ほかの人の画面を見ないようにしてください。</p><button class="btn primary" data-action="deal-start">5人の役職をシャッフルして配る</button>`;
    if(s.dealStep>=5)return `<div class="notice good"><span class="notice-icon">✓</span><span>5人への役職配布が完了。正体は最終発表まで非表示です。</span></div><div class="action-row"><button class="btn ghost tiny" data-action="deal-reset">役職を配り直す</button></div>`;
    return `<div class="turn-highlight"><div class="micro">役職確認 ${s.dealStep+1} / 5</div><div class="turn-name">${esc(state.players[s.dealStep])}</div><p class="small">ほかの人から画面が見えない状態で操作してください。</p><button class="btn primary" data-action="deal-peek">この人だけが役職を見る →</button></div>`;
  }
  function renderTally(){const votes=state.spy.votes;const tally=state.players.map((_,i)=>votes.filter(v=>v===i).length);const max=Math.max(...tally);
    return `<div class="section-gap"><div class="subhead">投票結果　${votes.filter(v=>v!==null).length} / 5票</div>${state.players.map((p,i)=>`<div class="settings-row"><div class="row between"><strong>${esc(p)}</strong><strong>${tally[i]}票${max&&tally[i]===max?' ★':''}</strong></div><div class="bar-meter" style="margin-top:8px"><span style="width:${tally[i]/5*100}%"></span></div></div>`).join('')}${votes.some(v=>v===null)?'<p class="small danger">未投票の人がいます。</p>':''}</div>`;
  }
  function renderVoteOutcome(){const tally=state.players.map((_,i)=>state.spy.votes.filter(v=>v===i).length);const max=Math.max(...tally);const best=tally.map((n,i)=>n===max?i:-1).filter(i=>i>=0);const spy=state.spy.mode==='app'?state.spy.spyIndex:state.spy.actual;
    return best.length!==1?'最多得票が同数です。必要なら決選投票してください。':best[0]===spy?'見破り成功！ 最多得票者がスパイでした。':'スパイの正体を見破れませんでした。';
  }
  function render(){
    getEl('navigation').innerHTML=NAV.map(x=>`<button class="nav-btn ${state.page===x.id?'active':''}" data-nav="${x.id}"><span class="ni">${x.icon}</span>${x.name}</button>`).join('');
    getEl('mobileNavigation').innerHTML=NAV.filter(x=>x.id!=='settings').map(x=>`<button class="mob-link ${state.page===x.id?'active':''}" data-nav="${x.id}"><span>${x.icon}</span><span>${x.id==='home'?'ホーム':x.id==='memory'?'色の記憶':x.id==='draw'?'絵しりとり':x.id==='word'?'文字数':x.id==='number'?'数字並び':x.id==='kana'?'ひらがな':x.id==='shape'?'図形':'投票'}</span></button>`).join('');
    const title=NAV.find(x=>x.id===state.page);getEl('crumbText').textContent=title?.name||'司会室';
    const f={home:screenHome,memory:screenMemory,draw:screenDraw,word:screenWord,number:screenNumber,kana:screenKana,shape:screenShape,results:screenResults,settings:screenSettings};
    getEl('app').innerHTML=f[state.page]();refreshTimers();
  }
  function refreshTimers(){
    for(const key of ['memory','draw','word','number']){
      const t=getTimer(key),ms=left(t);
      document.querySelectorAll(`[data-timer-value="${key}"]`).forEach(el=>{el.textContent=durationString(ms);el.classList.toggle('warn',ms===0||ms<=10000);});
      document.querySelectorAll(`[data-timer-fill="${key}"]`).forEach(el=>{el.style.width=`${t.durationMs?Math.max(0,ms/t.durationMs*100):0}%`;el.classList.toggle('warn',ms<=10000);});
      document.querySelectorAll(`[data-timer-status="${key}"]`).forEach(el=>{el.textContent=t.running?'カウントダウン中':ms===0?'時間終了':'開始前・一時停止中';});
    }
    const running=['memory','draw','word','number'].filter(k=>getTimer(k).running);
    getEl('topTimer').textContent=running.length?`${{memory:'記憶',draw:'描画',word:'しりとり',number:'数字並び'}[running[0]]} ${durationString(left(getTimer(running[0])))}`:'';
  }
  function tick(){let needRender=false;for(const key of ['memory','draw','word','number']){
      const t=getTimer(key);if(t.running&&left(t)<=0){stop(t);t.expired=true;needRender=true;sound();toast('制限時間です！');}
    }if(needRender){persist();render();}else refreshTimers();}
  setInterval(tick,160);
  function beginMemory(){unlockSound();const m=state.memory;reset(m.timer,state.config.memorySeconds);m.score=null;m.phase='memorize';pauseOtherTimers('memory');start(m.timer);saveAndRender();}
  function prepareDraw(){const d=state.draw;stop(d.timer);d.order=shuffled([0,1,2,3,4]);d.modes=shuffled(MODES);d.current=0;d.timeFlags=[];d.score=null;reset(d.timer,state.config.drawSeconds);d.phase='planned';saveAndRender('抽選したよ');}
  function startDraw(){const d=state.draw;d.current=0;d.phase='play';reset(d.timer,state.config.drawSeconds);saveAndRender();}
  function progressDraw(){const d=state.draw;if(d.phase!=='play')return;const wasExpired=d.timer.expired||left(d.timer)===0;d.timeFlags[d.current]=wasExpired;stop(d.timer);if(d.current===4){d.phase='score';}else{d.current++;reset(d.timer,state.config.drawSeconds);}saveAndRender();}
  function makeDeck(){return shuffled(['red','red','black','black'].flatMap(color=>[2,3,4,5,6].map(number=>({color,number}))));}
  function startWord(){unlockSound();const w=state.word;w.order=shuffled([0,1,2,3,4]);w.current=0;w.turns=[];w.deck=makeDeck();w.selectedNumber=null;w.selectedColor=null;w.phase='play';reset(w.timer,state.config.wordSeconds);pauseOtherTimers('word');start(w.timer);saveAndRender('全体タイマーを開始しました');}
  function recordWord(valid){const w=state.word;if(w.phase!=='play'||w.selectedNumber===null||!w.selectedColor)return;
    const total=w.timer.durationMs-left(w.timer),previous=w.turns.reduce((sum,t)=>sum+t.elapsed,0),el=Math.max(0,total-previous);
    w.turns.push({player:w.order[w.current%5],number:w.selectedNumber,color:w.selectedColor,valid,elapsed:el});w.current++;
    w.selectedNumber=null;w.selectedColor=null;
    if(w.current>=10){stop(w.timer);w.phase='done';}saveAndRender();
  }
  function currentWordCardAllowed(color,number){return state.word.turns.filter(t=>t.color===color&&t.number===number).length<2;}
  function commitWordRecord(){const w=state.word,st=wordScore();w.history.push({date:todayString(),completed:st.completed,valid:st.valid,elapsed:st.elapsed,success:st.success,turns:structuredClone(w.turns)});
    const mode=w.mode;state.word={...defaultState().word,history:w.history,mode};saveAndRender('文字数しりとりの結果を保存しました');}
  function getHistoryText(){let output=['【11/22 家族スパイゲーム 司会記録】'];
    for(let i=0;i<5;i++)output.push(`大人${i+1}: ${state.players[i]}`);
    const maps=[['色の記憶','memory'],['順手・逆手 絵しりとり','draw'],['文字数しばりしりとり','word'],['数字並びチャレンジ','number'],['人間ひらがな','kana'],['図形で伝えろ！','shape']];
    for(const [label,key]of maps){output.push(`\n■ ${label}`);const h=state[key].history;if(!h.length){output.push('未実施');continue;}h.forEach((r,i)=>output.push(`${i+1}回目: ${key==='word'?`${r.valid}/10`:key==='memory'?`${r.score}/15`:key==='draw'?`${r.score}/4`:r.summary||'記録済み'} ${r.success?'成功':'未達成'} (${r.date})`));}
    output.push(`\n■ 人間ひらがなクイズ：${state.kana.correct} / 7 正解（進行中）`);output.push(`■ 図形で伝えろ！：${state.shape.correct} / ${state.shape.attempts} 正解（進行中）`);
    return output.join('\n');
  }
  function downloadJson(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='SPY_GAME_進行記録.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('JSONを書き出しました');}
  async function copyResults(){const str=getHistoryText();try{await navigator.clipboard.writeText(str);toast('結果をコピーしました');}catch{showModal('結果一覧',`<textarea class="input" style="height:250px" readonly>${esc(str)}</textarea>`,'閉じる');}}
  function openDealPeek(){const s=state.spy;if(s.spyIndex===null||s.dealStep>=5)return;
    const isSpy=s.spyIndex===s.dealStep;
    const inner=`<p class="center small">${esc(state.players[s.dealStep])} さん専用</p><div class="center" style="padding:24px 8px;border-radius:14px;background:${isSpy?'rgba(243,126,139,.13)':'rgba(128,222,194,.12)'}"><div class="eyebrow">あなたの役職</div><div class="result-score ${isSpy?'danger':'mint'}">${isSpy?'スパイ':'一般プレイヤー'}</div><p class="small">${isSpy?'正体を隠して競技の成功を妨害しよう。':'協力してゲームを成功させ、スパイを見破ろう。'}</p></div>`;
    getEl('modalContent').innerHTML=`<div class="modal-title">秘密のカード</div>${inner}<div class="action-row"><button class="btn primary full big" data-action="deal-close">確認した・伏せて次へ →</button></div>`;
    getEl('modalBackdrop').hidden=false;
  }
  function handleClick(e){const trigger=e.target.closest('[data-nav],[data-action]');if(!trigger)return;
    const p=trigger.dataset;const value=p.value;const a=p.action;if(p.nav){nav(p.nav);return;}
    if(a==='close-modal'){closeModal();return;}
    if(a==='confirm-modal'){const cb=confirmModal.yesAction;closeModal();if(typeof cb==='function')cb();return;}
    if(a==='kana-next'){drawKana();saveAndRender();return;}
    if(a==='kana-correct'){if(state.kana.current===null)return;state.kana.correct++;drawKana();saveAndRender();return;}
    if(a==='kana-save'){const k=state.kana;const h=[...k.history,{date:todayString(),correct:k.correct,summary:`${k.correct}/7問`,success:k.correct>=7}];state.kana={...defaultState().kana,history:h};saveAndRender('ひらがなクイズの結果を保存しました');return;}
    if(a==='kana-reset'){confirmModal('ひらがなクイズをやり直す？','現在のお題・正解数・抽選済みの文字をすべてリセットします。','リセットする',()=>{state.kana={...defaultState().kana,history:state.kana.history};saveAndRender();});return;}
    if(a==='number-start'){const n=state.number;n.lineup=defaultState().number.lineup;n.success=null;n.expired=false;reset(n.timer,state.config.numberSeconds);pauseOtherTimers('number');start(n.timer);n.phase='play';saveAndRender();return;}
    if(a==='number-toggle'){const t=state.number.timer;t.running?stop(t):(pauseOtherTimers('number'),start(t));saveAndRender();return;}
    if(a==='number-reveal'){const n=state.number;n.expired=n.timer.expired||left(n.timer)===0;stop(n.timer);n.phase='check';saveAndRender();return;}
    if(a==='number-check'){const n=state.number;const nums=n.lineup.map(x=>Number(x.card));if(n.lineup.some(x=>x.card==='')||new Set(nums).size!==5||nums.some(x=>x<1||x>13)){toast('1〜13で重複しない5枚を選んでください');return;}n.success=!n.expired&&nums.every((v,i)=>i===0||nums[i-1]<v);n.phase='done';saveAndRender();return;}
    if(a==='number-manual'){const n=state.number;n.success=value==='success'&&!n.expired;n.phase='done';saveAndRender();return;}
    if(a==='number-save'){const n=state.number;if(n.success===null)return;n.history.push({date:todayString(),success:n.success,summary:n.lineup.some(x=>x.card!=='')?n.lineup.map(x=>x.card||'?').join('・'):(n.success?'手動成功':'手動失敗'),lineup:n.lineup,expired:n.expired});const h=n.history;state.number={...defaultState().number,history:h,timer:EMPTY_TIMER(state.config.numberSeconds)};saveAndRender('数字並びの結果を保存しました');return;}
    if(a==='number-reset'){confirmModal('数字並びをやり直す？','この回の途中データを消します。保存済みの結果は残ります。','やり直す',()=>{const h=state.number.history;state.number={...defaultState().number,history:h,timer:EMPTY_TIMER(state.config.numberSeconds)};saveAndRender();});return;}
    if(a==='shape-next'){const t=state.shape;if(t.attempts>=5)return;if(t.current!==null)t.attempts++;if(t.attempts>=5){t.current=null;t.visible=false;}else drawShape();saveAndRender();return;}
    if(a==='shape-toggle'){const t=state.shape;if(t.current===null)return;t.visible=!t.visible;saveAndRender();return;}
    if(a==='shape-correct'||a==='shape-fail'){const t=state.shape;if(t.current===null||t.attempts>=5)return;t.attempts++;if(a==='shape-correct')t.correct++;if(t.attempts>=5){t.current=null;t.visible=false;}else drawShape();saveAndRender();return;}
    if(a==='shape-save'){const t=state.shape;if(t.attempts===0)return;const h=[...t.history,{date:todayString(),correct:t.correct,attempts:t.attempts,summary:`${t.correct}/${t.attempts}問`,success:t.attempts>=5&&t.correct>=3}];state.shape={...defaultState().shape,history:h};saveAndRender('図形ゲームの結果を保存しました');return;}
    if(a==='shape-reset'){confirmModal('図形ゲームをやり直す？','現在の出題・正解数を消します。保存済みの結果は残ります。','やり直す',()=>{state.shape={...defaultState().shape,history:state.shape.history};saveAndRender();});return;}
    if(a==='memory-start'){beginMemory();return;}
    if(a==='memory-toggle'){unlockSound();const t=state.memory.timer;t.running?stop(t):start(t);saveAndRender();return;}
    if(a==='memory-next'){stop(state.memory.timer);state.memory.phase='place';saveAndRender();return;}
    if(a==='memory-check'){state.memory.phase='score';saveAndRender();return;}
    if(a==='memory-score'){state.memory.score=Number(value);saveAndRender();return;}
    if(a==='memory-save'){const m=state.memory;if(m.score===null)return;m.history.push({date:todayString(),score:m.score,success:m.score>=state.config.memoryPass});state.memory={...defaultState().memory,history:m.history,timer:EMPTY_TIMER(state.config.memorySeconds)};saveAndRender('色の記憶の結果を保存しました');return;}
    if(a==='memory-reset'){confirmModal('色の記憶をやり直す？','この回の途中状態を消します。すでに保存した結果は残ります。','やり直す',()=>{const h=state.memory.history;state.memory={...defaultState().memory,history:h,timer:EMPTY_TIMER(state.config.memorySeconds)};saveAndRender();});return;}
    if(a==='draw-plan'){prepareDraw();return;}
    if(a==='draw-begin'){startDraw();return;}
    if(a==='draw-toggle'){unlockSound();const t=state.draw.timer;t.running?stop(t):(pauseOtherTimers('draw'),start(t));saveAndRender();return;}
    if(a==='draw-next'){progressDraw();return;}
    if(a==='draw-back'){const d=state.draw;if(d.current>0){d.current--;d.timeFlags=d.timeFlags.slice(0,d.current);reset(d.timer,state.config.drawSeconds);saveAndRender();}return;}
    if(a==='draw-score'){state.draw.score=Number(value);saveAndRender();return;}
    if(a==='draw-save'){const d=state.draw;if(d.score===null)return;d.history.push({date:todayString(),score:d.score,over:d.timeFlags.some(Boolean),success:d.score>=state.config.drawPass,order:[...d.order],modes:[...d.modes]});state.draw={...defaultState().draw,history:d.history,timer:EMPTY_TIMER(state.config.drawSeconds)};saveAndRender('絵しりとりの結果を保存しました');return;}
    if(a==='draw-reset'){confirmModal('絵しりとりをやり直す？','この回の抽選と途中状態を消します。保存済みの記録は残ります。','やり直す',()=>{const h=state.draw.history;state.draw={...defaultState().draw,history:h,timer:EMPTY_TIMER(state.config.drawSeconds)};saveAndRender();});return;}
    if(a==='word-mode'){if(state.word.phase!=='ready')return;state.word.mode=value;saveAndRender();return;}
    if(a==='word-begin'){startWord();return;}
    if(a==='word-toggle'){unlockSound();const t=state.word.timer;t.running?stop(t):(pauseOtherTimers('word'),start(t));saveAndRender();return;}
    if(a==='word-draw'){const w=state.word;if(w.mode!=='digital'||w.selectedNumber!==null)return;const item=w.deck.shift();if(!item){toast('カードが足りません');return;}w.selectedNumber=item.number;w.selectedColor=item.color;saveAndRender();return;}
    if(a==='word-number'){const w=state.word;w.selectedNumber=Number(value);saveAndRender();return;}
    if(a==='word-color'){state.word.selectedColor=value;saveAndRender();return;}
    if(a==='word-pass'||a==='word-fail'){
      const w=state.word;if(w.mode==='physical'&&!currentWordCardAllowed(w.selectedColor,w.selectedNumber)){toast('その色・数字のカードは2枚とも使用済みです');return;}
      if(a==='word-fail')confirmModal('失敗として記録する？','紙の回答は訂正せず残してください。次の人のしりとりは、最後に成立した言葉からつなぐなど、司会者が決めて進めます。','失敗を記録',()=>recordWord(false));
      else recordWord(true);return;
    }
    if(a==='word-back'){const w=state.word;if(w.turns.length===0)return;const t=w.turns.pop();w.current--;w.selectedNumber=t.number;w.selectedColor=t.color;/* デジタルで引いたカードは現在の手番として保持。山札へは戻さない */saveAndRender('ひとつ前の手番に戻しました');return;}
    if(a==='word-finish'){confirmModal('途中で終了する？','ここまでの回答を残して結果確認へ進みます。','結果確認へ',()=>{stop(state.word.timer);state.word.phase='done';saveAndRender();});return;}
    if(a==='word-save'){commitWordRecord();return;}
    if(a==='word-reset'){confirmModal('文字数しりとりをやり直す？','この回のカード・手番・タイマーを消します。保存済みの結果は残ります。','やり直す',()=>{const h=state.word.history,mode=state.word.mode;state.word={...defaultState().word,history:h,mode,timer:EMPTY_TIMER(state.config.wordSeconds)};saveAndRender();});return;}
    if(a==='spy-mode'){if(state.spy.spyIndex!==null&&!state.spy.revealed&&state.spy.mode==='app'){
        confirmModal('役職方式を切り替える？','アプリで配った秘密の役職情報は消えます。','切り替える',()=>{state.spy={...defaultState().spy,mode:value};saveAndRender();});
      }else{state.spy={...defaultState().spy,mode:value};saveAndRender();}return;}
    if(a==='deal-start'){state.spy.spyIndex=Math.floor(Math.random()*5);state.spy.dealStep=0;state.spy.revealed=false;saveAndRender('役職をシャッフルしました');return;}
    if(a==='deal-peek'){openDealPeek();return;}
    if(a==='deal-close'){closeModal();state.spy.dealStep++;saveAndRender();return;}
    if(a==='deal-reset'){confirmModal('役職を配り直す？','以前の役職は破棄され、新しいスパイがランダムで決まります。','配り直す',()=>{state.spy.spyIndex=null;state.spy.dealStep=0;state.spy.revealed=false;saveAndRender();});return;}
    if(a==='spy-tally'){state.spy.tallyOpen=true;saveAndRender();return;}
    if(a==='spy-reset-votes'){confirmModal('投票をやり直す？','投票5人分を消して新しく投票できます。','やり直す',()=>{state.spy.votes=[null,null,null,null,null];state.spy.tallyOpen=false;state.spy.revealed=false;saveAndRender();});return;}
    if(a==='spy-reveal'){confirmModal('スパイの正体を発表する？','この操作をすると司会画面にスパイの名前が表示されます。周囲に画面を見せる準備をしてください。','正体を発表',()=>{state.spy.revealed=true;saveAndRender();});return;}
    if(a==='show-rules'){showModal('当日のルール',`${rulesContent()}<p class="small">※絵しりとりの成功ラインは仮設定です。設定画面から変更できます。</p>`);return;}
    if(a==='all-reset'){confirmModal('すべて初期化しますか？','参加者名・全競技の途中状態・保存済み結果・投票をすべて消します。元には戻せません。','すべて消去',()=>{state=defaultState();saveAndRender('初期化しました');});return;}
    if(a==='export-data'){downloadJson();return;}
    if(a==='copy-results'){copyResults();return;}
  }
  function handleChange(e){const el=e.target;if(el.matches('[data-number-card]')){const i=Number(el.dataset.numberCard);state.number.lineup[i].card=el.value;saveAndRender();return;}
    if(el.matches('[data-number-person]')){const i=Number(el.dataset.numberPerson);state.number.lineup[i].person=el.value;saveAndRender();return;}
    if(el.matches('[data-shape-helper]')){state.shape.helper=el.value;saveAndRender();return;}
    if(el.matches('[data-player]')){const i=Number(el.dataset.player);const name=el.value.trim()||`プレイヤー${i+1}`;state.players[i]=name;saveAndRender('名前を保存しました');return;}
    if(el.matches('[data-setting]')){const key=el.dataset.setting;state.config[key]=key==='sound'?el.checked:Number(el.value);
      if(key==='memorySeconds'&&state.memory.phase==='ready')reset(state.memory.timer,state.config.memorySeconds);
      if(key==='drawSeconds'&&state.draw.phase==='ready')reset(state.draw.timer,state.config.drawSeconds);
      if(key==='wordSeconds'&&state.word.phase==='ready')reset(state.word.timer,state.config.wordSeconds);
      if(key==='numberSeconds'&&state.number.phase==='ready')reset(state.number.timer,state.config.numberSeconds);
      saveAndRender('設定を保存しました');return;
    }
    if(el.matches('[data-vote]')){state.spy.votes[Number(el.dataset.vote)]=el.value===''?null:Number(el.value);state.spy.tallyOpen=false;saveAndRender();return;}
    if(el.matches('[data-spy-actual]')){state.spy.actual=el.value===''?null:Number(el.value);state.spy.revealed=false;saveAndRender();return;}
  }
  document.addEventListener('click',handleClick);
  document.addEventListener('change',handleChange);
  getEl('modalBackdrop').addEventListener('click',e=>{if(e.target===getEl('modalBackdrop'))closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!getEl('modalBackdrop').hidden)closeModal();});
  render();
  function updateConnectivity(){const status=navigator.onLine?'この端末に保存中':'オフライン・利用可能';getEl('offlineStatus').textContent=status;}
  window.addEventListener('online',updateConnectivity);window.addEventListener('offline',updateConnectivity);updateConnectivity();
  if('serviceWorker' in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
})();
