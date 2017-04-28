"use strict";
const debug = require('debug')('lc-spider');
const assert = require('assert');

const logger = require('log4js').getLogger('layout-pattern');
const baseUrl = 'https://leetcode.com/';
const requestLib = require('request');
const jar = requestLib.jar();
//set default http request settings
let request = requestLib
    .defaults({
        jar: jar,
        baseUrl:baseUrl,
        headers: {
            'Host': 'leetcode.com',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1',
            'Referer':'https://leetcode.com/accounts/login/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.98 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
            'Content-Type': 'application\/x-www-form-urlencoded'
        }
    });
let thenifyAll = require('thenify-all');
//promisify the callback-based request API
request = thenifyAll(request,{},['get','post']);
let cheerio = require('cheerio');

let fileUtils = require('./file.js');
let resultUtils = require('./result.js');
let generateMDUtils = require('./generateMD');

let co = require('co');
let parallel = require('co-parallel');
let executionConfig = require('./config');

let languageLeetcodeNameMap = require('./language').leetcodeName;

let config;
let leetcodeNumObj = {};


exports.fetch = co.wrap(function*(conf,numObj){
    config = conf;
    let acList;
    try{
        yield login(conf);
        acList = yield fetchACLists();
    }catch(e){
        throw e;
    }

    let fetchList;
    try{
        if(undefined === numObj){
            fetchList = yield fetchNotEverFetched(acList);
        }else{
            fetchList = yield fetchWithGivenNumber(acList,numObj);
        }
    }catch(e){
        logger.error('error happened when forming the fetch mission');
        throw e;
    }

    try{
        yield parallelFetch(fetchList)
    }catch(e){
        throw e;
    }
})

/**
 * Use the config json file to login
 * and return a promise.
 *
 * @param {Object} conf
 * @return {Promise}
 * @api public
 */
let login = co.wrap(function*(conf){

    config = conf;
    let responseAndBody = yield request.get('/accounts/login/');
    let $ = cheerio.load(responseAndBody[1]);
    let token = $('.form-signin input[name=csrfmiddlewaretoken]').val();

    logger.info('token get');
    debug('token:'+token);

    let cookie = jar.getCookies('https://leetcode.com/');
    let cookieOfToken = cookie.find(element => element.key == 'csrftoken');
    assert.notEqual(cookieOfToken,undefined,'network error: cannot get csrftoken');

    yield request({method: 'POST', url :'/accounts/login/',form: {
        'csrfmiddlewaretoken': token,
        'login': conf['username'],
        'password': conf['password']
    }})
    cookie = jar.getCookies('https://leetcode.com/');
    assert.notEqual(cookie.find(element => element.key == 'LEETCODE_SESSION'),undefined,'incorrect username or password');
    logger.info('login successfully');
})

/**
 * Fetch the accepted solutions' list.
 *
 * @return {Promise}
 *      @return {Array} list of solutions needed to fetch
 * @api public
 */
let fetchACLists = co.wrap(function*(){
    debug('fetch the accepted solutions\' list');

    //为了兼容4.x版本Node还是不要用数组/对象的解构赋值了
    //let [response, body] = yield request.get('/api/problems/algorithms/');
    let responseAndBody = yield request.get('/api/problems/algorithms/');
    let body;

    try{
        body = JSON.parse(responseAndBody[1]);
    }catch(e){
        debug(responseAndBody[1]);
        throw(new Error('network error:JSON data error'));
    }
    leetcodeNumObj.total = body['num_total'];
    leetcodeNumObj.solved = body['num_solved'];
    leetcodeNumObj.locked = 0;
    return body['stat_status_pairs'];
})

let fetchWithGivenNumber = co.wrap(function*(acLists,numObj){
    yield resultUtils.getResult();
    return acLists.filter(element => {
        if(element['paid_only']){
            leetcodeNumObj.locked++;
        }
        //!(element.stat['question_id'] in result)
        //if we fetched once we will not fetch this problem
        return element.status === 'ac' && (element.stat['question_id'] in numObj);
    }).reverse();
})

let fetchNotEverFetched = co.wrap(function*(acLists){
    //load the last spider result from result.json
    //if result.json doesn't exist that means never fetched solutions before
    let result = yield resultUtils.getResult();

    return acLists.filter(element => {
        if(element['paid_only']){
            leetcodeNumObj.locked++;
        }
        //!(element.stat['question_id'] in result)
        //if we fetched once we will not fetch this problem any more
        return element.status === 'ac' && !(element.stat['question_id'] in result);
    }).reverse();
})


/**
 * Fetch the accepted solutions' code and question.
 *
 * @param {Array} acLists
 * @return {Promise}
 * @api public
 */
let parallelFetch = co.wrap(function*(acLists){
    debug("fetch solutions ");
    if(acLists && acLists.length > 0){
        //form the promises array
        //every promise in it can be parallel executed
        let acListPromises = acLists.map(acProblem => {
            let languageClone = [];
            //use an object to store different language's solutions
            let languageCodeMap = {};

            //store the problem's info in languageCodeMap
            languageCodeMap._title = acProblem.stat['question__title_slug'];
            languageCodeMap._id = acProblem.stat['question_id'];
            languageCodeMap._level = acProblem['difficulty']['level'];

            //copy the language from config file to languageClone
            //use it to fetch every problem's solution
            config.language.forEach(language=>{
                languageClone.push(language);
            })

            logger.info('fetch '+languageCodeMap._id + ' . '+languageCodeMap._title);
            return fetchAndWrite(acProblem,languageClone,languageCodeMap);
        })

        //use parallel to control the number of concurrence
        let languageCodeMapArr = yield parallel(acListPromises,executionConfig.concurrency);
        //debug(languageCodeMapArr);
        let resultObj = yield resultUtils.writeResult(languageCodeMapArr,leetcodeNumObj);
        leetcodeNumObj.language = config.language;
        try{
            yield generateMDUtils.generateMarkdown(resultObj,leetcodeNumObj);
        }catch(e){
            throw e;
        }

    }else{
        logger.info('no new solution need to be fetched');
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
let fetchAndWrite = function*(problemInfo,languageToFetch,languageCodeMap){
    yield fetchACSolutionOfProblem(problemInfo,languageToFetch,0,languageCodeMap);
    yield fetchQuestion(problemInfo,languageCodeMap).catch(err => {throw err});
    yield fileUtils.writeToFile(languageCodeMap).catch(err => {throw err});
    return languageCodeMap;
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
let fetchACSolutionOfProblem = co.wrap(function* (problemInfo,languageToFetch,page,languageCodeMap){
    debug("fetch "+problemInfo.stat['question__title_slug']);

    if(languageToFetch.length < 1){
        return languageCodeMap;
    }

    // leetcode天天变ajax接口 变dom结构 我也是很心塞啊
    let responseAndBody, submissionsJson;
    try {
        responseAndBody = yield request.get({
            url: '/api/submissions/' + problemInfo.stat['question__title_slug'] + '/?offset=' + (page * 50)+ '&limit=50',
            headers: {
                'Accept': '*/*'
            }
        });
        submissionsJson = JSON.parse(responseAndBody[1])['submissions_dump'];
    } catch (err) {
        logger.error('Fetching submissions of '+problemInfo.stat['question__title_slug']+' failed');
        logger.error(err.stack);
        return;
    }

    //form the promises array
    let acSolutionPromise = [];

    //check the submissions list
    submissionsJson.forEach(e => {
        if(e['status_display'] !== 'Accepted'){
            return;
        }
        let language = languageLeetcodeNameMap[e['lang']];
        if(~languageToFetch.indexOf(language)){
            languageToFetch.splice(languageToFetch.indexOf(language),1);
            let codeUrl = e['url'];
            debug(problemInfo.stat['question__title_slug'],codeUrl,language);
            acSolutionPromise.push(fetchSolutionsOfUrl(codeUrl,0).then(codeObj => {
                languageCodeMap[language] = codeObj.code;
            }).catch(err => {
                logger.error('Fetching the '+language+' code of '+problemInfo.stat['question__title_slug']+' failed');
                logger.error(err.stack);
            }));
        }
    })

    //if no solution can be fetched
    if(acSolutionPromise.length < 1){
        if(submissionsJson.length == 50 && languageToFetch.length > 0){
            //then fetch the next page of submissions
            return yield fetchACSolutionOfProblem(problemInfo,languageToFetch,page+1,languageCodeMap);
        }else{
            return languageCodeMap;
        }
    }else{
        yield acSolutionPromise;
        if(submissionsJson.length == 50 && languageToFetch.length > 0){
            return yield fetchACSolutionOfProblem(problemInfo,languageToFetch,page+1,languageCodeMap);
        }else{
            //fetching finished , let's return it
            return languageCodeMap;
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
let fetchQuestion = co.wrap(function* (problemInfo,languageCodeMap){
    let responseAndBody;
    try{
        responseAndBody = yield request.get('/problems/'+problemInfo.stat['question__title_slug']+'/')
    }catch(err){
        debug('network error:error happened when fetching problem \''+problemInfo.stat['question__title_slug']+'\'');
        throw err;
    };

    let $ = cheerio.load(responseAndBody[1]);
    //debug('problem :');
    //debug($('meta[name=description]').attr('content'));
    languageCodeMap['_question'] =  $('meta[name=description]').attr('content');
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
let fetchSolutionsOfUrl = co.wrap(function* (url,times){
    let responseAndBody;
    try{
        responseAndBody = yield request.get(url);
    }catch(e){
        debug(e.stack);
        if(times < 5){
            //fixme! error often occurs when fetching the solution page
            //so i repeat at most 5 times
            return yield co(fetchSolutionsOfUrl,url,++times);
        }
        throw new Error('network error:cannot get the page of url' + url);
    };
    let body = responseAndBody[1];

    let matchResult = body.match(/submissionCode\:\s*\'([\s\S]*)\'\,\s*editCodeUrl/);
    if(matchResult === null){
        if(times < 5){
            //fixme! error often occurs when fetching the solution page
            //so i repeat at most 5 times
            return yield fetchSolutionsOfUrl(url,++times);
        }
        debug('can not get full page of'+url);
        throw new Error('network error:the page of'+url+ 'is not complete' );
    }

    let codeInUnicode = matchResult[1];

    let code = eval("'" + codeInUnicode + "'");
    debug(url + 'code get!');
    return {code};
})
