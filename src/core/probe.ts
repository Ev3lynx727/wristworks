import { connect } from 'node:net'

export interface ProbeResult {
  up: boolean
  server?: string
  statusCode?: number
  latencyMs: number
  error?: string
}

export async function probeHttp(host: string, port: number = 443, timeoutMs: number = 5000): Promise<ProbeResult> {
  const start = Date.now()

  return new Promise((resolve) => {
    const socket = connect(port, host, () => {
      socket.write(`HEAD / HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`)
    })

    let data = ''
    socket.setTimeout(timeoutMs)

    socket.on('data', (chunk: Buffer) => {
      data += chunk.toString()
    })

    socket.on('end', () => {
      const totalMs = Date.now() - start
      const statusLine = data.split('\r\n')[0] || ''
      const statusCode = parseInt(statusLine.split(' ')[1], 10)
      const serverHeader = data.split('\r\n').find(l => l.toLowerCase().startsWith('server:'))
      const server = serverHeader ? serverHeader.split(':')[1]?.trim() : undefined
      resolve({
        up: true,
        server,
        statusCode: isNaN(statusCode) ? undefined : statusCode,
        latencyMs: totalMs,
      })
    })

    socket.on('error', (err: Error & { code?: string }) => {
      resolve({ up: false, latencyMs: Date.now() - start, error: err.code || err.message })
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve({ up: false, latencyMs: Date.now() - start, error: 'timeout' })
    })
  })
}
