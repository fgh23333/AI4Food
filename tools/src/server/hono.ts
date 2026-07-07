import { Hono } from 'hono'
import { loadIndex } from '../indexer'

export function createApp(): Hono {
  const app = new Hono()

  app.get('/api/restaurants', (c) => {
    return c.json(loadIndex())
  })

  app.get('/api/restaurants/:id', (c) => {
    const id = c.req.param('id')
    const list = loadIndex()
    const found = list.find((r) => r.id === id)
    if (!found) return c.json({ error: 'not found' }, 404)
    return c.json(found)
  })

  // 预留：下一期接入 LLM
  // app.post('/api/ai/recommend', ...)

  return app
}
