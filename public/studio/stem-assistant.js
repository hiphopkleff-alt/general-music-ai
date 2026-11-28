"use strict";
(()=>{
 const $=id=>document.getElementById(id);
 const api=window.GTStudio;
 if(!api){console.error("Stem Assistant: Studio bridge unavailable.");return;}
 const roleData={
  vocal:{label:"Lead Vocal",keys:["lead vocal","lead vox","main vocal","vocal","vox","voice","singer"],settings:{low:-2,mid:1.5,high:1.2,compressor:34,deesser:30,reverb:8,delay:0}},
  backing:{label:"Backing Vocals",keys:["backing","bgv","bvox","choir","harmony","harmonies"],settings:{low:-2,mid:1,high:1,compressor:28,deesser:22,reverb:16,delay:5}},
  kick:{label:"Kick",keys:["kick","bass drum"],settings:{low:2.5,mid:-1,high:.5,compressor:38,deesser:0,reverb:0,delay:0}},
  bass:{label:"Bass",keys:["bass","808","sub"],settings:{low:2,mid:-1,high:.5,compressor:32,deesser:0,reverb:0,delay:0}},
  snare:{label:"Snare",keys:["snare","clap"],settings:{low:-1,mid:1.5,high:1.5,compressor:26,deesser:0,reverb:3,delay:0}},
  drums:{label:"Drums",keys:["drum","perc","percussion","toms","rim"],settings:{low:1,mid:.5,high:1,compressor:30,deesser:0,reverb:3,delay:0}},
  hats:{label:"Hi-hats",keys:["hat","hihat","hi-hat","cymbal","shaker"],settings:{low:-3,mid:0,high:2,compressor:14,deesser:8,reverb:2,delay:0}},
  piano:{label:"Piano / Keys",keys:["piano","keys","keyboard","organ","rhodes"],settings:{low:-1,mid:.5,high:1,compressor:18,deesser:0,reverb:10,delay:0}},
  guitar:{label:"Guitar",keys:["guitar","gtr"],settings:{low:-1,mid:1,high:1,compressor:20,deesser:0,reverb:10,delay:4}},
  synth:{label:"Synth",keys:["synth","pad","lead synth","arp"],settings:{low:0,mid:-.5,high:1,compressor:18,deesser:0,reverb:12,delay:8}},
  strings:{label:"Strings",keys:["strings","violin","cello","orchestra"],settings:{low:-1,mid:.5,high:1,compressor:14,deesser:0,reverb:16,delay:0}},
  instruments:{label:"Music / Instruments",keys:["music","instrument","melody","sample","loop","inst"],settings:{low:0,mid:0,high:.5,compressor:18,deesser:0,reverb:6,delay:0}},
  fx:{label:"Effects / FX",keys:["fx","effect","ambience","riser","sfx"],settings:{low:-1,mid:0,high:1,compressor:12,deesser:0,reverb:14,delay:10}},
  unknown:{label:"Unclassified / Full Mix",keys:[],settings:null}
 };
 const roles=Object.entries(roleData);
 const detect=name=>{const n=String(name||"").toLowerCase().replace(/[_-]+/g," ");for(const [key,r] of roles){if(key==="unknown")continue;if(r.keys.some(k=>new RegExp("(^|\\W)"+k.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")+"($|\\W)","i").test(n)))return key;}return "unknown"};
 function measure(buffer){
  const d=buffer.getChannelData(0),stride=Math.max(1,Math.floor(d.length/24000));let sum=0,peak=0,lo=0,mid=0,hi=0,lp=0,mp=0,n=0;
  for(let i=0;i<d.length;i+=stride){const x=d[i],a=Math.abs(x);sum+=x*x;peak=Math.max(peak,a);lp=lp*.94+x*.06;mp=mp*.72+(x-lp)*.28;const h=x-lp-mp;lo+=lp*lp;mid+=mp*mp;hi+=h*h;n++}
  const rms=Math.sqrt(sum/Math.max(1,n)),total=Math.max(1e-12,lo+mid+hi);
  return {rmsDb:20*Math.log10(Math.max(1e-8,rms)),peakDb:20*Math.log10(Math.max(1e-8,peak)),low:Math.round(lo/total*100),mid:Math.round(mid/total*100),high:Math.round(hi/total*100)};
 }
 let analyzed=[];
 function renderRows(){
  const host=$("stemAssistantList"),applyAll=$("applyAllStemRoles");if(!host)return;
  host.innerHTML="";
  analyzed.forEach((item,i)=>{
   const row=document.createElement("article");row.className="stem-row";
   const title=document.createElement("div");title.className="stem-row-title";
   const strong=document.createElement("strong");strong.textContent=item.track.name;
   const small=document.createElement("small");small.textContent="RMS "+item.stats.rmsDb.toFixed(1)+" dBFS · PEAK "+item.stats.peakDb.toFixed(1)+" dBFS · LOW/MID/HIGH "+item.stats.low+"/"+item.stats.mid+"/"+item.stats.high+"%";
   title.append(strong,small);
   const select=document.createElement("select");select.setAttribute("aria-label","Track role for "+item.track.name);
   roles.forEach(([key,r])=>{const op=document.createElement("option");op.value=key;op.textContent=r.label;select.appendChild(op)});
   select.value=item.role;select.addEventListener("change",()=>{item.role=select.value;item.detected=false;row.classList.toggle("unclassified",item.role==="unknown")});
   const apply=document.createElement("button");apply.type="button";apply.textContent="APPLY";apply.disabled=!roleData[item.role].settings;
   select.addEventListener("change",()=>{apply.disabled=!roleData[item.role].settings});
   apply.addEventListener("click",()=>applyRole(item));
   row.append(title,select,apply);if(item.role==="unknown")row.classList.add("unclassified");host.appendChild(row);
  });
  if(applyAll)applyAll.disabled=!analyzed.some(x=>roleData[x.role].settings);
 }
 function applyRole(item){
  const p=roleData[item.role];if(!p||!p.settings)return false;
  Object.assign(item.track.settings,p.settings);
  return true;
 }
 function analyze(){
  const tracks=api.getTracks();if(!tracks.length){$("stemAssistantSummary").textContent="IMPORT YOUR STEM FILES FIRST.";return}
  analyzed=tracks.map(track=>({track,role:detect(track.name),detected:true,stats:measure(track.buffer)}));
  renderRows();
  const found=analyzed.filter(x=>x.role!=="unknown").length;
  $("stemAssistantSummary").textContent=analyzed.length+" TRACK(S) ANALYZED · "+found+" ROLE(S) IDENTIFIED FROM FILE NAMES · "+(analyzed.length-found)+" NEED MANUAL ROLE SELECTION. Check every role before applying.";
  $("applyAllStemRoles").disabled=!found;
  api.status("STEM ANALYSIS COMPLETE · REVIEW TRACK ROLES BEFORE APPLYING");
 }
 $("analyzeStems")?.addEventListener("click",analyze);
 $("applyAllStemRoles")?.addEventListener("click",()=>{
  if(!analyzed.length)return;
  if(api.isPlaying())api.stop();
  let count=0;analyzed.forEach(item=>{if(applyRole(item))count++});
  api.render();renderRows();
  $("stemAssistantSummary").textContent=count+" CHANNEL(S) UPDATED WITH ROLE-BASED STARTING SETTINGS. Listen, adjust each channel and compare before export.";
  api.status("STEM-AWARE CHANNEL SETTINGS APPLIED · "+count+" TRACKS");
 });
})();
