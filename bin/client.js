const plugin = require('ilp-plugin')()
const request = require('superagent')
const agent = require('superagent-ilp')(request, plugin)
const uuid = require('uuid')
const table = require('good-table')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const MAX_PAYMENT = 1000000

require('yargs')
  .option('crontract', {
    alias: 'c',
    describe: 'crontract URI to talk to',
    default: process.env.CRONTRACT_URI || 'localhost:5001'
  })
  .option('file', {
    alias: 'f',
    describe: 'config file to load from',
    default: path.join(__dirname, '.crontractrc')
  })
  .command('list', 'list all deployed jobs', () => {}, argv => {
    const config = readConfig(argv.file)
    const jobList = config.jobs.map(j => {
      return [ j.id || '', j.time || '', j.task || '', j.crontract || '' ]
    })

    console.log(table([
      [ chalk.yellow('id'), chalk.yellow('repeat'), chalk.yellow('task'), chalk.yellow('crontract') ],
      ...jobList
    ]))
  })
  .command('upload [id]', 'start a crontract job', yargs => {
    yargs.option('task', {
      alias: 't',
      describe: 'task to deploy',
      required: true
    })

    yargs.option('repeat', {
      alias: 'r',
      describe: 'interval at which to perform task',
      required: true
    })
  }, async argv => {
    const id = argv.id || uuid()
    const crontract = argv.crontract
    console.log(table([
      [ chalk.yellow('task:'), argv.task ],
      [ chalk.yellow('repeat:'), argv.repeat ],
      [ chalk.yellow('crontract:'), crontract ],
      [ chalk.yellow('id:'), id ]
    ]))

    console.log(chalk.grey('uploading to ' + argv.crontract))
    const config = readConfig(argv.file)

    const res = await agent
      .post(argv.crontract + '/jobs/' + id)
      .send({
        task: argv.task,
        time: argv.repeat
      })
      .pay(MAX_PAYMENT)

    console.log(chalk.grey('storing details in ' + argv.file))
    config.jobs.push(Object.assign({ id, crontract }, res.body))
    writeConfig(argv.file, config)
    console.log(chalk.green('uploaded with id ' + id))
    process.exit(0)
  })
  .command('get <id>', 'get a deployed crontract job', yargs => {
  }, argv => {
    const config = readConfig(argv.file)
    const { job, index } = getJobById(config, argv.id)

    console.log(table([
      [ chalk.yellow('id:'), job.id ],
      [ chalk.yellow('crontract:'), job.crontract ]
    ]))
  })
  .command('delete <id>', 'stop a deployed crontract job', yargs => {
  }, argv => {
    const config = readConfig(argv.file)
    const { job, index } = getJobById(config, argv.id)

    console.log(table([
      [ chalk.yellow('id:'), job.id ],
      [ chalk.yellow('crontract:'), job.crontract ]
    ]))

    agent
      .delete(job.crontract + '/jobs/' + job.id)
      .set('Authorization', 'Bearer ' + job.token)
      .end((err, res) => {
        if (err) {
          console.error(chalk.red(err.stack))
          return
        }

        console.log(chalk.grey('removing job from config'))
        config.jobs.splice(index, 1)
        writeConfig(argv.file, config)
        console.log(chalk.green('deleted with id ' + argv.id))
      })
  }).argv

function readConfig (file) {
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file))
  } else {
    const init = {
      jobs: []
    }

    fs.writeFileSync(file, JSON.stringify(init))
    return init
  }
}

function writeConfig (file, config) {
  fs.writeFileSync(file, JSON.stringify(config))
}

function getJobById (config, id) {
  let match

  for (let index = 0; index < config.jobs.length; ++index) {
    const job = config.jobs[index]
    if (job.id.startsWith(id)) {
      if (job.id === id) return { job, index }
      if (match) throw new Error('ambgiuous job id')
      match = { job, index }
    }
  }

  return match
}
