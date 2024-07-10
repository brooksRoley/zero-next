import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

const MarioButton = () => {
  const [animationClass, setAnimationClass] = useState('');
  const [jumpClass, setJumpClass] = useState('');
  const [showMushroom, setShowMushroom] = useState(false);

  const animationClasses = [
    'shake-button',
    'color-change-button',
    'rotate-button',
  ];

  const handleClick = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    const randomClass = animationClasses[Math.floor(Math.random() * animationClasses.length)];
    setAnimationClass(randomClass);

    setJumpClass('mario-jump');
    setTimeout(() => setJumpClass(''), 500);

    setShowMushroom(true);
    setTimeout(() => setShowMushroom(false), 1000);
  };

  return (
    <div className="relative">
      {showMushroom && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 animate-float">
          <span className="text-4xl">🍄</span>
        </div>
      )}
      <button
        onClick={handleClick}
        className={`relative flex border-solid items-center justify-center w-16 h-16 bg-yellow-500 border-4 border-black rounded-lg shadow-lg ${animationClass} ${jumpClass}`}
      >
        <span className="absolute text-4xl font-bold text-white select-none">?</span>
        <span className="absolute w-full h-full border-2 border-white rounded-lg animate-ping"></span>
      </button>
    </div>
  );
};

export default MarioButton;