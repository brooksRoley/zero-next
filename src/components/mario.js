import React from 'react';
import confetti from 'canvas-confetti';

const MarioButton = () => {
  const handleClick = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  return (
    <button
      onClick={handleClick}
      className="relative flex border-solid items-center justify-center w-16 h-16 bg-yellow-500 border-4 border-black rounded-lg shadow-lg"
    >
      <span className="absolute text-4xl font-bold text-white select-none">?</span>
      <span className="absolute w-full h-full border-2 border-white rounded-lg animate-ping"></span>
    </button>
  );
};

export default MarioButton;
