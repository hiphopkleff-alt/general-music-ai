"use strict";
class GTLookAheadLimiter extends AudioWorkletProcessor {
 constructor(options){
  super();
  const ms=options.processorOptions&&options.processorOptions.lookaheadMs||5;
  this.lookahead=Math.max(1,Math.round(sampleRate*ms/1000));
  this.size=this.lookahead+2;
  this.left=new Float32Array(this.size);this.right=new Float32Array(this.size);
  this.write=0;this.gain=1;this.frames=0;this.maxReduction=0;
 }
 static get parameterDescriptors(){return[
  {name:"threshold",defaultValue:-1,minValue:-12,maxValue:0,automationRate:"k-rate"},
  {name:"release",defaultValue:80,minValue:20,maxValue:500,automationRate:"k-rate"},
  {name:"inputGain",defaultValue:0,minValue:-12,maxValue:12,automationRate:"k-rate"}
 ]}
 process(inputs,outputs,parameters){
  const input=inputs[0],output=outputs[0];if(!output||!output.length)return true;
  const outL=output[0],outR=output[1]||output[0],inL=input&&input[0],inR=input&&input[1]||inL;
  const threshold=Math.pow(10,(parameters.threshold[0]||-1)/20),inputGain=Math.pow(10,(parameters.inputGain[0]||0)/20);
  const release=Math.max(.02,(parameters.release[0]||80)/1000),smooth=Math.exp(-1/(release*sampleRate));
  for(let i=0;i<outL.length;i++){
   const l=(inL?inL[i]:0)*inputGain,r=(inR?inR[i]:0)*inputGain;
   this.left[this.write]=l;this.right[this.write]=r;
   let peak=0;
   for(let k=0;k<=this.lookahead;k++){const ix=(this.write-k+this.size)%this.size;peak=Math.max(peak,Math.abs(this.left[ix]),Math.abs(this.right[ix]))}
   const target=peak>threshold?threshold/peak:1;
   this.gain=target<this.gain?target:target+(this.gain-target)*smooth;
   const read=(this.write-this.lookahead+this.size)%this.size;
   outL[i]=this.left[read]*this.gain;
   if(output.length>1)outR[i]=this.right[read]*this.gain;
   this.maxReduction=Math.max(this.maxReduction,-20*Math.log10(Math.max(this.gain,1e-9)));
   this.write=(this.write+1)%this.size;
   if(++this.frames>=2048){this.port.postMessage({reduction:this.maxReduction});this.maxReduction=0;this.frames=0}
  }
  return true;
 }
}
registerProcessor("gt-lookahead-limiter",GTLookAheadLimiter);
