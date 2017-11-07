const Koa = require('koa')
const Router = require('koa-router')
const Parser = require('koa-bodyparser')

const Ilp = require('koa-ilp')
const plugin = require('ilp-plugin')()
const ilp = new Ilp({ plugin })

const request = require('superagent')
const agent = require('superagent-ilp')(request, plugin)
const council = require('council')({ plugin })
const codiusHostPromise = council('org.codius')

// TODO: persistence
const debug = require('debug')('crontract')
const cron = require('cron')
const crypto = require('crypto')
const childProcess = require('child_process')
const jobs = {}
const TASK_TIMEOUT = 10000

const app = new Koa()
const router = Router()
const parser = Parser()

router.get('/', async (ctx) => {
  ctx.body = 'Hello World!'
})

/* {
  time: '* * * * *',
  run: '...',
}
*/
router.post('/jobs/:job', ilp.paid({ price: 1000 }), async (ctx) => {
  const jobInfo = jobs[ctx.params.job]
  const body = ctx.request.body

  if (jobInfo) {
    ctx.throw(422, JSON.stringify({ error: 'a job with that ID already exists' }))
    return
  }

  const token = crypto.randomBytes(16).toString('base64')
  const timeZone = body.timezone || 'America/Los_Angeles'
  const { time, task } = body
  const job = new cron.CronJob({
    cronTime: time,
    onTick: runJob.bind(null, ctx.params.job),
    start: true,
    timeZone
  })

  jobs[ctx.params.job] = {
    token,
    job,
    task,
    time,
    timeZone
  }

  debug('added job with id %s', ctx.params.job)
  ctx.body = {
    token,
    task,
    time,
    timeZone
  }

  ctx.status = 201
})

function getJobInfo (ctx) {
  const jobInfo = jobs[ctx.params.job]
  if (!jobInfo) {
    ctx.throw(422, JSON.stringify({ error: 'no job with the given ID exists' }))
    return
  } else if (ctx.get('authorization') !== `Bearer ${jobInfo.token}`) {
    ctx.throw(403, JSON.stringify({ error: 'unauthorized' }))
  }

  return jobInfo
}

router.delete('/jobs/:job', async (ctx) => {
  const jobInfo = getJobInfo(ctx)
  jobInfo.job.stop()

  debug('stopped job with id %s', ctx.params.job)
  ctx.status = 200
})

router.get('/jobs/:job', async (ctx) => {
  const jobInfo = getJobInfo(ctx)
  const { token, task, time, timeZone } = jobInfo

  debug('fetched job with id %s', ctx.params.job)
  ctx.body = {
    token,
    task,
    time,
    timeZone
  }
})

async function runJob (id) {
  debug('called job with id %s', id)
  const codiusHosts = await codiusHostPromise
  const manifest = {
    image: 'sharafian/crontract-task',
    port: 9999, // no port used
    environment: {},
    command: [ '/bin/bash', '-c', jobs[id].task ]
  }

  debug('calling codius')
  await agent
    .post(codiusHosts[0].host + '/start')
    .send({ manifest })
    .query({ duration: 10 })
    .pay(1000000)
}

app
  .use(parser)
  .use(router.allowedMethods())
  .use(router.routes())
  .listen(5001)
