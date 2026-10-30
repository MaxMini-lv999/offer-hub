const $=id=>document.getElementById(id),base='../public/assets/offer-hub-motion/';
const actions=window.MOTION_MANIFEST.animations;
const pref=matchMedia('(prefers-reduced-motion: reduce)');let manualReduce=false,dark=false,paused=false,current=actions[0],complete=false,inView=true;
const reduced=()=>manualReduce||pref.matches;
function paintActor(restart=false){const a=$('actor'),active=!reduced()&&!paused&&!complete&&!document.hidden&&inView;
 a.dataset.active=String(active);a.setAttribute('aria-label','DeepSeek 娘：'+current.label);a.style.backgroundImage=`url("${base}${active?current.spriteHiDPI.file:current.posters[2].file}")`;
 a.style.animationName='none';if(active){void a.offsetWidth;a.style.animationName='ohm-frames-'+current.id}
 a.style.animationDuration=current.duration+'ms';a.style.animationIterationCount=$('loop').checked?'infinite':'1';
 $('playback').textContent=reduced()?'静态降级':paused?'已暂停':complete?'本次动作已完成':active?'正在播放 · '+current.label:'已暂停（后台／离屏）';
}
function selectAction(id){current=actions.find(a=>a.id===id);complete=false;paused=false;$('pause').textContent='暂停';$('pause').setAttribute('aria-pressed','false');$('loop').checked=current.defaultLoop;
 for(const b of $('selector').children)b.setAttribute('aria-pressed',String(b.dataset.id===id));
 $('download').href=base+current.variants[2].file;$('gif').href=current.id+'.gif';
 $('details').textContent=`8 帧 · ${(current.duration/1000).toFixed(2)} 秒 · 96 / 192 / 288px · 最大动态版本 ${(current.variants[2].bytes/1000).toFixed(1)} KB · ${current.defaultLoop?'默认循环，由业务状态停止':'默认播放一次'}`;
 $('timeline').innerHTML=Array.from({length:8},(_,i)=>`<div class="frame"><img loading="lazy" src="../frames/${id}/${String(i).padStart(2,'0')}.png" width="512" height="512" alt="第 ${i+1} 帧">${i+1} / 8</div>`).join('');paintActor(true);
}
actions.forEach(a=>{const b=document.createElement('button');b.dataset.id=a.id;b.innerHTML=a.label+'<small>'+a.id+'</small>';b.onclick=()=>selectAction(a.id);$('selector').append(b)});
$('actor').addEventListener('animationend',()=>{if(!$('loop').checked){complete=true;paintActor()}});
$('replay').onclick=()=>{complete=false;paused=false;$('pause').textContent='暂停';$('pause').setAttribute('aria-pressed','false');paintActor(true)};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'继续':'暂停';$('pause').setAttribute('aria-pressed',String(paused));paintActor()};
$('loop').onchange=()=>{complete=false;paintActor(true)};
function updateReduced(){document.documentElement.dataset.motion=reduced()?'off':'on';$('reduce').setAttribute('aria-pressed',String(manualReduce));$('reduce').textContent=manualReduce?'恢复动效':'减少动效';$('system-note').textContent=pref.matches?'已遵循系统减少动态效果设置':'';paintActor();if(reduced())revealFull();}
$('reduce').onclick=()=>{manualReduce=!manualReduce;updateReduced()};pref.addEventListener('change',updateReduced);
function theme(){document.documentElement.classList.toggle('dark',dark);$('theme').textContent=dark?'切换亮色':'切换暗色';$('theme').setAttribute('aria-pressed',String(dark));$('vn-bg').src=base+'fallbacks/interview-'+(dark?'night':'day')+'.webp';}
$('theme').onclick=()=>{dark=!dark;theme()};
document.addEventListener('visibilitychange',()=>{paintActor();if(document.hidden)cancelAnimationFrame(textRAF);else resumeText()});
new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;paintActor()},{threshold:.1}).observe($('actor'));
const iconCheck='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" class="ohm-check"><path d="M10 24l9 9 19-20"/></svg>';
const iconHour='<svg class="ohm-hourglass" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h28M18 54h28M21 10v10l11 12-11 12v10M43 10v10L32 32l11 12v10"/></svg>';
const iconBook='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"><path d="M32 18Q20 10 8 15v34q12-5 24 3 12-8 24-3V15q-12-5-24 3v34"/><path class="ohm-page" fill="currentColor" fill-opacity=".12" d="M32 18Q21 9 10 14v34q11-4 22 4z"/></svg>';
const panel=(cls,text)=>`<div class="demo-panel ${cls}">${text}</div>`;
const ui=[
 ['加载点','ohm-dots','<span class="ohm-dots"><i></i><i></i><i></i></span>'],
 ['请求提示条','ohm-loading-bar','<div class="ohm-loading-bar"></div>'],
 ['等待沙漏','ohm-hourglass',iconHour],['翻书提示','ohm-page',iconBook],
 ['骨架占位','ohm-skeleton','<div style="width:100%"><div class="ohm-skeleton"></div><div class="ohm-skeleton" style="width:70%;margin-top:12px"></div></div>'],
 ['搜索聚焦','ohm-search','<div class="ohm-search"><input aria-label="搜索动效演示" placeholder="输入关键词"></div>'],
 ['收藏切换','ohm-bookmark','<button class="ohm-bookmark" aria-pressed="false" data-bookmark><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg><span>收藏</span></button>'],
 ['掌握反馈','ohm-check',iconCheck],['待复习提示','ohm-review',panel('ohm-review','标记为模糊')],['错误提示','ohm-retry',panel('ohm-retry','请检查输入')],
 ['掌握进度','ohm-progress','<div style="width:100%"><div class="ohm-progress" role="progressbar" aria-label="演示掌握进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="35"><span style="transform:scaleX(.35)"></span></div><small class="muted">点击重播增加进度</small></div>'],
 ['里程碑粒子','ohm-burst','<span class="ohm-burst">✦'+[[-24,-24],[0,-30],[24,-24],[28,10],[-28,10],[0,30]].map(([x,y],i)=>`<i style="--x:${x}px;--y:${y}px;--r:${i*40}deg"></i>`).join('')+'</span>'],
 ['对话框入场','ohm-dialogue-enter',panel('ohm-dialogue-enter','准备开始吧。')],['选项高亮','ohm-choice','<button class="ohm-choice">显示参考答案</button>'],['推进提示','ohm-continue','<span class="ohm-continue" style="font-size:28px">▸</span>'],
 ['回看日志','ohm-backlog-enter',panel('ohm-backlog-enter','回看完整解析')],['移动抽屉','ohm-drawer-enter',panel('ohm-drawer-enter','会 · 模糊 · 不会')],['场景淡入','ohm-scene-enter',panel('ohm-scene-enter','新的面试场景')],
 ['操作通知','ohm-toast-enter',panel('ohm-toast-enter','演示：已保存')],['页面入场','ohm-page-enter',panel('ohm-page-enter','下一道题')],['立绘入场','ohm-character-enter',panel('ohm-character-enter','角色图层')],['静态立绘呼吸','ohm-breathe',panel('ohm-breathe','轻微 2px 呼吸')],['主题过渡','ohm-theme-transition',panel('ohm-theme-transition','点击顶部切换主题')],['成就出现','ohm-badge','<span class="ohm-badge" style="font-size:40px;color:var(--ohm-sakura)">✦</span>']
];
$('ui-grid').innerHTML=ui.map(([label,id,html],i)=>`<article class="ui-card"><h3>${String(i+1).padStart(2,'0')} / ${label}</h3><code>${id}</code><div class="ui-view ohm-motion">${html}</div><button class="replay" data-effect="${i}">重播／体验</button></article>`).join('');
$('ui-grid').onclick=e=>{const bookmark=e.target.closest('[data-bookmark]');if(bookmark){const v=bookmark.getAttribute('aria-pressed')!=='true';bookmark.setAttribute('aria-pressed',String(v));bookmark.querySelector('span').textContent=v?'已收藏':'收藏';return}const b=e.target.closest('[data-effect]');if(!b)return;const i=Number(b.dataset.effect),view=b.previousElementSibling;
 if(i===10){const p=view.querySelector('[role=progressbar]');let n=Number(p.getAttribute('aria-valuenow'))+30;if(n>100)n=10;p.setAttribute('aria-valuenow',String(n));p.firstElementChild.style.transform=`scaleX(${n/100})`;return}
 if(i===5){view.querySelector('input').focus();return}if(i===6){view.querySelector('button').click();return}if(i===13){view.querySelector('button').focus();return}if(i===22){$('theme').click();return}
 view.innerHTML=ui[i][2];};
const lines=['准备好了吗？先说说你对 Go 中切片和数组的理解。','很好。我们接着看看：切片扩容之后，原来的底层数组还会被共享吗？','你可以显示参考答案，再把掌握程度标记为“会、模糊、不会”。'];let lineIndex=0,textCount=0,textRAF=0,last=performance.now(),fraction=0;
function renderText(){$('dialogue-visible').textContent=Array.from(lines[lineIndex]).slice(0,textCount).join('');$('advance').textContent=textCount>=Array.from(lines[lineIndex]).length?'下一段':'显示全文';$('caret').hidden=textCount<Array.from(lines[lineIndex]).length;}
function revealFull(){cancelAnimationFrame(textRAF);textCount=Array.from(lines[lineIndex]).length;renderText()}
function resumeText(){cancelAnimationFrame(textRAF);if(reduced()){revealFull();return}last=performance.now();const tick=t=>{if(document.hidden)return;fraction+=(t-last)*Number($('speed').value)/1000;last=t;const add=Math.floor(fraction);fraction-=add;textCount=Math.min(Array.from(lines[lineIndex]).length,textCount+add);renderText();if(textCount<Array.from(lines[lineIndex]).length)textRAF=requestAnimationFrame(tick)};textRAF=requestAnimationFrame(tick)}
function startLine(){textCount=0;fraction=0;$('dialogue-accessible').textContent=lines[lineIndex];renderText();resumeText()}
function advance(){if(textCount<Array.from(lines[lineIndex]).length)revealFull();else{lineIndex=(lineIndex+1)%lines.length;startLine()}}
$('advance').onclick=advance;$('vn').onkeydown=e=>{if(e.target!==$('vn'))return;if(e.code==='Space'||e.key==='Enter'){e.preventDefault();advance()}};
$('speed').onchange=()=>resumeText();
function resizeVN(){$('vn-character').src=matchMedia('(max-width:600px)').matches?'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=':base+'fallbacks/portrait-explain.webp'};addEventListener('resize',resizeVN);
window.motionDemo={select:selectAction,replay:()=>$('replay').click(),reduce:v=>{manualReduce=v;updateReduced()},state:()=>({id:current.id,reduced:reduced(),complete,paused,active:$('actor').dataset.active,textCount})};
selectAction('wave');theme();resizeVN();startLine();updateReduced();
