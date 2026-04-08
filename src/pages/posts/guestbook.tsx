import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'

/* ── Typography options for the picker ── */
const FONTS = [
  { name: 'Inter', css: 'Inter, system-ui, sans-serif', label: 'Clean Sans' },
  { name: 'Georgia', css: 'Georgia, Cambria, serif', label: 'Classic Serif' },
  { name: 'Courier New', css: '"Courier New", Courier, monospace', label: 'Typewriter' },
  { name: 'Trebuchet MS', css: '"Trebuchet MS", Helvetica, sans-serif', label: 'Friendly' },
  { name: 'Palatino', css: 'Palatino, "Palatino Linotype", serif', label: 'Elegant' },
  { name: 'Comic Sans MS', css: '"Comic Sans MS", cursive', label: 'Playful' },
  { name: 'Lucida Console', css: '"Lucida Console", Monaco, monospace', label: 'Terminal' },
  { name: 'Impact', css: 'Impact, Haettenschweiler, sans-serif', label: 'Bold' },
]

type Element = { id: number; name: string; description: string; contributor: string | null }
type Rubric = { id: number; name: string; description: string; elements: Element[] }
type Selection = { rubric: string; element: string; contributor: string | null }
type Page = {
  id: number; title: string; prompt_text: string; generated_story: string | null;
  font_family: string; username: string; created_at: string; selections: Selection[]
}

export default function GuestBook() {
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [view, setView] = useState<'book' | 'sign'>('book')
  const [loading, setLoading] = useState(true)

  // Sign form state
  const [username, setUsername] = useState('')
  const [title, setTitle] = useState('')
  const [selectedFont, setSelectedFont] = useState(FONTS[0])
  const [selections, setSelections] = useState<Record<number, number>>({}) // rubric_id -> element_id
  const [newElements, setNewElements] = useState<Record<number, { name: string; description: string }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [rubricRes, pageRes] = await Promise.all([
      fetch('/api/guestbook/rubrics'),
      fetch('/api/guestbook/pages'),
    ])
    setRubrics(await rubricRes.json())
    setPages(await pageRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSelect = (rubricId: number, elementId: number) => {
    setSelections(prev => ({ ...prev, [rubricId]: elementId }))
    // Clear any new-element draft for this rubric
    setNewElements(prev => {
      const next = { ...prev }
      delete next[rubricId]
      return next
    })
  }

  const handleNewElementDraft = (rubricId: number, field: 'name' | 'description', value: string) => {
    setNewElements(prev => ({
      ...prev,
      [rubricId]: { ...prev[rubricId], [field]: value } as { name: string; description: string },
    }))
    // Deselect any picked element for this rubric
    setSelections(prev => {
      const next = { ...prev }
      delete next[rubricId]
      return next
    })
  }

  const handleSubmit = async () => {
    if (!username.trim()) return setError('Please enter your name')
    if (!title.trim()) return setError('Give your page a title')

    setSubmitting(true)
    setError('')

    // First, create any new elements
    const finalSelections = { ...selections }

    for (const [rubricIdStr, draft] of Object.entries(newElements)) {
      if (!draft?.name?.trim()) continue
      const rubricId = Number(rubricIdStr)
      const res = await fetch('/api/guestbook/elements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rubric_id: rubricId,
          name: draft.name.trim(),
          description: draft.description?.trim() || '',
          username: username.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Failed to create element')
        setSubmitting(false)
        return
      }
      const element = await res.json()
      finalSelections[rubricId] = element.id
    }

    const elementIds = Object.values(finalSelections)
    if (elementIds.length === 0) {
      setError('Select or create at least one element')
      setSubmitting(false)
      return
    }

    const res = await fetch('/api/guestbook/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        username: username.trim(),
        font_family: selectedFont.name,
        element_ids: elementIds,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setError(err.error || 'Failed to create page')
      setSubmitting(false)
      return
    }

    // Reset and go back to book view
    setSelections({})
    setNewElements({})
    setTitle('')
    setView('book')
    setSubmitting(false)
    fetchData()
  }

  const filledCount = Object.keys(selections).length + Object.values(newElements).filter(d => d?.name?.trim()).length

  return (
    <>
      <Head>
        <title>Guest Book | Brooks Roley</title>
        <meta name="description" content="Sign the guest book — build a short-story prompt from collaborative ad-lib rubrics" />
      </Head>

      <div className="min-h-screen bg-forest-950 text-forest-100">
        {/* Header */}
        <header className="border-b border-forest-800/50 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-forest-400 hover:text-candy-400 transition-colors text-sm">
                &larr; Home
              </Link>
              <h1 className="text-xl font-bold text-forest-100">Guest Book</h1>
            </div>
            <button
              onClick={() => setView(view === 'book' ? 'sign' : 'book')}
              className="px-4 py-2 rounded-lg bg-candy-600 hover:bg-candy-500 text-white text-sm font-medium transition-colors"
            >
              {view === 'book' ? 'Sign the Book' : 'View Pages'}
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          {loading ? (
            <div className="text-center py-20 text-forest-500">Loading guest book...</div>
          ) : view === 'book' ? (
            /* ═══ BOOK VIEW ═══ */
            <div className="space-y-6">
              <p className="text-forest-400 text-sm">
                Each page is a collaboratively built short-story prompt. Sign the book to add yours.
              </p>

              {pages.length === 0 ? (
                <div className="text-center py-16 text-forest-600">
                  <p className="text-lg">The book is empty.</p>
                  <p className="text-sm mt-2">Be the first to sign it.</p>
                </div>
              ) : (
                pages.map(page => (
                  <article
                    key={page.id}
                    className="border border-forest-800/50 rounded-xl p-6 bg-forest-900/30 hover:border-forest-700/50 transition-colors"
                    style={{ fontFamily: FONTS.find(f => f.name === page.font_family)?.css || FONTS[0].css }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-bold text-forest-100">{page.title}</h2>
                        <p className="text-xs text-forest-500 mt-1">
                          by <span className="text-candy-400">{page.username}</span>
                          {' '}&middot;{' '}
                          {new Date(page.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-forest-600 font-mono">
                        {FONTS.find(f => f.name === page.font_family)?.label || 'Sans'}
                      </span>
                    </div>

                    {/* Selections as tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {page.selections.map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-forest-800/60 text-forest-300 border border-forest-700/40"
                        >
                          <span className="text-forest-500">{s.rubric}:</span>
                          <span className="font-medium text-forest-200">{s.element}</span>
                          {s.contributor && (
                            <span className="text-candy-500/70 text-[10px]">({s.contributor})</span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Prompt text */}
                    <div className="bg-forest-950/50 rounded-lg p-4 border border-forest-800/30">
                      <p className="text-xs uppercase tracking-widest text-forest-600 mb-2 font-mono">Prompt</p>
                      <p className="text-sm text-forest-300 whitespace-pre-line leading-relaxed">
                        {page.prompt_text}
                      </p>
                    </div>

                    {page.generated_story && (
                      <div className="mt-4 bg-void-950/30 rounded-lg p-4 border border-void-800/30">
                        <p className="text-xs uppercase tracking-widest text-void-400 mb-2 font-mono">Story</p>
                        <p className="text-sm text-forest-200 whitespace-pre-line leading-relaxed">
                          {page.generated_story}
                        </p>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          ) : (
            /* ═══ SIGN VIEW ═══ */
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-forest-100 mb-1">Sign the Guest Book</h2>
                <p className="text-forest-400 text-sm">
                  Pick one ingredient from each rubric (or add your own), choose a font, and title your page.
                </p>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Username */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                  Your Name
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your name to sign"
                  className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50 transition-colors"
                  maxLength={50}
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-forest-500 mb-2 font-mono">
                  Page Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder='e.g. "Cyberpunk Heist Gone Wrong"'
                  className="w-full bg-forest-900/50 border border-forest-700/50 rounded-lg px-4 py-3 text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50 transition-colors"
                  maxLength={255}
                />
              </div>

              {/* Typography Picker */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-forest-500 mb-3 font-mono">
                  Typography
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FONTS.map(font => (
                    <button
                      key={font.name}
                      onClick={() => setSelectedFont(font)}
                      className={`px-3 py-3 rounded-lg border text-sm transition-all ${
                        selectedFont.name === font.name
                          ? 'border-candy-500 bg-candy-500/10 text-candy-300'
                          : 'border-forest-700/50 bg-forest-900/30 text-forest-400 hover:border-forest-600'
                      }`}
                      style={{ fontFamily: font.css }}
                    >
                      <span className="block text-base mb-0.5">{font.label}</span>
                      <span className="block text-[10px] opacity-60">The quick brown fox</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rubric Selections */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="block text-xs uppercase tracking-widest text-forest-500 font-mono">
                    Story Ingredients
                  </label>
                  <span className="text-xs text-forest-600">
                    {filledCount} of {rubrics.length} selected
                  </span>
                </div>

                {rubrics.map(rubric => {
                  const selectedId = selections[rubric.id]
                  const draft = newElements[rubric.id]
                  const isAddingNew = draft?.name !== undefined

                  return (
                    <div key={rubric.id} className="border border-forest-800/50 rounded-xl p-5 bg-forest-900/20">
                      <div className="mb-3">
                        <h3 className="font-semibold text-forest-200">{rubric.name}</h3>
                        <p className="text-xs text-forest-500 mt-0.5">{rubric.description}</p>
                      </div>

                      {/* Existing elements */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {rubric.elements.map((el: Element) => (
                          <button
                            key={el.id}
                            onClick={() => handleSelect(rubric.id, el.id)}
                            title={el.description || el.name}
                            className={`px-3 py-1.5 rounded-full text-xs transition-all border ${
                              selectedId === el.id
                                ? 'border-candy-500 bg-candy-500/15 text-candy-300'
                                : 'border-forest-700/40 bg-forest-800/40 text-forest-400 hover:border-forest-600 hover:text-forest-300'
                            }`}
                          >
                            {el.name}
                            {el.contributor && (
                              <span className="ml-1 text-forest-600 text-[10px]">({el.contributor})</span>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Add new element toggle */}
                      {!isAddingNew ? (
                        <button
                          onClick={() => handleNewElementDraft(rubric.id, 'name', '')}
                          className="text-xs text-candy-500/70 hover:text-candy-400 transition-colors"
                        >
                          + Add your own
                        </button>
                      ) : (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={draft?.name || ''}
                            onChange={e => handleNewElementDraft(rubric.id, 'name', e.target.value)}
                            placeholder="Element name"
                            className="flex-1 bg-forest-950/50 border border-forest-700/50 rounded-lg px-3 py-2 text-sm text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50"
                            maxLength={255}
                          />
                          <input
                            type="text"
                            value={draft?.description || ''}
                            onChange={e => handleNewElementDraft(rubric.id, 'description', e.target.value)}
                            placeholder="Brief description"
                            className="flex-1 bg-forest-950/50 border border-forest-700/50 rounded-lg px-3 py-2 text-sm text-forest-100 placeholder-forest-600 focus:outline-none focus:border-candy-500/50"
                          />
                          <button
                            onClick={() => {
                              setNewElements(prev => {
                                const next = { ...prev }
                                delete next[rubric.id]
                                return next
                              })
                            }}
                            className="text-forest-600 hover:text-forest-400 text-xs px-2"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Preview */}
              {(title || filledCount > 0) && (
                <div
                  className="border border-forest-700/30 rounded-xl p-5 bg-forest-900/10"
                  style={{ fontFamily: selectedFont.css }}
                >
                  <p className="text-xs uppercase tracking-widest text-forest-600 mb-3 font-mono" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Preview
                  </p>
                  {title && <h3 className="text-lg font-bold text-forest-200 mb-2">{title}</h3>}
                  <p className="text-sm text-forest-400 whitespace-pre-line">
                    {buildPreviewPrompt(rubrics, selections, newElements)}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-candy-600 hover:bg-candy-500 disabled:bg-forest-700 disabled:text-forest-500 text-white font-medium transition-colors"
              >
                {submitting ? 'Signing...' : 'Sign the Guest Book'}
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

function buildPreviewPrompt(
  rubrics: Rubric[],
  selections: Record<number, number>,
  newElements: Record<number, { name: string; description: string }>
): string {
  const lines: string[] = ['Write a short story with the following ingredients:']
  for (const rubric of rubrics) {
    const selectedId = selections[rubric.id]
    const draft = newElements[rubric.id]
    if (selectedId) {
      const el = rubric.elements.find((e: Element) => e.id === selectedId)
      if (el) lines.push(`${rubric.name}: ${el.name}`)
    } else if (draft?.name?.trim()) {
      lines.push(`${rubric.name}: ${draft.name.trim()}`)
    }
  }
  return lines.length > 1 ? lines.join('\n') : ''
}
