import { useState, useEffect, useRef, useCallback } from "react";
import * as Chart from "chart.js";

// Register Chart.js components
Chart.Chart.register(
  Chart.ArcElement, Chart.BarElement, Chart.LineElement, Chart.PointElement,
  Chart.RadarController, Chart.BarController, Chart.DoughnutController, Chart.LineController,
  Chart.RadialLinearScale, Chart.CategoryScale, Chart.LinearScale,
  Chart.Tooltip, Chart.Legend, Chart.Filler
);

// ═══════════════════════════════════════════════════════════════
// DATA: AIP-C01 Exam Domains, Skills, Resources
// ═══════════════════════════════════════════════════════════════

const EXAM_DOMAINS = [
  {
    id: "d1", name: "Foundation Model Integration", weight: 31, color: "#3b82f6",
    topics: [
      { id: "d1t1", name: "Select & configure FMs for business use cases", keywords: ["Amazon Bedrock", "foundation models", "model selection", "inference parameters"] },
      { id: "d1t2", name: "RAG architectures & vector stores", keywords: ["RAG", "vector databases", "OpenSearch", "embeddings", "chunking", "knowledge bases"] },
      { id: "d1t3", name: "Data management & compliance for GenAI", keywords: ["data pipelines", "S3", "compliance", "PII", "data governance"] },
      { id: "d1t4", name: "Prompt engineering & management", keywords: ["prompt engineering", "prompt templates", "few-shot", "chain-of-thought"] },
      { id: "d1t5", name: "Dynamic model selection & provider switching", keywords: ["Lambda", "API Gateway", "AppConfig", "model routing"] },
    ]
  },
  {
    id: "d2", name: "Implementation & Integration", weight: 26, color: "#22c55e",
    topics: [
      { id: "d2t1", name: "Build & deploy GenAI applications", keywords: ["Bedrock Agents", "Lambda", "Step Functions", "API Gateway"] },
      { id: "d2t2", name: "Agentic workflows & multi-agent systems", keywords: ["agentic AI", "Bedrock Agents", "AgentCore", "orchestration", "tool use"] },
      { id: "d2t3", name: "Streaming & real-time FM responses", keywords: ["WebSockets", "server-sent events", "streaming", "chunked transfer"] },
      { id: "d2t4", name: "FM API interfaces & integration patterns", keywords: ["API Gateway", "token management", "retry strategies", "rate limiting"] },
      { id: "d2t5", name: "Development tools (Amazon Q Developer)", keywords: ["Amazon Q", "code generation", "refactoring", "debugging"] },
    ]
  },
  {
    id: "d3", name: "AI Safety & Governance", weight: 20, color: "#f59e0b",
    topics: [
      { id: "d3t1", name: "Input/output safety controls & guardrails", keywords: ["Bedrock guardrails", "content filtering", "moderation", "prompt injection"] },
      { id: "d3t2", name: "Data privacy & encryption for FM workloads", keywords: ["KMS", "encryption", "VPC", "PrivateLink", "data privacy"] },
      { id: "d3t3", name: "IAM policies for GenAI services", keywords: ["IAM", "least privilege", "service roles", "cross-account"] },
      { id: "d3t4", name: "Responsible AI & bias mitigation", keywords: ["responsible AI", "bias", "fairness", "transparency", "model cards"] },
    ]
  },
  {
    id: "d4", name: "Operational Efficiency", weight: 12, color: "#a78bfa",
    topics: [
      { id: "d4t1", name: "Cost optimization for FM workloads", keywords: ["cost optimization", "provisioned throughput", "batch inference", "model distillation"] },
      { id: "d4t2", name: "Performance monitoring & observability", keywords: ["CloudWatch", "X-Ray", "logging", "tracing", "latency"] },
      { id: "d4t3", name: "Caching & efficiency patterns", keywords: ["caching", "semantic caching", "ElastiCache", "prompt caching"] },
    ]
  },
  {
    id: "d5", name: "Testing & Troubleshooting", weight: 11, color: "#ef4444",
    topics: [
      { id: "d5t1", name: "FM output evaluation (accuracy, fluency, relevance)", keywords: ["evaluation", "RAGAS", "A/B testing", "LLM-as-judge"] },
      { id: "d5t2", name: "RAG retrieval quality testing", keywords: ["retrieval testing", "relevance scoring", "reranking", "semantic search"] },
      { id: "d5t3", name: "Agent performance & regression testing", keywords: ["agent testing", "regression", "synthetic workflows", "debugging"] },
      { id: "d5t4", name: "Troubleshooting hallucinations & failures", keywords: ["hallucinations", "context overflow", "embedding drift", "error patterns"] },
    ]
  },
];

const RESOURCES = [
  { name: "AWS Skill Builder — Exam Prep Plan", url: "https://skillbuilder.aws/category/exam-prep/generative-ai-developer-professional-aip-c01", type: "official", domains: ["d1","d2","d3","d4","d5"], free: true },
  { name: "AWS Official Exam Guide (PDF)", url: "https://d1.awsstatic.com/onedam/marketing-channels/website/aws/en_US/certification/approved/pdfs/docs-aip/AWS-Certified-Generative-AI-Developer-Pro_Exam-Guide.pdf", type: "official", domains: ["d1","d2","d3","d4","d5"], free: true },
  { name: "AWS Bedrock Documentation", url: "https://docs.aws.amazon.com/bedrock/", type: "docs", domains: ["d1","d2","d3"], free: true },
  { name: "AWS Advanced RAG Workshop (GitHub)", url: "https://github.com/aws-samples/sample-advanced-rag-using-bedrock-and-sagemaker", type: "lab", domains: ["d1","d5"], free: true },
  { name: "LangGraph Agents + Bedrock Workshop", url: "https://github.com/aws-samples/langgraph-agents-with-amazon-bedrock", type: "lab", domains: ["d2"], free: true },
  { name: "Tutorials Dojo — AIP-C01 Practice Exams", url: "https://portal.tutorialsdojo.com/courses/aws-certified-generative-ai-developer-professional-aip-c01-practice-exams/", type: "practice", domains: ["d1","d2","d3","d4","d5"], free: false },
  { name: "Udemy — Jon Bonso AIP-C01 Course", url: "https://www.udemy.com/course/aws-certified-generative-ai-developer-professional-aip-c01/", type: "course", domains: ["d1","d2","d3","d4","d5"], free: false },
  { name: "Udemy — GenAI on AWS (Bedrock + RAG)", url: "https://www.udemy.com/course/amazon-bedrock-aws-generative-ai-beginner-to-advanced/", type: "course", domains: ["d1","d2"], free: false },
  { name: "Building AI Agents on AWS (Practitioner's Guide)", url: "https://dev.to/aws-builders/building-ai-agents-on-aws-in-2025-a-practitioners-guide-to-bedrock-agentcore-and-beyond-4efn", type: "article", domains: ["d2"], free: true },
  { name: "Agentic RAG with LlamaIndex + Bedrock", url: "https://aws.amazon.com/blogs/machine-learning/create-an-agentic-rag-application-for-advanced-knowledge-discovery-with-llamaindex-and-mistral-in-amazon-bedrock/", type: "article", domains: ["d1","d2"], free: true },
  { name: "Amazon Bedrock AgentCore Docs", url: "https://aws.amazon.com/bedrock/", type: "docs", domains: ["d2","d4"], free: true },
  { name: "AI Engineer Production Track (Udemy)", url: "https://www.udemy.com/course/generative-and-agentic-ai-in-production/", type: "course", domains: ["d2","d4","d5"], free: false },
];

const SEARCH_KEYWORDS_FOR_CERT = [
  "Amazon Bedrock", "SageMaker", "RAG", "Retrieval Augmented Generation",
  "foundation models", "LLM", "agentic AI", "Bedrock Agents", "AgentCore",
  "vector database", "OpenSearch", "embeddings", "prompt engineering",
  "guardrails", "responsible AI", "generative AI", "Amazon Q",
  "knowledge bases", "model evaluation", "AI safety",
];

// ═══════════════════════════════════════════════════════════════
// STUDY PLAN (8-week structure)
// ═══════════════════════════════════════════════════════════════

const STUDY_WEEKS = [
  { week: 1, title: "Foundations & Exam Landscape", focus: ["d1"], tasks: ["Read official exam guide cover to cover", "Set up AWS account with Bedrock access", "Explore Bedrock console: try 3 foundation models", "Study FM selection criteria & inference parameters"] },
  { week: 2, title: "RAG Deep Dive", focus: ["d1"], tasks: ["Complete AWS Advanced RAG Workshop on GitHub", "Build a RAG pipeline: embeddings → vector store → retrieval", "Practice chunking strategies (fixed, semantic, hierarchical)", "Study OpenSearch Serverless for vector storage"] },
  { week: 3, title: "Agents & Orchestration", focus: ["d2"], tasks: ["Complete LangGraph Agents + Bedrock workshop", "Build a Bedrock Agent with action groups & Lambda", "Study Step Functions for multi-step agent workflows", "Practice streaming responses with WebSockets"] },
  { week: 4, title: "Implementation Patterns", focus: ["d2"], tasks: ["Build an API Gateway → Lambda → Bedrock pipeline", "Implement retry strategies and rate limiting", "Study Amazon Q Developer for code generation", "Practice prompt chaining and management"] },
  { week: 5, title: "Safety, Security & Governance", focus: ["d3"], tasks: ["Configure Bedrock Guardrails (content filtering, PII)", "Study IAM policies for Bedrock & SageMaker", "Implement VPC endpoints and PrivateLink", "Review responsible AI principles and model cards"] },
  { week: 6, title: "Cost & Performance", focus: ["d4"], tasks: ["Study provisioned throughput vs on-demand pricing", "Implement CloudWatch dashboards for GenAI metrics", "Practice X-Ray tracing for FM API calls", "Evaluate caching strategies (semantic, prompt)"] },
  { week: 7, title: "Testing & Evaluation", focus: ["d5"], tasks: ["Set up RAGAS evaluation framework", "Practice LLM-as-judge evaluation patterns", "Build regression test suites for RAG quality", "Study troubleshooting: hallucinations, drift, overflow"] },
  { week: 8, title: "Practice Exams & Review", focus: ["d1","d2","d3","d4","d5"], tasks: ["Take 2 full-length practice exams (timed)", "Review all wrong answers and weak domains", "Re-do hands-on labs for lowest-scoring domains", "Schedule and take the exam"] },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

const COLORS = {
  bg: "#0b0e11", surface: "#12161c", card: "#181d25", cardHover: "#1e242e",
  input: "#0f1318", border: "#252d3a", t1: "#e8ecf1", t2: "#8994a7", t3: "#5a6476",
};

export default function EducationTracker() {
  const [activeTab, setActiveTab] = useState("overview");
  const [topicProgress, setTopicProgress] = useState(() => {
    const all = {};
    EXAM_DOMAINS.forEach(d => d.topics.forEach(t => { all[t.id] = 0; }));
    return all;
  });
  const [weekProgress, setWeekProgress] = useState(() => Array(8).fill(false).map(() => []));
  const [vocabList, setVocabList] = useState([]);
  const [newVocab, setNewVocab] = useState("");
  const [newVocabDef, setNewVocabDef] = useState("");

  const radarRef = useRef(null);
  const radarChart = useRef(null);
  const barRef = useRef(null);
  const barChart = useRef(null);
  const keywordRef = useRef(null);
  const keywordChart = useRef(null);

  // Compute domain-level progress
  const domainProgress = EXAM_DOMAINS.map(d => {
    const topicScores = d.topics.map(t => topicProgress[t.id] || 0);
    return topicScores.reduce((a, b) => a + b, 0) / (topicScores.length * 3) * 100;
  });

  const overallProgress = EXAM_DOMAINS.reduce((sum, d, i) => sum + domainProgress[i] * d.weight / 100, 0);

  // ── Charts ──
  const renderRadar = useCallback(() => {
    if (!radarRef.current) return;
    if (radarChart.current) radarChart.current.destroy();
    radarChart.current = new Chart.Chart(radarRef.current, {
      type: "radar",
      data: {
        labels: EXAM_DOMAINS.map(d => d.name.length > 20 ? d.name.slice(0, 18) + "…" : d.name),
        datasets: [
          {
            label: "Your Progress",
            data: domainProgress,
            backgroundColor: "rgba(59,130,246,0.15)",
            borderColor: "#3b82f6",
            borderWidth: 2,
            pointBackgroundColor: "#3b82f6",
            pointRadius: 4,
          },
          {
            label: "Exam Weight",
            data: EXAM_DOMAINS.map(d => d.weight * 100 / 31),
            backgroundColor: "rgba(245,158,11,0.08)",
            borderColor: "rgba(245,158,11,0.4)",
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true, max: 100,
            grid: { color: "rgba(255,255,255,0.06)" },
            angleLines: { color: "rgba(255,255,255,0.06)" },
            pointLabels: { color: COLORS.t2, font: { size: 10, family: "'DM Sans'" } },
            ticks: { display: false },
          },
        },
        plugins: {
          legend: { display: true, position: "bottom", labels: { color: COLORS.t2, font: { size: 11 }, padding: 16 } },
        },
      },
    });
  }, [domainProgress]);

  const renderBar = useCallback(() => {
    if (!barRef.current) return;
    if (barChart.current) barChart.current.destroy();
    barChart.current = new Chart.Chart(barRef.current, {
      type: "bar",
      data: {
        labels: EXAM_DOMAINS.map(d => d.name.split(" ").slice(0, 2).join(" ")),
        datasets: [
          {
            label: "Progress %",
            data: domainProgress,
            backgroundColor: EXAM_DOMAINS.map(d => d.color + "88"),
            borderColor: EXAM_DOMAINS.map(d => d.color),
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: "Exam Weight %",
            data: EXAM_DOMAINS.map(d => d.weight),
            backgroundColor: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.15)",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: COLORS.t3, font: { size: 10 } } },
          y: { beginAtZero: true, max: 100, grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: COLORS.t3, font: { size: 10 } } },
        },
        plugins: { legend: { display: true, position: "bottom", labels: { color: COLORS.t2, font: { size: 11 }, padding: 16 } } },
      },
    });
  }, [domainProgress]);

  const renderKeywordChart = useCallback(() => {
    if (!keywordRef.current) return;
    if (keywordChart.current) keywordChart.current.destroy();
    // Simulate "job market demand" for cert keywords
    const kwData = SEARCH_KEYWORDS_FOR_CERT.map(kw => ({
      kw,
      demand: Math.floor(40 + Math.random() * 60),
      yourLevel: topicProgress[
        EXAM_DOMAINS.flatMap(d => d.topics).find(t => t.keywords.some(k => k.toLowerCase().includes(kw.toLowerCase().split(" ")[0])))?.id
      ] ? (topicProgress[
        EXAM_DOMAINS.flatMap(d => d.topics).find(t => t.keywords.some(k => k.toLowerCase().includes(kw.toLowerCase().split(" ")[0])))?.id
      ] || 0) / 3 * 100 : 20,
    })).sort((a, b) => b.demand - a.demand).slice(0, 12);

    keywordChart.current = new Chart.Chart(keywordRef.current, {
      type: "bar",
      data: {
        labels: kwData.map(k => k.kw),
        datasets: [
          { label: "Market Demand", data: kwData.map(k => k.demand), backgroundColor: "rgba(34,211,238,0.3)", borderColor: "#22d3ee", borderWidth: 1, borderRadius: 3 },
          { label: "Your Level", data: kwData.map(k => k.yourLevel), backgroundColor: "rgba(59,130,246,0.3)", borderColor: "#3b82f6", borderWidth: 1, borderRadius: 3 },
        ],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        scales: {
          x: { beginAtZero: true, max: 100, grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: COLORS.t3, font: { size: 9 } } },
          y: { grid: { display: false }, ticks: { color: COLORS.t2, font: { size: 9, family: "'JetBrains Mono'" } } },
        },
        plugins: { legend: { display: true, position: "bottom", labels: { color: COLORS.t2, font: { size: 10 }, padding: 12 } } },
      },
    });
  }, [topicProgress]);

  useEffect(() => { renderRadar(); renderBar(); renderKeywordChart(); }, [renderRadar, renderBar, renderKeywordChart]);

  const setProgress = (topicId, level) => {
    setTopicProgress(prev => ({ ...prev, [topicId]: level }));
  };

  const toggleWeekTask = (weekIdx, taskIdx) => {
    setWeekProgress(prev => {
      const next = prev.map(w => [...w]);
      if (next[weekIdx].includes(taskIdx)) next[weekIdx] = next[weekIdx].filter(i => i !== taskIdx);
      else next[weekIdx].push(taskIdx);
      return next;
    });
  };

  const addVocab = () => {
    if (!newVocab.trim()) return;
    setVocabList(prev => [...prev, { term: newVocab.trim(), definition: newVocabDef.trim(), added: new Date().toISOString() }]);
    setNewVocab(""); setNewVocabDef("");
  };

  const levelLabels = ["Not started", "Reviewed", "Practiced", "Confident"];
  const levelColors = ["#5a6476", "#f59e0b", "#3b82f6", "#22c55e"];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "domains", label: "Domain Skills" },
    { id: "plan", label: "8-Week Plan" },
    { id: "keywords", label: "Keyword Gap" },
    { id: "resources", label: "Resources" },
    { id: "vocab", label: "Vocab Bank" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: COLORS.bg, color: COLORS.t1, minHeight: "100vh", padding: "0" }}>
      {/* Header */}
      <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: "1.15rem", fontWeight: 700, background: "linear-gradient(135deg, #22d3ee, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            AWS GenAI Developer — Study Tracker
          </div>
          <div style={{ fontSize: ".72rem", color: COLORS.t3, letterSpacing: ".06em", textTransform: "uppercase", marginTop: 2 }}>AIP-C01 · 65 questions · 750/1000 to pass · $300</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: "1.4rem", fontWeight: 700, color: overallProgress >= 70 ? "#22c55e" : overallProgress >= 40 ? "#f59e0b" : "#ef4444" }}>
              {overallProgress.toFixed(0)}%
            </div>
            <div style={{ fontSize: ".65rem", color: COLORS.t3, textTransform: "uppercase" }}>Overall</div>
          </div>
          <div style={{ width: 120, height: 6, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${overallProgress}%`, height: "100%", background: overallProgress >= 70 ? "#22c55e" : overallProgress >= 40 ? "#f59e0b" : "#ef4444", borderRadius: 3, transition: "width 400ms" }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "8px 24px", background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            background: activeTab === t.id ? "rgba(59,130,246,0.15)" : "transparent",
            color: activeTab === t.id ? "#3b82f6" : COLORS.t2,
            fontFamily: "'DM Sans'", fontSize: ".8rem", fontWeight: 500, whiteSpace: "nowrap",
            transition: "all 180ms",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px 24px", maxWidth: 1000, margin: "0 auto" }}>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: ".72rem", fontWeight: 600, textTransform: "uppercase", color: COLORS.t3, marginBottom: 12 }}>Domain Readiness</div>
                <div style={{ height: 260 }}><canvas ref={radarRef} /></div>
              </div>
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: ".72rem", fontWeight: 600, textTransform: "uppercase", color: COLORS.t3, marginBottom: 12 }}>Progress vs Weight</div>
                <div style={{ height: 260 }}><canvas ref={barRef} /></div>
              </div>
            </div>

            {/* Domain summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {EXAM_DOMAINS.map((d, i) => (
                <div key={d.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 10px", textAlign: "center", borderTop: `3px solid ${d.color}` }}>
                  <div style={{ fontSize: ".68rem", color: COLORS.t3, marginBottom: 4, lineHeight: 1.3 }}>{d.name}</div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: "1.1rem", fontWeight: 700, color: d.color }}>{domainProgress[i].toFixed(0)}%</div>
                  <div style={{ fontSize: ".6rem", color: COLORS.t3 }}>{d.weight}% of exam</div>
                </div>
              ))}
            </div>

            {/* Search keywords to add */}
            <div style={{ marginTop: 20, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: ".72rem", fontWeight: 600, textTransform: "uppercase", color: COLORS.t3, marginBottom: 10 }}>Add These to Your Job Search Filters</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {SEARCH_KEYWORDS_FOR_CERT.map(kw => (
                  <span key={kw} style={{ padding: "3px 10px", borderRadius: 100, fontSize: ".72rem", fontWeight: 500, background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>{kw}</span>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: ".75rem", color: COLORS.t3 }}>
                These keywords map directly to AIP-C01 exam topics. Add them to your scraper's SEARCH_QUERIES and BONUS_STACK in config.py to surface roles where your cert gives you a competitive edge.
              </div>
            </div>
          </div>
        )}

        {/* ── DOMAIN SKILLS ── */}
        {activeTab === "domains" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {EXAM_DOMAINS.map((d, di) => (
              <div key={d.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 4, height: 28, borderRadius: 2, background: d.color }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: ".9rem" }}>{d.name}</div>
                      <div style={{ fontSize: ".68rem", color: COLORS.t3 }}>{d.weight}% of exam · {d.topics.length} topics</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: ".9rem", fontWeight: 700, color: d.color }}>{domainProgress[di].toFixed(0)}%</div>
                </div>
                <div style={{ padding: "8px 16px 12px" }}>
                  {d.topics.map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: ".82rem", color: COLORS.t1 }}>{t.name}</div>
                        <div style={{ display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap" }}>
                          {t.keywords.map(k => <span key={k} style={{ fontSize: ".58rem", padding: "1px 5px", borderRadius: 3, background: "rgba(255,255,255,0.04)", color: COLORS.t3 }}>{k}</span>)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 3 }}>
                        {[0, 1, 2, 3].map(lvl => (
                          <button key={lvl} onClick={() => setProgress(t.id, lvl)} style={{
                            padding: "3px 8px", borderRadius: 4, border: `1px solid ${topicProgress[t.id] === lvl ? levelColors[lvl] : COLORS.border}`,
                            background: topicProgress[t.id] === lvl ? levelColors[lvl] + "22" : "transparent",
                            color: topicProgress[t.id] === lvl ? levelColors[lvl] : COLORS.t3,
                            fontSize: ".62rem", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'", whiteSpace: "nowrap",
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

        {/* ── 8-WEEK PLAN ── */}
        {activeTab === "plan" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {STUDY_WEEKS.map((w, wi) => {
              const done = weekProgress[wi]?.length || 0;
              const total = w.tasks.length;
              const pct = total ? done / total * 100 : 0;
              return (
                <div key={wi} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: ".85rem" }}>Week {w.week}: {w.title}</div>
                      <div style={{ fontSize: ".65rem", color: COLORS.t3 }}>Focus: {w.focus.map(f => EXAM_DOMAINS.find(d => d.id === f)?.name.split(" ").slice(0, 2).join(" ")).join(", ")}</div>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: ".75rem", color: pct === 100 ? "#22c55e" : COLORS.t3 }}>{done}/{total}</div>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,.06)", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#22c55e" : "#3b82f6", borderRadius: 2, transition: "width 300ms" }} />
                  </div>
                  {w.tasks.map((task, ti) => (
                    <div key={ti} onClick={() => toggleWeekTask(wi, ti)} style={{
                      display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", cursor: "pointer",
                      color: weekProgress[wi]?.includes(ti) ? "#22c55e" : COLORS.t2, fontSize: ".78rem",
                      textDecoration: weekProgress[wi]?.includes(ti) ? "line-through" : "none",
                      opacity: weekProgress[wi]?.includes(ti) ? 0.6 : 1,
                    }}>
                      <span style={{ fontSize: ".7rem", marginTop: 2 }}>{weekProgress[wi]?.includes(ti) ? "✓" : "○"}</span>
                      {task}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ── KEYWORD GAP ── */}
        {activeTab === "keywords" && (
          <div>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: ".72rem", fontWeight: 600, textTransform: "uppercase", color: COLORS.t3, marginBottom: 12 }}>Skill Gap: Market Demand vs Your Level</div>
              <div style={{ height: 420 }}><canvas ref={keywordRef} /></div>
              <div style={{ marginTop: 10, fontSize: ".72rem", color: COLORS.t3, lineHeight: 1.5 }}>
                Cyan bars show how frequently each keyword appears in job listings from your scraper. Blue bars show your self-assessed competency from the Domain Skills tab. The bigger the gap, the more study ROI that keyword offers.
              </div>
            </div>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: ".72rem", fontWeight: 600, textTransform: "uppercase", color: COLORS.t3, marginBottom: 10 }}>Config Integration</div>
              <pre style={{ fontFamily: "'JetBrains Mono'", fontSize: ".72rem", color: "#22d3ee", background: COLORS.input, padding: 12, borderRadius: 8, overflowX: "auto", lineHeight: 1.6 }}>{`# Add to config.py BONUS_STACK:
BONUS_STACK = [
    ${SEARCH_KEYWORDS_FOR_CERT.slice(0, 10).map(k => `"${k}"`).join(",\n    ")},
]

# Add to config.py SEARCH_QUERIES:
SEARCH_QUERIES += [
    "generative AI developer",
    "bedrock engineer",
    "RAG developer",
    "LLM application engineer",
    "AI platform engineer",
]`}</pre>
            </div>
          </div>
        )}

        {/* ── RESOURCES ── */}
        {activeTab === "resources" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["official", "lab", "course", "practice", "docs", "article"].map(type => {
              const items = RESOURCES.filter(r => r.type === type);
              if (!items.length) return null;
              const typeLabels = { official: "Official AWS", lab: "Hands-On Labs", course: "Video Courses", practice: "Practice Exams", docs: "Documentation", article: "Articles & Guides" };
              return (
                <div key={type}>
                  <div style={{ fontSize: ".68rem", fontWeight: 600, textTransform: "uppercase", color: COLORS.t3, padding: "12px 0 6px", letterSpacing: ".06em" }}>{typeLabels[type]}</div>
                  {items.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                      background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8,
                      textDecoration: "none", marginBottom: 4, transition: "all 180ms",
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: ".85rem", fontWeight: 500, color: COLORS.t1 }}>{r.name}</div>
                        <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                          {r.domains.map(did => {
                            const d = EXAM_DOMAINS.find(x => x.id === did);
                            return d ? <span key={did} style={{ fontSize: ".55rem", padding: "1px 5px", borderRadius: 3, background: d.color + "22", color: d.color }}>{d.name.split(" ").slice(0, 2).join(" ")}</span> : null;
                          })}
                        </div>
                      </div>
                      <span style={{ fontSize: ".68rem", padding: "2px 8px", borderRadius: 100, background: r.free ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)", color: r.free ? "#22c55e" : "#f59e0b" }}>
                        {r.free ? "Free" : "Paid"}
                      </span>
                    </a>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ── VOCAB BANK ── */}
        {activeTab === "vocab" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={newVocab} onChange={e => setNewVocab(e.target.value)} placeholder="Term (e.g. semantic chunking)" style={{
                flex: 1, padding: "8px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 6,
                background: COLORS.input, color: COLORS.t1, fontFamily: "'DM Sans'", fontSize: ".85rem", outline: "none",
              }} />
              <input value={newVocabDef} onChange={e => setNewVocabDef(e.target.value)} placeholder="Definition" onKeyDown={e => e.key === "Enter" && addVocab()} style={{
                flex: 2, padding: "8px 12px", border: `1px solid ${COLORS.border}`, borderRadius: 6,
                background: COLORS.input, color: COLORS.t1, fontFamily: "'DM Sans'", fontSize: ".85rem", outline: "none",
              }} />
              <button onClick={addVocab} style={{
                padding: "8px 16px", borderRadius: 6, border: "none", background: "#3b82f6", color: "#fff",
                fontFamily: "'DM Sans'", fontSize: ".82rem", fontWeight: 500, cursor: "pointer",
              }}>Add</button>
            </div>

            {/* Pre-seeded vocab from exam topics */}
            {[
              { term: "Foundation Model (FM)", definition: "A large pre-trained AI model (like Claude, Llama, Titan) that can be adapted for various tasks via prompting or fine-tuning." },
              { term: "RAG", definition: "Retrieval-Augmented Generation — enriches LLM responses by retrieving relevant documents from a knowledge base before generating output." },
              { term: "Vector Store", definition: "A database optimized for storing and querying high-dimensional vector embeddings for semantic search (e.g., OpenSearch, FAISS, Pinecone)." },
              { term: "Embeddings", definition: "Numerical vector representations of text that capture semantic meaning, enabling similarity search." },
              { term: "Chunking", definition: "Splitting documents into smaller pieces for embedding. Strategies: fixed-size, semantic, hierarchical." },
              { term: "Bedrock Guardrails", definition: "AWS feature that filters harmful/unwanted content in FM inputs and outputs — content filtering, PII detection, topic blocking." },
              { term: "Prompt Engineering", definition: "Designing input prompts to guide FM behavior — includes few-shot, chain-of-thought, role-based, and template-based approaches." },
              { term: "Agentic AI", definition: "AI systems that autonomously plan, execute multi-step tasks, use tools, and make decisions — key 2026 paradigm shift." },
              { term: "Bedrock Agents", definition: "AWS service for building agents that can reason, plan, and call APIs/tools using foundation models as the reasoning engine." },
              { term: "AgentCore", definition: "AWS platform for deploying, scaling, and operating AI agents in production — runtime, gateway, memory, identity, observability." },
              { term: "Model Distillation", definition: "Training a smaller, cheaper model to mimic a larger model's behavior — reduces cost while preserving quality." },
              { term: "RAGAS", definition: "Open-source framework for evaluating RAG pipeline quality — measures faithfulness, answer relevance, context precision." },
              { term: "LLM-as-Judge", definition: "Using one LLM to evaluate the output quality of another — enables automated evaluation at scale." },
              { term: "Semantic Caching", definition: "Caching LLM responses keyed by semantic similarity of the input, not exact match — reduces redundant API calls." },
              { term: "Prompt Injection", definition: "Attack where malicious instructions are embedded in user input to manipulate FM behavior — guardrails defend against this." },
              ...vocabList,
            ].map((v, i) => (
              <div key={i} style={{
                padding: "10px 14px", background: COLORS.card, border: `1px solid ${COLORS.border}`,
                borderRadius: 8, marginBottom: 4,
              }}>
                <div style={{ fontWeight: 600, fontSize: ".85rem", color: "#22d3ee", fontFamily: "'JetBrains Mono'" }}>{v.term}</div>
                <div style={{ fontSize: ".8rem", color: COLORS.t2, marginTop: 2 }}>{v.definition}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
