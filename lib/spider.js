"use strict";
let requestLib = require('request');
let jar = requestLib.jar();
let config;
const debug = require('debug')('lc-spider');
const baseUrl = 'https://leetcode.com/';
let file = require('./file.js');
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
        }
    });
let thenifyAll = require('thenify-all');
request = thenifyAll(request,{},['get','post']);
let co = require('co');
let cheerio = require('cheerio');
let parallel = require('co-parallel');

let resultUtils = require('./result.js');



exports.login = conf => {
    config = conf;
    return co(function*(){
        yield request.get('/accounts/login/');
        let cookie = jar.getCookies('https://leetcode.com/');
        let cookieOfToken = cookie.find(element => element.key == 'csrftoken');
        if(cookieOfToken == undefined){
            throw(new Error("获取csrftoken失败"));
        }
        let token = cookieOfToken.value;
        debug('token:'+token);
        yield request({method: 'POST', url :'/accounts/login/',form: {
                    'csrfmiddlewaretoken': token,
                    'login': conf['username'],
                    'password': conf['password']
                }})
        cookie = jar.getCookies('https://leetcode.com/');
        if(cookie.find(element => element.key == 'PHPSESSID') == undefined){
            throw(new Error("用户名或密码错误"));
        }
        debug('登录成功');
    })
}
exports.fetchACLists = () => {
    return co(function*(){
        debug('获取AC的题目列表');
        //为了兼容4.x版本Node还是不要用数组/对象的解构赋值了
        //let [response, body] = yield request.get('/api/problems/algorithms/');
        let result = yield resultUtils.getResult();
        let responseAndBody = yield request.get('/api/problems/algorithms/');
        let body;
        try{
            body = JSON.parse(responseAndBody[1]);
        }catch(e){
            debug(responseAndBody[1]);
            throw(new Error('network error:JSON data error'));
        }
        let acLists = body['stat_status_pairs'].filter(element => {
            //!(element.stat['question_id'] in result)爬过的就不再爬了
            return element.status === 'ac' && !(element.stat['question_id'] in result);
        })
        return acLists.reverse();
    })
}
exports.fetchACSolutions = acLists =>{
    return co(function*(){
        debug("爬取各个solutions");
        if(acLists && acLists.length > 0){
            let acListPromises = acLists.map(element => {
                let languageClone = [];
                let languageCodeMap = {};
                languageCodeMap._title = element.stat['question__title_slug'];
                languageCodeMap._id = element.stat['question_id'];
                languageCodeMap._level = element['difficulty']['level'];
                config.language.forEach(element=>{
                    languageClone.push(element);
                })
                return fetchAndWrite(element,languageClone,1,languageCodeMap);
            })
            let languageCodeMapArr = yield parallel(acListPromises,20);
            debug(languageCodeMapArr);
            yield resultUtils.writeResult(languageCodeMapArr);
        }
    })
}
let fetchAndWrite = function*(question,languageToFetch,page,languageCodeMap){
    yield co(fetchACSolutionOfQuestion,question,languageToFetch,1,languageCodeMap);
    yield co(fetchProblem,question,languageCodeMap).catch(err => {throw err});
    yield co(file.writeToFile(languageCodeMap)).catch(err => {throw err});
    return languageCodeMap;
}
let fetchProblem = function* (question,languageCodeMap){
    let responseAndBody = yield request.get('/problems/'+question.stat['question__title_slug']+'/').catch(err=>{
        debug('network error:error happened when fetching problem \''+question.stat['question__title_slug']+'\'');
        throw err;
    });
    let $ = cheerio.load(responseAndBody[1]);
    //debug('problem :');
    //debug($('meta[name=description]').attr('content'));
    languageCodeMap['_problem'] =  $('meta[name=description]').attr('content');
}
let fetchACSolutionOfQuestion = function* (question,languageToFetch,page,languageCodeMap){
    debug("爬取"+question.stat['question__title_slug']);

    if(languageToFetch.length < 1){
        return languageCodeMap;
    }
    let responseAndBody = yield request.get('/problems/'+question.stat['question__title_slug']+'/submissions/'+page+'/').catch(err=>{
        debug('network error:error happened when fetching submissions page');
        throw err;
    });
    if(responseAndBody[0].statusCode != 200){
        throw new Error('network error');
    }
    let $ = cheerio.load(responseAndBody[1]);

    let acSolutionPromise = [];

    let trDomArr = $('#result-testcases tbody tr').toArray();
    trDomArr.forEach(e => {
        let passed = $($(e).children('td')[2]).text().trim();
        if(passed !== 'Accepted'){
            return;
        }
        let language = $($(e).children('td')[4]).text().trim();
        if(~languageToFetch.indexOf(language)){
            languageToFetch.splice(languageToFetch.indexOf(language),1);
            let codeUrl = $($(e).children('td')[2]).children('a').attr('href');
            debug(question.stat['question__title_slug'],codeUrl,language);
            acSolutionPromise.push(co(fetchSolutionsOfUrl,codeUrl,0).then(codeObj => {
                languageCodeMap[language] = codeObj.code;
            }).catch(err => {
                console.log('Fetch the '+language+' code of '+question.stat['question__title_slug']+' failed');
                console.log(err.stack);
            }));
        }
    })
    if(acSolutionPromise.length < 1){
        //该页没有找到可以下载的源码
        if(trDomArr.length == 20 && languageToFetch.length > 0){
            //如果该页的条目是20个 说明下一页可能有submissions,并且languageToFetch数组不为空
            //那就去爬下一页的submissions
            return yield fetchACSolutionOfQuestion(question,languageToFetch,page+1,languageCodeMap);
        }else{
            return languageCodeMap;
        }
    }
    yield acSolutionPromise;
    if(trDomArr.length == 20 && languageToFetch.length > 0){
        //如果该页的条目是20个 说明下一页可能有submissions,并且languageToFetch数组不为空
        //那就去爬下一页的submissions
        return yield fetchACSolutionOfQuestion(question,languageToFetch,page+1,languageCodeMap);
    }else{
        //没得爬啦 返回吧
        return languageCodeMap;
    }
}
let fetchSolutionsOfUrl = function* (url,times){
    let responseAndBody;
    try{
        responseAndBody = yield request.get(url);
    }catch(e){
        debug(e.stack);
        if(times < 5){
            return yield co(fetchSolutionsOfUrl,url,++times);
        }
        throw new Error('network error:cannot get the page of url' + url);
    };


    let body = responseAndBody[1];
    let matchResult = body.match(/submissionCode\:\s*\'([\s\S]*)\'\,\s*editCodeUrl/);
    if(matchResult === null){
        if(times < 5){
            return yield fetchSolutionsOfUrl(url,++times);
        }
        debug('can not get full page of'+url);
        throw new Error('network error:the page of'+url+ 'is not complete' );
    }
    let codeInUnicode = matchResult[1];
    let code = eval("'" + codeInUnicode + "'");
    debug(url + 'code get!');
    return {code};
}
