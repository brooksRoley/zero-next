import React, { useState } from 'react';
import Image from 'next/image';
import confetti from 'canvas-confetti';

// The resume's easter egg: the site's own basketball mascot (public/BRBaller.png)
// bounces and throws confetti in the mascot's colours. It replaced a "?" block
// borrowed from a game franchise (2026-11-03): every image here is Brooks's own.
const COLORS = ['#F15A29', '#FFC250', '#5A1F0F', '#FCE3B0', '#E9E3D6'];
const MOVES = ['shake-button', 'color-change-button', 'rotate-button'];

const BallButton = () => {
  const [move, setMove] = useState('');
  const [bounce, setBounce] = useState('');

  const handleClick = () => {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: COLORS });
    setMove(MOVES[Math.floor(Math.random() * MOVES.length)]);
    setBounce('ball-bounce');
    setTimeout(() => setBounce(''), 500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Bounce the ball"
      className={`relative h-20 w-20 rounded-full transition-shadow duration-300 hover:shadow-xl hover:shadow-brass-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 ${move} ${bounce}`}
    >
      <Image
        src="/BRBaller.png"
        alt=""
        width={80}
        height={80}
        className="h-20 w-20 rounded-full object-cover select-none"
        draggable={false}
      />
      <span className="absolute inset-0 rounded-full border-2 border-brass-200/50 animate-ping" aria-hidden />
    </button>
  );
};

export default BallButton;
