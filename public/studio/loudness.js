"use strict";
(() => {
  const db = v => v > 0 ? 20 * Math.log10(v) : -Infinity;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

  function truePeakDb(buffer) {
    let peak = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const d = buffer.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const a = d[i], b = d[Math.min(i + 1, d.length - 1)];
        peak = Math.max(peak, Math.abs(a));
        // Cubic interpolation estimates inter-sample peaks without allocating a 4x buffer.
        const p0 = d[Math.max(0, i - 1)], p1 = a, p2 = b, p3 = d[Math.min(i + 2, d.length - 1)];
        for (let k = 1; k < 4; k++) {
          const t = k / 4, t2 = t * t, t3 = t2 * t;
          const y = .5 * ((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
          peak = Math.max(peak, Math.abs(y));
        }
      }
    }
    return db(peak);
  }

  async function integratedLufs(buffer) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) throw new Error("Offline audio processing is not supported by this browser.");
    const off = new Offline(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const src = off.createBufferSource();
    const hp = off.createBiquadFilter(), shelf = off.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 38.135; hp.Q.value = .5003;
    shelf.type = "highshelf"; shelf.frequency.value = 1681.97; shelf.gain.value = 4;
    src.buffer = buffer; src.connect(hp); hp.connect(shelf); shelf.connect(off.destination); src.start(0);
    const weighted = await off.startRendering();
    const rate = buffer.sampleRate, block = Math.max(1, Math.round(rate * .4)), hop = Math.max(1, Math.round(rate * .1));
    const energies = [];
    for (let start = 0; start < weighted.length; start += hop) {
      const end = Math.min(weighted.length, start + block);
      if (end - start < Math.min(block, Math.round(rate * .1))) break;
      let energy = 0;
      for (let ch = 0; ch < weighted.numberOfChannels; ch++) {
        const d = weighted.getChannelData(ch); let sum = 0;
        for (let i = start; i < end; i++) sum += d[i] * d[i];
        energy += sum / (end - start);
      }
      energies.push(energy);
      if (end === weighted.length) break;
    }
    if (!energies.length) return -Infinity;
    const lufs = e => e > 0 ? -.691 + 10 * Math.log10(e) : -Infinity;
    const absolute = energies.filter(e => lufs(e) >= -70);
    if (!absolute.length) return -Infinity;
    const ungated = absolute.reduce((a,b)=>a+b,0) / absolute.length;
    const relativeGate = lufs(ungated) - 10;
    const gated = absolute.filter(e => lufs(e) >= relativeGate);
    if (!gated.length) return lufs(ungated);
    return lufs(gated.reduce((a,b)=>a+b,0) / gated.length);
  }

  async function normalize(buffer, targetLufs, ceilingDb) {
    const beforeLufs = await integratedLufs(buffer);
    const beforePeak = truePeakDb(buffer);
    if (!Number.isFinite(beforeLufs) || !Number.isFinite(beforePeak)) throw new Error("The mix is silent or could not be measured.");
    const wanted = targetLufs - beforeLufs;
    const peakHeadroom = ceilingDb - beforePeak;
    const applied = Math.min(wanted, peakHeadroom);
    const gain = Math.pow(10, applied / 20);
    const channels = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const copy = new Float32Array(buffer.getChannelData(ch));
      for (let i = 0; i < copy.length; i++) copy[i] *= gain;
      channels.push(copy);
    }
    const out = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: buffer.sampleRate });
    const normalized = out.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    channels.forEach((data, ch) => normalized.copyToChannel(data, ch));
    await out.close();
    const afterLufs = beforeLufs + applied;
    const afterPeak = beforePeak + applied;
    return { buffer: normalized, beforeLufs, afterLufs, beforePeak, afterPeak, gainDb: applied, targetLufs, ceilingDb, peakLimited: applied < wanted - .05 };
  }

  window.GTLOUDNESS = { integratedLufs, truePeakDb, normalize, report(result) {
    set("loudBefore", result.beforeLufs.toFixed(1) + " LUFS");
    set("loudAfter", result.afterLufs.toFixed(1) + " LUFS");
    set("peakBefore", result.beforePeak.toFixed(1) + " dBTP*");
    set("peakAfter", result.afterPeak.toFixed(1) + " dBTP*");
    set("loudGain", (result.gainDb >= 0 ? "+" : "") + result.gainDb.toFixed(1) + " dB");
    set("loudnessStatus", result.peakLimited ? "TARGET LIMITED BY PEAK CEILING" : "TARGET REACHED");
  }};
})();