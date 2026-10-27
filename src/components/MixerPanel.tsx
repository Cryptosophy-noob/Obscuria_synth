
import { useEffect, useRef, useState } from "react";
import {
  Sequencer,
  type SequencerTrack,
} from "../audio/Sequencer";

interface MixerPanelProps {
  sequencer: Sequencer;
  masterOutput?: GainNode;
}

export default function MixerPanel({
  sequencer,
  masterOutput,
}: MixerPanelProps) {
  const [tracks, setTracks] = useState<SequencerTrack[]>(
    () => sequencer.getTracks(),
  );
  const [masterVolume, setMasterVolume] = useState(
    masterOutput?.gain.value ?? 0.8,
  );
  const [soloTrack, setSoloTrack] = useState<number | null>(null);

  const savedMuteStates = useRef<boolean[] | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTracks(sequencer.getTracks());
    }, 200);

    return () => window.clearInterval(timer);
  }, [sequencer]);

  const refresh = () => setTracks(sequencer.getTracks());

  const updateVolume = (index: number, volume: number) => {
    sequencer.setTrackVolume(index, volume);
    refresh();
  };

  const toggleMute = (index: number) => {
    const track = tracks[index];
    if (!track) return;

    sequencer.setTrackMuted(index, !track.muted);
    refresh();
  };

  const toggleSolo = (index: number) => {
    if (soloTrack === index) {
      const previous = savedMuteStates.current;

      if (previous) {
        previous.forEach((muted, trackIndex) => {
          sequencer.setTrackMuted(trackIndex, muted);
        });
      }

      savedMuteStates.current = null;
      setSoloTrack(null);
      refresh();
      return;
    }

    if (soloTrack === null) {
      savedMuteStates.current = tracks.map((track) => track.muted);
    }

    tracks.forEach((_, trackIndex) => {
      sequencer.setTrackMuted(trackIndex, trackIndex !== index);
    });

    setSoloTrack(index);
    refresh();
  };

  const updateMaster = (volume: number) => {
    setMasterVolume(volume);

    if (masterOutput) {
      masterOutput.gain.setTargetAtTime(
        volume,
        masterOutput.context.currentTime,
        0.015,
      );
    }
  };

  return (
    <section className="mixer-panel">
      <header className="panel-header">
        <div>
          <span className="panel-kicker">SIGNAL ROUTING</span>
          <h2>MIXER</h2>
        </div>

        <label className="mixer-master">
          <span>MASTER</span>
          <strong>{Math.round(masterVolume * 100)}%</strong>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(event) =>
              updateMaster(Number(event.target.value))
            }
          />
        </label>
      </header>

      <div className="mixer-channels">
        {tracks.map((track, index) => (
          <article className="mixer-channel" key={`${track.name}-${index}`}>
            <div className="mixer-channel-top">
              <span className="mixer-channel-number">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="mixer-meter">
                <span
                  className="mixer-meter-fill"
                  style={{
                    height: `${track.muted ? 0 : track.volume * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="mixer-channel-name">
              <strong>{track.name}</strong>
              <span>{track.type.toUpperCase()}</span>
            </div>

            <div className="mixer-fader-area">
              <span className="mixer-fader-value">
                {Math.round(track.volume * 100)}%
              </span>

              <input
                aria-label={`${track.name} volume`}
                className="mixer-fader"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={track.volume}
                onChange={(event) =>
                  updateVolume(index, Number(event.target.value))
                }
              />
            </div>

            <div className="mixer-channel-buttons">
              <button
                type="button"
                className={`mixer-button ${track.muted ? "is-active" : ""}`}
                onClick={() => toggleMute(index)}
              >
                M
              </button>

              <button
                type="button"
                className={`mixer-button ${soloTrack === index ? "is-solo" : ""}`}
                onClick={() => toggleSolo(index)}
              >
                S
              </button>
            </div>

            <div className="mixer-channel-footer">
              <span>{track.muted ? "MUTED" : "ACTIVE"}</span>
              <span>
                {track.steps.filter((step) => step.active).length} STEPS
              </span>
            </div>
          </article>
        ))}
      </div>

      <footer className="mixer-footer">
        <span>4 CHANNELS</span>
        <span>PER-TRACK LEVEL CONTROL</span>
        <span>MASTER OUTPUT</span>
      </footer>
    </section>
  );
}
