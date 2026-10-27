import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  ObscuriaSynth,
  DEFAULT_SYNTH_PARAMS,
  type SynthParams,
} from "./audio/ObscuriaSynth";
import { DrumMachine } from "./audio/DrumMachine";
import { Sequencer } from "./audio/Sequencer";
import { WhiteNoiseGenerator } from "./audio/WhiteNoiseGenerator";
import { downloadWav } from "./audio/renderExport";
import { PatchEngine, type SynthPatch } from "./patches/PatchEngine";

import SynthPanel from "./components/SynthPanel";
import PatchBay from "./components/Patchbay";
import DrumPanel from "./components/DrumPanel";
import SequencerView from "./components/SequencerView";
import MixerPanel from "./components/MixerPanel";
import PerformancePanel, { type ArpeggiatorMode } from "./components/PerformancePanel";

import "./App.css";

const patchEngine = new PatchEngine();

const PROJECT_STORAGE_KEY = "obscuria.project.v1";

interface SavedProject {
  activePatch?: SynthPatch;
  params?: SynthParams;
  masterLevel?: number;
  keyboardOctave?: number;
  drumParams?: ReturnType<DrumMachine["getParams"]>;
  tracks?: ReturnType<Sequencer["getTracks"]>;
  bpm?: number;
  swing?: number;
  recordedNotes?: ReturnType<Sequencer["getRecordedNotes"]>;
  noiseVolume?: number;
  noiseCutoff?: number;
  arpEnabled?: boolean;
  arpMode?: ArpeggiatorMode;
  arpDivision?: 4 | 8 | 16;
  arpOctaves?: number;
  wavBitDepth?: 16 | 24;
}

function readSavedProject(): SavedProject | null {
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    return value as SavedProject;
  } catch {
    return null;
  }
}

const KEYBOARD_NOTES: Record<string, number> = {
  a: 48,
  w: 49,
  s: 50,
  e: 51,
  d: 52,
  f: 53,
  t: 54,
  g: 55,
  y: 56,
  h: 57,
  u: 58,
  j: 59,
  k: 60,
  o: 61,
  l: 62,
  p: 63,
  ";": 64,
  "'": 65,
};

function getPatchParams(patch: SynthPatch): Partial<SynthParams> {
  const data = patch as unknown as {
    params?: Partial<SynthParams>;
    parameters?: Partial<SynthParams>;
    synthParams?: Partial<SynthParams>;
  };

  return data.params ?? data.parameters ?? data.synthParams ?? {};
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)
  );
}

export default function App() {
  const [synth] = useState(() => new ObscuriaSynth());

  const [activePatch, setActivePatch] = useState<SynthPatch>(() => {
    const saved = readSavedProject();
    return saved?.activePatch ?? patchEngine.createDefaultPatch();
  });

  const [params, setParams] = useState<SynthParams>(() => {
    const saved = readSavedProject();
    return {
      ...DEFAULT_SYNTH_PARAMS,
      ...getPatchParams(saved?.activePatch ?? patchEngine.createDefaultPatch()),
      ...(saved?.params ?? {}),
    };
  });

  const [audioReady, setAudioReady] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");

  const [drumMachine, setDrumMachine] = useState<DrumMachine | null>(null);
  const [sequencer, setSequencer] = useState<Sequencer | null>(null);
  const [noiseGenerator, setNoiseGenerator] = useState<WhiteNoiseGenerator | null>(null);

  const drumRef = useRef<DrumMachine | null>(null);
  const sequencerRef = useRef<Sequencer | null>(null);
  const noiseRef = useRef<WhiteNoiseGenerator | null>(null);
  const arpHeldNotes = useRef<Map<number, number>>(new Map());
  const arpLastNote = useRef<number | null>(null);
  const arpCursor = useRef(0);
  const arpNextTime = useRef(0);
  const wavTimerRef = useRef<number | null>(null);
  const pressedKeys = useRef<Set<string>>(new Set<string>());
  const heldPointerNotes = useRef<Set<number>>(new Set<number>());

  const [keyboardOctave, setKeyboardOctave] = useState(
    () => readSavedProject()?.keyboardOctave ?? 0,
  );
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [masterLevel, setMasterLevel] = useState(
    () => readSavedProject()?.masterLevel ?? 0.8,
  );
  const [saveStatus, setSaveStatus] = useState("RESTORE READY");
  const [noiseVolume, setNoiseVolume] = useState(() => readSavedProject()?.noiseVolume ?? 0);
  const [noiseCutoff, setNoiseCutoff] = useState(() => readSavedProject()?.noiseCutoff ?? 12000);
  const [arpEnabled, setArpEnabled] = useState(() => readSavedProject()?.arpEnabled ?? false);
  const [arpMode, setArpMode] = useState<ArpeggiatorMode>(() => readSavedProject()?.arpMode ?? "up");
  const [arpDivision, setArpDivision] = useState<4 | 8 | 16>(() => readSavedProject()?.arpDivision ?? 8);
  const [arpOctaves, setArpOctaves] = useState(() => readSavedProject()?.arpOctaves ?? 1);
  const [wavBitDepth, setWavBitDepth] = useState<16 | 24>(() => readSavedProject()?.wavBitDepth ?? 24);
  const [wavExporting, setWavExporting] = useState(false);
  const [wavMessage, setWavMessage] = useState("");
  const [activeTab, setActiveTab] = useState("SYNTH");

  const startAudio = useCallback(async () => {
    if (audioLoading || audioReady) return;

    setAudioLoading(true);
    setAudioError("");

    try {
      await synth.start();

      const context = synth.getAudioContext();

      if (!context) {
        throw new Error("Il motore audio non ha creato il contesto.");
      }

      if (!drumRef.current) {
        const saved = readSavedProject();
        const masterBus = synth.getOutput() ?? context.destination;
        const drums = new DrumMachine(context, masterBus);
        if (saved?.drumParams) drums.setParams(saved.drumParams);
        drumRef.current = drums;
        setDrumMachine(drums);

        const noise = new WhiteNoiseGenerator(context, masterBus);
        noise.setParams({ volume: noiseVolume, cutoff: noiseCutoff });
        noiseRef.current = noise;
        setNoiseGenerator(noise);

        const seq = new Sequencer(synth, drums);
        if (saved?.tracks && Array.isArray(saved.tracks)) {
          try { seq.setTracks(saved.tracks); } catch { /* progetto precedente non compatibile */ }
        }
        if (typeof saved?.bpm === "number") seq.setBpm(saved.bpm);
        if (typeof saved?.swing === "number") seq.setSwing(saved.swing);
        if (saved?.recordedNotes && Array.isArray(saved.recordedNotes)) {
          seq.setRecordedNotes(saved.recordedNotes);
        }
        sequencerRef.current = seq;
        setSequencer(seq);
      }

      synth.setParams(params);
      setParams(synth.getParams());
      setAudioReady(true);
    } catch (error) {
      setAudioError(
        error instanceof Error
          ? error.message
          : "Impossibile avviare il motore audio.",
      );
    } finally {
      setAudioLoading(false);
    }
  }, [synth, params, noiseVolume, noiseCutoff, audioLoading, audioReady]);

  const updateSynthParams = useCallback(
    (next: Partial<SynthParams>) => {
      synth.setParams(next);
      setParams(synth.getParams());
    },
    [synth],
  );

  const selectPatch = useCallback(
    (patch: SynthPatch) => {
      setActivePatch(patch);

      const nextParams = getPatchParams(patch);

      synth.setParams(nextParams);
      setParams(synth.getParams());
    },
    [synth],
  );

  /**
   * Suona una nota e, se REC è attivo, la registra nel sequencer.
   */
  const noteOn = useCallback(
    (midiNote: number) => {
      if (!audioReady) return;

      const velocity = 0.85;

      if (arpEnabled) {
        arpHeldNotes.current.set(midiNote, velocity);
      } else {
        synth.noteOn(midiNote, velocity);
        sequencerRef.current?.recordNoteOn(midiNote, velocity);
      }

      setActiveNotes((previous) => {
        const next = new Set(previous);
        next.add(midiNote);
        return next;
      });
    },
    [audioReady, synth, arpEnabled],
  );

  /**
   * Rilascia una nota e completa il relativo evento MIDI.
   */
  const noteOff = useCallback(
    (midiNote: number) => {
      if (arpEnabled) {
        arpHeldNotes.current.delete(midiNote);
      } else {
        synth.noteOff(midiNote);
        sequencerRef.current?.recordNoteOff(midiNote);
      }

      setActiveNotes((previous) => {
        const next = new Set(previous);
        next.delete(midiNote);
        return next;
      });
    },
    [synth, arpEnabled],
  );

  /**
   * Autosalva il progetto locale. I dati audio non vengono inviati a un server.
   */
  useEffect(() => {
    const saveProject = () => {
      try {
        const previous = readSavedProject();
        const snapshot: SavedProject = {
          activePatch,
          params,
          masterLevel,
          keyboardOctave,
          drumParams: drumMachine?.getParams() ?? previous?.drumParams,
          tracks: sequencer?.getTracks() ?? previous?.tracks,
          bpm: sequencer?.getBpm() ?? previous?.bpm,
          swing: sequencer?.getSwing() ?? previous?.swing,
          recordedNotes: sequencer?.getRecordedNotes() ?? previous?.recordedNotes,
          noiseVolume,
          noiseCutoff,
          arpEnabled,
          arpMode,
          arpDivision,
          arpOctaves,
          wavBitDepth,
        };
        window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(snapshot));
        setSaveStatus("PROJECT SAVED LOCALLY");
      } catch (error) {
        console.error("Obscuria autosave failed", error);
        setSaveStatus("SAVE ERROR");
      }
    };

    const timer = window.setInterval(saveProject, 1000);
    window.addEventListener("pagehide", saveProject);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", saveProject);
      saveProject();
    };
  }, [activePatch, params, masterLevel, keyboardOctave, drumMachine, sequencer, noiseVolume, noiseCutoff, arpEnabled, arpMode, arpDivision, arpOctaves, wavBitDepth]);

  useEffect(() => {
    noiseGenerator?.setParams({ volume: noiseVolume, cutoff: noiseCutoff });
  }, [noiseGenerator, noiseVolume, noiseCutoff]);

  /**
   * Arpeggiatore sincronizzato al BPM del sequencer.
   * La registrazione acquisisce le note generate, non soltanto i tasti tenuti.
   */
  useEffect(() => {
    const context = synth.getAudioContext();
    if (!audioReady || !arpEnabled || !sequencer || !context) {
      if (arpLastNote.current !== null) {
        synth.noteOff(arpLastNote.current);
        sequencerRef.current?.recordNoteOff(arpLastNote.current);
        arpLastNote.current = null;
      }
      return;
    }

    arpCursor.current = 0;
    arpNextTime.current = context.currentTime;
    const timer = window.setInterval(() => {
      const ctx = synth.getAudioContext();
      if (!ctx) return;

      const held = [...arpHeldNotes.current.entries()].sort((a, b) => a[0] - b[0]);
      if (held.length === 0) {
        if (arpLastNote.current !== null) {
          synth.noteOff(arpLastNote.current);
          sequencer.recordNoteOff(arpLastNote.current);
          arpLastNote.current = null;
        }
        return;
      }

      const interval = (60 / sequencer.getBpm()) * (4 / arpDivision);
      if (ctx.currentTime < arpNextTime.current) return;

      if (arpLastNote.current !== null) {
        synth.noteOff(arpLastNote.current);
        sequencer.recordNoteOff(arpLastNote.current);
        arpLastNote.current = null;
      }

      const notes: Array<{ note: number; velocity: number }> = [];
      for (let octave = 0; octave < arpOctaves; octave++) {
        for (const [note, velocity] of held) {
          notes.push({ note: note + octave * 12, velocity });
        }
      }

      let index = 0;
      if (arpMode === "down") {
        index = notes.length - 1 - (arpCursor.current % notes.length);
      } else if (arpMode === "random") {
        index = Math.floor(Math.random() * notes.length);
      } else if (arpMode === "updown" && notes.length > 1) {
        const cycle = notes.length * 2 - 2;
        const position = arpCursor.current % cycle;
        index = position < notes.length ? position : cycle - position;
      } else {
        index = arpCursor.current % notes.length;
      }

      const next = notes[index];
      if (next) {
        synth.noteOn(next.note, next.velocity);
        sequencer.recordNoteOn(next.note, next.velocity);
        arpLastNote.current = next.note;
      }
      arpCursor.current++;
      arpNextTime.current = ctx.currentTime + interval;
    }, 8);

    return () => {
      window.clearInterval(timer);
      if (arpLastNote.current !== null) {
        synth.noteOff(arpLastNote.current);
        sequencer.recordNoteOff(arpLastNote.current);
        arpLastNote.current = null;
      }
    };
  }, [audioReady, arpEnabled, arpMode, arpDivision, arpOctaves, sequencer, synth]);

  const finishWavExport = useCallback(() => {
    if (wavTimerRef.current !== null) {
      window.clearTimeout(wavTimerRef.current);
      wavTimerRef.current = null;
    }
    sequencer?.stop();
    try {
      const captured = synth.stopWavCapture();
      downloadWav(captured.left, captured.right, captured.sampleRate, {
        bitDepth: wavBitDepth,
        filename: "obscuria-pattern.wav",
      });
      setWavMessage(`WAV esportato · ${captured.sampleRate} Hz · ${wavBitDepth}-bit`);
    } catch (error) {
      setWavMessage(error instanceof Error ? error.message : "Errore durante l'esportazione WAV.");
    } finally {
      setWavExporting(false);
    }
  }, [sequencer, synth, wavBitDepth]);

  const startWavExport = useCallback(() => {
    if (wavExporting) {
      finishWavExport();
      return;
    }
    if (!audioReady || !sequencer) {
      setWavMessage("Avvia prima il motore audio.");
      return;
    }
    try {
      sequencer.stop();
      synth.startWavCapture();
      sequencer.play();
      setWavExporting(true);
      setWavMessage("Cattura in corso: riproduzione di una battuta...");
      const noteEnd = sequencer.getRecordedNotes().reduce(
        (end, note) => Math.max(end, note.start + note.duration), 0,
      );
      const duration = Math.max((60 / sequencer.getBpm()) * 4, noteEnd);
      wavTimerRef.current = window.setTimeout(() => {
        sequencer.stop();
        wavTimerRef.current = window.setTimeout(
          () => finishWavExport(),
          Math.max(1200, (params.release + 0.2) * 1000),
        );
      }, duration * 1000);
    } catch (error) {
      synth.cancelWavCapture();
      setWavExporting(false);
      setWavMessage(error instanceof Error ? error.message : "Impossibile avviare la cattura WAV.");
    }
  }, [wavExporting, audioReady, sequencer, synth, finishWavExport, params.release]);

  /**
   * Mappa la tastiera fisica del computer sul sintetizzatore.
   */
  useEffect(() => {
    if (!audioReady) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const note = KEYBOARD_NOTES[key];

      if (note === undefined || pressedKeys.current.has(key)) return;

      event.preventDefault();
      pressedKeys.current.add(key);

      noteOn(note + keyboardOctave * 12);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const note = KEYBOARD_NOTES[key];

      if (note === undefined || !pressedKeys.current.has(key)) return;

      pressedKeys.current.delete(key);
      noteOff(note + keyboardOctave * 12);
    };

    const releaseAll = () => {
      for (const key of pressedKeys.current) {
        const note = KEYBOARD_NOTES[key];

        if (note !== undefined) {
          noteOff(note + keyboardOctave * 12);
        }
      }

      pressedKeys.current.clear();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseAll);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [audioReady, keyboardOctave, noteOn, noteOff]);

  /**
   * Rilascia eventuali note tenute premute quando il componente
   * viene smontato e chiude i moduli audio.
   */
  useEffect(() => {
    return () => {
      sequencerRef.current?.dispose();
      drumRef.current?.dispose();
      noiseRef.current?.dispose();
      if (wavTimerRef.current !== null) window.clearTimeout(wavTimerRef.current);
      void synth.stop();
    };
  }, [synth]);

  const handleKeyboardPointerDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    midiNote: number,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      noteOn(midiNote);
    }
  };

  const keyboardNotes = [
    { semitone: 0, label: "C", black: false },
    { semitone: 1, label: "C#", black: true },
    { semitone: 2, label: "D", black: false },
    { semitone: 3, label: "D#", black: true },
    { semitone: 4, label: "E", black: false },
    { semitone: 5, label: "F", black: false },
    { semitone: 6, label: "F#", black: true },
    { semitone: 7, label: "G", black: false },
    { semitone: 8, label: "G#", black: true },
    { semitone: 9, label: "A", black: false },
    { semitone: 10, label: "A#", black: true },
    { semitone: 11, label: "B", black: false },
    { semitone: 12, label: "C", black: false },
  ];

  return (
    <main className="obscuria-app">
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="#top" aria-label="Obscuria home">
            <span className="brand-mark">
              <span />
              <span />
              <span />
            </span>

            <span className="brand-word">
              OBSCURIA
              <small>MODULAR SOUND SYSTEM</small>
            </span>
          </a>

          <div className="topbar-center">
            <span className={`status-led ${audioReady ? "online" : ""}`} />
            <span>
              {audioReady ? "AUDIO ENGINE ONLINE" : "AUDIO ENGINE STANDBY"}
            </span>
            <span className="autosave-status">{saveStatus}</span>
          </div>

          <div className="topbar-right">
            <span className="version-tag">OS / 01</span>

            <button
              type="button"
              className={`power-button ${audioReady ? "powered" : ""}`}
              onClick={startAudio}
              disabled={audioReady || audioLoading}
            >
              <span className="power-symbol">⏻</span>

              {audioLoading
                ? "INITIALIZING"
                : audioReady
                  ? "POWER ON"
                  : "START AUDIO"}
            </button>
          </div>
        </header>

        <section className="hero" id="top">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              DIGITAL ANALOG INSTRUMENT
            </div>

            <h1>
              Shape the
              <br />
              <span>unknown.</span>
            </h1>

            <p>
              A generative synthesizer and step sequencer for experimental
              sound design.
            </p>
          </div>

          <div className="hero-instrument" aria-hidden="true">
            <div className="instrument-ring ring-one" />
            <div className="instrument-ring ring-two" />
            <div className="instrument-ring ring-three" />

            <div className="instrument-core">
              <span>OSC</span>
              <strong>01</strong>
              <span>MODULATION</span>
            </div>

            <div className="instrument-cross instrument-cross-h" />
            <div className="instrument-cross instrument-cross-v" />
          </div>

          <div className="hero-meta">
            <div>
              <span>INSTRUMENT</span>
              <strong>OBSCURIA / V1</strong>
            </div>

            <div>
              <span>VOICE ARCHITECTURE</span>
              <strong>DUAL OSC + SUB</strong>
            </div>

            <div>
              <span>PATCH</span>
              <strong>{activePatch.name}</strong>
            </div>
          </div>
        </section>

        {audioError && (
          <div className="error-banner" role="alert">
            <strong>AUDIO ERROR</strong>
            <span>{audioError}</span>

            <button type="button" onClick={() => setAudioError("")}>
              DISMISS
            </button>
          </div>
        )}

        {!audioReady && (
          <section className="audio-start-notice">
            <div className="audio-start-icon">↗</div>

            <div>
              <strong>Audio engine is waiting</strong>
              <p>
                Premi <b>START AUDIO</b> per inizializzare il sintetizzatore.
                La riproduzione e la tastiera musicale saranno disponibili
                dopo l'attivazione.
              </p>
            </div>

            <button
              type="button"
              className="action-button action-button--primary"
              onClick={startAudio}
              disabled={audioLoading}
            >
              {audioLoading ? "INITIALIZING..." : "INITIALIZE AUDIO"}
            </button>
          </section>
        )}

        <nav className="module-nav" aria-label="Instrument modules">
          {[
            ["SYNTH", "01"],
            ["PATCH BAY", "02"],
            ["SEQUENCER", "03"],
            ["DRUMS", "04"],
            ["MIXER", "05"],
          ].map(([name, number]) => (
            <button
              type="button"
              key={name}
              className={`module-nav-item ${
                activeTab === name ? "selected" : ""
              }`}
              onClick={() => {
                setActiveTab(name);

                document
                  .getElementById(
                    name === "SYNTH"
                      ? "synth-module"
                      : name === "PATCH BAY"
                        ? "patch-module"
                        : name === "SEQUENCER"
                          ? "sequencer-module"
                          : name === "DRUMS"
                            ? "drums-module"
                            : "mixer-module",
                  )
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
              }}
            >
              <span>{number}</span>
              {name}
              <span className="nav-arrow">↘</span>
            </button>
          ))}
        </nav>

        <section className="workbench">
          <div className="workbench-heading">
            <div>
              <span className="section-index">01 — SOUND DESIGN</span>
              <h2>Instrument architecture</h2>
            </div>

            <span className="section-side-note">
              OSCILLATOR / FILTER / MOD
            </span>
          </div>

          <div className="synth-layout" id="synth-module">
            <div className="module-card module-card--synth">
              <SynthPanel
                params={params}
                onParamsChange={updateSynthParams}
              />
            </div>

            <aside
              className="module-card module-card--patch"
              id="patch-module"
            >
              <PatchBay
                activePatch={activePatch}
                onSelectPatch={selectPatch}
              />
            </aside>

            <div className="module-card performance-card">
              <PerformancePanel
                noiseParams={{ volume: noiseVolume, cutoff: noiseCutoff }}
                onNoiseChange={(next) => {
                  if (next.volume !== undefined) setNoiseVolume(next.volume);
                  if (next.cutoff !== undefined) setNoiseCutoff(next.cutoff);
                }}
                arpEnabled={arpEnabled}
                onArpEnabledChange={setArpEnabled}
                arpMode={arpMode}
                onArpModeChange={setArpMode}
                arpDivision={arpDivision}
                onArpDivisionChange={setArpDivision}
                arpOctaves={arpOctaves}
                onArpOctavesChange={setArpOctaves}
                audioReady={audioReady}
                wavExporting={wavExporting}
                wavBitDepth={wavBitDepth}
                onWavBitDepthChange={setWavBitDepth}
                onWavExport={startWavExport}
                wavMessage={wavMessage}
              />
            </div>
          </div>

          <section className="keyboard-panel">
            <header className="subpanel-header">
              <div>
                <span className="panel-kicker">PERFORMANCE INTERFACE</span>
                <h2>Virtual keyboard</h2>
              </div>

              <div className="keyboard-octave">
                <button
                  type="button"
                  aria-label="Lower keyboard octave"
                  onClick={() =>
                    setKeyboardOctave((value) => Math.max(-2, value - 1))
                  }
                  disabled={keyboardOctave <= -2}
                >
                  −
                </button>

                <span>
                  OCT {keyboardOctave >= 0 ? "+" : ""}
                  {keyboardOctave}
                </span>

                <button
                  type="button"
                  aria-label="Raise keyboard octave"
                  onClick={() =>
                    setKeyboardOctave((value) => Math.min(2, value + 1))
                  }
                  disabled={keyboardOctave >= 2}
                >
                  +
                </button>
              </div>
            </header>

            <div className="keyboard-instructions">
              <span>PC KEYBOARD</span>

              <p>
                White keys: A S D F G H J K L ; &nbsp; Black keys: W E T Y U O P
              </p>

              <span className="midi-range">
                MIDI {48 + keyboardOctave * 12}–
                {60 + keyboardOctave * 12}
              </span>
            </div>

            <div className="piano-keyboard">
              {keyboardNotes.map((key) => {
                const midiNote =
                  48 + key.semitone + keyboardOctave * 12;

                const isActive = activeNotes.has(midiNote);

                return (
                  <button
                    type="button"
                    key={`${key.label}-${key.semitone}`}
                    className={[
                      "piano-key",
                      key.black
                        ? "piano-key--black"
                        : "piano-key--white",
                      isActive ? "piano-key--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={
                      key.black
                        ? {
                            left: `${(key.semitone / 12) * 100}%`,
                          }
                        : undefined
                    }
                    aria-label={`Play ${key.label}, MIDI ${midiNote}`}
                    aria-pressed={isActive}
                    onPointerDown={(event) => {
                      if (!audioReady) return;

                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);

                      heldPointerNotes.current.add(midiNote);
                      noteOn(midiNote);
                    }}
                    onPointerUp={() => {
                      if (!heldPointerNotes.current.has(midiNote)) return;

                      heldPointerNotes.current.delete(midiNote);
                      noteOff(midiNote);
                    }}
                    onPointerCancel={() => {
                      if (!heldPointerNotes.current.has(midiNote)) return;

                      heldPointerNotes.current.delete(midiNote);
                      noteOff(midiNote);
                    }}
                    onPointerLeave={(event) => {
                      if (
                        event.buttons === 0 &&
                        heldPointerNotes.current.has(midiNote)
                      ) {
                        heldPointerNotes.current.delete(midiNote);
                        noteOff(midiNote);
                      }
                    }}
                    onKeyDown={(event) =>
                      handleKeyboardPointerDown(event, midiNote)
                    }
                    onKeyUp={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        noteOff(midiNote);
                      }
                    }}
                    disabled={!audioReady}
                  >
                    {!key.black && <span>{key.label}</span>}
                  </button>
                );
              })}
            </div>

            <div className="keyboard-footer">
              <span>
                <span className="status-led" />
                {audioReady ? "READY TO PLAY" : "AUDIO DISABLED"}
              </span>

              <span>POLYPHONIC CONTROL / WEB AUDIO</span>
            </div>
          </section>
        </section>

        <section className="sequencer-section" id="sequencer-module">
          <div className="workbench-heading">
            <div>
              <span className="section-index">
                02 — PATTERN GENERATION
              </span>
              <h2>Sequencing system</h2>
            </div>

            <span className="section-side-note">16 STEPS / 4 TRACKS</span>
          </div>

          {sequencer ? (
            <div className="module-card">
              <SequencerView sequencer={sequencer} />
            </div>
          ) : (
            <div className="module-placeholder">
              <span className="placeholder-number">SEQ / 01</span>
              <strong>Sequencer in standby</strong>
              <p>
                Attiva il motore audio per iniziare a creare pattern.
              </p>
            </div>
          )}
        </section>

        <section className="drum-section" id="drums-module">
          <div className="workbench-heading">
            <div>
              <span className="section-index">
                03 — RHYTHM GENERATION
              </span>
              <h2>Percussion engine</h2>
            </div>

            <span className="section-side-note">KICK / SNARE / HI-HAT</span>
          </div>

          {drumMachine ? (
            <div className="module-card">
              <DrumPanel drumMachine={drumMachine} />
            </div>
          ) : (
            <div className="module-placeholder">
              <span className="placeholder-number">DRM / 01</span>
              <strong>Drum machine in standby</strong>
              <p>
                Avvia l'audio per utilizzare i controlli percussivi.
              </p>
            </div>
          )}
        </section>

        <section className="mixer-section" id="mixer-module">
          <div className="workbench-heading">
            <div>
              <span className="section-index">04 — OUTPUT CONTROL</span>
              <h2>Mixing console</h2>
            </div>

            <span className="section-side-note">LEVEL / MUTE / SOLO</span>
          </div>

          {sequencer ? (
            <div className="module-card">
              <MixerPanel
                sequencer={sequencer}
                masterOutput={synth.getOutput() ?? undefined}
              />
            </div>
          ) : (
            <div className="module-placeholder">
              <span className="placeholder-number">MIX / 01</span>
              <strong>Mixer in standby</strong>
              <p>
                Il mixer sarà disponibile dopo l'avvio del motore audio.
              </p>
            </div>
          )}

          <div className="master-output-strip">
            <div>
              <span className="panel-kicker">MASTER OUTPUT</span>
              <strong>MAIN BUS</strong>
            </div>

            <label className="master-output-control">
              <span>LEVEL</span>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={masterLevel}
                onChange={(event) => {
                  const value = Number(event.target.value);

                  setMasterLevel(value);

                  const output = synth.getOutput();
                  const context = synth.getAudioContext();

                  if (output && context) {
                    output.gain.setTargetAtTime(
                      value,
                      context.currentTime,
                      0.015,
                    );
                  }
                }}
                aria-label="Master output level"
              />

              <strong>{Math.round(masterLevel * 100)}%</strong>
            </label>
          </div>
        </section>

        <footer className="app-footer">
          <div className="footer-brand">
            <span className="brand-mark">
              <span />
              <span />
              <span />
            </span>

            <span>OBSCURIA</span>
          </div>

          <p>DESIGNED FOR EXPERIMENTAL SOUND</p>

          <div className="footer-meta">
            <span>WEB AUDIO API</span>
            <span>·</span>
            <span>LOCAL SYNTH ENGINE</span>
          </div>

          <div className="app-credits">
            <span>
              Created and programmed by Danyel Noach Spadoni
            </span>
            <span>for N00b Collective</span>
          </div>
        </footer>
      </div>
    </main>
  );
}