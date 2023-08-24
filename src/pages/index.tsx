import Image from 'next/image'
import { Inter } from 'next/font/google'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">

      <div className="header w-full items-center justify-between font-mono text-sm">
        <h1>Hi, I am Brooks Roley</h1>
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 ">
          Want to check for a prime?&nbsp;
          <code className="font-mono font-bold">/^1?$|^(11+?)\1+$/</code>
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center">
          <Link
            className="fixed right-0 top-0"
            href="https://github.com/brooksroley"
            target="_blank"
            rel="noopener noreferrer"
          >
            Want to get to my Github? {' '}
            <Image
              src="/facebook.jpeg"
              alt="Facebook Offices - Zero"
              className="dark:invert"
              width={100}
              height={24}
              priority
            />
          </Link>
        </div>
      </div>

      <div className="mb-32 grid text-center lg:mb-0 lg:grid-cols-4 lg:text-left">
        <Link
          href="https://zero-chat-nine.vercel.app/"
          className=""
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`${inter.className} text-2xl font-semibold`}>
            Chat{' '}
            <span className="">
              -&gt;
            </span>
          </h2>
          <p
            className={`${inter.className} text-sm opacity-50`}
          >
            Check out my chat application :D. Learn about me by asking my chat bot what you would like to know and how to schedule for me and I will get back to you. Bear with me as I improve the accuracy.
          </p>
          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/water1.jpg"
              alt="Next.js Logo"
              width={180}
              height={37}
              priority
            />
          </div>
        </Link>

        <a
          href="https://www.cl-asi.org/easi"
          className=""
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`${inter.className} mb-3 text-2xl font-semibold`}>
            Learn{' '}
            <span className="">
              -&gt;
            </span>
          </h2>
          <p
            className={`${inter.className} text-sm opacity-50`}
          >
            Help childhood development and sensory integration by helping EASI. EASI is a non-profit organization that helps children with sensory integration issues.
          </p>

          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/lion.jpg"
              alt="Petting lion in South Africa"
              width={180}
              height={37}
              priority
            />
          </div>
        </a>

        <Link
          href="https://lolchess.gg/profile/na/zero400"
          className=""
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`${inter.className} mb-3 text-2xl font-semibold`}>
            Play{' '}
            <span className="inline-block">
              -&gt;
            </span>
          </h2>
          <p
            className={`${inter.className} text-sm`}
          >
            Play a game of Pente against an AI. I am still working on the AI so it is not the best yet.
          </p>

          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/mountain.jpg"
              alt="Mountain in Japan"
              width={180}
              height={37}
              priority
            />
          </div>
        </Link>

        <Link
          href="https://www.linkedin.com/in/brooksroley/"
          className=""
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`${inter.className} mb-3 text-2xl font-semibold`}>
            Contact{' '}
            <span className="inline-block transition-transform">
              -&gt;
            </span>
          </h2>
          <p
            className={`${inter.className} text-sm opacity-50`}
          >
            Here is the best way to get ahold of me and schedule a time to chat.
          </p>

          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/water2.jpg"
              alt="Ocean waves in Japan"
              width={180}
              height={37}
              priority
            />
          </div>
        </Link>
      </div>

      <p>
        Here we have a little list of experimental pages. Call them a work in progress.
      </p>
      <p>
        <Link href="/posts/first-post">First Post</Link>
      </p>
      <p>
        <Link href="/resume">Resume Uploaded with S3.</Link>
      </p>
      <p>
        <Link href="/posts/post-form">Post Form</Link>
      </p>
    </main>
  )
}
