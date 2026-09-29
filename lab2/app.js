(() => {
"use strict";

/* Обработка данных и парсинг */
function workerMain() {
  "use strict";

  const u16le=(v,o)=>v.getUint16(o,true), u16be=(v,o)=>v.getUint16(o,false);
  const u32le=(v,o)=>v.getUint32(o,true), u32be=(v,o)=>v.getUint32(o,false);
  const ascii=(u,o,n)=>String.fromCharCode(...u.slice(o,o+n));
  const fmtNum=n=>Number.isFinite(n)?Math.round(n*100)/100:null;
  const result=(format)=>({format,width:null,height:null,dpiX:null,dpiY:null,depth:null,compression:"-",status:"OK",details:""});
  const fail=(format,msg)=>({...result(format),status:"Файл поврежден",details:msg});
  const need=(cond,msg)=>{if(!cond)throw new Error(msg)};
  async function bytes(file,start=0,end=file.size){return new Uint8Array(await file.slice(start,end).arrayBuffer())}
  const view=u=>new DataView(u.buffer,u.byteOffset,u.byteLength);
  function dpiText(x,y){if(!x&&!y)return "-"; if(x&&y)return `${fmtNum(x)} × ${fmtNum(y)}`; return String(fmtNum(x||y))}
  function depthText(d){return d==null?"-":`${d} бит`}
  function finalize(r){r.dpi=dpiText(r.dpiX,r.dpiY);r.depthText=depthText(r.depth);return r}

  async function parsePNG(file){
    const r=result("PNG");
    const h=await bytes(file,0,Math.min(file.size,33));
    need(h.length>=33,"слишком короткий PNG");

    const sig=[137,80,78,71,13,10,26,10];
    need(sig.every((b,i)=>h[i]===b),"неверная сигнатура PNG");

    const hv=view(h);
    const ihdrLength=u32be(hv,8);
    need(ihdrLength===13 && ascii(h,12,4)==="IHDR","отсутствует корректный IHDR");

    r.width=u32be(hv,16);
    r.height=u32be(hv,20);
    need(r.width>0 && r.height>0,"некорректные размеры PNG");

    const bitDepth=h[24];
    const colorType=h[25];
    const channels={0:1,2:3,3:1,4:2,6:4}[colorType];
    need(channels!==undefined,"неподдерживаемый color type PNG");

    const allowedDepths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
    need(allowedDepths[colorType].includes(bitDepth),"некорректная глубина цвета PNG");
    need(h[26]===0,"неподдерживаемый метод сжатия PNG");
    need(h[27]===0,"неподдерживаемый метод фильтрации PNG");

    r.depth=bitDepth*channels;
    r.compression="Deflate (метод 0)";

    let pos=8;
    let hasIEND=false;
    let hasIDAT=false;

    while(pos+12<=file.size){
      const chunkHeader=await bytes(file,pos,pos+8);
      need(chunkHeader.length===8,"обрезанный заголовок chunk PNG");

      const cv=view(chunkHeader);
      const len=u32be(cv,0);
      const typeName=ascii(chunkHeader,4,4);
      const chunkEnd=pos+12+len;
      need(chunkEnd<=file.size,"размер chunk выходит за файл");

      if(typeName==="pHYs"){
        need(len===9,"некорректный pHYs");
        const p=await bytes(file,pos+8,pos+17);
        const pv=view(p);
        if(p[8]===1){
          r.dpiX=u32be(pv,0)*0.0254;
          r.dpiY=u32be(pv,4)*0.0254;
        }
      }

      if(typeName==="IDAT")hasIDAT=true;

      if(typeName==="IEND"){
        need(len===0,"некорректный IEND");
        hasIEND=true;
        break;
      }

      pos=chunkEnd;
    }

    need(hasIDAT,"отсутствует IDAT");
    need(hasIEND,"отсутствует IEND");
    return finalize(r)
  }

  async function parseGIF(file){
    const r=result("GIF"), h=await bytes(file,0,13);
    need(h.length>=13,"слишком короткий GIF"); const s=ascii(h,0,6);need(s==="GIF87a"||s==="GIF89a","неверная сигнатура GIF");
    const v=view(h);r.width=u16le(v,6);r.height=u16le(v,8);const packed=h[10];r.depth=((packed>>4)&7)+1;r.compression="LZW";
    const tail=await bytes(file,Math.max(0,file.size-1),file.size);need(tail[0]===0x3b,"отсутствует GIF trailer 3B");return finalize(r)
  }

  async function parseBMP(file){
    const r=result("BMP"), h=await bytes(file,0,Math.min(file.size,128));need(h.length>=54,"слишком короткий BMP");need(h[0]===0x42&&h[1]===0x4d,"неверная сигнатура BMP");
    const v=view(h), declared=u32le(v,2), dib=u32le(v,14);need(dib>=40&&h.length>=54,"неподдерживаемый DIB header");
    r.width=Math.abs(v.getInt32(18,true));r.height=Math.abs(v.getInt32(22,true));r.depth=u16le(v,28);
    const comp=u32le(v,30), names={0:"BI_RGB (без сжатия)",1:"BI_RLE8",2:"BI_RLE4",3:"BI_BITFIELDS",4:"BI_JPEG",5:"BI_PNG",6:"BI_ALPHABITFIELDS"};r.compression=names[comp]||`BMP compression ${comp}`;
    const x=v.getInt32(38,true),y=v.getInt32(42,true);if(x>0)r.dpiX=x*0.0254;if(y>0)r.dpiY=y*0.0254;
    need(declared===0||declared<=file.size,"размер в заголовке больше файла");return finalize(r)
  }

  async function parsePCX(file){
    const r=result("PCX"), h=await bytes(file,0,128);need(h.length>=128,"слишком короткий PCX");need(h[0]===0x0a,"неверная сигнатура PCX");need(h[2]===1,"неподдерживаемое сжатие PCX");
    const v=view(h),xmin=u16le(v,4),ymin=u16le(v,6),xmax=u16le(v,8),ymax=u16le(v,10);
    need(xmax>=xmin&&ymax>=ymin,"неверные координаты PCX");r.width=xmax-xmin+1;r.height=ymax-ymin+1;r.dpiX=u16le(v,12)||null;r.dpiY=u16le(v,14)||null;r.depth=h[3]*h[65];r.compression="PCX RLE";return finalize(r)
  }

  async function parseJPEG(file){
    const r=result("JPEG"), first=await bytes(file,0,2);need(first.length===2&&first[0]===0xff&&first[1]===0xd8,"отсутствует SOI FF D8");
    let pos=2, foundSOF=false, foundEOI=false;
    while(pos<file.size){
      let b=await bytes(file,pos,Math.min(file.size,pos+2)); if(!b.length)break;
      if(b[0]!==0xff){pos++;continue}
      let marker=b[1];pos+=2;while(marker===0xff){b=await bytes(file,pos,pos+1);marker=b[0];pos++}
      if(marker===0xd9){foundEOI=true;break}
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      const lb=await bytes(file,pos,pos+2);need(lb.length===2,"обрезанный JPEG segment");const len=(lb[0]<<8)|lb[1];need(len>=2&&pos+len<=file.size,"размер JPEG segment выходит за файл");
      const dataStart=pos+2, dataLen=len-2;
      if(marker===0xe0&&dataLen>=14){
        const a=await bytes(file,dataStart,dataStart+14);
        if(ascii(a,0,5)==="JFIF\0"){const unit=a[7],xd=(a[8]<<8)|a[9],yd=(a[10]<<8)|a[11];if(unit===1){r.dpiX=xd;r.dpiY=yd}else if(unit===2){r.dpiX=xd*2.54;r.dpiY=yd*2.54}}
      }
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&dataLen>=6){
        const a=await bytes(file,dataStart,dataStart+6);r.height=(a[1]<<8)|a[2];r.width=(a[3]<<8)|a[4];r.depth=a[0]*a[5];foundSOF=true;
        r.compression=marker===0xc2?"JPEG DCT, progressive":marker===0xc0?"JPEG DCT, baseline":"JPEG";
      }
      if(marker===0xda){
        pos += len;
        const tail=await bytes(file,Math.max(0,file.size-2),file.size);foundEOI=tail.length===2&&tail[0]===0xff&&tail[1]===0xd9;break;
      }
      pos += len;
    }
    need(foundSOF,"не найден SOF");need(foundEOI,"отсутствует EOI FF D9");return finalize(r)
  }

  async function parseTIFF(file){
    const r=result("TIFF"), max=Math.min(file.size,1024*1024), u=await bytes(file,0,max);need(u.length>=8,"слишком короткий TIFF");
    const le=u[0]===0x49&&u[1]===0x49, be=u[0]===0x4d&&u[1]===0x4d;need(le||be,"неверная сигнатура TIFF");const v=view(u);
    const U16=o=>v.getUint16(o,le),U32=o=>v.getUint32(o,le);need(U16(2)===42,"неверный magic TIFF");
    const ifd=U32(4);need(ifd+2<=u.length,"IFD находится вне прочитанного диапазона");const count=U16(ifd);need(ifd+2+count*12+4<=u.length,"обрезанный IFD");
    const typeSize={1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8};
    function entryValue(type,cnt,valOff,entryOff){
      const size=(typeSize[type]||0)*cnt;const off=size<=4?entryOff+8:valOff;need(off+size<=u.length,"значение TIFF tag вне диапазона");
      if(type===3)return cnt===1?U16(off):Array.from({length:cnt},(_,i)=>U16(off+i*2));
      if(type===4)return cnt===1?U32(off):Array.from({length:cnt},(_,i)=>U32(off+i*4));
      if(type===5){const vals=Array.from({length:cnt},(_,i)=>{const a=U32(off+i*8),b=U32(off+i*8+4);return b?a/b:0});return cnt===1?vals[0]:vals}
      return null
    }
    let unit=2,xres=null,yres=null,bits=null,spp=1,compression=null;
    for(let i=0;i<count;i++){const o=ifd+2+i*12,tag=U16(o),type=U16(o+2),cnt=U32(o+4),vo=U32(o+8);let val=null;try{val=entryValue(type,cnt,vo,o)}catch(e){continue}
      if(tag===256)r.width=Array.isArray(val)?val[0]:val;if(tag===257)r.height=Array.isArray(val)?val[0]:val;if(tag===258)bits=val;if(tag===259)compression=Array.isArray(val)?val[0]:val;
      if(tag===277)spp=Array.isArray(val)?val[0]:val;if(tag===282)xres=val;if(tag===283)yres=val;if(tag===296)unit=Array.isArray(val)?val[0]:val;
    }
    need(r.width&&r.height,"не найдены размеры TIFF");if(Array.isArray(bits))r.depth=bits.reduce((a,b)=>a+b,0);else if(bits)r.depth=bits*spp;
    if(unit===2){r.dpiX=xres;r.dpiY=yres}else if(unit===3){r.dpiX=xres?xres*2.54:null;r.dpiY=yres?yres*2.54:null}
    const cn={1:"Без сжатия",2:"CCITT 1D",3:"CCITT Group 3",4:"CCITT Group 4",5:"LZW",6:"Old JPEG",7:"JPEG",8:"Deflate",32773:"PackBits"};r.compression=cn[compression]||`TIFF compression ${compression??"-"}`;return finalize(r)
  }

  async function detect(file){
    const h=await bytes(file,0,16);if(h.length<2)return null;
    if(h[0]===0xff&&h[1]===0xd8)return "jpeg";
    if(h.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>h[i]===b))return "png";
    if(ascii(h,0,6)==="GIF87a"||ascii(h,0,6)==="GIF89a")return "gif";
    if(h[0]===0x42&&h[1]===0x4d)return "bmp";
    if((h[0]===0x49&&h[1]===0x49&&h[2]===42&&h[3]===0)||(h[0]===0x4d&&h[1]===0x4d&&h[2]===0&&h[3]===42))return "tiff";
    if(h[0]===0x0a&&h[2]===1)return "pcx";return null
  }
  const extKind=name=>{const e=(name.split(".").pop()||"").toLowerCase();return e==="jpg"||e==="jpeg"?"jpeg":e==="tif"||e==="tiff"?"tiff":e};
  async function parse(file){
    const actual=await detect(file), expected=extKind(file.name);
    if(!actual)return finalize(fail(expected.toUpperCase()||"-","сигнатура не соответствует поддерживаемому графическому формату"));
    if(expected!==actual){const x=finalize(fail(actual.toUpperCase(),`подмена расширения: .${expected||"?"}, фактически ${actual.toUpperCase()}`));return x}
    try{
      if(actual==="png")return await parsePNG(file);if(actual==="jpeg")return await parseJPEG(file);if(actual==="gif")return await parseGIF(file);
      if(actual==="bmp")return await parseBMP(file);if(actual==="tiff")return await parseTIFF(file);if(actual==="pcx")return await parsePCX(file);
    }catch(e){return finalize(fail(actual.toUpperCase(),e.message||"ошибка разбора"))}
  }
  self.onmessage=async e=>{const {id,file}=e.data;try{self.postMessage({id,data:await parse(file)})}catch(err){self.postMessage({id,data:finalize(fail("-",err.message||"неизвестная ошибка"))})}}
}

/* Ядро, бизнес-логика. Мультипоточная обработка */
class WorkerPool {
  constructor(size) {
    this.url = URL.createObjectURL(new Blob([`(${workerMain.toString()})()`], {type:"text/javascript"}));
    this.workers = Array.from({length:size}, () => this.makeWorker());
    this.queue = [];
    this.seq = 0;
  }
  makeWorker() {
    const worker = new Worker(this.url);
    const slot = {worker,busy:false,current:null};
    worker.onmessage = e => {
      const job = slot.current;
      slot.busy = false; slot.current = null;
      if (job) job.resolve(e.data.data);
      this.pump();
    };
    worker.onerror = e => {
      const job = slot.current;
      slot.busy = false; slot.current = null;
      if (job) job.resolve({format:"-",width:null,height:null,dpi:"-",depthText:"-",compression:"-",status:"Файл поврежден",details:e.message||"ошибка Worker"});
      this.pump();
    };
    return slot;
  }
  run(file) {
    return new Promise(resolve => {
      this.queue.push({id:++this.seq,file,resolve});
      this.pump();
    });
  }
  pump() {
    for (const slot of this.workers) {
      if (slot.busy || !this.queue.length) continue;
      const job = this.queue.shift();
      slot.busy = true; slot.current = job;
      slot.worker.postMessage({id:job.id,file:job.file});
    }
  }
  destroy() {
    this.workers.forEach(s=>s.worker.terminate());
    URL.revokeObjectURL(this.url);
  }
}

/* Вывод данных */
const $=id=>document.getElementById(id);
const els={files:$("files"),folder:$("folder"),clear:$("clear"),rows:$("rows"),found:$("found"),done:$("done"),broken:$("broken"),size:$("size"),bar:$("bar"),message:$("message")};
let generation=0, pool=null;
const allowed=new Set(["jpg","jpeg","gif","tif","tiff","bmp","png","pcx"]);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function reset(){generation++;if(pool){pool.destroy();pool=null}els.rows.innerHTML="";els.found.textContent="0";els.done.textContent="0";els.broken.textContent="0";els.size.textContent="0 МБ";els.bar.style.width="0%";els.message.textContent="Выберите файлы или папку.";els.files.value="";els.folder.value=""}
function row(file,d){
  const tr=document.createElement("tr");if(d.status!=="OK")tr.className="bad";
  const size=d.width&&d.height?`${d.width} × ${d.height}`:"-";
  const status=d.status==="OK"?`<span class="ok">OK</span>`:`<span class="bad-text">${esc(d.status)}</span><br><span class="muted">${esc(d.details)}</span>`;
  tr.innerHTML=`<td title="${esc(file.webkitRelativePath||file.name)}">${esc(file.name)}</td><td>${esc(d.format)}</td><td>${esc(size)}</td><td>${esc(d.dpi||"-")}</td><td>${esc(d.depthText||"-")}</td><td>${esc(d.compression||"-")}</td><td>${status}</td>`;
  els.rows.appendChild(tr);
}
async function processSelection(fileList){
  const token=++generation;if(pool){pool.destroy();pool=null}
  els.rows.innerHTML="";els.done.textContent="0";els.broken.textContent="0";els.bar.style.width="0%";
  const all=Array.from(fileList), files=all.filter(f=>allowed.has((f.name.split(".").pop()||"").toLowerCase()));
  els.found.textContent=String(files.length);const total=files.reduce((s,f)=>s+f.size,0);els.size.textContent=`${(total/1048576).toFixed(2)} МБ`;
  if(!files.length){els.message.textContent="Поддерживаемые файлы не найдены.";return}
  const count=Math.max(1,Math.min(8,navigator.hardwareConcurrency||4,files.length));pool=new WorkerPool(count);
  els.message.textContent=`Обработка ${files.length} файлов в ${count} потоках...`;
  let done=0,broken=0;
  await Promise.all(files.map(async file=>{
    const data=await pool.run(file);if(token!==generation)return;
    row(file,data);done++;if(data.status!=="OK")broken++;
    els.done.textContent=String(done);els.broken.textContent=String(broken);els.bar.style.width=`${done/files.length*100}%`;
  }));
  if(token===generation){pool.destroy();pool=null;els.message.textContent=`Готово. Обработано: ${done}. Повреждено/ошибок: ${broken}.`}
}
els.files.addEventListener("change",e=>processSelection(e.target.files));
els.folder.addEventListener("change",e=>processSelection(e.target.files));
els.clear.addEventListener("click",reset);
})();
