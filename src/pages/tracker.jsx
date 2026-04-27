import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import * as Chart from 'chart.js'
import PreText from 'src/components/PreText'

Chart.Chart.register(
  Chart.ArcElement, Chart.BarElement, Chart.LineElement, Chart.PointElement,
  Chart.RadarController, Chart.BarController, Chart.DoughnutController, Chart.LineController,
  Chart.RadialLinearScale, Chart.CategoryScale, Chart.LinearScale,
  Chart.Tooltip, Chart.Legend, Chart.Filler
)

// ─────────────────────────────────────────────────────────────────────────────
// SKILLS & LEARNING DATA
// ─────────────────────────────────────────────────────────────────────────────

const EXAM_DOMAINS = [
  {
    id: 'd1', name: 'Foundation Model Integration', weight: 31, color: '#3b82f6',
    topics: [
      { id: 'd1t1', name: 'Select & configure FMs for business use cases', keywords: ['Amazon Bedrock', 'foundation models', 'model selection', 'inference parameters'] },
      { id: 'd1t2', name: 'RAG architectures & vector stores', keywords: ['RAG', 'vector databases', 'OpenSearch', 'embeddings', 'chunking', 'knowledge bases'] },
      { id: 'd1t3', name: 'Data management & compliance for GenAI', keywords: ['data pipelines', 'S3', 'compliance', 'PII', 'data governance'] },
      { id: 'd1t4', name: 'Prompt engineering & management', keywords: ['prompt engineering', 'prompt templates', 'few-shot', 'chain-of-thought'] },
      { id: 'd1t5', name: 'Dynamic model selection & provider switching', keywords: ['Lambda', 'API Gateway', 'AppConfig', 'model routing'] },
    ]
  },
  {
    id: 'd2', name: 'Implementation & Integration', weight: 26, color: '#22c55e',
    topics: [
      { id: 'd2t1', name: 'Build & deploy GenAI applications', keywords: ['Bedrock Agents', 'Lambda', 'Step Functions', 'API Gateway'] },
      { id: 'd2t2', name: 'Agentic workflows & multi-agent systems', keywords: ['agentic AI', 'Bedrock Agents', 'AgentCore', 'orchestration', 'tool use'] },
      { id: 'd2t3', name: 'Streaming & real-time FM responses', keywords: ['WebSockets', 'server-sent events', 'streaming', 'chunked transfer'] },
      { id: 'd2t4', name: 'FM API interfaces & integration patterns', keywords: ['API Gateway', 'token management', 'retry strategies', 'rate limiting'] },
      { id: 'd2t5', name: 'Development tools (Amazon Q Developer)', keywords: ['Amazon Q', 'code generation', 'refactoring', 'debugging'] },
    ]
  },
  {
    id: 'd3', name: 'AI Safety & Governance', weight: 20, color: '#f59e0b',
    topics: [
      { id: 'd3t1', name: 'Input/output safety controls & guardrails', keywords: ['Bedrock guardrails', 'content filtering', 'moderation', 'prompt injection'] },
      { id: 'd3t2', name: 'Data privacy & encryption for FM workloads', keywords: ['KMS', 'encryption', 'VPC', 'PrivateLink', 'data privacy'] },
      { id: 'd3t3', name: 'IAM policies for GenAI services', keywords: ['IAM', 'least privilege', 'service roles', 'cross-account'] },
      { id: 'd3t4', name: 'Responsible AI & bias mitigation', keywords: ['responsible AI', 'bias', 'fairness', 'transparency', 'model cards'] },
    ]
  },
  {
    id: 'd4', name: 'Operational Efficiency', weight: 12, color: '#a78bfa',
    topics: [
      { id: 'd4t1', name: 'Cost optimization for FM workloads', keywords: ['cost optimization', 'provisioned throughput', 'batch inference', 'model distillation'] },
      { id: 'd4t2', name: 'Performance monitoring & observability', keywords: ['CloudWatch', 'X-Ray', 'logging', 'tracing', 'latency'] },
      { id: 'd4t3', name: 'Caching & efficiency patterns', keywords: ['caching', 'semantic caching', 'ElastiCache', 'prompt caching'] },
    ]
  },
  {
    id: 'd5', name: 'Testing & Troubleshooting', weight: 11, color: '#ef4444',
    topics: [
      { id: 'd5t1', name: 'FM output evaluation (accuracy, fluency, relevance)', keywords: ['evaluation', 'RAGAS', 'A/B testing', 'LLM-as-judge'] },
      { id: 'd5t2', name: 'RAG retrieval quality testing', keywords: ['retrieval testing', 'relevance scoring', 'reranking', 'semantic search'] },
      { id: 'd5t3', name: 'Agent performance & regression testing', keywords: ['agent testing', 'regression', 'synthetic workflows', 'debugging'] },
      { id: 'd5t4', name: 'Troubleshooting hallucinations & failures', keywords: ['hallucinations', 'context overflow', 'embedding drift', 'error patterns'] },
    ]
  },
]

const RESOURCES = [
  { name: 'AWS Skill Builder — Exam Prep Plan', url: 'https://skillbuilder.aws/category/exam-prep/generative-ai-developer-professional-aip-c01', type: 'official', domains: ['d1','d2','d3','d4','d5'], free: true },
  { name: 'AWS Official Exam Guide (PDF)', url: 'https://d1.awsstatic.com/onedam/marketing-channels/website/aws/en_US/certification/approved/pdfs/docs-aip/AWS-Certified-Generative-AI-Developer-Pro_Exam-Guide.pdf', type: 'official', domains: ['d1','d2','d3','d4','d5'], free: true },
  { name: 'AWS Bedrock Documentation', url: 'https://docs.aws.amazon.com/bedrock/', type: 'docs', domains: ['d1','d2','d3'], free: true },
  { name: 'AWS Advanced RAG Workshop (GitHub)', url: 'https://github.com/aws-samples/sample-advanced-rag-using-bedrock-and-sagemaker', type: 'lab', domains: ['d1','d5'], free: true },
  { name: 'LangGraph Agents + Bedrock Workshop', url: 'https://github.com/aws-samples/langgraph-agents-with-amazon-bedrock', type: 'lab', domains: ['d2'], free: true },
  { name: 'Tutorials Dojo — AIP-C01 Practice Exams', url: 'https://portal.tutorialsdojo.com/courses/aws-certified-generative-ai-developer-professional-aip-c01-practice-exams/', type: 'practice', domains: ['d1','d2','d3','d4','d5'], free: false },
  { name: 'Udemy — Jon Bonso AIP-C01 Course', url: 'https://www.udemy.com/course/aws-certified-generative-ai-developer-professional-aip-c01/', type: 'course', domains: ['d1','d2','d3','d4','d5'], free: false },
  { name: 'Udemy — GenAI on AWS (Bedrock + RAG)', url: 'https://www.udemy.com/course/amazon-bedrock-aws-generative-ai-beginner-to-advanced/', type: 'course', domains: ['d1','d2'], free: false },
  { name: 'Building AI Agents on AWS (Practitioner\'s Guide)', url: 'https://dev.to/aws-builders/building-ai-agents-on-aws-in-2025-a-practitioners-guide-to-bedrock-agentcore-and-beyond-4efn', type: 'article', domains: ['d2'], free: true },
  { name: 'Agentic RAG with LlamaIndex + Bedrock', url: 'https://aws.amazon.com/blogs/machine-learning/create-an-agentic-rag-application-for-advanced-knowledge-discovery-with-llamaindex-and-mistral-in-amazon-bedrock/', type: 'article', domains: ['d1','d2'], free: true },
  { name: 'Amazon Bedrock AgentCore Docs', url: 'https://aws.amazon.com/bedrock/', type: 'docs', domains: ['d2','d4'], free: true },
  { name: 'AI Engineer Production Track (Udemy)', url: 'https://www.udemy.com/course/generative-and-agentic-ai-in-production/', type: 'course', domains: ['d2','d4','d5'], free: false },
]

const SEARCH_KEYWORDS_FOR_CERT = [
  'Amazon Bedrock', 'SageMaker', 'RAG', 'Retrieval Augmented Generation',
  'foundation models', 'LLM', 'agentic AI', 'Bedrock Agents', 'AgentCore',
  'vector database', 'OpenSearch', 'embeddings', 'prompt engineering',
  'guardrails', 'responsible AI', 'generative AI', 'Amazon Q',
  'knowledge bases', 'model evaluation', 'AI safety',
]

const STUDY_WEEKS = [
  { week: 1, title: 'Foundations & Exam Landscape', focus: ['d1'], tasks: ['Read official exam guide cover to cover', 'Set up AWS account with Bedrock access', 'Explore Bedrock console: try 3 foundation models', 'Study FM selection criteria & inference parameters'] },
  { week: 2, title: 'RAG Deep Dive', focus: ['d1'], tasks: ['Complete AWS Advanced RAG Workshop on GitHub', 'Build a RAG pipeline: embeddings → vector store → retrieval', 'Practice chunking strategies (fixed, semantic, hierarchical)', 'Study OpenSearch Serverless for vector storage'] },
  { week: 3, title: 'Agents & Orchestration', focus: ['d2'], tasks: ['Complete LangGraph Agents + Bedrock workshop', 'Build a Bedrock Agent with action groups & Lambda', 'Study Step Functions for multi-step agent workflows', 'Practice streaming responses with WebSockets'] },
  { week: 4, title: 'Implementation Patterns', focus: ['d2'], tasks: ['Build an API Gateway → Lambda → Bedrock pipeline', 'Implement retry strategies and rate limiting', 'Study Amazon Q Developer for code generation', 'Practice prompt chaining and management'] },
  { week: 5, title: 'Safety, Security & Governance', focus: ['d3'], tasks: ['Configure Bedrock Guardrails (content filtering, PII)', 'Study IAM policies for Bedrock & SageMaker', 'Implement VPC endpoints and PrivateLink', 'Review responsible AI principles and model cards'] },
  { week: 6, title: 'Cost & Performance', focus: ['d4'], tasks: ['Study provisioned throughput vs on-demand pricing', 'Implement CloudWatch dashboards for GenAI metrics', 'Practice X-Ray tracing for FM API calls', 'Evaluate caching strategies (semantic, prompt)'] },
  { week: 7, title: 'Testing & Evaluation', focus: ['d5'], tasks: ['Set up RAGAS evaluation framework', 'Practice LLM-as-judge evaluation patterns', 'Build regression test suites for RAG quality', 'Study troubleshooting: hallucinations, drift, overflow'] },
  { week: 8, title: 'Practice Exams & Review', focus: ['d1','d2','d3','d4','d5'], tasks: ['Take 2 full-length practice exams (timed)', 'Review all wrong answers and weak domains', 'Re-do hands-on labs for lowest-scoring domains', 'Schedule and take the exam'] },
]

const C = {
  bg: '#0b0e11', surface: '#12161c', card: '#181d25', input: '#0f1318',
  border: '#252d3a', t1: '#e8ecf1', t2: '#8994a7', t3: '#5a6476',
}

// ─────────────────────────────────────────────────────────────────────────────
// ZERO PARADOX DATA
// ─────────────────────────────────────────────────────────────────────────────

const PRESET_AMOUNTS = [5, 10, 25, 50, 100]

const MISSIONS = [
  { icon: '🎮', title: 'Game Development', desc: 'Pente, Nanu & Pika TD, Basketball Tactics — building games grounded in Theory of Fun.' },
  { icon: '🏥', title: 'CenterPointe for Children', desc: "Nonprofit web infrastructure, donor tooling, and tech support for children's programming." },
  { icon: '🛠', title: 'Open Source Tools', desc: 'pdf-to-audio, NBA analytics utilities, developer tools — free and open.' },
  { icon: '📐', title: 'Research & Education', desc: 'Game Design Theory of Fun, AWS GenAI curriculum, NBA data strategy.' },
]

function buildPaymentUrl(method, amount) {
  const stripe = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK
  const paypal = process.env.NEXT_PUBLIC_PAYPAL_ME
  const venmo  = process.env.NEXT_PUBLIC_VENMO_HANDLE
  switch (method) {
    case 'stripe': return stripe && !stripe.includes('REPLACE') ? stripe : null
    case 'paypal': return paypal && !paypal.includes('REPLACE') ? `https://paypal.me/${paypal}/${amount}` : null
    case 'venmo':  return venmo  && !venmo.includes('REPLACE')  ? `https://venmo.com/${venmo}?txn=pay&note=Zero+Paradox+LLC&amount=${amount}` : null
    default: return null
  }
}

function AmountSelector({ amount, setAmount, customAmount, setCustomAmount }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESET_AMOUNTS.map((preset) => (
        <button key={preset} onClick={() => { setAmount(preset); setCustomAmount('') }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${
            amount === preset && !customAmount
              ? 'bg-void-600 border-void-400 text-white shadow-lg shadow-void-900/40'
              : 'bg-white/5 border-white/10 text-white/70 hover:border-void-500/50 hover:text-white'
          }`}>
          ${preset}
        </button>
      ))}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
        <input type="number" min="1" placeholder="Other" value={customAmount}
          onChange={(e) => { setCustomAmount(e.target.value); if (e.target.value) setAmount(Number(e.target.value)) }}
          className="w-24 pl-7 pr-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-void-500/60 transition-colors"
        />
      </div>
    </div>
  )
}

function PaymentButton({ label, icon, description, url, accent }) {
  const configured = !!url
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-3 transition-all duration-200 ${
      configured ? 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8' : 'bg-white/[0.02] border-white/5 opacity-60'
    }`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-white font-semibold text-sm">{label}</p>
          <p className="text-white/40 text-xs">{description}</p>
        </div>
      </div>
      {configured ? (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
          style={{ background: accent, color: '#fff' }}>
          Pay with {label}
          <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      ) : (
        <div className="flex items-center justify-center w-full py-2.5 rounded-lg text-sm text-white/30 bg-white/5 border border-white/5">
          Configure in .env.local
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILLS SECTION
// ─────────────────────────────────────────────────────────────────────────────

function SkillsSection() {
  const [activeTab, setActiveTab] = useState('overview')
  const [topicProgress, setTopicProgress] = useState(() => {
    const all = {}
    EXAM_DOMAINS.forEach(d => d.topics.forEach(t => { all[t.id] = 0 }))
    return all
  })
  const [weekProgress, setWeekProgress] = useState(() => Array(8).fill(false).map(() => []))
  const [vocabList, setVocabList] = useState([])
  const [newVocab, setNewVocab] = useState('')
  const [newVocabDef, setNewVocabDef] = useState('')

  const radarRef = useRef(null)
  const radarChart = useRef(null)
  const barRef = useRef(null)
  const barChart = useRef(null)
  const keywordRef = useRef(null)
  const keywordChart = useRef(null)

  const domainProgress = EXAM_DOMAINS.map(d => {
    const scores = d.topics.map(t => topicProgress[t.id] || 0)
    return scores.reduce((a, b) => a + b, 0) / (scores.length * 3) * 100
  })

  const overallProgress = EXAM_DOMAINS.reduce((sum, d, i) => sum + domainProgress[i] * d.weight / 100, 0)

  const renderRadar = useCallback(() => {
    if (!radarRef.current) return
    if (radarChart.current) radarChart.current.destroy()
    radarChart.current = new Chart.Chart(radarRef.current, {
      type: 'radar',
      data: {
        labels: EXAM_DOMAINS.map(d => d.name.length > 20 ? d.name.slice(0, 18) + '…' : d.name),
        datasets: [
          { label: 'Your Progress', data: domainProgress, backgroundColor: 'rgba(59,130,246,0.15)', borderColor: '#3b82f6', borderWidth: 2, pointBackgroundColor: '#3b82f6', pointRadius: 4 },
          { label: 'Exam Weight', data: EXAM_DOMAINS.map(d => d.weight * 100 / 31), backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.4)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.06)' }, angleLines: { color: 'rgba(255,255,255,0.06)' }, pointLabels: { color: C.t2, font: { size: 10 } }, ticks: { display: false } } },
        plugins: { legend: { display: true, position: 'bottom', labels: { color: C.t2, font: { size: 11 }, padding: 16 } } },
      },
    })
  }, [domainProgress])

  const renderBar = useCallback(() => {
    if (!barRef.current) return
    if (barChart.current) barChart.current.destroy()
    barChart.current = new Chart.Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: EXAM_DOMAINS.map(d => d.name.split(' ').slice(0, 2).join(' ')),
        datasets: [
          { label: 'Progress %', data: domainProgress, backgroundColor: EXAM_DOMAINS.map(d => d.color + '88'), borderColor: EXAM_DOMAINS.map(d => d.color), borderWidth: 1, borderRadius: 4 },
          { label: 'Exam Weight %', data: EXAM_DOMAINS.map(d => d.weight), backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: C.t3, font: { size: 10 } } },
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: C.t3, font: { size: 10 } } },
        },
        plugins: { legend: { display: true, position: 'bottom', labels: { color: C.t2, font: { size: 11 }, padding: 16 } } },
      },
    })
  }, [domainProgress])

  const renderKeywordChart = useCallback(() => {
    if (!keywordRef.current) return
    if (keywordChart.current) keywordChart.current.destroy()
    const kwData = SEARCH_KEYWORDS_FOR_CERT.map(kw => ({
      kw,
      demand: Math.floor(40 + Math.random() * 60),
      yourLevel: topicProgress[EXAM_DOMAINS.flatMap(d => d.topics).find(t => t.keywords.some(k => k.toLowerCase().includes(kw.toLowerCase().split(' ')[0])))?.id]
        ? (topicProgress[EXAM_DOMAINS.flatMap(d => d.topics).find(t => t.keywords.some(k => k.toLowerCase().includes(kw.toLowerCase().split(' ')[0])))?.id] || 0) / 3 * 100
        : 20,
    })).sort((a, b) => b.demand - a.demand).slice(0, 12)

    keywordChart.current = new Chart.Chart(keywordRef.current, {
      type: 'bar',
      data: {
        labels: kwData.map(k => k.kw),
        datasets: [
          { label: 'Market Demand', data: kwData.map(k => k.demand), backgroundColor: 'rgba(34,211,238,0.3)', borderColor: '#22d3ee', borderWidth: 1, borderRadius: 3 },
          { label: 'Your Level',    data: kwData.map(k => k.yourLevel), backgroundColor: 'rgba(59,130,246,0.3)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 3 },
        ],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: {
          x: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: C.t3, font: { size: 9 } } },
          y: { grid: { display: false }, ticks: { color: C.t2, font: { size: 9 } } },
        },
        plugins: { legend: { display: true, position: 'bottom', labels: { color: C.t2, font: { size: 10 }, padding: 12 } } },
      },
    })
  }, [topicProgress])

  useEffect(() => { renderRadar(); renderBar(); renderKeywordChart() }, [renderRadar, renderBar, renderKeywordChart])

  const setProgress = (topicId, level) => setTopicProgress(prev => ({ ...prev, [topicId]: level }))

  const toggleWeekTask = (weekIdx, taskIdx) => {
    setWeekProgress(prev => {
      const next = prev.map(w => [...w])
      if (next[weekIdx].includes(taskIdx)) next[weekIdx] = next[weekIdx].filter(i => i !== taskIdx)
      else next[weekIdx].push(taskIdx)
      return next
    })
  }

  const addVocab = () => {
    if (!newVocab.trim()) return
    setVocabList(prev => [...prev, { term: newVocab.trim(), definition: newVocabDef.trim() }])
    setNewVocab(''); setNewVocabDef('')
  }

  const levelLabels = ['Not started', 'Reviewed', 'Practiced', 'Confident']
  const levelColors = ['#5a6476', '#f59e0b', '#3b82f6', '#22c55e']

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'domains', label: 'Domain Skills' },
    { id: 'plan', label: '8-Week Plan' },
    { id: 'keywords', label: 'Keyword Gap' },
    { id: 'resources', label: 'Resources' },
    { id: 'vocab', label: 'Vocab Bank' },
  ]

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: C.t1 }}>
      {/* Sub-header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, background: 'linear-gradient(135deg, #22d3ee, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AWS GenAI Developer — AIP-C01
          </div>
          <div style={{ fontSize: '.72rem', color: C.t3, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>65 questions · 750/1000 to pass · $300</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: '1.4rem', fontWeight: 700, color: overallProgress >= 70 ? '#22c55e' : overallProgress >= 40 ? '#f59e0b' : '#ef4444' }}>
              {overallProgress.toFixed(0)}%
            </div>
            <div style={{ fontSize: '.65rem', color: C.t3, textTransform: 'uppercase' }}>Overall</div>
          </div>
          <div style={{ width: 120, height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${overallProgress}%`, height: '100%', background: overallProgress >= 70 ? '#22c55e' : overallProgress >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 400ms' }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '8px 24px', background: C.surface, borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: activeTab === t.id ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: activeTab === t.id ? '#3b82f6' : C.t2,
            fontFamily: "'DM Sans'", fontSize: '.8rem', fontWeight: 500, whiteSpace: 'nowrap', transition: 'all 180ms',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px', maxWidth: 1000, margin: '0 auto' }}>

        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: C.t3, marginBottom: 12 }}>Domain Readiness</div>
                <div style={{ height: 260 }}><canvas ref={radarRef} /></div>
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: C.t3, marginBottom: 12 }}>Progress vs Weight</div>
                <div style={{ height: 260 }}><canvas ref={barRef} /></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {EXAM_DOMAINS.map((d, i) => (
                <div key={d.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 10px', textAlign: 'center', borderTop: `3px solid ${d.color}` }}>
                  <div style={{ fontSize: '.68rem', color: C.t3, marginBottom: 4, lineHeight: 1.3 }}>{d.name}</div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: '1.1rem', fontWeight: 700, color: d.color }}>{domainProgress[i].toFixed(0)}%</div>
                  <div style={{ fontSize: '.6rem', color: C.t3 }}>{d.weight}% of exam</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: C.t3, marginBottom: 10 }}>Job Search Keywords</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {SEARCH_KEYWORDS_FOR_CERT.map(kw => (
                  <span key={kw} style={{ padding: '3px 10px', borderRadius: 100, fontSize: '.72rem', fontWeight: 500, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}>{kw}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'domains' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {EXAM_DOMAINS.map((d, di) => (
              <div key={d.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 4, height: 28, borderRadius: 2, background: d.color }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '.9rem' }}>{d.name}</div>
                      <div style={{ fontSize: '.68rem', color: C.t3 }}>{d.weight}% of exam · {d.topics.length} topics</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: '.9rem', fontWeight: 700, color: d.color }}>{domainProgress[di].toFixed(0)}%</div>
                </div>
                <div style={{ padding: '8px 16px 12px' }}>
                  {d.topics.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '.82rem', color: C.t1 }}>{t.name}</div>
                        <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'wrap' }}>
                          {t.keywords.map(k => <span key={k} style={{ fontSize: '.58rem', padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', color: C.t3 }}>{k}</span>)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[0, 1, 2, 3].map(lvl => (
                          <button key={lvl} onClick={() => setProgress(t.id, lvl)} style={{
                            padding: '3px 8px', borderRadius: 4, border: `1px solid ${topicProgress[t.id] === lvl ? levelColors[lvl] : C.border}`,
                            background: topicProgress[t.id] === lvl ? levelColors[lvl] + '22' : 'transparent',
                            color: topicProgress[t.id] === lvl ? levelColors[lvl] : C.t3,
                            fontSize: '.62rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans'", whiteSpace: 'nowrap',
                          }}>{levelLabels[lvl]}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'plan' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {STUDY_WEEKS.map((w, wi) => {
              const done = weekProgress[wi]?.length || 0
              const total = w.tasks.length
              const pct = total ? done / total * 100 : 0
              return (
                <div key={wi} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '.85rem' }}>Week {w.week}: {w.title}</div>
                      <div style={{ fontSize: '.65rem', color: C.t3 }}>Focus: {w.focus.map(f => EXAM_DOMAINS.find(d => d.id === f)?.name.split(' ').slice(0, 2).join(' ')).join(', ')}</div>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: '.75rem', color: pct === 100 ? '#22c55e' : C.t3 }}>{done}/{total}</div>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : '#3b82f6', borderRadius: 2, transition: 'width 300ms' }} />
                  </div>
                  {w.tasks.map((task, ti) => (
                    <div key={ti} onClick={() => toggleWeekTask(wi, ti)} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', cursor: 'pointer',
                      color: weekProgress[wi]?.includes(ti) ? '#22c55e' : C.t2, fontSize: '.78rem',
                      textDecoration: weekProgress[wi]?.includes(ti) ? 'line-through' : 'none',
                      opacity: weekProgress[wi]?.includes(ti) ? 0.6 : 1,
                    }}>
                      <span style={{ fontSize: '.7rem', marginTop: 2 }}>{weekProgress[wi]?.includes(ti) ? '✓' : '○'}</span>
                      {task}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'keywords' && (
          <div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: C.t3, marginBottom: 12 }}>Skill Gap: Market Demand vs Your Level</div>
              <div style={{ height: 420 }}><canvas ref={keywordRef} /></div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase', color: C.t3, marginBottom: 10 }}>Config Integration</div>
              <pre style={{ fontFamily: "'JetBrains Mono'", fontSize: '.72rem', color: '#22d3ee', background: C.input, padding: 12, borderRadius: 8, overflowX: 'auto', lineHeight: 1.6 }}>{`# Add to config.py BONUS_STACK:
BONUS_STACK = [
    ${SEARCH_KEYWORDS_FOR_CERT.slice(0, 10).map(k => `"${k}"`).join(',\n    ')},
]`}</pre>
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['official', 'lab', 'course', 'practice', 'docs', 'article'].map(type => {
              const items = RESOURCES.filter(r => r.type === type)
              if (!items.length) return null
              const typeLabels = { official: 'Official AWS', lab: 'Hands-On Labs', course: 'Video Courses', practice: 'Practice Exams', docs: 'Documentation', article: 'Articles & Guides' }
              return (
                <div key={type}>
                  <div style={{ fontSize: '.68rem', fontWeight: 600, textTransform: 'uppercase', color: C.t3, padding: '12px 0 6px', letterSpacing: '.06em' }}>{typeLabels[type]}</div>
                  {items.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                      textDecoration: 'none', marginBottom: 4,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '.85rem', fontWeight: 500, color: C.t1 }}>{r.name}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                          {r.domains.map(did => {
                            const d = EXAM_DOMAINS.find(x => x.id === did)
                            return d ? <span key={did} style={{ fontSize: '.55rem', padding: '1px 5px', borderRadius: 3, background: d.color + '22', color: d.color }}>{d.name.split(' ').slice(0, 2).join(' ')}</span> : null
                          })}
                        </div>
                      </div>
                      <span style={{ fontSize: '.68rem', padding: '2px 8px', borderRadius: 100, background: r.free ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: r.free ? '#22c55e' : '#f59e0b' }}>
                        {r.free ? 'Free' : 'Paid'}
                      </span>
                    </a>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'vocab' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={newVocab} onChange={e => setNewVocab(e.target.value)} placeholder="Term" style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.input, color: C.t1, fontFamily: "'DM Sans'", fontSize: '.85rem', outline: 'none' }} />
              <input value={newVocabDef} onChange={e => setNewVocabDef(e.target.value)} placeholder="Definition" onKeyDown={e => e.key === 'Enter' && addVocab()} style={{ flex: 2, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, background: C.input, color: C.t1, fontFamily: "'DM Sans'", fontSize: '.85rem', outline: 'none' }} />
              <button onClick={addVocab} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontFamily: "'DM Sans'", fontSize: '.82rem', fontWeight: 500, cursor: 'pointer' }}>Add</button>
            </div>
            {[
              { term: 'Foundation Model (FM)', definition: 'A large pre-trained AI model (like Claude, Llama, Titan) that can be adapted for various tasks via prompting or fine-tuning.' },
              { term: 'RAG', definition: 'Retrieval-Augmented Generation — enriches LLM responses by retrieving relevant documents from a knowledge base before generating output.' },
              { term: 'Vector Store', definition: 'A database optimized for storing and querying high-dimensional vector embeddings for semantic search (e.g., OpenSearch, FAISS, Pinecone).' },
              { term: 'Embeddings', definition: 'Numerical vector representations of text that capture semantic meaning, enabling similarity search.' },
              { term: 'Chunking', definition: 'Splitting documents into smaller pieces for embedding. Strategies: fixed-size, semantic, hierarchical.' },
              { term: 'Bedrock Guardrails', definition: 'AWS feature that filters harmful/unwanted content in FM inputs and outputs — content filtering, PII detection, topic blocking.' },
              { term: 'Prompt Engineering', definition: 'Designing input prompts to guide FM behavior — includes few-shot, chain-of-thought, role-based, and template-based approaches.' },
              { term: 'Agentic AI', definition: 'AI systems that autonomously plan, execute multi-step tasks, use tools, and make decisions — key 2026 paradigm shift.' },
              { term: 'Bedrock Agents', definition: 'AWS service for building agents that can reason, plan, and call APIs/tools using foundation models as the reasoning engine.' },
              { term: 'AgentCore', definition: 'AWS platform for deploying, scaling, and operating AI agents in production — runtime, gateway, memory, identity, observability.' },
              { term: 'Model Distillation', definition: 'Training a smaller, cheaper model to mimic a larger model\'s behavior — reduces cost while preserving quality.' },
              { term: 'RAGAS', definition: 'Open-source framework for evaluating RAG pipeline quality — measures faithfulness, answer relevance, context precision.' },
              { term: 'LLM-as-Judge', definition: 'Using one LLM to evaluate the output quality of another — enables automated evaluation at scale.' },
              { term: 'Semantic Caching', definition: 'Caching LLM responses keyed by semantic similarity of the input, not exact match — reduces redundant API calls.' },
              { term: 'Prompt Injection', definition: 'Attack where malicious instructions are embedded in user input to manipulate FM behavior — guardrails defend against this.' },
              ...vocabList,
            ].map((v, i) => (
              <div key={i} style={{ padding: '10px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 4 }}>
                <div style={{ fontWeight: 600, fontSize: '.85rem', color: '#22d3ee', fontFamily: "'JetBrains Mono'" }}>{v.term}</div>
                <div style={{ fontSize: '.8rem', color: C.t2, marginTop: 2 }}>{v.definition}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ZERO PARADOX SECTION
// ─────────────────────────────────────────────────────────────────────────────

function ZeroParadoxSection() {
  const [amount, setAmount] = useState(25)
  const [customAmount, setCustomAmount] = useState('')

  const activeAmount = customAmount ? Number(customAmount) : amount

  const paymentMethods = [
    { method: 'stripe', label: 'Stripe', icon: '⚡', description: 'Card · Apple Pay · Google Pay', accent: '#635BFF', url: buildPaymentUrl('stripe', activeAmount) },
    { method: 'paypal', label: 'PayPal', icon: '🅿', description: 'PayPal balance or card',       accent: '#0070E0', url: buildPaymentUrl('paypal', activeAmount) },
    { method: 'venmo',  label: 'Venmo',  icon: '💙', description: 'Venmo balance · US only',      accent: '#3D95CE', url: buildPaymentUrl('venmo',  activeAmount) },
  ]

  return (
    <div className="min-h-0 bg-[#0a0814]">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(124,58,237,0.18),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(99,91,255,0.12),transparent_55%)]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 pt-12 pb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-void-900/60 border border-void-700/40 shadow-lg shadow-void-900/40 mb-6">
            <span className="text-2xl font-black text-void-300 tracking-tighter select-none">ZP</span>
          </div>
          <div className="flex justify-center mb-4">
            <PreText text="Zero Paradox LLC" mode="flow" color="#a78bfa" accentColor="#c4b5fd" tag="h2" fontSize="clamp(1.5rem, 4vw, 2.5rem)" fontWeight="800" />
          </div>
          <p className="text-white/50 text-base max-w-xl mx-auto leading-relaxed">
            Building games, tools, and systems at the intersection of technology and human experience.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Work in progress — not yet published
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 pb-16 space-y-12">
        {/* Payment */}
        <section>
          <div className="rounded-2xl border border-void-800/60 bg-void-950/60 p-6 sm:p-8 shadow-xl">
            <div className="mb-6">
              <PreText text="Support the Work" mode="pulse" color="#a78bfa" fontSize="1.25rem" fontWeight="700" tag="h3" />
              <p className="text-white/40 text-sm mt-2">Choose an amount and payment method. Every contribution goes directly to the projects below.</p>
            </div>
            <div className="mb-6">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">Amount</p>
              <AmountSelector amount={amount} setAmount={setAmount} customAmount={customAmount} setCustomAmount={setCustomAmount} />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-void-400 text-sm font-mono">${activeAmount > 0 ? activeAmount : '—'}</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {paymentMethods.map(pm => <PaymentButton key={pm.method} {...pm} />)}
            </div>
            <p className="text-white/20 text-xs text-center mt-4">Payments processed securely by each provider. Zero Paradox LLC does not store card data.</p>
          </div>
        </section>

        {/* Consulting CTA */}
        <section>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex-1">
                <PreText text="Consulting" mode="flow" color="#c4b5fd" fontSize="1.125rem" fontWeight="700" tag="h3" />
                <p className="text-white/50 text-sm mt-2 leading-relaxed">
                  Senior full-stack engineering · Sports tech & NBA data strategy · React, TypeScript, Node.js, SwiftUI · Available for contract and fractional engagements.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end shrink-0">
                <div className="text-right">
                  <p className="text-void-300 text-xl font-bold">$150 <span className="text-white/30 text-sm font-normal">/ hr</span></p>
                  <p className="text-white/30 text-xs">Project rates available</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-void-500 mb-1">What you&apos;re funding</p>
            <PreText text="The Mission" mode="flow" color="#8b5cf6" fontSize="1.5rem" fontWeight="700" tag="h3" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MISSIONS.map(m => (
              <div key={m.title} className="rounded-xl border border-white/8 bg-white/[0.03] p-5 hover:border-void-700/40 transition-all duration-200">
                <span className="text-2xl block mb-2">{m.icon}</span>
                <h4 className="text-white font-semibold text-sm mb-1">{m.title}</h4>
                <p className="text-white/40 text-xs leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'skills', label: 'Skills & Learning' },
  { id: 'zero-paradox', label: 'Zero Paradox LLC' },
]

export default function Tracker() {
  const [activeSection, setActiveSection] = useState('skills')
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <>
      <Head>
        <title>Dashboard</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-forest-950">
        {/* Dashboard header */}
        <div className="sticky top-16 z-40 bg-forest-900/95 backdrop-blur-md border-b border-forest-700/40">
          <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1">
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeSection === s.id
                      ? 'text-candy-400 bg-forest-800'
                      : 'text-forest-300 hover:text-candy-300 hover:bg-forest-800'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-forest-400 hover:text-forest-200 hover:bg-forest-800 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {activeSection === 'skills' && <SkillsSection />}
        {activeSection === 'zero-paradox' && <ZeroParadoxSection />}
      </div>
    </>
  )
}
