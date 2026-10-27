export type Waveform = "sawtooth" | "square" | "triangle" | "sine";

export interface SynthParams {
  waveform: Waveform;
  octave: number;
  detune: number;
  subLevel: number;
  cutoff: number;
  resonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  volume: number;
  lfoRate: number;
  lfoDepth: number;
  lfoTarget: "filter" | "pitch";
  pulseWidth: number;
}

export const DEFAULT_SYNTH_PARAMS: SynthParams = {
  waveform: "sawtooth",
  octave: 0,
  detune: 0,
  subLevel: 0.2,
  cutoff: 1800,
  resonance: 2,
  attack: 0.015,
  decay: 0.18,
  sustain: 0.65,
  release: 0.25,
  volume: 0.65,
  lfoRate: 3,
  lfoDepth: 0,
  lfoTarget: "filter",
  pulseWidth: 0.5,
};

export class ObscuriaSynth {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  private voices = new Map<
    number,
    {
      oscillators: OscillatorNode[];
      envelope: GainNode;
      filter: BiquadFilterNode;
      pitchMod: GainNode;
      lfoConnection: AudioNode | null;
    }
  >();

  private params = { ...DEFAULT_SYNTH_PARAMS };
  private active = false;

  private captureProcessor: ScriptProcessorNode | null = null;
  private captureLeft: Float32Array[] = [];
  private captureRight: Float32Array[] = [];

  async start(): Promise<void> {
    if (this.context) {
      if (this.context.state === "suspended") {
        await this.context.resume();
      }
      return;
    }

    const ctx = new AudioContext();
    const output = ctx.createGain();
    const analyser = ctx.createAnalyser();

    output.gain.value = this.params.volume;
    analyser.fftSize = 2048;

    output.connect(analyser);
    analyser.connect(ctx.destination);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    lfo.type = "sine";
    lfo.frequency.value = this.params.lfoRate;
    lfoGain.gain.value = this.params.lfoDepth;

    lfo.connect(lfoGain);
    lfo.start();

    this.context = ctx;
    this.output = output;
    this.analyser = analyser;
    this.lfo = lfo;
    this.lfoGain = lfoGain;
    this.active = true;

    await ctx.resume();
  }

  isStarted(): boolean {
    return this.active && this.context !== null;
  }

  getAudioContext(): AudioContext | null {
    return this.context;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getOutput(): GainNode | null {
    return this.output;
  }

  /**
   * Cattura il bus master in tempo reale.
   * L'audio originale continua a raggiungere gli altoparlanti;
   * il nodo di cattura emette silenzio.
   */
  startWavCapture(): void {
    const ctx = this.context;
    const analyser = this.analyser;

    if (!ctx || !analyser) {
      throw new Error("Avvia prima il motore audio.");
    }

    if (this.captureProcessor) {
      throw new Error("Una cattura WAV è già attiva.");
    }

    this.captureLeft = [];
    this.captureRight = [];

    const processor = ctx.createScriptProcessor(4096, 2, 2);

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      const input = event.inputBuffer;
      const left = input.getChannelData(0);
      const right =
        input.numberOfChannels > 1
          ? input.getChannelData(1)
          : left;

      this.captureLeft.push(new Float32Array(left));
      this.captureRight.push(new Float32Array(right));

      for (
        let channel = 0;
        channel < event.outputBuffer.numberOfChannels;
        channel++
      ) {
        event.outputBuffer.getChannelData(channel).fill(0);
      }
    };

    analyser.connect(processor);
    processor.connect(ctx.destination);

    this.captureProcessor = processor;
  }

  stopWavCapture(): {
    left: Float32Array;
    right: Float32Array;
    sampleRate: number;
  } {
    const ctx = this.context;

    if (!ctx || !this.captureProcessor) {
      throw new Error("Non è attiva alcuna cattura WAV.");
    }

    this.captureProcessor.onaudioprocess = null;

    try {
      this.analyser?.disconnect(this.captureProcessor);
    } catch {
      // Il nodo è già scollegato.
    }

    this.captureProcessor.disconnect();
    this.captureProcessor = null;

    const length = this.captureLeft.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );

    const left = new Float32Array(length);
    const right = new Float32Array(length);

    let offset = 0;

    for (let i = 0; i < this.captureLeft.length; i++) {
      left.set(this.captureLeft[i], offset);
      right.set(this.captureRight[i], offset);
      offset += this.captureLeft[i].length;
    }

    this.captureLeft = [];
    this.captureRight = [];

    return {
      left,
      right,
      sampleRate: ctx.sampleRate,
    };
  }

  cancelWavCapture(): void {
    if (this.captureProcessor) {
      this.captureProcessor.onaudioprocess = null;

      try {
        this.analyser?.disconnect(this.captureProcessor);
      } catch {
        // Il nodo è già scollegato.
      }

      this.captureProcessor.disconnect();
      this.captureProcessor = null;
    }

    this.captureLeft = [];
    this.captureRight = [];
  }

  getParams(): SynthParams {
    return { ...this.params };
  }

  setParams(next: Partial<SynthParams>): void {
    this.params = { ...this.params, ...next };

    const ctx = this.context;

    if (!ctx) return;

    const now = ctx.currentTime;

    if (this.output) {
      this.output.gain.setTargetAtTime(
        this.params.volume,
        now,
        0.015,
      );
    }

    if (this.lfo) {
      this.lfo.frequency.setTargetAtTime(
        this.params.lfoRate,
        now,
        0.015,
      );
    }

    if (this.lfoGain) {
      this.lfoGain.gain.setTargetAtTime(
        this.params.lfoDepth,
        now,
        0.015,
      );
    }

    for (const voice of this.voices.values()) {
      voice.filter.frequency.setTargetAtTime(
        Math.max(20, Math.min(20000, this.params.cutoff)),
        now,
        0.015,
      );

      voice.filter.Q.setTargetAtTime(
        this.params.resonance,
        now,
        0.015,
      );

      for (let i = 0; i < voice.oscillators.length; i++) {
        const osc = voice.oscillators[i];

        if (i < 2) {
          osc.type = this.params.waveform;

          osc.detune.setTargetAtTime(
            this.params.detune + (i === 0 ? -4 : 4),
            now,
            0.015,
          );
        }
      }
    }
  }

  noteOn(midiNote: number, velocity = 0.85): void {
    const ctx = this.context;

    if (!ctx || !this.output || !this.active) return;

    this.noteOff(midiNote);

    const now = ctx.currentTime;
    const frequency =
      440 *
      Math.pow(
        2,
        (midiNote - 69 + this.params.octave * 12) / 12,
      );

    const filter = ctx.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = Math.max(
      20,
      Math.min(20000, this.params.cutoff),
    );
    filter.Q.value = this.params.resonance;

    const envelope = ctx.createGain();

    envelope.gain.setValueAtTime(0.0001, now);

    envelope.gain.linearRampToValueAtTime(
      Math.max(0.0001, velocity),
      now + Math.max(0.001, this.params.attack),
    );

    envelope.gain.linearRampToValueAtTime(
      Math.max(0.0001, velocity * this.params.sustain),
      now +
        Math.max(0.001, this.params.attack) +
        Math.max(0.001, this.params.decay),
    );

    const oscillators: OscillatorNode[] = [];
    const main1 = ctx.createOscillator();
    const main2 = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    const pitchMod = ctx.createGain();

    main1.type = this.params.waveform;
    main2.type = this.params.waveform;

    main1.frequency.value = frequency;
    main2.frequency.value = frequency;

    main1.detune.value = this.params.detune - 4;
    main2.detune.value = this.params.detune + 4;

    sub.type = "square";
    sub.frequency.value = frequency / 2;
    subGain.gain.value = this.params.subLevel;
    pitchMod.gain.value = 0;

    main1.connect(filter);
    main2.connect(filter);

    sub.connect(subGain);
    subGain.connect(filter);

    filter.connect(envelope);
    envelope.connect(this.output);

    const lfoConnection: AudioNode | null = this.lfoGain;

    if (this.lfoGain) {
      if (this.params.lfoTarget === "filter") {
        this.lfoGain.connect(filter.frequency);
      } else {
        this.lfoGain.connect(pitchMod);
        pitchMod.connect(main1.detune);
        pitchMod.connect(main2.detune);
      }
    }

    for (const osc of [main1, main2, sub]) {
      osc.start(now);
      oscillators.push(osc);
    }

    this.voices.set(midiNote, {
      oscillators,
      envelope,
      filter,
      pitchMod,
      lfoConnection,
    });
  }

  noteOff(midiNote: number): void {
    const ctx = this.context;
    const voice = this.voices.get(midiNote);

    if (!ctx || !voice) return;

    this.voices.delete(midiNote);

    const now = ctx.currentTime;
    const release = Math.max(0.01, this.params.release);

    voice.envelope.gain.cancelScheduledValues(now);

    voice.envelope.gain.setTargetAtTime(
      0.0001,
      now,
      release / 4,
    );

    const stopAt = now + release + 0.05;

    for (const osc of voice.oscillators) {
      osc.stop(stopAt);
    }

    window.setTimeout(() => {
      for (const osc of voice.oscillators) {
        try {
          osc.disconnect();
        } catch {
          // Già disconnesso.
        }
      }

      try {
        voice.filter.disconnect();
      } catch {
        // Già disconnesso.
      }

      try {
        voice.envelope.disconnect();
      } catch {
        // Già disconnesso.
      }

      try {
        voice.pitchMod.disconnect();
      } catch {
        // Già disconnesso.
      }
    }, (release + 0.1) * 1000);
  }

  allNotesOff(): void {
    for (const note of [...this.voices.keys()]) {
      this.noteOff(note);
    }
  }

  async stop(): Promise<void> {
    this.cancelWavCapture();
    this.allNotesOff();

    const ctx = this.context;
    this.active = false;

    try {
      this.lfo?.stop();
    } catch {
      // Già fermo.
    }

    this.lfo?.disconnect();
    this.lfoGain?.disconnect();
    this.output?.disconnect();
    this.analyser?.disconnect();

    this.lfo = null;
    this.lfoGain = null;
    this.output = null;
    this.analyser = null;
    this.context = null;

    if (ctx && ctx.state !== "closed") {
      await ctx.close();
    }
  }
}