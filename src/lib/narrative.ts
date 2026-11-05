// The career story the Work page tells (2026-11-05). One thread runs through
// the work: interactive software, and the systems that keep it reliable.
//
// Keep it true. Every clause maps to src/lib/resume.ts:
//   product interfaces in healthcare, finance, insurance and e-commerce → Zipongo, SigFig, Limelight, Grove
//   on-call tooling at Zoox                                          → Zoox (SRE OnCall system)
//   games with real engines                                          → Hardwood (C++ to WebAssembly)
//   AI coding agents under tests and review                          → Independent, AI_NOTE
// Zoox is a robotics company, but the work there was SRE tooling. Do not claim
// computer vision, perception, robotics engineering or "multi-agent
// orchestration": none is on the resume, and narrative.test.ts fails if one appears.

export const WORK_THESIS = 'I build interactive software and the systems that keep it reliable.'

export const WORK_INTRO =
  'Ten years shipping product interfaces in healthcare, finance, insurance and e-commerce, ' +
  'on-call tooling at Zoox, and games with real engines underneath. ' +
  'This past year I have been building with AI coding agents: a scheduled agent opens pull requests, ' +
  'tests run on each one, and I review every change before I merge it.'

export const WORK_DESCRIPTION =
  'Brooks Roley, software engineer: interactive software and the systems that keep it reliable, ' +
  'across healthcare, finance, e-commerce and on-call tooling at Zoox.'
