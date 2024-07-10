import React from 'react';
import Link from 'next/link';

const ScoreBoard = ({ blackScore, whiteScore, blackCaptures, whiteCaptures }) => {
  return (
    <div className="score-board">
      <div className="mb-10">
        <h2 className="mb-5">Score</h2>
        <p>Black: {blackScore}</p>
        <p>White: {whiteScore}</p>
      </div>
      <div className="mb-10">
        <h2 className="mb-5">Captures</h2>
        <p>Black: {blackCaptures}</p>
        <p>White: {whiteCaptures}</p>
      </div>

      <Link
        href="/"
      >
        Back to home
      </Link>
    </div>
  );
};

export default ScoreBoard;