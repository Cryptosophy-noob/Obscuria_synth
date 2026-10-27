
export interface MixerChannel {
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

export class Mixer {
  private context: AudioContext;
  private master: GainNode;
  private masterAnalyser: AnalyserNode;
  private channels: MixerChannel[] = [
    { name: "SYNTH", volume: 0.8, pan: 0, muted: false, solo: false },
    { name: "BASS", volume: 0.8, pan: 0, muted: false, solo: false },
    { name: "DRUMS", volume: 0.8, pan: 0, muted: false, solo: false },
    { name: "MOD", volume: 1, pan: 0, muted: false, solo: false },
  ];
  private inputs: GainNode[] = [];
  private panners: StereoPannerNode[] = [];

  constructor(context: AudioContext, destination?: AudioNode) {
    this.context = context;
    this.master = context.createGain();
    this.masterAnalyser = context.createAnalyser();
    this.masterAnalyser.fftSize = 2048;

    this.master.connect(this.masterAnalyser);
    this.masterAnalyser.connect(destination ?? context.destination);

    for (const channel of this.channels) {
      const input = context.createGain();
      const panner = context.createStereoPanner();
      input.gain.value = channel.volume;
      panner.pan.value = channel.pan;
      input.connect(panner);
      panner.connect(this.master);
      this.inputs.push(input);
      this.panners.push(panner);
    }
  }

  getChannelInput(index: number): GainNode | null {
    return this.inputs[index] ?? null;
  }

  getMasterOutput(): GainNode {
    return this.master;
  }

  getAnalyser(): AnalyserNode {
    return this.masterAnalyser;
  }

  getChannels(): MixerChannel[] {
    return this.channels.map((channel) => ({ ...channel }));
  }

  setChannel(index: number, patch: Partial<MixerChannel>): void {
    const channel = this.channels[index];
    const input = this.inputs[index];
    const panner = this.panners[index];
    if (!channel || !input || !panner) return;

    this.channels[index] = { ...channel, ...patch };
    this.applyChannels();
  }

  setMasterVolume(volume: number): void {
    this.master.gain.setTargetAtTime(
      Math.max(0, Math.min(1, volume)),
      this.context.currentTime,
      0.015,
    );
  }

  getMasterVolume(): number {
    return this.master.gain.value;
  }

  private applyChannels(): void {
    const hasSolo = this.channels.some((channel) => channel.solo);

    this.channels.forEach((channel, index) => {
      const audible = !channel.muted && (!hasSolo || channel.solo);
      this.inputs[index].gain.setTargetAtTime(
        audible ? channel.volume : 0,
        this.context.currentTime,
        0.015,
      );
      this.panners[index].pan.setTargetAtTime(
        channel.pan,
        this.context.currentTime,
        0.015,
      );
    });
  }

  dispose(): void {
    for (const input of this.inputs) input.disconnect();
    for (const panner of this.panners) panner.disconnect();
    this.master.disconnect();
    this.masterAnalyser.disconnect();
  }
}
