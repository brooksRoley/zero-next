import React from 'react';
import Link from 'next/link'
import MarioButton from 'src/components/mario';

const Resume = () => {
  return (
    <div className="h-max p-8 named-bg text-center">
      <header>
        <Link href="/">
          A brief history of me
        </Link>
      </header>
      <div className="main-content py-4">
        <h1 className="text-2xl">Brooks Roley</h1>
        <h2 className="text-xl">
          <p>Software Engineer</p>
        </h2>
        <h3 className="text-lg">brooksroley@gmail.com</h3>
        <h4>949-525-5124</h4>
      </div>

      <div className="main-content">
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
            Link to Github:
        </Link>
        <Link 
          href="https://www.github.com/brooksroley/zero-next"
          className="block text-blue-600 hover:text-blue-800"
        >
            Link to this repo
        </Link>

        <div className="flex justify-center mt-4"><MarioButton /></div>
      </div>
    </div>
  );
};

export default Resume;
