"use strict";
class GTStereoImager extends AudioWorkletProcessor{
 static get parameterDescriptors(){return[{name:"width",defaultValue:1,minValue:0,maxValue:2,automationRate:"k-rate"},{name:"balance",defaultValue:0,minValue:-1,maxValue:1,automationRate:"k-rate"}]}
 constructor(){super();this.blocks=0}
 process(inputs,outputs,parameters){
  const input=inputs[0],output=outputs[0];if(!output||!output.length)return true;
  const leftIn=input&&input[0],rightIn=input&&input[1]||leftIn,left=output[0],right=output[1]||output[0],width=parameters.width[0],balance=parameters.balance[0];
  let ll=0,rr=0,lr=0,mono=0,stereo=0;
  for(let i=0;i<left.length;i++){
   const l=leftIn?leftIn[i]||0:0,r=rightIn?rightIn[i]||0:l;
   const mid=(l+r)*.5,side=(l-r)*.5*width;
   let outL=mid+side,outR=mid-side;
   if(balance<0)outR*=1+balance;else if(balance>0)outL*=1-balance;
   left[i]=outL;if(right!==left)right[i]=outR;
   ll+=outL*outL;rr+=outR*outR;lr+=outL*outR;mono+=(outL+outR)*.5*((outL+outR)*.5);stereo+=(outL*outL+outR*outR)*.5;
  }
  if(++this.blocks%12===0){const corr=ll&&rr?Math.max(-1,Math.min(1,lr/Math.sqrt(ll*rr))):0;const monoDb=stereo>1e-12?10*Math.log10(Math.max(1e-12,mono/Math.max(1,stereo))): -120;this.port.postMessage({correlation:corr,monoDb})}
  return true;
 }
}
registerProcessor("gt-stereo-imager",GTStereoImager);
