import {useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react';

export function LoadingDots({label='正在加载'}:{label?:string}){
 return <span className="ohm-motion" role="status"><span className="ohm-dots" aria-hidden="true"><i/><i/><i/></span><span className="ohm-sr-only">{label}</span></span>;
}
export function BookmarkButton({pressed,onChange,disabled=false}:{pressed:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){
 return <button type="button" className="ohm-bookmark ohm-motion" aria-pressed={pressed} disabled={disabled} onClick={()=>onChange(!pressed)}>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>{pressed?'已收藏':'收藏'}
 </button>;
}
export function MasteryProgress({value,label='掌握进度'}:{value:number;label?:string}){
 const n=Math.min(100,Math.max(0,Number.isFinite(value)?value:0));
 return <div className="ohm-progress ohm-motion" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={n}><span style={{transform:`scaleX(${n/100})`}}/></div>;
}
export function AnswerFeedback({state,children}:{state:'mastered'|'review'|'retry';children:ReactNode}){
 return <div className={`ohm-motion ohm-${state==='mastered'?'dialogue-enter':state}`} role="status">
  {state==='mastered'&&<svg className="ohm-check" width="24" height="24" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M10 24l9 9 19-20"/></svg>}{children}
 </div>;
}
export function MilestoneBurst({children}:{children?:ReactNode}){
 const points=[[-24,-24,-40],[0,-32,20],[24,-24,60],[30,8,100],[-30,8,-90],[0,30,160]];
 return <span className="ohm-burst ohm-motion" aria-hidden="true"><span className="ohm-badge">{children??'✦'}</span>{points.map(([x,y,r],i)=><i key={i} style={{'--x':x+'px','--y':y+'px','--r':r+'deg'} as CSSProperties}/>)}</span>;
}
export function MotionPanel({kind='dialogue',children,className=''}:{kind?:'dialogue'|'backlog'|'drawer'|'toast'|'page'|'scene'|'character';children:ReactNode;className?:string}){
 return <div className={`ohm-motion ohm-${kind}-enter ${className}`}>{children}</div>;
}
/** Text progression is application logic; visual transitions remain CSS-only.
 * Pass revealAll after a click/Space/Enter; keep keyboard handling in the VN controller.
 * Screen readers receive the full paragraph once, not every character update.
 */
export function DialogueText({text,speed=40,revealAll=false,disabled=false,onComplete}:{text:string;speed?:number;revealAll?:boolean;disabled?:boolean;onComplete?:()=>void}){
 const chars=useMemo(()=>Array.from(text),[text]);const [count,setCount]=useState(0);const cursor=useRef(0);
 const done=useRef(false);const callback=useRef(onComplete);callback.current=onComplete;
 const [reduce,setReduce]=useState<boolean|null>(null);
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduce(q.matches);update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update)},[]);
 useEffect(()=>{cursor.current=0;setCount(0);done.current=false},[text]);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;let start=performance.now(),from=cursor.current;
  if(reduce===null)return;
  const finish=()=>{if(!done.current){done.current=true;callback.current?.()}};
  if(reduce||disabled||revealAll){cursor.current=chars.length;setCount(chars.length);finish();return}
  const rate=Math.min(2000,Math.max(1,Number.isFinite(speed)?speed:40));
  const tick=()=>{if(document.hidden)return;const n=Math.min(chars.length,from+Math.floor((performance.now()-start)*rate/1000));cursor.current=n;setCount(n);if(n===chars.length)finish();else timer=setTimeout(tick,16)};
  const visibility=()=>{if(timer)clearTimeout(timer);if(!document.hidden){from=cursor.current;start=performance.now();tick()}};
  document.addEventListener('visibilitychange',visibility);tick();
  return()=>{if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',visibility)};
 },[chars,speed,reduce,disabled,revealAll]);
 return <span><span aria-hidden="true">{chars.slice(0,reduce||disabled||revealAll?chars.length:count).join('')}</span><span className="ohm-sr-only">{text}</span></span>;
}
