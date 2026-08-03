import { useRef } from 'react';

const PAUSE_BEFORE_REPLAY_MS = 5000;

export default function VideoHeroBg() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleEnded = () => {
    setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = 0;
      video.play();
    }, PAUSE_BEFORE_REPLAY_MS);
  };

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <video
        ref={videoRef}
        src="/hero-video.mp4"
        autoPlay
        muted
        playsInline
        onEnded={handleEnded}
        className="w-full h-full object-cover"
      />
      {/* Teal wash under the navbar, echoing the original hero treatment */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-transparent to-transparent" />
      {/* Scrim so the navy hero copy stays legible over the video */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/65 to-background" />
    </div>
  );
}
