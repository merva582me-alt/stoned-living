import React, { useEffect, useRef, useState } from 'react';

interface AmbientSoundPlayerProps {
  enabled: boolean;
  isPlayingMedia?: boolean; // Mute when user is actively watching a movie/show
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

export const AmbientSoundPlayer: React.FC<AmbientSoundPlayerProps> = ({
  enabled,
  isPlayingMedia = false
}) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isApiReady, setIsApiReady] = useState<boolean>(!!(window.YT && window.YT.Player));
  const [useFallbackSynth, setUseFallbackSynth] = useState<boolean>(false);

  // Web Audio Synth Fallback Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const chordTimerRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef<boolean>(false);
  const activeNodesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);

  // 1. Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
      return;
    }

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }

    const previousOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousOnReady) previousOnReady();
      setIsApiReady(true);
    };
  }, []);

  // 2. Initialize YouTube Player for Video XVFUtEh9zrY
  useEffect(() => {
    if (!isApiReady || !containerRef.current || playerRef.current) return;

    try {
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '1',
        width: '1',
        videoId: 'XVFUtEh9zrY', // Official Lofi Girl Track (https://www.youtube.com/watch?v=XVFUtEh9zrY)
        playerVars: {
          autoplay: enabled ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          loop: 1,
          playlist: 'XVFUtEh9zrY',
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            event.target.setVolume(10);
            if (enabled && !isPlayingMedia) {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
          onError: (err: any) => {
            console.warn('[AmbientSoundPlayer] YouTube embed error, switching to ambient synth fallback', err);
            setUseFallbackSynth(true);
          }
        }
      });
    } catch (e) {
      console.warn('[AmbientSoundPlayer] Could not create YT player, using synth fallback', e);
      setUseFallbackSynth(true);
    }
  }, [isApiReady]);

  // 3. Sync YouTube Play/Pause/Mute state
  useEffect(() => {
    if (useFallbackSynth) return;
    const player = playerRef.current;
    if (!player || typeof player.playVideo !== 'function') return;

    if (enabled && !isPlayingMedia) {
      try {
        player.setVolume(10);
        player.playVideo();
      } catch (e) {
        console.warn('YouTube play notice:', e);
      }
    } else {
      try {
        player.pauseVideo();
      } catch (e) {
        console.warn('YouTube pause notice:', e);
      }
    }
  }, [enabled, isPlayingMedia, useFallbackSynth]);

  // 4. Web Audio Fallback Implementation (if YT blocked or offline)
  const stopAllSynthAudio = () => {
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
    isLoopRunningRef.current = false;

    activeNodesRef.current.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(0);
        gain.gain.setValueAtTime(0, 0);
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    activeNodesRef.current = [];
  };

  useEffect(() => {
    if (!useFallbackSynth) return;

    if (!enabled) {
      stopAllSynthAudio();
      return;
    }

    let ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;
    }

    const targetGain = isPlayingMedia ? 0.0001 : 0.10;
    if (!masterGainRef.current) {
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(targetGain, ctx.currentTime);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      masterGain.connect(filter);
      filter.connect(ctx.destination);
      masterGainRef.current = masterGain;
    } else {
      masterGainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.2);
    }

    const chordProgressions = [
      { notes: [138.59, 164.81, 207.65, 246.94, 329.63], bass: 69.30 },
      { notes: [116.54, 146.83, 174.61, 220.00, 261.63], bass: 58.27 },
      { notes: [155.56, 185.00, 233.08, 277.18, 349.23], bass: 77.78 },
      { notes: [207.65, 261.63, 311.13, 392.00, 440.00], bass: 51.91 }
    ];

    let chordIndex = 0;
    const scheduleNextChord = () => {
      const currentCtx = audioCtxRef.current;
      if (!enabled || !currentCtx || currentCtx.state === 'closed' || !masterGainRef.current) return;

      const now = currentCtx.currentTime;
      const chord = chordProgressions[chordIndex % chordProgressions.length];
      chordIndex++;

      const chordDuration = 7.5;
      chord.notes.forEach((freq, idx) => {
        try {
          const osc = currentCtx.createOscillator();
          const gainNode = currentCtx.createGain();
          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          osc.detune.setValueAtTime((Math.random() - 0.5) * 5, now);

          const peakGain = 0.035 / chord.notes.length;
          gainNode.gain.setValueAtTime(0.0001, now);
          gainNode.gain.linearRampToValueAtTime(peakGain, now + 2.2);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + chordDuration - 0.3);

          osc.connect(gainNode);
          gainNode.connect(masterGainRef.current!);
          osc.start(now);
          osc.stop(now + chordDuration);
          activeNodesRef.current.push({ osc, gain: gainNode });
        } catch (e) {}
      });

      chordTimerRef.current = window.setTimeout(scheduleNextChord, (chordDuration - 1.2) * 1000);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (!isLoopRunningRef.current) {
          isLoopRunningRef.current = true;
          scheduleNextChord();
        }
      }).catch(() => {});
    } else if (!isLoopRunningRef.current) {
      isLoopRunningRef.current = true;
      scheduleNextChord();
    }
  }, [useFallbackSynth, enabled, isPlayingMedia]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: -100,
        right: -100,
        width: 1,
        height: 1,
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity: 0,
        zIndex: -9999
      }}
      aria-hidden="true"
    >
      <div ref={containerRef} id="youtube-lofi-player" />
    </div>
  );
};
