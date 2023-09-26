import Image from 'next/image'
import { Inter } from 'next/font/google'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 mb-2">
      <div className="header items-center justify-between font-mono">
        <h1>Hi, I am Brooks Roley</h1>
        <p className="flex justify-center border-b border-gray-300 text-sm mb-2 mb-2">
          Check for a prime: &nbsp;
          <code className="font-mono font-bold w-6/12">/^1?$|^(11+?)\1+$/</code>
        </p>
      </div>

      <div className="grid text-center">
        <Link
          className="bg-blue-900 text-white m-4 p-4 rounded"
          href="https://github.com/brooksroley"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-2 text-2xl font-semibold`}>
            Github {' '} <span>-&gt;</span>
          </h2>
          <p className={`text-sm mb-2`}>
            Coding dreams into reality, one commit at a time! Explore my projects and contributions on GitHub. 💻✨
          </p>
          <Image
            src="/facebook.jpeg"
            alt="Facebook Offices"
            width={180}
            height={40}
            priority
          />
        </Link>

        <Link className="bg-blue-900 text-white m-4 p-4 rounded" href="/resume">
          <h2 className={`mb-2 text-2xl font-semibold`}>
            Resume{' '}<span>-&gt;</span>
          </h2>
          <p className={`text-sm mb-2`}>
            Download link for interested parties, plus a little fun.
          </p>
          <Image src="/coverphoto.jpeg" alt="Brooks Roley" width={100} height={24} />
        </Link>

        <Link
          href="https://lolchess.gg/profile/na/zerothot"
          className="bg-blue-900 m-4 text-white p-4 rounded"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-2 text-2xl font-semibold`}>
            Play{' '}
            <span className="inline-block">
              -&gt;
            </span>
          </h2>
          <p
            className={`text-sm mb-2`}
          >
            I am working on a game of Pente to play against an AI. I am still working on the AI so instead, here is a link my LolChess.
          </p>

          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/mountain.jpg"
              alt="Mountain in Japan"
              width={180}
              height={40}
              priority
            />
          </div>
        </Link>

        <Link
          href="https://www.linkedin.com/in/brooksroley/"
          className="bg-blue-900 m-4 text-white p-4 rounded"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-2 text-2xl font-semibold`}>
            Calendly{' '}
            <span className="inline-block transition-transform">
              -&gt;
            </span>
          </h2>
          <p
            className={`text-sm mb-2`}
          >
            Schedule a time on my calendar
          </p>

          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/water2.jpg"
              alt="Ocean waves in Japan"
              width={180}
              height={40}
              priority
            />
          </div>
        </Link>

        <Link
          href="https://www.cl-asi.org/easi"
          className="bg-blue-900 m-4 text-white p-4 rounded"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-2 text-2xl font-semibold`}>
            Sensory Integration with CLASI{' '}<span>-&gt;</span>
          </h2>
          <p
            className={`text-sm mb-2`}
          >
            Help childhood development and sensory integration by helping EASI. EASI is a non-profit organization that helps children with sensory integration issues.
          </p>

          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/lion.jpg"
              alt="Petting lion in South Africa"
              width={180}
              height={40}
              priority
            />
          </div>
        </Link>
        <Link className="bg-blue-900 text-white m-4 p-4 rounded" href="https://www.linkedin.com/in/brooksroley/">
          <h2 className={`mb-2 text-2xl font-semibold`}>
            LinkedIn{' '}<span>-&gt;</span>
          </h2>
          <p className={`text-sm mb-2`}>
            Unlocking professional potential and fostering meaningful connections. Let us connect on and make things happen! 🌟
          </p>
          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/water1.jpg"
              alt="Stairs to the Ocean in Japan"
              width={180}
              height={40}
              priority
            />
          </div>
        </Link>
        {/* <Link className="bg-blue-900 text-white m-4 p-4 rounded" href="/posts/first-post">First Post</Link> */}
        {/* <Link className="bg-blue-900 text-white m-4 p-4 rounded" href="/posts/post-form">Post Form</Link> */}
        <Link className="bg-blue-900 text-white m-4 p-4 rounded" href="/posts/pente">
          <h2 className='mb-2 text-2xl font-semibold'>
            Pente{' '}<span>-&gt;</span>
          </h2>
          <p className={`text-sm mb-2`}>
            A favorite strategy game I love to play. I am still working on the AI to play against so bear with me.
          </p>
          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/pente.jpg"
              alt="Pente Board"
              width={180}
              height={40}
              priority
            />
          </div>
        </Link>
      </div>
    </main>
  )
}
