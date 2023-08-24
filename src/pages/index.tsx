import Image from 'next/image'
import { Inter } from 'next/font/google'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 mb-2">
      <div className="header items-center justify-between font-mono">
        <h1>Hi, I am Brooks Roley</h1>
        <p className="flex justify-center border-b border-gray-300 text-sm mb-2">
          Check for a prime: &nbsp;
          <code className="font-mono font-bold">/^1?$|^(11+?)\1+$/</code>
        </p>
        <div className="flex">
          <Link
            className="bg-blue-900 w-full text-white p-2 rounded"
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

      <div className="grid text-center">
        <Link
          href="https://zero-chat-nine.vercel.app/"
          className="bg-blue-900 m-4 text-white p-2 rounded"
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
            className={`${inter.className} text-sm`}
          >
            Check out my chat application :D. Learn about me by asking my chat bot what you would like to know and how to schedule for me and I will get back to you. Bear with me as I improve the accuracy.
          </p>
          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/water1.jpg"
              alt="Stairs to the Ocean in Japan"
              width={180}
              height={37}
              priority
            />
          </div>
        </Link>

        <Link
          href="https://www.cl-asi.org/easi"
          className="bg-blue-900 m-4 text-white p-2 rounded"
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
            className={`${inter.className} text-sm`}
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
        </Link>

        <Link
          href="https://lolchess.gg/profile/na/zero400"
          className="bg-blue-900 m-4 text-white p-2 rounded"
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
          className="bg-blue-900 m-4 text-white p-2 rounded"
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
            className={`${inter.className} text-sm`}
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
        <Link className="bg-blue-900 text-white m-4 p-2 rounded" href="/posts/first-post">First Post</Link>
        <Link className="bg-blue-900 text-white m-4 p-2 rounded" href="/resume">Resume Uploaded with S3.</Link>
        <Link className="bg-blue-900 text-white m-4 p-2 rounded" href="/posts/post-form">Post Form</Link>
      </div>
    </main>
  )
}
