
export type DrumVoice = "kick" | "snare" | "hat";

export interface DrumParams {
  volume: number;
  kickPitch: number;
  kickDecay: number;
  kickDrive: number;
  snareTone: number;
  snareDecay: number;
  hatDecay: number;
  hatTone: number;
}

export const DEFAULT_DRUM_PARAMS: DrumParams = {
  volume: 0.7,
  kickPitch: 55,
  kickDecay: 0.35,
  kickDrive: 1.5,
  snareTone: 1800,
  snareDecay: 0.18,
  hatDecay: 0.07,
  hatTone: 8000,
};

export class DrumMachine {
  private context: AudioContext;
  private output: GainNode;
  private params = { ...DEFAULT_DRUM_PARAMS };

  constructor(context: AudioContext, destination?: AudioNode) {
    this.context = context;
    this.output = context.createGain();
    this.output.gain.value = this.params.volume;
    this.output.connect(destination ?? context.destination);
  }

  getOutput(): GainNode {
    return this.output;
  }

  getParams(): DrumParams {
    return { ...this.params };
  }

  setParams(next: Partial<DrumParams>): void {
    this.params = { ...this.params, ...next };
    this.output.gain.setTargetAtTime(
      this.params.volume, this.context.currentTime, 0.015,
    );
  }

  trigger(
    voice: DrumVoice,
    time = this.context.currentTime,
    velocity = 1,
  ): void {
    if (voice === "kick") this.kick(time, velocity);
    else if (voice === "snare") this.snare(time, velocity);
    else this.hat(time, velocity);
  }

  private kick(time: number, velocity: number): void {
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const shaper = ctx.createWaveShaper();

    const curve = new Float32Array(256);
    const drive = Math.max(0.1, this.params.kickDrive);
    for (let i = 0; i < curve.length; i++) {
      const x = (i * 2) / (curve.length - 1) - 1;
      curve[i] = Math.tanh(x * drive);
    }
    shaper.curve = curve;

    osc.type = "sine";
    osc.frequency.setValueAtTime(this.params.kickPitch * 3, time);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(25, this.params.kickPitch), time + 0.045,
    );
    gain.gain.setValueAtTime(Math.max(0.001, velocity), time);
    gain.gain.exponentialRampToValueAtTime(
      0.001, time + Math.max(0.04, this.params.kickDecay),
    );

    osc.connect(shaper);
    shaper.connect(gain);
    gain.connect(this.output);
    osc.start(time);
    osc.stop(time + this.params.kickDecay + 0.08);
    osc.onended = () => {
      osc.disconnect();
      shaper.disconnect();
      gain.disconnect();
    };
  }

  private snare(time: number, velocity: number): void {
    const ctx = this.context;
    const noise = this.createNoise(time, this.params.snareDecay, velocity * 0.75);
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = this.params.snareTone;
    noise.source.connect(filter);
    filter.connect(this.output);

    const osc = ctx.createOscillator();
    const toneGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 185;
    toneGain.gain.setValueAtTime(velocity * 0.45, time);
    toneGain.gain.exponentialRampToValueAtTime(
      0.001, time + this.params.snareDecay,
    );
    osc.connect(toneGain);
    toneGain.connect(this.output);
    osc.start(time);
    osc.stop(time + this.params.snareDecay + 0.03);
    osc.onended = () => {
      osc.disconnect();
      toneGain.disconnect();
      filter.disconnect();
    };
  }

  private hat(time: number, velocity: number): void {
    const ctx = this.context;
    const noise = this.createNoise(time, this.params.hatDecay, velocity);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = "highpass";
    filter.frequency.value = this.params.hatTone;
    gain.gain.setValueAtTime(velocity * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(
      0.001, time + Math.max(0.015, this.params.hatDecay),
    );

    noise.source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    noise.source.onended = () => {
      noise.source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  private createNoise(
    time: number,
    duration: number,
    volume: number,
  ): { source: AudioBufferSourceNode } {
    const ctx = this.context;
    const length = Math.max(1, Math.ceil(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(gain);
    gain.connect(this.output);
    source.start(time);
    source.stop(time + duration + 0.02);

    source.onended = () => {
      try { gain.disconnect(); } catch { /* già disconnesso */ }
    };

    return { source };
  }

  dispose(): void {
    this.output.disconnect();
  }
}
