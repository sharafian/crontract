const agent = require('superagent')
const uuid = require('uuid')
const table = require('good-table')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')

require('yargs')
  .option('crontract', {
    alias: 'c',
    describe: 'crontract URI to talk to',
    default: 'localhost:5001'
  })
  .option('file', {
    alias: 'f',
    describe: 'config file to load from',
    default: path.join(__dirname, '.crontractrc')
  })
  .command('list', 'list all deployed jobs', () => {}, argv => {
    const config = readConfig(argv.file)
    const jobList = config.jobs.map(j => {
      return [ j.id || '', j.time || '', j.task || '' ]
    })

    console.log(table([
      [ chalk.yellow('id'), chalk.yellow('repeat'), chalk.yellow('task') ],
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
  }, argv => {
    const id = argv.id || uuid()
    console.log(table([
      [ chalk.yellow('task:'), argv.task ],
      [ chalk.yellow('repeat:'), argv.repeat ],
      [ chalk.yellow('crontract:'), argv.crontract ],
      [ chalk.yellow('id:'), id ]
    ]))

    console.log(chalk.grey('uploading to ' + argv.crontract))
    const config = readConfig(argv.file)

    agent
      .post(argv.crontract + '/jobs/' + id)
      .send({
        task: argv.task,
        time: argv.repeat
      })
      .end((err, res) => {
        if (err) {
          console.error(chalk.red(err.stack))
          return
        }

        console.log(chalk.grey('storing details in ' + argv.file))
        config.jobs.push(Object.assign({ id }, res.body))
        writeConfig(argv.file, config)

        console.log(chalk.green('uploaded with id ' + id))
      })
  })
  .command('get <id>', 'get a deployed crontract job', yargs => {
  }, argv => {
    console.log(table([
      [ chalk.yellow('id:'), argv.id ],
      [ chalk.yellow('crontract:'), argv.crontract ]
    ]))
  })
  .command('delete <id>', 'stop a deployed crontract job', yargs => {
  }, argv => {
    const config = readConfig(argv.file)
    const { job, index } = getJobById(config, argv.id)

    console.log(table([
      [ chalk.yellow('id:'), job.id ],
      [ chalk.yellow('crontract:'), argv.crontract ]
    ]))

    agent
      .delete(argv.crontract + '/jobs/' + job.id)
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

  config.jobs.forEach((job, index) => {
    if (job.id.startsWith(id)) {
      if (job.id === id) return { job, index }
      if (match) throw new Error('ambgiuous job id')
      match = { job, index }
    }
  })

  return match
}
