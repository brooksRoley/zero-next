import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import LessonShell from 'src/components/go/lessons/LessonShell'
import StageVoid from 'src/components/go/lessons/StageVoid'
import StageBreath from 'src/components/go/lessons/StageBreath'
import StageSurvival from 'src/components/go/lessons/StageSurvival'
import StageExpansion from 'src/components/go/lessons/StageExpansion'

export async function getStaticPaths() {
  return {
    paths: ['0', '1', '2', '3', '4', '5'].map(stage => ({ params: { stage } })),
    fallback: false,
  }
}

export async function getStaticProps({ params }) {
  return { props: { stageParam: params.stage } }
}

const TOTAL_STAGES = 6

const STAGES = {
  0: {
    title: 'The Void',
    subtitle: 'Board, stones, intersections',
    Component: StageVoid,
  },
  1: {
    title: 'Breath',
    subtitle: 'Liberties, atari, capture',
    Component: StageBreath,
  },
  2: {
    title: 'Survival',
    subtitle: 'Eyes, two-eye life, vital point',
    Component: StageSurvival,
  },
  3: {
    title: 'Expansion',
    subtitle: 'Territory, corners vs center',
    Component: StageExpansion,
  },
}

export default function GoLessonPage({ stageParam }) {
  const router = useRouter()
  const stageNum = parseInt(stageParam, 10)

  if (!Number.isFinite(stageNum) || !STAGES[stageNum]) {
    return (
      <div className="min-h-screen bg-forest-950 text-white flex flex-col items-center justify-center gap-3 px-6">
        <Head><title>Stage not yet available | Brooks Roley</title></Head>
        <h1 className="text-xl font-semibold">This stage isn’t live yet</h1>
        <p className="text-sm text-forest-400 text-center max-w-md">
          Stages 4–5 (Combat and Flow) are on the roadmap but not built yet.
          Stages 0–3 are interactive today.
        </p>
        <Link
          href="/posts/go/learn"
          className="mt-2 px-4 py-2 rounded-md bg-candy-500/20 border border-candy-400/40 text-sm text-candy-100 hover:bg-candy-500/30 transition"
        >
          Back to lessons
        </Link>
      </div>
    )
  }

  const stage = STAGES[stageNum]
  const Component = stage.Component
  const next = STAGES[stageNum + 1]
    ? { href: `/posts/go/learn/${stageNum + 1}`, label: `Stage ${stageNum + 1}: ${STAGES[stageNum + 1].title}` }
    : { href: '/posts/go/learn', label: 'Back to lessons' }
  const prev = STAGES[stageNum - 1]
    ? { href: `/posts/go/learn/${stageNum - 1}`, label: `Stage ${stageNum - 1}: ${STAGES[stageNum - 1].title}` }
    : { href: '/posts/go/learn', label: 'Lessons' }

  return (
    <LessonShell
      stageNumber={stageNum}
      totalStages={TOTAL_STAGES}
      title={stage.title}
      subtitle={stage.subtitle}
      prev={prev}
      next={next}
    >
      <Head>
        <title>Stage {stageNum}: {stage.title} | Learn Go</title>
      </Head>
      <Component onAdvance={() => { router.push(next.href) }} />
    </LessonShell>
  )
}
