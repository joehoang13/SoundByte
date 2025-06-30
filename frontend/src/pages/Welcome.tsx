import React, { useEffect, useRef } from 'react';
import { Howl } from 'howler';

const CLOUDINARY_URL =
  'https://res.cloudinary.com/dqyszqny2/video/upload/v1751056497/sample_end8r3.ogg';

const Welcome = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  const soundRef = useRef<Howl | null>(null);
  const sourceRef = useRef<AudioNode | null>(null);
  const [isPaused, setIsPaused] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);

  const handlePauseResume = () => {
    if (!soundRef.current) return;

    if (isPaused) {
      soundRef.current.play();
      setIsPaused(false);
    } else {
      soundRef.current.pause();
      setIsPaused(true);
    }
  };

  const initAudio = () => {
    if (soundRef.current) return;

    const sound = new Howl({
      src: [CLOUDINARY_URL],
      volume: 1.0,
      onplay: () => setupAnalyser(),
    });

    soundRef.current = sound;
    sound.play();
    sound.once('load', () => {
      setDuration(sound.duration());
    });
  };

  const setupAnalyser = () => {
    const ctx = Howler.ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    const rawSound = (soundRef.current as any)?._sounds?.[0];
    const srcNode = rawSound?._node?.bufferSource;

    if (srcNode) {
      srcNode.connect(analyser);
      analyser.connect(ctx.destination); // optional
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    draw();
  };

  const draw = () => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const drawLoop = () => {
      if (!ctx || !analyser) return;

      analyser.getByteFrequencyData(dataArray); // <--- frequency instead of time-domain

      ctx.fillStyle = '#111827'; // background
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const barWidth = (WIDTH / dataArray.length) * 2.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * HEIGHT;

        ctx.fillStyle = '#3b82f6'; // blue bars
        ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(drawLoop);
    };

    drawLoop();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (soundRef.current?.playing()) {
        setCurrentTime(soundRef.current.seek() as number);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-4">Welcome to SoundByte</h1>
      <p className="mb-4">Click below to play audio and see the frequency visualizer!</p>
      <div className="flex gap-4 mb-6">
        <button onClick={initAudio} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded">
          Play
        </button>
        <button
          onClick={handlePauseResume}
          className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 rounded"
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={() => {
            soundRef.current?.stop();
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            setIsPaused(false);
            setCurrentTime(0);
          }}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded"
        >
          Stop
        </button>
      </div>

      {/* Scrubber bar */}
      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={currentTime}
        onChange={e => {
          const seekTime = parseFloat(e.target.value);
          soundRef.current?.seek(seekTime);
          setCurrentTime(seekTime);

          // Howler rebuilds the audio node after seeking, so we reconnect analyser
          const isPlaying = soundRef.current?.playing();
          if (isPlaying) {
            cancelAnimationFrame(animationRef.current as number);
            animationRef.current = null;
            setupAnalyser(); // this will reconnect the audio node to analyser + restart draw loop
          }
        }}
        className="w-full max-w-md mb-6"
      />
      <canvas ref={canvasRef} width={600} height={150} className="border border-white rounded" />
    </div>
  );
};

export default Welcome;
