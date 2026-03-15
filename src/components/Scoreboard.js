import React from 'react';

const BLACK = 1;

const ScoreBoard = ({ blackScore, whiteScore, blackCaptures, whiteCaptures, currentPlayer }) => {
  const isBlackTurn = currentPlayer === BLACK;

  return (
    <div className="rounded-xl bg-forest-900/80 backdrop-blur-sm shadow-lg border border-forest-700/40 p-4 sm:p-5 w-full md:w-56">
      <div className="flex md:flex-col gap-4 sm:gap-0">
        {/* Score */}
        <div className="flex-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-forest-400 mb-3 sm:mb-4">Score</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:mb-6">
            <div className={`rounded-lg bg-forest-950 text-white p-2 sm:p-3 text-center transition-all duration-300 ${
              isBlackTurn
                ? 'border-2 border-candy-400/50 shadow-md shadow-candy-400/10'
                : 'border border-forest-700/30'
            }`}>
              <p className="text-xl sm:text-2xl font-bold">{blackScore}</p>
              <p className="text-xs text-forest-400 mt-1 flex items-center justify-center gap-1">
                {isBlackTurn && <span className="w-1.5 h-1.5 rounded-full bg-candy-400 inline-block" />}
                Black
              </p>
            </div>
            <div className={`rounded-lg bg-forest-100 p-2 sm:p-3 text-center transition-all duration-300 ${
              !isBlackTurn
                ? 'border-2 border-candy-400/50 shadow-md shadow-candy-400/10'
                : 'border border-forest-200'
            }`}>
              <p className="text-xl sm:text-2xl font-bold text-forest-900">{whiteScore}</p>
              <p className="text-xs text-forest-500 mt-1 flex items-center justify-center gap-1">
                {!isBlackTurn && <span className="w-1.5 h-1.5 rounded-full bg-candy-400 inline-block" />}
                White
              </p>
            </div>
          </div>
        </div>

        {/* Captures */}
        <div className="flex-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-forest-400 mb-3 sm:mb-4">Captures</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className={`rounded-lg bg-forest-950 text-white p-2 sm:p-3 text-center transition-all duration-300 ${
              isBlackTurn
                ? 'border-2 border-candy-400/50 shadow-md shadow-candy-400/10'
                : 'border border-forest-700/30'
            }`}>
              <p className="text-xl sm:text-2xl font-bold">{blackCaptures}<span className="text-xs sm:text-sm text-candy-400">/5</span></p>
              <p className="text-xs text-forest-400 mt-1">Black</p>
            </div>
            <div className={`rounded-lg bg-forest-100 p-2 sm:p-3 text-center transition-all duration-300 ${
              !isBlackTurn
                ? 'border-2 border-candy-400/50 shadow-md shadow-candy-400/10'
                : 'border border-forest-200'
            }`}>
              <p className="text-xl sm:text-2xl font-bold text-forest-900">{whiteCaptures}<span className="text-xs sm:text-sm text-candy-600">/5</span></p>
              <p className="text-xs text-forest-500 mt-1">White</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreBoard;
