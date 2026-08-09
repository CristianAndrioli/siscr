/**
 * Worker de entrada: HTTPS público → container Node (mTLS SEFAZ).
 * Auth Bearer no Worker; container só faz mTLS.
 * Singleton compartilhado entre tenants (A1 vai por request nos headers).
 */
import { Container, getContainer } from '@cloudflare/containers'

export interface Env {
  SEFAZ_BRIDGE: DurableObjectNamespace
  BRIDGE_TOKEN: string
}

export class SefazBridgeContainer extends Container<Env> {
  defaultPort = 8788
  sleepAfter = '10m'
  enableInternet = true
  pingEndpoint = '/health'

  envVars = {
    PORT: '8788',
    // Auth fica no Worker; container aceita chamadas internas sem token
    BRIDGE_TOKEN: '',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Health público (monitoramento)
    if (request.method === 'GET' && url.pathname === '/health') {
      const container = getContainer(env.SEFAZ_BRIDGE, 'singleton')
      await container.startAndWaitForPorts()
      return container.fetch(request)
    }

    const token = (env.BRIDGE_TOKEN || '').trim()
    if (token) {
      const auth = request.headers.get('Authorization') || ''
      if (auth !== `Bearer ${token}`) {
        return Response.json(
          { error: 'Não autorizado. Use Authorization: Bearer <BRIDGE_TOKEN>.' },
          { status: 401 },
        )
      }
    }

    const container = getContainer(env.SEFAZ_BRIDGE, 'singleton')
    await container.startAndWaitForPorts()
    return container.fetch(request)
  },
}
