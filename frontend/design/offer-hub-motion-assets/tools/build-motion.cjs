const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..');const out=path.join(root,'public/assets/offer-hub-motion');
const jobs=JSON.parse(fs.readFileSync(path.join(root,'docs/prompts.json'))).jobs;
const limit=150000;sharp.concurrency(2);
const manifest={version:1,baseUrl:'/assets/offer-hub-motion/',animations:[]};const report=[];
async function save(data,rel,extra={}){if(data.length>limit)throw Error('Over budget: '+rel);const dest=path.join(out,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);const m=await sharp(data,{animated:true}).metadata();const v={file:rel,bytes:data.length,width:m.width,height:m.pageHeight||m.height,frames:m.pages||1,...extra};report.push(v);return v;}
async function encoded(input,rel,opts){let data,q;for(q of [82,74,66,58,50,42,34,26]){data=await sharp(input,opts?.input).webp({quality:q,alphaQuality:90,effort:5,...opts?.webp}).toBuffer();if(data.length<=limit)break;}return save(data,rel,{quality:q});}
function cutsForRow(data,width,top,height){const cuts=[0];for(let c=1;c<4;c++){let best=c*width/4,score=Infinity;for(let x=best-32;x<=c*width/4+32;x++){let sum=0;for(let y=top;y<top+height;y++)sum+=Math.max(0,data[(y*width+x)*4+3]-20);const s=sum+Math.abs(x-c*width/4)*0.001;if(s<score){score=s;best=x;}}cuts.push(best);}cuts.push(width);return cuts;}
async function main(){let css='/* Generated eight-frame timelines. Load together with motion.css. */\n';
 for(const j of jobs){
  const src=path.join(root,'masters',j.id+'.png');const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.width!==1536||info.height!==1024)throw Error('Unexpected atlas dimensions: '+j.id);
  const rows=[cutsForRow(data,info.width,0,512),cutsForRow(data,info.width,512,512)];const rawFrames=[];
  for(let i=0;i<8;i++){const col=i%4,row=Math.floor(i/4),left=rows[row][col],w=rows[row][col+1]-left;
   const cell=await sharp(src).extract({left,top:row*512,width:w,height:512}).png().toBuffer();
   const frame=await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite([{input:cell,left:64+left-col*384,top:0}]).png().toBuffer();rawFrames.push(frame);
  }
  // Keep one waving hand throughout the sequence; omit the generator's opposite-hand transition.
  const order=j.id==='wave'?[0,3,2,4,5,4,3,0]:[0,1,2,3,4,5,6,0];
  const frames=order.map(i=>rawFrames[i]);fs.mkdirSync(path.join(root,'frames',j.id),{recursive:true});
  frames.forEach((f,i)=>fs.writeFileSync(path.join(root,'frames',j.id,String(i).padStart(2,'0')+'.png'),f));
  const duration=j.delays.reduce((a,b)=>a+b,0);const a={id:j.id,label:j.label,frameCount:8,duration,defaultLoop:j.loop===0,delays:j.delays,sourceFrameOrder:order,variants:[],posters:[]};
  for(const size of [96,192,288]){
   const raw=await Promise.all(frames.map(f=>sharp(f).resize(size,size).ensureAlpha().raw().toBuffer()));
   const v=await encoded(Buffer.concat(raw),`animated/${j.id}-${size}.webp`,{input:{raw:{width:size,height:size*8,channels:4,pageHeight:size}},webp:{loop:j.loop,delay:j.delays}});a.variants.push(v);
   const poster=await sharp(frames[0]).resize(size,size).png().toBuffer();a.posters.push(await encoded(poster,`posters/${j.id}-${size}.webp`));
  }
  for(const size of [192,288]){
   const sprite=await sharp({create:{width:size*8,height:size,channels:4,background:'#00000000'}}).composite(await Promise.all(frames.map(async(f,i)=>({input:await sharp(f).resize(size,size).png().toBuffer(),left:i*size,top:0})))).png().toBuffer();
   const v=await encoded(sprite,`sprites/${j.id}-${size}.webp`);if(size===192)a.sprite=v;else a.spriteHiDPI=v;
  }
  // GIFs are preview files only; production uses alpha WebP or CSS sprite sheets.
  const previewRaw=await Promise.all(frames.map(f=>sharp(f).resize(192,192).flatten({background:'#FDFAF4'}).ensureAlpha().raw().toBuffer()));
  await sharp(Buffer.concat(previewRaw),{raw:{width:192,height:1536,channels:4,pageHeight:192}}).gif({loop:0,delay:j.delays,colours:192,effort:7}).toFile(path.join(root,'preview',j.id+'.gif'));
  let elapsed=0;css+=`@keyframes ohm-frames-${j.id}{\n`;
  j.delays.forEach((d,i)=>{css+=`${(elapsed/duration*100).toFixed(5)}%{background-position:${(i/7*100).toFixed(6)}% 0}\n`;elapsed+=d});css+='100%{background-position:100% 0}\n}\n';
  manifest.animations.push(a);console.log(j.id+' exported');
 }
 fs.writeFileSync(path.join(out,'frames.css'),css);
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(root,'integration/motion-manifest.ts'),'export const motionManifest = '+JSON.stringify(manifest,null,2)+' as const;\n');
 fs.writeFileSync(path.join(root,'preview/manifest.js'),'window.MOTION_MANIFEST = '+JSON.stringify(manifest)+';');
 fs.writeFileSync(path.join(root,'docs/encoding-report.json'),JSON.stringify({limitBytes:limit,fileCount:report.length,maxBytes:Math.max(...report.map(r=>r.bytes)),files:report},null,2));
 console.log('DONE '+report.length+' images; max '+Math.max(...report.map(r=>r.bytes))+' bytes');
}
main().catch(e=>{console.error(e);process.exit(1)});
