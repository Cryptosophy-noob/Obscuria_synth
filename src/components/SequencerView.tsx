
import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Sequencer,
  type SequencerTrack,
  type RecordedNote,
} from "../audio/Sequencer";
import { FACTORY_PRESETS } from "../patches/presets";

interface SequencerViewProps {
  sequencer: Sequencer;
}

export default function SequencerView({
  sequencer,
}: SequencerViewProps) {
  const [tracks, setTracks] = useState<SequencerTrack[]>(
    () => sequencer.getTracks(),
  );
  const [bpm, setBpm] = useState(sequencer.getBpm());
  const [swing, setSwing] = useState(sequencer.getSwing());
  const [playing, setPlaying] = useState(
    sequencer.isRunning(),
  );
  const [recording, setRecording] = useState(
    sequencer.isRecording(),
  );
  const [recordedNotes, setRecordedNotes] =
    useState<RecordedNote[]>(() =>
      sequencer.getRecordedNotes(),
    );
  const [recordingDuration, setRecordingDuration] =
    useState(0);
  const [currentStep, setCurrentStep] = useState(
    sequencer.getCurrentStep(),
  );
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [selectedStep, setSelectedStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTracks(sequencer.getTracks());
      setBpm(sequencer.getBpm());
      setSwing(sequencer.getSwing());
      setPlaying(sequencer.isRunning());
      setRecording(sequencer.isRecording());
      setRecordedNotes(sequencer.getRecordedNotes());
      setRecordingDuration(
        sequencer.getRecordingDuration(),
      );
      setCurrentStep(sequencer.getCurrentStep());
    }, 60);

    return () => window.clearInterval(timer);
  }, [sequencer]);

  const refreshTracks = () => {
    setTracks(sequencer.getTracks());
  };

  const refreshRecording = () => {
    setRecordedNotes(sequencer.getRecordedNotes());
    setRecordingDuration(
      sequencer.getRecordingDuration(),
    );
    setRecording(sequencer.isRecording());
  };

  const toggleStep = (
    trackIndex: number,
    stepIndex: number,
  ) => {
    const step = tracks[trackIndex]?.steps[stepIndex];

    if (!step) return;

    sequencer.setStep(trackIndex, stepIndex, {
      active: !step.active,
    });

    refreshTracks();
  };

  const toggleMute = (trackIndex: number) => {
    const track = tracks[trackIndex];

    if (!track) return;

    sequencer.setTrackMuted(
      trackIndex,
      !track.muted,
    );

    refreshTracks();
  };

  const clearTrack = (trackIndex: number) => {
    const track = tracks[trackIndex];

    if (!track) return;

    sequencer.setTracks(
      tracks.map((item, index) =>
        index === trackIndex
          ? {
              ...item,
              steps: item.steps.map((step) => ({
                ...step,
                active: false,
              })),
            }
          : item,
      ),
    );

    refreshTracks();
  };

  const randomizeTrack = () => {
    const track = tracks[selectedTrack];

    if (!track) return;

    sequencer.setTracks(
      tracks.map((item, index) =>
        index === selectedTrack
          ? {
              ...item,
              steps: item.steps.map(
                (step, stepIndex) => ({
                  ...step,
                  active: Math.random() < 0.35,
                  velocity:
                    0.55 + Math.random() * 0.45,
                  ...(item.type === "drums"
                    ? {
                        drum:
                          stepIndex % 4 === 0
                            ? ("kick" as const)
                            : stepIndex % 4 === 2
                              ? ("snare" as const)
                              : ("hat" as const),
                      }
                    : {}),
                }),
              ),
            }
          : item,
      ),
    );

    refreshTracks();
  };

  const clearAll = () => {
    sequencer.setTracks(
      tracks.map((track) => ({
        ...track,
        steps: track.steps.map((step) => ({
          ...step,
          active: false,
        })),
      })),
    );

    refreshTracks();
  };

  const togglePlayback = () => {
    if (sequencer.isRunning()) {
      sequencer.stop();
      setPlaying(false);
      setRecording(false);
      refreshRecording();
      setCurrentStep(sequencer.getCurrentStep());
      return;
    }

    try {
      sequencer.play();
      setPlaying(true);
    } catch (error) {
      console.error(error);
      window.alert("Avvia prima il motore audio.");
    }
  };

  const toggleRecording = () => {
    try {
      if (sequencer.isRecording()) {
        sequencer.stopRecording();
      } else {
        sequencer.startRecording();
      }

      setPlaying(sequencer.isRunning());
      refreshRecording();
    } catch (error) {
      console.error(error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Impossibile avviare la registrazione.",
      );
    }
  };

  const clearRecording = () => {
    sequencer.clearRecording();

    setRecording(false);
    setRecordedNotes([]);
    setRecordingDuration(0);
  };

  const exportPattern = () => {
    const data = {
      name: "OBSCURIA_PATTERN",
      bpm: sequencer.getBpm(),
      swing: sequencer.getSwing(),
      tracks: sequencer.getTracks(),
      recordedNotes: sequencer.getRecordedNotes(),
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "obscuria-pattern.json";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const importPattern = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const parsed: unknown = JSON.parse(
        await file.text(),
      );

      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("tracks" in parsed) ||
        !Array.isArray(parsed.tracks)
      ) {
        throw new Error("Formato non valido.");
      }

      const imported =
        parsed.tracks as SequencerTrack[];

      if (
        imported.length !== 4 ||
        imported.some(
          (track) =>
            !track ||
            typeof track.name !== "string" ||
            !Array.isArray(track.steps) ||
            track.steps.length !== 16,
        )
      ) {
        throw new Error(
          "Il pattern deve contenere quattro tracce da 16 step.",
        );
      }

      sequencer.setTracks(imported);

      if (
        "bpm" in parsed &&
        typeof parsed.bpm === "number" &&
        Number.isFinite(parsed.bpm)
      ) {
        sequencer.setBpm(parsed.bpm);
      }

      if (
        "swing" in parsed &&
        typeof parsed.swing === "number" &&
        Number.isFinite(parsed.swing)
      ) {
        sequencer.setSwing(parsed.swing);
      }

      // I vecchi file JSON senza recordedNotes rimangono compatibili.
      // In quel caso si importa il pattern senza una performance MIDI.
      if ("recordedNotes" in parsed) {
        if (!Array.isArray(parsed.recordedNotes)) {
          throw new Error(
            "Il formato delle note registrate non è valido.",
          );
        }

        const notes = parsed.recordedNotes as RecordedNote[];

        const validNotes = notes.every(
          (note) =>
            note !== null &&
            typeof note === "object" &&
            Number.isInteger(note.note) &&
            note.note >= 0 &&
            note.note <= 127 &&
            Number.isFinite(note.start) &&
            note.start >= 0 &&
            Number.isFinite(note.duration) &&
            note.duration > 0 &&
            Number.isFinite(note.velocity) &&
            note.velocity >= 0 &&
            note.velocity <= 1,
        );

        if (!validNotes) {
          throw new Error(
            "Il file contiene note registrate non valide.",
          );
        }

        sequencer.setRecordedNotes(notes);
      } else {
        sequencer.setRecordedNotes([]);
      }

      setBpm(sequencer.getBpm());
      setSwing(sequencer.getSwing());

      refreshTracks();
      refreshRecording();
    } catch (error) {
      console.error(error);

      window.alert(
        error instanceof Error
          ? `Impossibile importare il pattern: ${error.message}`
          : "Impossibile importare il pattern. Controlla il file JSON.",
      );
    }

    event.target.value = "";
  };

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = Math.floor(
      safeSeconds % 60,
    );
    const tenths = Math.floor(
      (safeSeconds % 1) * 10,
    );

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}.${tenths}`;
  };

  const recordedDuration = recordedNotes.reduce(
    (end, note) =>
      Math.max(end, note.start + note.duration),
    0,
  );

  return (
    <section className="sequencer-panel">
      <header className="panel-header">
        <div>
          <span className="panel-kicker">
            PATTERN GENERATOR
          </span>
          <h2>STEP SEQUENCER</h2>
        </div>

        <div className="sequencer-transport">
          <button
            className={`transport-button ${
              playing ? "is-active" : ""
            }`}
            type="button"
            onClick={togglePlayback}
          >
            {playing ? "■ STOP" : "▶ PLAY"}
          </button>

          <button
            className={`transport-button ${
              recording ? "is-recording" : ""
            }`}
            type="button"
            onClick={toggleRecording}
            aria-pressed={recording}
          >
            {recording ? "■ REC ON" : "● REC"}
          </button>

          <button
            className="transport-button"
            type="button"
            onClick={() => {
              sequencer.stop();

              setPlaying(false);
              setRecording(false);
              setCurrentStep(
                sequencer.getCurrentStep(),
              );

              refreshRecording();
            }}
          >
            RESET
          </button>
        </div>
      </header>

      <div className="sequencer-controls">
        <label className="control-block">
          <span>TEMPO</span>
          <strong>{bpm} BPM</strong>
          <input
            type="range"
            min="30"
            max="300"
            value={bpm}
            onChange={(event) => {
              const value = Number(
                event.target.value,
              );

              setBpm(value);
              sequencer.setBpm(value);
            }}
          />
        </label>

        <label className="control-block">
          <span>SWING</span>
          <strong>
            {Math.round(swing * 100)}%
          </strong>
          <input
            type="range"
            min="0"
            max="75"
            value={Math.round(swing * 100)}
            onChange={(event) => {
              const value =
                Number(event.target.value) / 100;

              setSwing(value);
              sequencer.setSwing(value);
            }}
          />
        </label>
      </div>

      <section className="midi-recording-panel">
        <header className="midi-recording-header">
          <div>
            <span className="panel-kicker">
              LIVE PERFORMANCE
            </span>
            <h3>MIDI RECORDING</h3>
          </div>

          <span
            className={`recording-status ${
              recording
                ? "recording-status--active"
                : ""
            }`}
          >
            <span className="status-led" />
            {recording ? "RECORDING" : "STANDBY"}
          </span>
        </header>

        <div className="midi-recording-info">
          <div>
            <span>RECORDED NOTES</span>
            <strong>{recordedNotes.length}</strong>
          </div>

          <div>
            <span>DURATION</span>
            <strong>
              {formatTime(
                recording
                  ? recordingDuration
                  : recordedDuration,
              )}
            </strong>
          </div>

          <div>
            <span>INPUT</span>
            <strong>SYNTH KEYBOARD</strong>
          </div>
        </div>

        <p className="midi-recording-help">
          {recording
            ? "Registrazione attiva: suona la tastiera virtuale o usa i tasti del computer. Premi REC ON per terminare."
            : recordedNotes.length > 0
              ? "Performance registrata. Premi STOP se il trasporto è ancora attivo, quindi PLAY per riascoltarla."
              : "Premi REC e suona il synth. Le note verranno registrate con altezza, durata e velocity."}
        </p>

        <div className="midi-recording-actions">
          <button
            type="button"
            className="panel-action"
            onClick={clearRecording}
            disabled={
              recording || recordedNotes.length === 0
            }
          >
            CLEAR MIDI
          </button>

          <button
            type="button"
            className="panel-action"
            onClick={exportPattern}
          >
            EXPORT PATTERN
          </button>
        </div>

        {recordedNotes.length > 0 && (
          <div className="recorded-note-list">
            <div className="recorded-note-list-header">
              <span>NOTE</span>
              <span>POSITION</span>
              <span>DURATION</span>
              <span>VELOCITY</span>
            </div>

            {recordedNotes
              .slice(0, 12)
              .map((note, index) => (
                <div
                  className="recorded-note-row"
                  key={`${note.note}-${note.start}-${index}`}
                >
                  <strong>MIDI {note.note}</strong>
                  <span>
                    {formatTime(note.start)}
                  </span>
                  <span>
                    {formatTime(note.duration)}
                  </span>
                  <span>
                    {Math.round(
                      note.velocity * 100,
                    )}
                    %
                  </span>
                </div>
              ))}

            {recordedNotes.length > 12 && (
              <p className="recorded-note-more">
                + {recordedNotes.length - 12} altre
                note
              </p>
            )}
          </div>
        )}
      </section>

      <div className="sequencer-grid-wrapper">
        <div className="sequencer-grid">
          <div className="sequencer-grid-label">
            TRACK / STEP
          </div>

          {Array.from({ length: 16 }, (_, index) => (
            <div
              key={index}
              className={[
                "step-number",
                index % 4 === 0
                  ? "beat-start"
                  : "",
                currentStep === index && playing
                  ? "playhead"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {String(index + 1).padStart(2, "0")}
            </div>
          ))}

          {tracks.map((track, trackIndex) => (
            <div
              className="sequencer-track-row"
              key={`${track.name}-${trackIndex}`}
            >
              <button
                type="button"
                className={`track-name ${
                  selectedTrack === trackIndex
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setSelectedTrack(trackIndex)
                }
              >
                {track.name}
              </button>

              {Array.from(
                { length: 16 },
                (_, stepIndex) => {
                  const step =
                    track.steps[stepIndex];
                  const active = Boolean(
                    step?.active,
                  );

                  return (
                    <button
                      key={stepIndex}
                      type="button"
                      aria-label={`${track.name}, step ${
                        stepIndex + 1
                      }`}
                      aria-pressed={active}
                      className={[
                        "sequencer-step",
                        active ? "active" : "",
                        selectedTrack === trackIndex && selectedStep === stepIndex ? "selected-step" : "",
                        stepIndex % 4 === 0
                          ? "beat-start"
                          : "",
                        currentStep === stepIndex &&
                        playing
                          ? "current-step"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        setSelectedTrack(trackIndex);
                        setSelectedStep(stepIndex);
                        toggleStep(trackIndex, stepIndex);
                      }}
                    />
                  );
                },
              )}
            </div>
          ))}
        </div>
      </div>

      <section className="step-editor">
        <header className="step-editor__header">
          <div>
            <span className="panel-kicker">STEP PARAMETERS</span>
            <h3>{tracks[selectedTrack]?.name ?? "TRACK"} / STEP {String(selectedStep + 1).padStart(2, "0")}</h3>
          </div>
          <span className="step-editor__hint">INDIVIDUAL STEP EDIT</span>
        </header>

        {(() => {
          const track = tracks[selectedTrack];
          const step = track?.steps[selectedStep];
          if (!track || !step) return null;
          const updateStep = (patch: Partial<typeof step>) => {
            sequencer.setStep(selectedTrack, selectedStep, patch);
            refreshTracks();
          };
          return (
            <div className="step-editor__controls">
              {(track.type === "synth" || track.type === "bass") && (
                <>
                  <label className="step-editor__control">
                    <span>STEP PATCH</span>
                    <select
                      value={step.patchId ?? ""}
                      onChange={(event) => updateStep({ patchId: event.target.value || undefined })}
                    >
                      <option value="">KEEP CURRENT SOUND</option>
                      {FACTORY_PRESETS.map((preset) => (
                        <option value={preset.id} key={preset.id}>{preset.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="step-editor__control">
                    <span>MIDI NOTE <strong>{step.note}</strong></span>
                    <input type="range" min="24" max="96" step="1" value={step.note}
                      onChange={(event) => updateStep({ note: Number(event.target.value) })} />
                  </label>
                  <label className="step-editor__control">
                    <span>GATE <strong>{Math.round(step.gate * 100)}%</strong></span>
                    <input type="range" min="0.1" max="1" step="0.05" value={step.gate}
                      onChange={(event) => updateStep({ gate: Number(event.target.value) })} />
                  </label>
                </>
              )}
              <label className="step-editor__control">
                <span>VELOCITY <strong>{Math.round(step.velocity * 100)}%</strong></span>
                <input type="range" min="0.05" max="1" step="0.05" value={step.velocity}
                  onChange={(event) => updateStep({ velocity: Number(event.target.value) })} />
              </label>
              {(track.type === "modulation" || track.type === "synth" || track.type === "bass") && (
                <label className="step-editor__control">
                  <span>CUTOFF <strong>{Math.round(step.cutoff ?? 1800)} Hz</strong></span>
                  <input type="range" min="40" max="18000" step="10" value={step.cutoff ?? 1800}
                    onChange={(event) => updateStep({ cutoff: Number(event.target.value) })} />
                </label>
              )}
            </div>
          );
        })()}
      </section>

      <div className="sequencer-track-controls">
        <div className="selected-track-info">
          <span>SELECTED TRACK</span>
          <strong>
            {tracks[selectedTrack]?.name ?? "NONE"}
          </strong>
        </div>

        <button
          type="button"
          className="panel-action"
          onClick={randomizeTrack}
        >
          RANDOMIZE
        </button>

        <button
          type="button"
          className="panel-action"
          onClick={() => clearTrack(selectedTrack)}
        >
          CLEAR TRACK
        </button>

        <button
          type="button"
          className="panel-action"
          onClick={clearAll}
        >
          CLEAR ALL
        </button>

        <button
          type="button"
          className="panel-action"
          onClick={exportPattern}
        >
          EXPORT JSON
        </button>

        <label className="panel-action file-import">
          IMPORT JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={importPattern}
          />
        </label>
      </div>

      <div className="sequencer-mute-controls">
        {tracks.map((track, index) => (
          <button
            key={`${track.name}-mute`}
            type="button"
            className={`mixer-button ${
              track.muted ? "is-active" : ""
            }`}
            onClick={() => toggleMute(index)}
          >
            {track.name}:{" "}
            {track.muted ? "MUTED" : "ON"}
          </button>
        ))}
      </div>
    </section>
  );
}
