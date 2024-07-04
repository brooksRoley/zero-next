import Image from 'next/image'
import { Inter } from 'next/font/google'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 mb-2">
      <div className="header items-center justify-between font-mono">
        <h1>Hi, my name is Brooks Roley.</h1>

        <p className="flex justify-center border-b border-gray-300 text-sm mb-2 mb-2">
          Check for a prime: &nbsp;
          <code className="font-mono font-bold w-6/12">/^1?$|^(11+?)\1+$/</code>
        </p>
      </div>
      <div className="grid md:grid-cols-2 text-center">
        <Link className="bg-blue-900 bg-opacity-70 hover:bg-opacity-90 text-white m-4 p-4 rounded" href="/resume">
          <h2 className={`mb-2 text-2xl font-semibold`}>
            Resume{' '}<span>-&gt;</span>
          </h2>
          <p className="text-sm mb-2">
            Here is a download link for some of my experiences. &#128214; &#x1F4D6;
          </p>
          <Image src="/cover.png" alt="Brooks Roley" width={200} height={100} />
        </Link>

        <Link className="bg-blue-900 bg-opacity-70 hover:bg-opacity-90 text-white m-4 p-4 rounded" href="https://www.linkedin.com/in/brooksroley/">
          <h2 className={`mb-2 text-2xl font-semibold`}>
            LinkedIn{' '}<span>-&gt;</span>
          </h2>
          <p className={`text-sm mb-2`}>
            Unlocking professional potential and fostering meaningful connections. Let us connect on and make things happen! 🌟
          </p>
          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/BRBaller.png"
              alt="Baller Logo: Brooks Roley"
              width={200}
              height={120}
              priority
            />
          </div>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 text-center">
        <Link
          className="bg-blue-900 bg-opacity-70 hover:bg-opacity-90 text-white m-4 p-4 rounded"
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
            height={60}
            priority
          />
        </Link>

        <Link
          href="https://calendly.com/brooksroley/"
          className="bg-blue-900 bg-opacity-70 hover:bg-opacity-90 m-4 text-white p-4 rounded"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h2 className={`mb-2 text-2xl font-semibold`}>
            Calendly{' '}
            <span className="inline-block transition-transform">-&gt;</span>
          </h2>
          <p
            className={`text-sm mb-2`}
          >
            Schedule a time on my calendar &#128197; &#x1F4C5;
          </p>

          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/BRMinimalist.png"
              alt="Design Icon BR"
              width={180}
              height={60}
              priority
            />
          </div>
        </Link>

        <Link className="bg-blue-900 bg-opacity-70 hover:bg-opacity-90 text-white m-4 p-4 rounded" href="/posts/first-post">
          <h2 className={`mb-2 text-2xl`}>
            Blog in progress <span className="inline-block transition-transform">-&gt;</span>
          </h2>
          <p className={`text-sm mb-2`}>
            A way to organize my thoughts and data and posts. Stay tuned for an interactive message wall.
          </p>
          <Image
            className="relative"
            src="/marathon.png"
            alt="Ball Logo"
            width={180}
            height={60}
            priority
          />
        </Link>
        
        {/* <Link
          href="https://www.cl-asi.org/easi"
          className="bg-blue-900 bg-opacity-70 hover:bg-opacity-90 m-4 text-white p-4 rounded"
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
              height={60}
              priority
            />
          </div>
        </Link> */}

        {/* <Link className="bg-blue-900 bg-opacity-70 hover:bg-opacity-90 text-white m-4 p-4 rounded" href="/posts/pente">
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
              height={60}
              priority
            />
          </div>
        </Link>

        <Link className="bg-blue-900 bg-opacity-70 hover:bg-opacity-90 text-white m-4 p-4 rounded" href="/posts/post-form">Post Form</Link>

        <Link
          href="https://lolchess.gg/profile/na/zero400"
          className="bg-blue-900 bg-opacity-70 hover:bg-opacity-90 m-4 text-white p-4 rounded"
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
            I love a sense of competition and sharing my passions. Here is a link my LolChess which breaks down my pursuit of perfecting strategy in the game Teamfight Tactics.
          </p>

          <div className="relative flex place-items-center">
            <Image
              className="relative"
              src="/mountain.jpg"
              alt="Mountain in Japan"
              width={180}
              height={60}
              priority
            />
          </div>
        </Link> */}
      </div>
    </main>
  )
}
