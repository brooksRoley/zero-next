import React from 'react';
import Head from 'next/head';
import Link from 'next/link'
import MarioButton from 'src/components/mario';
import Reveal from 'src/components/Reveal';

const Resume = () => {
  return (
    <div className="relative min-h-screen cover-photo">
      <Head>
        <title>Resume | Brooks Roley</title>
        <meta property="og:title" content="Resume | Brooks Roley" />
      </Head>
      <div className="absolute inset-0 bg-forest-950/50" />
      <div className="relative max-w-2xl mx-auto px-4 py-10 sm:py-16 flex flex-col items-center gap-6 sm:gap-8">
        {/* Identity card */}
        <Reveal>
          <div className="w-full rounded-2xl bg-forest-900/85 backdrop-blur-md shadow-xl border border-forest-700/40 p-6 sm:p-8 text-center">
            <p className="text-xs sm:text-sm uppercase tracking-widest text-white mb-3">A brief history of me</p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Brooks Roley</h1>
            <p className="text-lg text-candy-400 font-medium mt-1">Software Engineer</p>
            <p className="text-sm text-forest-300 mt-3">brooksroley@gmail.com</p>
          </div>
        </Reveal>

        {/* Action cards */}
        <Reveal delay={150}>
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/Brooks_Roley.pdf"
              download
              className="group flex items-center justify-center gap-2 rounded-xl bg-forest-900/85 backdrop-blur-md shadow-md border border-forest-700/40 px-4 py-3 text-sm font-medium text-forest-100 hover:text-candy-300 hover:border-candy-400/40 hover:shadow-lg hover:shadow-candy-400/5 transition-all duration-300"
            >
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Resume PDF
            </Link>
            <Link
              href="https://www.github.com/brooksroley/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-2 rounded-xl bg-forest-900/85 backdrop-blur-md shadow-md border border-forest-700/40 px-4 py-3 text-sm font-medium text-forest-100 hover:text-candy-300 hover:border-candy-400/40 hover:shadow-lg hover:shadow-candy-400/5 transition-all duration-300"
            >
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              GitHub
            </Link>
            <Link
              href="https://www.github.com/brooksroley/zero-next"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-2 rounded-xl bg-forest-900/85 backdrop-blur-md shadow-md border border-forest-700/40 px-4 py-3 text-sm font-medium text-forest-100 hover:text-candy-300 hover:border-candy-400/40 hover:shadow-lg hover:shadow-candy-400/5 transition-all duration-300"
            >
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              Source Code
            </Link>
          </div>
        </Reveal>

        {/* Mario easter egg */}
        <Reveal delay={300}>
          <div className="flex flex-col items-center gap-2">
            <MarioButton />
            <p className="text-xs text-forest-300/50">Try me</p>
          </div>
        </Reveal>
      </div>
    </div>
  );
};

export default Resume;
