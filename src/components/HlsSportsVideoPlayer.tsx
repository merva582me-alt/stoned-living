import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  ShieldCheck,
  RotateCw,
  AlertTriangle,
} from 'lucide-react';

interface HlsSportsVideoPlayerProps {
  streamUrl: string;
  title: string;
  posterUrl?: string | null;
  onPlaybackError?: (error: string) => void;
  onSwitchToEmbed?: () => void;
}

interface QualityLevel {
  id: number;
  label: string;
  bitrate?: number;
}

export const HlsSportsVideoPlayer: React.FC<HlsSportsVideoPlayerProps> = ({
  streamUrl,
  title,
  posterUrl,
  onPlaybackError,
  onSwitchToEmbed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLiveEdge, setIsLiveEdge] = useState(true);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after inactivity (longer timer for touchscreens)
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowQualityMenu(false);
      }
    }, 4000);
  }, [isPlaying]);

  // Setup Hls.js stream player with cross-device acceleration
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setPlaybackError(null);
    setIsBuffering(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });

      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsBuffering(false);
        const parsedLevels: QualityLevel[] = [
          { id: -1, label: 'Auto' },
          ...data.levels.map((lvl, idx) => ({
            id: idx,
            label: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
            bitrate: lvl.bitrate,
          })),
        ];
        setLevels(parsedLevels);

        video.play().catch(() => {
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(hls.autoLevelEnabled ? -1 : data.level);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[HlsSportsVideoPlayer] Network error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[HlsSportsVideoPlayer] Media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[HlsSportsVideoPlayer] Fatal error:', data.details);
              setPlaybackError('Stream transmission interrupted. Tap below to retry or switch feed.');
              if (onPlaybackError) onPlaybackError(data.details);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native iOS / iPadOS Safari HLS engine
      video.src = streamUrl;
      const onLoadedMetadata = () => {
        setIsBuffering(false);
        video.play().catch(() => setIsPlaying(false));
      };
      const onError = () => {
        setPlaybackError('Native player encountered an error loading HLS stream.');
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('error', onError);

      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('error', onError);
      };
    } else {
      setPlaybackError('HLS playback is not supported by your browser.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, onPlaybackError]);

  // Video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onTimeUpdate = () => {
      if (video.seekable && video.seekable.length > 0) {
        const liveEdge = video.seekable.end(video.seekable.length - 1);
        setIsLiveEdge(Math.abs(liveEdge - video.currentTime) < 15);
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, []);

  // Track Fullscreen changes (standard + webkit)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Desktop keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const video = videoRef.current;
      if (!video) return;

      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        changeVolume(Math.min(1, volume + 0.1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        changeVolume(Math.max(0, volume - 0.1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
    resetControlsTimeout();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    resetControlsTimeout();
  };

  const changeVolume = (val: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    setVolume(val);
    if (val === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
    resetControlsTimeout();
  };

  const jumpToLiveEdge = () => {
    const video = videoRef.current;
    if (!video || !video.seekable || video.seekable.length === 0) return;
    const end = video.seekable.end(video.seekable.length - 1);
    video.currentTime = Math.max(0, end - 2);
    setIsLiveEdge(true);
    resetControlsTimeout();
  };

  // Cross-device Fullscreen: supports Container API & iOS Safari webkitEnterFullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    } else if (container.requestFullscreen) {
      container.requestFullscreen().catch(console.error);
    } else if ((video as unknown as { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
      (video as unknown as { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
    }
    resetControlsTimeout();
  };

  const selectQuality = (levelId: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelId;
    setCurrentLevel(levelId);
    setShowQualityMenu(false);
    resetControlsTimeout();
  };

  const retryPlayback = () => {
    if (hlsRef.current) {
      hlsRef.current.loadSource(streamUrl);
      hlsRef.current.startLoad();
      setPlaybackError(null);
      setIsBuffering(true);
    } else if (videoRef.current) {
      videoRef.current.src = streamUrl;
      videoRef.current.load();
      videoRef.current.play().catch(console.error);
      setPlaybackError(null);
      setIsBuffering(true);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onClick={() => {
        // Tap to toggle controls on mobile screens
        setShowControls((prev) => !prev);
        resetControlsTimeout();
      }}
      className="relative w-full h-full bg-black select-none flex items-center justify-center overflow-hidden group touch-manipulation"
    >
      {/* Background Poster Blur when buffering */}
      {posterUrl && isBuffering && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 pointer-events-none scale-105"
          style={{ backgroundImage: `url('${posterUrl}')` }}
        />
      )}

      {/* Universal HTML5 Video Tag with iOS Inline Attributes */}
      <video
        ref={videoRef}
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        className="w-full h-full object-contain cursor-pointer"
        poster={posterUrl || undefined}
      />

      {/* Zero Ads Verified Badge (Top Left Overlay) */}
      <div
        className={`absolute top-3 left-3 sm:top-4 sm:left-4 z-20 transition-opacity duration-300 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-emerald-500/35 text-emerald-400 text-[10px] sm:text-xs font-mono font-semibold shadow-lg ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="hidden xs:inline">Ad-Stripped HLS Stream</span>
        <span className="xs:hidden">HLS Direct</span>
      </div>

      {/* Buffering Spinner */}
      {isBuffering && !playbackError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none">
          <div className="w-12 h-12 rounded-full border-3 border-emerald-500/20 border-t-emerald-400 animate-spin shadow-[0_0_20px_rgba(16,185,129,0.3)] mb-3" />
          <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">
            BUFFERING LIVE HLS FEED...
          </span>
        </div>
      )}

      {/* Playback Error Overlay */}
      {playbackError && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center max-w-md mx-auto"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1.5 font-mono">
            HLS FEED INTERRUPTED
          </h3>
          <p className="text-xs text-zinc-400 mb-5 font-mono leading-relaxed">
            {playbackError}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={retryPlayback}
              className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.35)]"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Stream</span>
            </button>
            {onSwitchToEmbed && (
              <button
                onClick={onSwitchToEmbed}
                className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer border border-zinc-700"
              >
                <span>Switch to Embed Mirror</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Modern Touch-Friendly Player Control Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 z-20 p-2.5 sm:p-5 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between gap-2 sm:gap-3 max-w-5xl mx-auto bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 rounded-2xl px-2.5 py-2 sm:px-4 sm:py-2.5 shadow-2xl">
          {/* Left Controls: Play/Pause, Live Edge Sync, Volume */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={togglePlay}
              className="w-9 h-9 sm:w-10 sm:h-10 min-w-[36px] min-h-[36px] rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black flex items-center justify-center transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.35)] shrink-0"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-black" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-black ml-0.5" />}
            </button>

            {/* Live Edge Sync Badge Button */}
            <button
              onClick={jumpToLiveEdge}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                isLiveEdge
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
              }`}
              title="Click to jump to live broadcast edge"
            >
              <span className={`w-2 h-2 rounded-full ${isLiveEdge ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider">LIVE</span>
            </button>

            {/* Volume Control */}
            <div className="hidden xs:flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="w-8 h-8 min-h-[36px] min-w-[36px] rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition cursor-pointer border border-zinc-800"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                className="w-14 sm:w-20 accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>
          </div>

          {/* Right Controls: Quality Selector, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Mobile Mute Toggle (visible when slider is hidden) */}
            <button
              onClick={toggleMute}
              className="xs:hidden w-8 h-8 min-h-[36px] min-w-[36px] rounded-xl bg-zinc-900/80 text-zinc-300 flex items-center justify-center border border-zinc-800"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Quality Selector Dropdown */}
            {levels.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-mono transition cursor-pointer"
                  title="Stream Quality"
                >
                  <Settings className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-semibold">
                    {currentLevel === -1
                      ? 'Auto'
                      : levels.find((l) => l.id === currentLevel)?.label || 'Quality'}
                  </span>
                </button>

                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-36 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl overflow-hidden py-1 z-30">
                    <div className="px-3 py-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                      Quality
                    </div>
                    {levels.map((lvl) => {
                      const isSelected = currentLevel === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          onClick={() => selectQuality(lvl.id)}
                          className={`w-full text-left px-3 py-2 text-xs font-mono flex items-center justify-between hover:bg-zinc-800 transition cursor-pointer ${
                            isSelected ? 'text-emerald-400 font-bold bg-emerald-950/30' : 'text-zinc-300'
                          }`}
                        >
                          <span>{lvl.label}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 sm:w-10 sm:h-10 min-w-[36px] min-h-[36px] rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center transition cursor-pointer border border-zinc-800"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
