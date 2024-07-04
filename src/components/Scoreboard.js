import React from 'react';

const ScoreBoard = ({ blackScore, whiteScore, blackCaptures, whiteCaptures }) => {
  return (
    <div className="score-board">
      <div className="score-section">
        <h2>Score</h2>
        <p>Black: {blackScore}</p>
        <p>White: {whiteScore}</p>
      </div>
      <div className="score-section">
        <h2>Captures</h2>
        <p>Black: {blackCaptures}</p>
        <p>White: {whiteCaptures}</p>
      </div>
    </div>
  );
};

export default ScoreBoard;