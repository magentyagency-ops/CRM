import { config as loadEnv } from 'dotenv'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

loadEnv({ path: '.env.local' })
loadEnv()

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const dataDir = path.join(rootDir, 'data')
const storeFile = path.join(dataDir, 'crm.json')
const port = Number(process.env.PORT ?? 3002)

/* ---------------------------------------------------------------- schémas */

const StageSchema = z.enum(['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])
const PrioritySchema = z.enum(['low', 'medium', 'high'])
const EventKindSchema = z.enum(['call', 'meeting', 'demo', 'followup', 'internal'])

const ActivitySchema = z.object({
  id: z.string(),
  kind: z.enum(['note', 'call', 'email', 'meeting', 'stage']),
  text: z.string(),
  createdAt: z.string(),
})

const LeadSchema = z.object({
  id: z.string(),
  contact: z.string(),
  company: z.string(),
  email: z.string(),
  phone: z.string(),
  role: z.string(),
  source: z.string(),
  owner: z.string(),
  stage: StageSchema,
  value: z.number(),
  probability: z.number(),
  priority: PrioritySchema,
  nextStep: z.string(),
  expectedCloseAt: z.string(),
  tags: z.array(z.string()),
  notes: z.string(),
  activities: z.array(ActivitySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: EventKindSchema,
  start: z.string(),
  end: z.string(),
  leadId: z.string().nullable(),
  location: z.string(),
  notes: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const StateSchema = z.object({
  theme: z.enum(['light', 'midnight', 'ocean', 'sunset']),
  leads: z.array(LeadSchema),
  events: z.array(EventSchema),
})

type Lead = z.infer<typeof LeadSchema>
type CalendarEvent = z.infer<typeof EventSchema>
type State = z.infer<typeof StateSchema>

const LeadInputSchema = LeadSchema.omit({ id: true, createdAt: true, updatedAt: true, activities: true }).partial()
const EventInputSchema = EventSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial()

/* ------------------------------------------------------------- persistance */

const emptyState = (): State => ({ theme: 'light', leads: [], events: [] })

let writeQueue: Promise<void> = Promise.resolve()

async function readState(): Promise<State> {
  try {
    const raw = await fs.readFile(storeFile, 'utf8')
    const parsed = StateSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
    console.warn('[crm] fichier de données invalide, réinitialisation en mémoire')
    return emptyState()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState()
    throw error
  }
}

async function writeState(state: State): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(dataDir, { recursive: true })
    const tmp = `${storeFile}.tmp`
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
    await fs.rename(tmp, storeFile)
  })
  return writeQueue
}

async function mutate<T>(fn: (state: State) => T | Promise<T>): Promise<T> {
  const state = await readState()
  const result = await fn(state)
  await writeState(state)
  return result
}

const now = () => new Date().toISOString()

function newLead(input: Partial<Lead>): Lead {
  const stamp = now()
  return {
    id: randomUUID(),
    contact: input.contact?.trim() || 'Nouveau contact',
    company: input.company?.trim() ?? '',
    email: input.email?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    role: input.role?.trim() ?? '',
    source: input.source?.trim() ?? 'Direct',
    owner: input.owner?.trim() ?? '',
    stage: input.stage ?? 'new',
    value: Number.isFinite(input.value) ? Number(input.value) : 0,
    probability: Number.isFinite(input.probability) ? Number(input.probability) : 10,
    priority: input.priority ?? 'medium',
    nextStep: input.nextStep?.trim() ?? '',
    expectedCloseAt: input.expectedCloseAt ?? '',
    tags: input.tags ?? [],
    notes: input.notes ?? '',
    activities: [],
    createdAt: stamp,
    updatedAt: stamp,
  }
}

function newEvent(input: Partial<CalendarEvent>): CalendarEvent {
  const stamp = now()
  const start = input.start ?? stamp
  return {
    id: randomUUID(),
    title: input.title?.trim() || 'Rendez-vous',
    kind: input.kind ?? 'meeting',
    start,
    end: input.end ?? new Date(new Date(start).getTime() + 45 * 60_000).toISOString(),
    leadId: input.leadId ?? null,
    location: input.location?.trim() ?? '',
    notes: input.notes ?? '',
    done: input.done ?? false,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

/* ------------------------------------------------------------------- API */

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next)
  }

app.get('/api/state', asyncRoute(async (_req, res) => {
  res.json(await readState())
}))

app.put('/api/theme', asyncRoute(async (req, res) => {
  const theme = StateSchema.shape.theme.parse(req.body?.theme)
  await mutate((state) => {
    state.theme = theme
  })
  res.json({ theme })
}))

app.post('/api/leads', asyncRoute(async (req, res) => {
  const input = LeadInputSchema.parse(req.body ?? {})
  const lead = await mutate((state) => {
    const created = newLead(input)
    created.activities.push({
      id: randomUUID(),
      kind: 'stage',
      text: 'Lead créé.',
      createdAt: created.createdAt,
    })
    state.leads.unshift(created)
    return created
  })
  res.status(201).json(lead)
}))

app.patch('/api/leads/:id', asyncRoute(async (req, res) => {
  const input = LeadInputSchema.parse(req.body ?? {})
  const lead = await mutate((state) => {
    const target = state.leads.find((item) => item.id === req.params.id)
    if (!target) return null
    const previousStage = target.stage
    Object.assign(target, input)
    target.updatedAt = now()
    if (input.stage && input.stage !== previousStage) {
      target.activities.unshift({
        id: randomUUID(),
        kind: 'stage',
        text: `Étape : ${previousStage} → ${input.stage}.`,
        createdAt: target.updatedAt,
      })
    }
    return target
  })
  if (!lead) return res.status(404).json({ error: 'Lead introuvable.' })
  res.json(lead)
}))

app.post('/api/leads/:id/activities', asyncRoute(async (req, res) => {
  const payload = ActivitySchema.omit({ id: true, createdAt: true }).parse(req.body ?? {})
  const lead = await mutate((state) => {
    const target = state.leads.find((item) => item.id === req.params.id)
    if (!target) return null
    target.activities.unshift({ id: randomUUID(), ...payload, createdAt: now() })
    target.updatedAt = now()
    return target
  })
  if (!lead) return res.status(404).json({ error: 'Lead introuvable.' })
  res.status(201).json(lead)
}))

app.delete('/api/leads/:id', asyncRoute(async (req, res) => {
  await mutate((state) => {
    state.leads = state.leads.filter((item) => item.id !== req.params.id)
    state.events = state.events.map((event) =>
      event.leadId === req.params.id ? { ...event, leadId: null } : event,
    )
  })
  res.status(204).end()
}))

app.post('/api/events', asyncRoute(async (req, res) => {
  const input = EventInputSchema.parse(req.body ?? {})
  const event = await mutate((state) => {
    const created = newEvent(input)
    state.events.push(created)
    return created
  })
  res.status(201).json(event)
}))

app.patch('/api/events/:id', asyncRoute(async (req, res) => {
  const input = EventInputSchema.parse(req.body ?? {})
  const event = await mutate((state) => {
    const target = state.events.find((item) => item.id === req.params.id)
    if (!target) return null
    Object.assign(target, input)
    target.updatedAt = now()
    return target
  })
  if (!event) return res.status(404).json({ error: 'Rendez-vous introuvable.' })
  res.json(event)
}))

app.delete('/api/events/:id', asyncRoute(async (req, res) => {
  await mutate((state) => {
    state.events = state.events.filter((item) => item.id !== req.params.id)
  })
  res.status(204).end()
}))

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Données invalides.', details: error.issues })
  }
  console.error('[crm]', error)
  res.status(500).json({ error: 'Erreur serveur.' })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`[crm] API prête sur http://127.0.0.1:${port}`)
})
