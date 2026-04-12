/**
 * botWorker.js
 * Wrapper around the Pente AI Web Worker.
 * Provides a promise-based interface for requesting moves.
 */

export class BotWorkerManager {
  constructor() {
    this.worker = null
    this.pending = null // { resolve, reject, timeout }
  }

  /**
   * Lazily create the worker on first use.
   * Worker file lives at /penteWorker.js (public folder).
   */
  ensureWorker() {
    if (this.worker) return
    if (typeof window === 'undefined') return // SSR guard
    this.worker = new Worker('/penteWorker.js')
    this.worker.onmessage = (e) => this.handleMessage(e.data)
    this.worker.onerror = (e) => this.handleError(e)
  }

  handleMessage(data) {
    if (!this.pending) return
    const { resolve, timeout } = this.pending
    this.pending = null
    clearTimeout(timeout)
    if (data.type === 'move') {
      resolve(data.result)
    } else if (data.type === 'puzzle') {
      resolve(data.puzzle)
    } else if (data.type === 'error') {
      resolve(null) // degrade gracefully — caller handles null
    }
  }

  handleError(err) {
    if (!this.pending) return
    const { resolve, timeout } = this.pending
    this.pending = null
    clearTimeout(timeout)
    console.error('[BotWorker] error:', err)
    resolve(null)
  }

  /**
   * Request the best move from the engine.
   * @param {number[][]} board - Current board state
   * @param {number} player - Who is moving (BLACK, WHITE, RED, BLUE)
   * @param {object} captures - Current capture counts
   * @param {object} config - Engine config: { searchDepth, timeBudgetMs, blunderRate }
   * @param {object|null} gameMode - Game mode config (null for classic)
   * @param {number} [timeoutMs=10000] - Hard timeout (kills stuck workers)
   * @returns {Promise<{ row, col, score, depth, nodes }|null>}
   */
  findMove(board, player, captures, config, gameMode, timeoutMs = 10000) {
    this.ensureWorker()
    if (!this.worker) return Promise.resolve(null) // SSR or worker unavailable

    // Cancel any pending request
    if (this.pending) {
      this.pending.resolve(null)
      clearTimeout(this.pending.timeout)
      this.pending = null
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.pending) {
          this.pending = null
          resolve(null)
        }
      }, timeoutMs)

      this.pending = { resolve, timeout }

      this.worker.postMessage({
        type: 'findMove',
        board,
        player,
        captures,
        config,
        gameMode,
      })
    })
  }

  /**
   * Generate a puzzle calibrated to the target ELO.
   * Runs bot-vs-bot games in the worker to find puzzle-worthy positions.
   * @param {number} targetElo - Player's current ELO for difficulty calibration
   * @param {object} [opts]
   * @param {string} [opts.preferredCategory] - Bias the generator toward a category (defense/capture/five_in_a_row/mixed). Falls back to best available if exhausted.
   * @param {number} [opts.timeoutMs=15000] - Hard timeout
   * @returns {Promise<object|null>} Generated puzzle or null
   */
  generatePuzzle(targetElo = 1000, opts = {}) {
    const { preferredCategory = null, timeoutMs = 15000 } = opts
    this.ensureWorker()
    if (!this.worker) return Promise.resolve(null)

    if (this.pending) {
      this.pending.resolve(null)
      clearTimeout(this.pending.timeout)
      this.pending = null
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.pending) {
          this.pending = null
          resolve(null)
        }
      }, timeoutMs)

      this.pending = { resolve, timeout }
      this.worker.postMessage({ type: 'generatePuzzle', targetElo, preferredCategory })
    })
  }

  /**
   * Terminate the worker. Call on component unmount.
   */
  terminate() {
    if (this.pending) {
      this.pending.resolve(null)
      clearTimeout(this.pending.timeout)
      this.pending = null
    }
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}
