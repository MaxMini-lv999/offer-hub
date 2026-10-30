const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const templates={
 dots:{label:'加载',body:'<g><rect class="a" x="10" y="29" width="6" height="6"/><rect class="a b" x="29" y="29" width="6" height="6"/><rect class="a c" x="48" y="29" width="6" height="6"/></g>',css:'.a{animation:a 1200ms ease-in-out infinite}.b{animation-delay:160ms}.c{animation-delay:320ms}@keyframes a{0%,70%,100%{opacity:.35;transform:translateY(0)}35%{opacity:1;transform:translateY(-5px)}}'},
 hourglass:{label:'等待',body:'<g class="turn" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h28M18 54h28M21 10v10l11 12-11 12v10M43 10v10L32 32l11 12v10"/><path fill="currentColor" stroke="none" d="M25 18h14l-7 9zM25 48l7-9 7 9z"/></g>',css:'.turn{transform-origin:32px 32px;animation:a 1800ms cubic-bezier(.2,0,0,1) infinite}@keyframes a{0%,65%{transform:rotate(0)}85%,100%{transform:rotate(180deg)}}'},
 book:{label:'翻书',body:'<g fill="none" stroke="currentColor" stroke-width="2"><path d="M32 18Q20 10 8 15v34q12-5 24 3 12-8 24-3V15q-12-5-24 3v34"/><path class="page" fill="currentColor" fill-opacity=".12" d="M32 18Q21 9 10 14v34q11-4 22 4z"/></g>',css:'.page{transform-origin:32px 32px;animation:a 1600ms cubic-bezier(.2,0,0,1) infinite}@keyframes a{0%,25%{transform:scaleX(1)}65%,90%{transform:scaleX(-1)}100%{transform:scaleX(1)}}'},
 check:{label:'已掌握',body:'<path class="line" fill="none" stroke="currentColor" stroke-width="3" d="M14 32l11 11 25-27"/>',css:'.line{stroke-dasharray:70;animation:a 240ms cubic-bezier(.2,0,0,1) both}@keyframes a{from{stroke-dashoffset:70}to{stroke-dashoffset:0}}'},
 continue:{label:'继续',body:'<path class="arrow" d="M23 18l18 14-18 14z"/>',css:'.arrow{animation:a 1400ms ease-in-out infinite}@keyframes a{50%{transform:translateX(3px);opacity:.5}}'},
 milestone:{label:'里程碑',body:'<path d="M32 19l4 9 10 4-10 4-4 10-4-10-10-4 10-4z"/><g class="p"><path d="M14 13h4v4h-4zM47 16h4v4h-4zM45 48h4v4h-4zM14 47h4v4h-4z"/></g>',css:'.p{transform-origin:32px 32px;animation:a 240ms cubic-bezier(.2,0,0,1) both}@keyframes a{from{opacity:0;transform:scale(.3)}40%{opacity:1}to{opacity:0;transform:scale(1.2)}}'}
};
const out=path.join(root,'public/assets/offer-hub-motion/vectors');fs.mkdirSync(out,{recursive:true});
for(const [id,t] of Object.entries(templates))for(const theme of ['light','dark']){
 const color=['continue','milestone'].includes(id)?(theme==='light'?'#D43063':'#F87F99'):(theme==='light'?'#171A26':'#F1EEE9');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" style="color:${color};fill:currentColor"><title>${t.label}</title><style>${t.css}@media(prefers-reduced-motion:reduce){*{animation:none!important}.p{display:none}}</style>${t.body}</svg>`;
 fs.writeFileSync(path.join(out,`${id}-${theme}.svg`),svg);
}
console.log('12 theme-specific animated SVG files');
