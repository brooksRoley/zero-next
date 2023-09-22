import React, { useState } from 'react';

const Resume = () => {
  const [showVideo, setShowVideo] = useState(false);

  const playVideo = () => {
    setShowVideo(true);
  };

  const handleVideoEnd = () => {
    setShowVideo(false);
  };

  return (
    <div className="container">
      <header>
        <h1>My Resume</h1>
      </header>
      <div className="main-content">
        <h2>Brooks Roley</h2>
        <p>Software Engineer</p>
        <p>brooksroley@gmail.com</p>
        <p>949-525-5124</p>
        <p>
          <a href="/Brooks_Roley.pdf" download>Download Resume as PDF</a>
        </p>
        <p>
          <a href="https://www.github.com/brooksroley/">Link to Github</a>
        </p>
        <p>
          <a href="https://www.github.com/brooksroley/zero-next">Link to this repo</a>
        </p>


        {showVideo ? (
          <video controls autoPlay onEnded={handleVideoEnd}>
            <source src="/highkick.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <button onClick={playVideo}>High kick video for fun</button>
        )}
      </div>
    </div>
  );
};

export default Resume;
