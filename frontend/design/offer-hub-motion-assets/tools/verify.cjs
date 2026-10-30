const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');const root=path.resolve(__dirname,'..');
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)])}
async function main(){const assets=walk(path.join(root,'public')).filter(f=>/\.(webp|svg|png)$/.test(f));const report=[];
 for(const file of assets){const buf=fs.readFileSync(file);if(buf.length>150000)throw Error('Over budget: '+file);const s=sharp(buf,{animated:true}),m=await s.metadata();await s.raw().toBuffer();report.push({file:path.relative(root,file),bytes:buf.length,width:m.width,height:m.pageHeight||m.height,pages:m.pages||1,hasAlpha:m.hasAlpha,loop:m.loop,delay:m.delay,sha256:crypto.createHash('sha256').update(buf).digest('hex')});}
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));const motion=[];
 for(const a of manifest.animations){const file=path.join(root,'public/assets/offer-hub-motion',a.variants[1].file);const {data,info}=await sharp(file,{animated:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});const m=await sharp(file,{animated:true}).metadata();if(m.pages!==8)throw Error('Incorrect frame count: '+a.id);if(!m.hasAlpha)throw Error('Missing alpha');if(m.delay.reduce((x,y)=>x+y,0)!==a.duration)throw Error('Timing mismatch');
  const bytesPerFrame=info.width*(m.pageHeight)*4;const hashes=[];for(let i=0;i<8;i++)hashes.push(crypto.createHash('sha256').update(data.subarray(i*bytesPerFrame,(i+1)*bytesPerFrame)).digest('hex'));const unique=new Set(hashes).size;if(unique<4)throw Error('Insufficient frame variation: '+a.id);
  motion.push({id:a.id,pages:m.pages,duration:a.duration,loop:m.loop,uniqueDecodedFrames:unique});
 }
 for(const file of walk(path.join(root,'masters')).concat(walk(path.join(root,'frames'))))await sharp(file).raw().toBuffer();
 const result={webImageCount:report.length,allDecoded:true,maxWebImageBytes:Math.max(...report.map(r=>r.bytes)),motion,files:report};fs.writeFileSync(path.join(root,'docs/validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,files:undefined}));
}
main().catch(e=>{console.error(e);process.exit(1)});
