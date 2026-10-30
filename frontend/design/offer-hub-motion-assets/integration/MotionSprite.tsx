import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {motionManifest} from './motion-manifest';
export type MotionName=(typeof motionManifest.animations)[number]['id'];

/** No animation library. The visible timeline is CSS keyframes + a WebP strip. */
export function MotionSprite({name,size=144,playKey=0,loop,disabled=false,label,base='/assets/offer-hub-motion/',onComplete}:{
 name:MotionName;size?:number;playKey?:string|number;loop?:boolean;disabled?:boolean;label?:string;base?:string;onComplete?:()=>void;
}){
 const item=motionManifest.animations.find(a=>a.id===name)!;
 const ref=useRef<HTMLSpanElement>(null);const [allowed,setAllowed]=useState(false);
 const [inView,setInView]=useState(false);const [finished,setFinished]=useState(false);
 useEffect(()=>{setFinished(false)},[name,playKey]);
 useEffect(()=>{
  const mq=matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setAllowed(!mq.matches&&!document.hidden&&!disabled);update();
  mq.addEventListener('change',update);document.addEventListener('visibilitychange',update);
  return()=>{mq.removeEventListener('change',update);document.removeEventListener('visibilitychange',update)};
 },[disabled]);
 useEffect(()=>{
  if(!ref.current)return;
  if(!('IntersectionObserver' in window)){setInView(true);return}
  const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting),{threshold:0.1});
  observer.observe(ref.current);return()=>observer.disconnect();
 },[name,playKey]);
 const active=allowed&&inView&&!finished;const repeat=loop??item.defaultLoop;
 const sheet=size<=96?item.sprite:item.spriteHiDPI;
 const poster=size<=96?item.posters[1]:item.posters[2];
 const style:CSSProperties={width:size,backgroundImage:`url("${base}${active?sheet.file:poster.file}")`,
  animationName:active?`ohm-frames-${name}`:'none',animationDuration:`${item.duration}ms`,animationIterationCount:repeat?'infinite':1};
 return <span ref={ref} key={`${name}-${playKey}`} className="ohm-sprite ohm-motion" data-active={String(active)} style={style}
  role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true}
  onAnimationEnd={e=>{if(e.target===e.currentTarget&&!repeat){setFinished(true);onComplete?.()}}}/>;
}
