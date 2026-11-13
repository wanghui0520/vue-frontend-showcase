/**
 * SSE 流式请求客户端（展示版）
 * Fetch + ReadableStream + AbortController
 * - 按 \n\n 切分完整 SSE 帧，处理半帧粘包
 * - AbortSignal.any 合并「用户中断」与「超时」两个信号
 * - 分类型抛错：HTTP 非 200 / 网络中断 / 超时 / Abort
 */

const DEFAULT_TIMEOUT = 30 * 60 * 1000

export function createStreamClient({ baseURL = '', timeout = DEFAULT_TIMEOUT } = {}) {
  /**
   * @param {string} url
   * @param {object} data
   * @param {(sse: {event:string, data:any}) => void} onMessage
   * @param {() => void} onComplete
   * @param {(err: Error & {type?: string}) => void} onError
   * @param {{signal?: AbortSignal}} [options]
   */
  function streamRequest(url, data, onMessage, onComplete, onError, options = {}) {
    const userSignal = options.signal
    const timeoutSignal = AbortSignal.timeout(timeout)
    // 合并「用户中断」与「超时」：任一触发即中止请求
    const signal = userSignal ? AbortSignal.any([userSignal, timeoutSignal]) : timeoutSignal

    let completed = false
    let buffer = ''

    const finish = () => {
      if (completed) return
      completed = true
      onComplete?.()
    }

    fetch(baseURL + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}: ${response.statusText}`)
          err.type = 'http'
          throw err
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')

        // 循环读取字节流 → 解码 → 按 \n\n 切帧
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const frames = buffer.split(/\n\n/)
          buffer = frames.pop() || '' // 最后一段可能是不完整帧，留待下次拼接
          for (const frame of frames) {
            const sse = parseFrame(frame)
            if (sse) onMessage?.(sse)
          }
        }
        // 收尾：处理残余的完整帧
        if (buffer.trim()) {
          const sse = parseFrame(buffer)
          if (sse) onMessage?.(sse)
        }
        finish()
      })
      .catch((error) => {
        if (completed) return
        if (error.name === 'AbortError') {
          // 区分用户中断与超时
          const err = new Error(userSignal?.aborted ? '用户中断请求' : '请求超时')
          err.type = userSignal?.aborted ? 'abort' : 'timeout'
          onError?.(err)
        } else if (error.name === 'TimeoutError') {
          onError?.(Object.assign(new Error('请求超时'), { type: 'timeout' }))
        } else {
          error.type = error.type || 'network'
          onError?.(error)
        }
        completed = true
      })

    return { abort: () => {} }
  }

  /** 解析单个 SSE 帧：event / data 两段 */
  function parseFrame(frame) {
    let event = 'message'
    let data = ''
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return null
    try {
      return { event, data: JSON.parse(data) }
    } catch {
      return { event, data }
    }
  }

  return { streamRequest }
}
