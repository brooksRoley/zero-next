import React, { useState } from 'react';
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
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#ff69b4', '#40916c', '#ffb8d9', '#6abf82', '#ff8cc2'],
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
        className={`relative flex border-solid items-center justify-center w-16 h-16 bg-gradient-to-br from-candy-400 to-candy-500 border-4 border-forest-600 rounded-lg shadow-lg hover:shadow-candy-400/30 hover:shadow-xl transition-shadow duration-300 ${animationClass} ${jumpClass}`}
      >
        <span className="absolute text-4xl font-bold text-white select-none drop-shadow-md">?</span>
        <span className="absolute w-full h-full border-2 border-candy-200/50 rounded-lg animate-ping"></span>
      </button>
    </div>
  );
};

export default MarioButton;
