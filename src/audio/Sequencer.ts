import type { ObscuriaSynth } from "./ObscuriaSynth";
import type { DrumMachine, DrumVoice } from "./DrumMachine";
import { FACTORY_PRESETS } from "../patches/presets";

export type TrackType = "synth" | "bass" | "drums" | "modulation";

export interface SequencerStep {
  note: number;
  velocity: number;
  gate: number;
  active: boolean;
  drum?: DrumVoice;
  cutoff?: number;
  patchId?: string;
}

export interface SequencerTrack {
  name: string;
  type: TrackType;
  steps: SequencerStep[];
  muted: boolean;
  volume: number;
}

export interface RecordedNote {
  note: number;
  start: number;
  duration: number;
  velocity: number;
}

interface OpenNote {
  start: number;
  velocity: number;
}

export function createEmptyStep(): SequencerStep {
  return {
    note: 60,
    velocity: 0.8,
    gate: 0.8,
    active: false,
  };
}

export function createDefaultTracks(): SequencerTrack[] {
  return [
    {
      name: "SYNTH",
      type: "synth",
      steps: Array.from({ length: 16 }, createEmptyStep),
      muted: false,
      volume: 1,
    },
    {
      name: "BASS",
      type: "bass",
      steps: Array.from({ length: 16 }, (_, i) => ({
        ...createEmptyStep(),
        note: [36, 36, 43, 36, 31, 36, 43, 34][i % 8],
        active: i % 4 === 0,
      })),
      muted: false,
      volume: 0.8,
    },
    {
      name: "DRUMS",
      type: "drums",
      steps: Array.from({ length: 16 }, (_, i) => ({
        ...createEmptyStep(),
        drum:
          i % 4 === 0
            ? ("kick" as const)
            : i % 4 === 2
              ? ("snare" as const)
              : ("hat" as const),
        active: i % 2 === 0 || i % 4 === 3,
      })),
      muted: false,
      volume: 0.8,
    },
    {
      name: "MOD",
      type: "modulation",
      steps: Array.from({ length: 16 }, (_, i) => ({
        ...createEmptyStep(),
        cutoff: 400 + ((i * 733) % 5000),
        active: true,
      })),
      muted: false,
      volume: 1,
    },
  ];
}

export class Sequencer {
  private synth: ObscuriaSynth;
  private drums: DrumMachine;
  private tracks = createDefaultTracks();

  private bpm = 120;
  private swing = 0;
  private timer: number | null = null;
  private step = 0;
  private running = false;

  private lookahead = 0.12;
  private scheduleInterval = 25;
  private nextStepTime = 0;

  private loopStart = 0;
  private loopEnd = 16;

  private onStep?: (step: number) => void;

  private recording = false;
  private recordStartTime = 0;
  private openNotes = new Map<number, OpenNote>();
  private recordedNotes: RecordedNote[] = [];

  private playbackStartTime = 0;
  private playbackCursor = 0;
  private scheduledTimeouts = new Set<number>();

  constructor(
    synth: ObscuriaSynth,
    drums: DrumMachine,
    onStep?: (step: number) => void,
  ) {
    this.synth = synth;
    this.drums = drums;
    this.onStep = onStep;
  }

  getTracks(): SequencerTrack[] {
    return this.tracks.map((track) => ({
      ...track,
      steps: track.steps.map((step) => ({ ...step })),
    }));
  }

  setTracks(tracks: SequencerTrack[]): void {
    this.tracks = tracks.map((track) => ({
      ...track,
      steps: track.steps.map((step) => ({ ...step })),
    }));
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(30, Math.min(300, bpm));
  }

  getBpm(): number {
    return this.bpm;
  }

  setSwing(value: number): void {
    this.swing = Math.max(0, Math.min(0.75, value));
  }

  getSwing(): number {
    return this.swing;
  }

  setLoop(start: number, end: number): void {
    this.loopStart = Math.max(0, Math.min(15, Math.floor(start)));
    this.loopEnd = Math.max(
      this.loopStart + 1,
      Math.min(16, Math.floor(end)),
    );
  }

  setStep(
    trackIndex: number,
    stepIndex: number,
    patch: Partial<SequencerStep>,
  ): void {
    const track = this.tracks[trackIndex];

    if (!track || !track.steps[stepIndex]) return;

    track.steps[stepIndex] = {
      ...track.steps[stepIndex],
      ...patch,
    };
  }

  setTrackMuted(trackIndex: number, muted: boolean): void {
    if (this.tracks[trackIndex]) {
      this.tracks[trackIndex].muted = muted;
    }
  }

  setTrackVolume(trackIndex: number, volume: number): void {
    if (this.tracks[trackIndex]) {
      this.tracks[trackIndex].volume = Math.max(
        0,
        Math.min(1, volume),
      );
    }
  }

  getCurrentStep(): number {
    return this.step;
  }

  isRunning(): boolean {
    return this.running;
  }

  isRecording(): boolean {
    return this.recording;
  }

  getRecordedNotes(): RecordedNote[] {
    return this.recordedNotes.map((note) => ({ ...note }));
  }

  setRecordedNotes(notes: RecordedNote[]): void {
    if (this.recording) {
      this.stopRecording();
    }

    this.recordedNotes = notes
      .filter(
        (note) =>
          Number.isInteger(note.note) &&
          note.note >= 0 &&
          note.note <= 127 &&
          Number.isFinite(note.start) &&
          note.start >= 0 &&
          Number.isFinite(note.duration) &&
          note.duration > 0 &&
          Number.isFinite(note.velocity),
      )
      .map((note) => ({
        note: Math.round(note.note),
        start: Math.max(0, note.start),
        duration: Math.max(0.05, note.duration),
        velocity: Math.max(0, Math.min(1, note.velocity)),
      }))
      .sort((a, b) => a.start - b.start);

    this.playbackCursor = 0;
  }

  getRecordingDuration(): number {
    const context = this.synth.getAudioContext();

    if (this.recording && context) {
      return Math.max(
        0,
        context.currentTime - this.recordStartTime,
      );
    }

    return this.recordedNotes.reduce(
      (end, note) => Math.max(end, note.start + note.duration),
      0,
    );
  }

  startRecording(): void {
    const context = this.synth.getAudioContext();

    if (!context) {
      throw new Error("Avvia prima il motore audio.");
    }

    if (this.recording) return;

    this.recordedNotes = [];
    this.openNotes.clear();
    this.recordStartTime = context.currentTime;
    this.recording = true;

    if (!this.running) {
      try {
        this.play();
      } catch (error) {
        this.recording = false;
        throw error;
      }
    }
  }

  stopRecording(): void {
    if (!this.recording) return;

    const context = this.synth.getAudioContext();
    const now = context?.currentTime ?? this.recordStartTime;

    for (const [note, openNote] of this.openNotes) {
      this.recordedNotes.push({
        note,
        start: Math.max(
          0,
          openNote.start - this.recordStartTime,
        ),
        duration: Math.max(0.05, now - openNote.start),
        velocity: openNote.velocity,
      });
    }

    this.openNotes.clear();
    this.recording = false;

    this.recordedNotes.sort((a, b) => a.start - b.start);
    this.playbackCursor = this.recordedNotes.length;
  }

  recordNoteOn(note: number, velocity = 0.85): void {
    if (!this.recording) return;

    const context = this.synth.getAudioContext();

    if (!context) return;

    const midiNote = Math.round(note);

    if (midiNote < 0 || midiNote > 127) return;

    if (this.openNotes.has(midiNote)) {
      this.recordNoteOff(midiNote);
    }

    this.openNotes.set(midiNote, {
      start: context.currentTime,
      velocity: Math.max(0, Math.min(1, velocity)),
    });
  }

  recordNoteOff(note: number): void {
    if (!this.recording) return;

    const context = this.synth.getAudioContext();
    const midiNote = Math.round(note);
    const openNote = this.openNotes.get(midiNote);

    if (!context || !openNote) return;

    this.recordedNotes.push({
      note: midiNote,
      start: Math.max(
        0,
        openNote.start - this.recordStartTime,
      ),
      duration: Math.max(
        0.05,
        context.currentTime - openNote.start,
      ),
      velocity: openNote.velocity,
    });

    this.openNotes.delete(midiNote);
    this.recordedNotes.sort((a, b) => a.start - b.start);
  }

  clearRecording(): void {
    if (this.recording) {
      this.stopRecording();
    }

    this.recordedNotes = [];
    this.openNotes.clear();
    this.playbackCursor = 0;
  }

  play(): void {
    if (this.running) return;

    const context = this.synth.getAudioContext();

    if (!context) {
      throw new Error("Avvia prima il motore audio.");
    }

    this.running = true;
    this.nextStepTime = context.currentTime + 0.05;
    this.playbackStartTime = this.nextStepTime;
    this.playbackCursor = 0;

    this.timer = window.setInterval(
      () => this.schedule(),
      this.scheduleInterval,
    );
  }

  private schedule(): void {
    const context = this.synth.getAudioContext();

    if (!context || !this.running) return;

    while (
      this.nextStepTime <
      context.currentTime + this.lookahead
    ) {
      this.scheduleStep(this.step, this.nextStepTime);

      const secondsPerBeat = 60 / this.bpm;

      const swingOffset =
        this.step % 2 === 1
          ? secondsPerBeat * 0.5 * this.swing
          : 0;

      this.nextStepTime +=
        secondsPerBeat / 4 + swingOffset;

      this.step++;

      if (this.step >= this.loopEnd) {
        this.step = this.loopStart;
      }
    }

    if (!this.recording) {
      this.scheduleRecordedNotes(context);
    }
  }

  private scheduleRecordedNotes(context: AudioContext): void {
    const elapsed =
      context.currentTime - this.playbackStartTime;

    const horizon = elapsed + this.lookahead;

    while (this.playbackCursor < this.recordedNotes.length) {
      const event = this.recordedNotes[this.playbackCursor];

      if (event.start > horizon) break;

      this.playbackCursor++;

      const eventTime = this.playbackStartTime + event.start;

      const delay = Math.max(
        0,
        (eventTime - context.currentTime) * 1000,
      );

      const noteOnTimer = window.setTimeout(() => {
        this.scheduledTimeouts.delete(noteOnTimer);

        if (!this.running || this.recording) return;

        this.synth.noteOn(event.note, event.velocity);

        const noteOffDelay = Math.max(
          50,
          event.duration * 1000,
        );

        const noteOffTimer = window.setTimeout(() => {
          this.scheduledTimeouts.delete(noteOffTimer);

          if (this.running && !this.recording) {
            this.synth.noteOff(event.note);
          }
        }, noteOffDelay);

        this.scheduledTimeouts.add(noteOffTimer);
      }, delay);

      this.scheduledTimeouts.add(noteOnTimer);
    }
  }

  private scheduleStep(stepIndex: number, time: number): void {
    this.onStep?.(stepIndex);

    for (const track of this.tracks) {
      if (track.muted) continue;

      const event = track.steps[stepIndex];

      if (!event?.active) continue;

      if (track.type === "synth" || track.type === "bass") {
        if (event.patchId) {
          const stepPatch = FACTORY_PRESETS.find(
            (patch) => patch.id === event.patchId,
          );

          if (stepPatch) {
            this.synth.setParams(stepPatch.params);
          }
        }

        if (event.cutoff !== undefined) {
          this.synth.setParams({ cutoff: event.cutoff });
        }

        this.synth.noteOn(
          event.note,
          event.velocity * track.volume,
        );

        const duration = (60 / this.bpm / 4) * event.gate;

        const noteOffTimer = window.setTimeout(() => {
          this.synth.noteOff(event.note);
          this.scheduledTimeouts.delete(noteOffTimer);
        }, Math.max(10, duration * 1000));

        this.scheduledTimeouts.add(noteOffTimer);
      } else if (track.type === "drums") {
        this.drums.trigger(
          event.drum ?? "kick",
          time,
          event.velocity * track.volume,
        );
      } else if (
        track.type === "modulation" &&
        event.cutoff !== undefined
      ) {
        this.synth.setParams({
          cutoff: event.cutoff,
        });
      }
    }
  }

  stop(): void {
    this.stopRecording();

    this.running = false;

    if (this.timer !== null) {
      window.clearInterval(this.timer);
    }

    this.timer = null;

    for (const timeout of this.scheduledTimeouts) {
      window.clearTimeout(timeout);
    }

    this.scheduledTimeouts.clear();

    this.step = this.loopStart;
    this.playbackCursor = 0;

    this.synth.allNotesOff();
  }

  dispose(): void {
    this.stop();
  }
}