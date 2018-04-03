'use strict'
const debug = require('debug')('lc-spider')
const assert = require('assert')

const path = require('path')
const logger = require('log4js').getLogger('layout-pattern')
const baseUrl = 'https://leetcode.com/'
const requestLib = require('request')
const jar = requestLib.jar()
// set default http request settings
let request = requestLib
    .defaults({
        jar: jar,
        baseUrl: baseUrl,
        headers: {
            'Host': 'leetcode.com',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://leetcode.com/accounts/login/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.98 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
let thenifyAll = require('thenify-all')
// promisify the callback-based request API
request = thenifyAll(request, {}, ['get', 'post'])
let cheerio = require('cheerio')

let fileUtils = require('./file.js')
let resultUtils = require('./result.js')
let generateMDUtils = require('./generateMD')

let co = require('co')
let parallel = require('co-parallel')
let executionConfig = require('./runtimeConf')

let languageLeetcodeNameMap = require('./language').leetcodeName

let config
let solutionsDirPath
let resultJsonPath
let leetcodeNumObj = {}

exports.fetch = co.wrap(function * (conf, numObj) {
    config = conf
    solutionsDirPath = path.resolve(process.cwd(), config.outputDir)
    resultJsonPath = path.resolve(solutionsDirPath, 'result.json')
    /**
     * fetch solved problems list first
     * */
    let acList
    try {
        yield login(conf)
        acList = yield fetchACLists()
    } catch (e) {
        throw e
    }

    /**
     * generate the real solutions list we need to fetch
     * if we fetched before, then only fetch the newly submitted solutions
     * or if the user specified problem number, fetch the solutions of that
     * */
    let fetchList
    try {
        if (undefined === numObj) {
            fetchList = yield fetchSolutionsNotEverFetched(acList)
        } else {
            fetchList = yield fetchWithGivenNumber(acList, numObj)
        }
    } catch (e) {
        logger.error('error happened when forming the fetch mission')
        throw e
    }

    /**
     * fetch all the solutions in parallel
     * and every time one solution fetched, write it into file immediately
     * */
    let languageCodeMapArr = yield parallelFetch(fetchList)

    /**
     * write the fetch result into result.json
     * */
    let resultObj = yield resultUtils.writeResult(languageCodeMapArr, leetcodeNumObj, resultJsonPath)
    leetcodeNumObj.language = config.language

    /**
     * generate READE.md
     * */
    yield generateMDUtils.generateMarkdown(resultObj, leetcodeNumObj, config.outputDir, config.template)
})

/**
 * Use the config json file to login
 * and return a promise.
 *
 * @param {Object} conf
 * @return {Promise}
 * @api public
 */
let login = co.wrap(function * (conf) {
    config = conf
    let responseAndBody = yield request.get('/accounts/login/')
    let $ = cheerio.load(responseAndBody[1])
    let token = $('input[name=csrfmiddlewaretoken]').val()

    logger.info('token get')
    debug('token:' + token)

    let cookie = jar.getCookies('https://leetcode.com/')
    let cookieOfToken = cookie.find(element => element.key === 'csrftoken')
    assert.notEqual(cookieOfToken, undefined, 'network error: cannot get csrftoken')

    yield request({method: 'POST',
        url: '/accounts/login/',
        form: {
            'csrfmiddlewaretoken': token,
            'login': conf['username'],
            'password': conf['password']
        }
    })
    cookie = jar.getCookies('https://leetcode.com/')
    assert.notEqual(cookie.find(element => element.key === 'LEETCODE_SESSION'), undefined, 'incorrect username or password')
    logger.info('login successfully')
})

/**
 * Fetch the accepted solutions' list.
 *
 * @return {Promise}
 *      @return {Array} list of solutions needed to fetch
 * @api public
 */
let fetchACLists = co.wrap(function * () {
    debug('fetch the accepted solutions\' list')

    let [, body] = yield request.get('/api/problems/algorithms/')
    try {
        body = JSON.parse(body)
    } catch (e) {
        debug(body)
        throw (new Error('network error:JSON data error'))
    }
    leetcodeNumObj.total = body['num_total']
    leetcodeNumObj.solved = body['num_solved']
    leetcodeNumObj.locked = 0
    return body['stat_status_pairs']
})

let fetchWithGivenNumber = co.wrap(function * (acLists, numObj) {
    yield resultUtils.getResult()
    return acLists.filter(element => {
        if (element['paid_only']) {
            leetcodeNumObj.locked++
        }
        //! (element.stat['question_id'] in result)
        // if we fetched the problem before, we will not do it again
        return element.status === 'ac' && (element.stat['question_id'] in numObj)
    }).reverse()
})

let fetchSolutionsNotEverFetched = co.wrap(function * (acLists) {
    // load the last spider result from result.json
    // if result.json doesn't exist that means never fetched solutions before
    let result = yield resultUtils.getResult(resultJsonPath)

    return acLists.filter(element => {
        if (element['paid_only']) {
            leetcodeNumObj.locked++
        }
        //! (element.stat['question_id'] in result)
        // if we fetched once we will not fetch this problem any more
        return element.status === 'ac' && !(element.stat['question_id'] in result)
    }).reverse()
})

/**
 * Fetch the accepted solutions' code and question.
 *
 * @param {Array} acLists
 * @return {Promise}
 * @api public
 */
let parallelFetch = co.wrap(function * (acLists) {
    debug('fetch solutions ')
    if (acLists && acLists.length > 0) {
        // form the promises array
        // every promise in it can be parallel executed
        let acListPromises = acLists.map(acProblem => {
            let languageClone = []
            // use an object to store different language's solutions
            let languageCodeMap = {}

            // store the problem's info in languageCodeMap
            languageCodeMap._title = acProblem.stat['question__title_slug']
            languageCodeMap._id = acProblem.stat['question_id']
            languageCodeMap._level = acProblem['difficulty']['level']
            languageCodeMap._paid_only = acProblem['paid_only']
            languageCodeMap._acceptance = (acProblem['stat']['total_acs'] / acProblem['stat']['total_submitted'] * 100).toFixed(2) + '%'

            // copy the language from config file to languageClone
            // use it to fetch every problem's solution
            config.language.forEach(language => {
                languageClone.push(language)
            })
            logger.info('fetch ' + languageCodeMap._id + ' . ' + languageCodeMap._title)
            return fetchAndWrite(acProblem, languageClone, languageCodeMap)
        })

        // use parallel to control the number of concurrence
        let languageCodeMapArr = yield parallel(acListPromises, executionConfig.concurrency)
        // debug(languageCodeMapArr);
        return languageCodeMapArr
    } else {
        logger.info('no new solution need to be fetched')
        return []
    }
})

/**
 * Fetch a leetcode problem's solutions and question
 * and then write to file.
 *
 * @param {Object} problemInfo
 * @param {Array} languageToFetch, a copy of language list in config file
 * @param {Object} languageCodeMap, an map object to store different language's solutions
 * @return {Object} languageCodeMap
 * @api public
 */
let fetchAndWrite = function * (problemInfo, languageToFetch, languageCodeMap) {
    yield fetchACSolutionOfProblem(problemInfo, languageToFetch, 0, languageCodeMap)
    yield fetchQuestion(problemInfo, languageCodeMap).catch(err => { throw err })
    yield fileUtils.writeToFile(languageCodeMap, solutionsDirPath).catch(err => { throw err })
    return languageCodeMap
}

/**
 * Fetch a leetcode problem's solutions and question
 * and then write to file.
 *
 * @param {Object} problemInfo
 * @param {Array} languageToFetch, a copy of language list in config file
 * @param {Number} page, the page number of the page needed to fetch
 * @param {Object} languageCodeMap, an map object to store different language's solutions
 * @return {Promise}
 *      @return {Object} languageCodeMap
 * @api public
 */
let fetchACSolutionOfProblem = co.wrap(function * (problemInfo, languageToFetch, page, languageCodeMap) {
    debug('fetch ' + problemInfo.stat['question__title_slug'])

    if (languageToFetch.length < 1) {
        return languageCodeMap
    }

    let responseAndBody, submissionsJson
    try {
        responseAndBody = yield request.get({
            url: '/api/submissions/' + problemInfo.stat['question__title_slug'] + '/?offset=' + (page * 50) + '&limit=50',
            headers: {
                'Accept': '*/*'
            }
        })
        submissionsJson = JSON.parse(responseAndBody[1])['submissions_dump']
    } catch (err) {
        logger.error('Fetching submissions of ' + problemInfo.stat['question__title_slug'] + ' failed')
        logger.error(err.stack)
        return
    }

    // form the promises array
    let acSolutionPromise = []

    // check the submissions list
    submissionsJson.forEach(e => {
        if (e['status_display'] !== 'Accepted') {
            return
        }
        let language = languageLeetcodeNameMap[e['lang']]
        if (~languageToFetch.indexOf(language)) {
            languageToFetch.splice(languageToFetch.indexOf(language), 1)
            let codeUrl = e['url']
            debug(problemInfo.stat['question__title_slug'], codeUrl, language)
            acSolutionPromise.push(fetchSolutionsOfUrl(codeUrl, 0).then(codeObj => {
                languageCodeMap[language] = codeObj.code
            }).catch(err => {
                logger.error('Fetching the ' + language + ' code of ' + problemInfo.stat['question__title_slug'] + ' failed')
                logger.error(err.stack)
            }))
        }
    })

    // if no solution can be fetched
    if (acSolutionPromise.length < 1) {
        if (submissionsJson.length === 50 && languageToFetch.length > 0) {
            // then fetch the next page of submissions
            return yield fetchACSolutionOfProblem(problemInfo, languageToFetch, page + 1, languageCodeMap)
        } else {
            return languageCodeMap
        }
    } else {
        yield acSolutionPromise
        if (submissionsJson.length === 50 && languageToFetch.length > 0) {
            return yield fetchACSolutionOfProblem(problemInfo, languageToFetch, page + 1, languageCodeMap)
        } else {
            // fetching finished , let's return it
            return languageCodeMap
        }
    }
})

/**
 * Fetch a leetcode problem's question
 * and store it in languageCodeMap['_problem'].
 *
 * @param {Object} problemInfo
 * @param {Object} languageCodeMap, an map object to store different language's solutions
 * @return {Promise}
 * @api public
 */
let fetchQuestion = co.wrap(function * (problemInfo, languageCodeMap) {
    let responseAndBody
    try {
        responseAndBody = yield request.get('/problems/' + problemInfo.stat['question__title_slug'] + '/')
    } catch (err) {
        debug('network error:error happened when fetching problem \'' + problemInfo.stat['question__title_slug'] + '\'')
        throw err
    };

    let $ = cheerio.load(responseAndBody[1])
    // debug('problem :');
    // debug($('meta[name=description]').attr('content'));
    languageCodeMap['_question'] = $('meta[name=description]').attr('content')
})

/**
 * Fetch a leetcode problem's solution of given url
 * and store it in languageCodeMap['_problem'].
 *
 * @param {String} url
 * @param {Number} times
 * @return {Promise}
 * @api public
 */
let fetchSolutionsOfUrl = co.wrap(function * (url, times) {
    let responseAndBody
    try {
        responseAndBody = yield request.get(url)
    } catch (e) {
        debug(e.stack)
        if (times < 5) {
            // fixme! error often occurs when fetching the solution page
            // so i repeat at most 5 times
            return yield co(fetchSolutionsOfUrl, url, ++times)
        }
        throw new Error('network error:cannot get the page of url' + url)
    };
    let body = responseAndBody[1]

    let matchResult = body.match(/submissionCode:\s*'([\s\S]*)',\s*editCodeUrl/)
    if (matchResult === null) {
        if (times < 5) {
            // fixme! error often occurs when fetching the solution page
            // so i repeat at most 5 times
            return yield fetchSolutionsOfUrl(url, ++times)
        }
        debug('can not get full page of' + url)
        throw new Error('network error:the page of' + url + 'is not complete')
    }

    let codeInUnicode = matchResult[1]

    /* eslint-disable no-eval */
    let code = eval("'" + codeInUnicode + "'")
    debug(url + 'code get!')
    return {code}
})
