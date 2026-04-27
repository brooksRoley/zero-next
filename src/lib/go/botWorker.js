/**
 * Promise-based wrapper around the Go Web Worker. Mirrors the Pente
 * `BotWorkerManager` pattern. Each call gets a unique request id; responses
 * resolve the matching pending promise. A wall-clock timeout protects the UI
 * from a hung worker — on timeout we resolve with `{ move: null }` so callers
 * can continue without throwing.
 */
export class GoBotWorkerManager {
  constructor() {
    this.worker = null
    this.pending = new Map()
    this.nextId = 1
  }

  ensureWorker() {
    if (this.worker) return
    if (typeof window === 'undefined') return
    this.worker = new Worker('/goWorker.js')
    this.worker.onmessage = (e) => {
      const { id, result } = e.data || {}
      const pending = this.pending.get(id)
      if (!pending) return
      this.pending.delete(id)
      clearTimeout(pending.timeoutId)
      pending.resolve(result)
    }
    this.worker.onerror = () => {
      for (const { resolve, timeoutId } of this.pending.values()) {
        clearTimeout(timeoutId)
        resolve({ move: null, reason: 'worker_error' })
      }
      this.pending.clear()
    }
  }

  findResponse(board, color, goal, koPoint, timeoutMs = 1500, level = 2) {
    this.ensureWorker()
    if (!this.worker) {
      return Promise.resolve({ move: null, reason: 'no_worker' })
    }
    return new Promise((resolve) => {
      const id = this.nextId++
      const timeoutId = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          resolve({ move: null, reason: 'timeout' })
        }
      }, timeoutMs)
      this.pending.set(id, { resolve, timeoutId })
      this.worker.postMessage({
        id,
        type: 'find_response',
        payload: { board, color, goal, koPoint, level },
      })
    })
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    for (const { timeoutId } of this.pending.values()) clearTimeout(timeoutId)
    this.pending.clear()
  }
}
