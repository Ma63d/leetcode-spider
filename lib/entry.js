'use strict'
const debug = require('debug')('lc-spider')
let chalk = require('chalk')
let log4js = require('log4js')
const ensureDirectoryExists = require('./util').ensureDirectoryExists

log4js.configure({
    appenders: [{
        type: 'console',
        layout: {
            type: 'pattern',
            pattern: `[%r] ${chalk.blue('[lc-spider]')} %[%p%] - %m`
        }
    }]
})
let logger = log4js.getLogger('layout-pattern')

let thenify = require('thenify')
let path = require('path')
let argv = require('yargs')
    .option('c', {
        alias: 'config',
        default: 'config.json',
        demand: false,
        describe: `Use specified config file to download your leetcode accepted solutions.We use 'config.json' by default.`,
        type: 'string'
    })
    .option('n', {
        alias: 'number',
        demand: false,
        describe: 'Fetch only specified question number of problems.',
        type: 'array'
    })
    .usage('Usage: $0 [options]')
    .example('$0 -c conf.json', `Use the config file 'conf.json' to run lc-spider(We use 'config.json' by default.).
    You need to write a json file beforehand like this :
     ` + chalk.blue(`{
        "username" : "hello@gmail.com",
        "password" : "xxxxxxxxx",
        "language": ["java","c++","c"]
     }\n`) +
     `The fields ${chalk.red('username')} and ${chalk.red('password')}  are your leetcode account, both necessary.
     The field ${chalk.red('languages')} is necessary(must be an array).Only the accepted solutions wrote in those languages will be downloaded.
    `)
    .example('$0 -n 10 20 5-8', `Only fetch Problem 5,6,7,8,10 and 20`)
    .help('h')
    .alias('h', 'help')
    .argv

let fs = require('fs')
let co = require('co')
let stat = thenify(fs.stat)
let spider = require('./spider.js')

co(function * () {
    let stats = yield stat(path.resolve(process.cwd(), argv.c)).catch(() => {
        throw new Error('config file ' + argv.c + ' not exist!')
    })
    if (!stats.isFile()) {
        throw new Error('config file ' + argv.c + ' not exist!')
    }
    let config = require(path.resolve(process.cwd(), argv.c))
    config = mergeConfig(config)
    if (!checkConfig(config)) {
        throw new Error('config file error')
    }
    debug('begin')
    return config
}).then(function (config) {
    let numObj = generateNumObj(argv.n)
    return spider.fetch(config, numObj)
}).then(function () {
    logger.info('finished!')
}).catch(err => {
    logger.error(err)
    logger.error(err.stack)
    process.exit(1)
})

function generateNumObj (numArr) {
    if (numArr !== undefined && numArr.length > 0) {
        let numObj = {}
        numArr.forEach((number) => {
            if (typeof number === 'string') {
                if (~number.indexOf('-')) {
                    let numPair = number.split('-').map(e => ~~e)
                    if (numPair[0] > numPair[1]) {
                        let temp = numPair[1]
                        numPair[1] = numPair[0]
                        numPair[0] = temp
                    }
                    for (let i = numPair[0]; i <= numPair[1]; i++) {
                        debug(i)
                        numObj[i] = true
                    }
                }
            } else {
                debug(number)
                numObj[number] = true
            }
        })
        return numObj
    }
}

function checkConfig (config) {
    if (undefined === config.username || undefined === config.password) {
        if (undefined === config.cookie) {
            logger.error(chalk.red('username&&password or coookie not found in config file'))
            return false
        }
    }

    const languageNameMap = require('./language').nameMap
    if (undefined !== config.language) {
        if (config.length < 1) {
            console.warn(chalk.red('at least one language needed'))
            return false
        }
        let languageCheck = config.language.every(element => {
            if (languageNameMap[element] === undefined) {
                logger.error(element + ' is not supported')
                return false
            }
            return true
        })
        if (!languageCheck) {
            return false
        }
    } else {
        logger.error(`not found 'language' in config file`)
        return false
    }
    ensureDirectoryExists(path.resolve(process.cwd(), config.outputDir))
    return true
}

function mergeConfig (config) {
    const defaultConfig = {
        outputDir: './solutions',
        template: './README.tpl'
    }
    return Object.assign({}, defaultConfig, config)
}

process.on('uncaughtException', function (err) {
    logger.error('uncaughtException:')
    logger.error(err)
})
