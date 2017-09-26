const Koa = require('koa')
const Router = require('koa-router')
const Parser = require('koa-bodyparser')

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
router.post('/jobs/:job', /* TODO: make paid ,*/ async (ctx) => {
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

function runJob (id) {
  debug('called job with id %s', id)
  const process = childProcess.spawn('docker', [
    'run',
    '--rm', // remove container after task
    '-i', // don't daemonize
    'node', // runs bash on node image because it has stuff installed
    '/bin/bash', '-c', jobs[id].task // run task as bash command
  ], { stdio: 'inherit', detached: false, shell: false })

  let exited = false
  process.on('exit', () => {
    debug('process', process.pid,
      process.killed ? 'was killed' : 'exited')
    exited = true
  })
  debug('spawned process', process.pid)

  setTimeout(() => {
    if (exited) {
      debug('process', process.pid, 'is already dead')
    } else {
      debug('killing process', process.pid)
      process.kill('SIGKILL')
    }
  }, TASK_TIMEOUT)
}

app
  .use(parser)
  .use(router.allowedMethods())
  .use(router.routes())
  .listen(5001)
