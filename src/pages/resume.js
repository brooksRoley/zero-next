import React from 'react';
import Link from 'next/link'

const Resume = () => {
  return (
    <div className="h-max p-8 named-bg">
      <header>
        <h1>
          <Link href="./..">
            Back to a brief history of me
          </Link>
        </h1>
      </header>
      <div className="main-content py-4">
        <h2>Brooks Roley</h2>
        <p>Software Engineer</p>
        <p>brooksroley@gmail.com</p>
        <p>949-525-5124</p>
      </div>
      <div className="main-content py-4">
        <Link 
          href="/Brooks_Roley.pdf"
          download
          className="block text-blue-600 hover:text-blue-800"
        >
            Download Resume as PDF
        </Link>
          <Link 
            href="https://www.github.com/brooksroley/"
            className="block text-blue-600 hover:text-blue-800"
          >
              Link to Github
          </Link>
          <Link 
            href="https://www.github.com/brooksroley/zero-next"
            className="block text-blue-600 hover:text-blue-800"
          >
              Link to this repo
          </Link>
      </div>
    </div>
  );
};

export default Resume;
