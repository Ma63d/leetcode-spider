"use strict";
let requestLib = require('request');
let jar = requestLib.jar();
let config;
const debug = require('debug')('lc-spider');
const baseUrl = 'https://leetcode.com/';
let request = requestLib
    .defaults({
        jar: jar,
        baseUrl:baseUrl,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.98 Safari/537.36'
        }
    });
let thenifyAll = require('thenify-all');
request = thenifyAll(request,{},['get','post']);
let co = require('co');
let cheerio = require('cheerio');

exports.login = conf => {
    config = conf;
    return co(function*(){
        yield request.get('/accounts/login/');
        let cookie = jar.getCookies('https://leetcode.com/');
        let cookieOfToken = cookie.find(element => element.key == 'csrftoken');
        if(cookieOfToken == undefined){
            return Promise.reject("获取csrftoken失败");
        }
        let token = cookieOfToken.value;
        yield request({method: 'POST', url :'/accounts/login/',headers:{'Referer': baseUrl+'/accounts/login/'},form: {
                    'csrfmiddlewaretoken': token,
                    'login': conf['username'],
                    'password': conf['password']
                }})
        cookie = jar.getCookies('https://leetcode.com/');
        if(cookie.find(element => element.key == 'PHPSESSID') == undefined){
            return Promise.reject("登录失败");
        }
        debug('登录成功');
    })
}
exports.fetchACLists = () => {
    return co(function*(){
        debug('获取AC的题目列表');
        //为了兼容4.x版本Node还是不要用数组的解构赋值了
        //let [response, body] = yield request.get('/api/problems/algorithms/');
        let responseAndBody = yield request.get('/api/problems/algorithms/');
        let body;
        try{
            body = JSON.parse(responseAndBody[1]);
        }catch(e){
            debug(responseAndBody[1]);
            throw(new Error("JSON数据不完整,JSON解析出错"));
        }
        let acLists = body['stat_status_pairs'].filter(element => {
            return element.status === 'ac';
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
                return co(fetchACSolutionOfQuestion,element,languageClone,1,languageCodeMap);
            })
            let languageCodeMapArr = yield acListPromises;
            debug(languageCodeMapArr);
            return languageCodeMapArr;
        }
    })
}
let fetchACSolutionOfQuestion = function* (question,languageToFetch,page,languageCodeMap){
    debug("爬取"+question.stat['question__title_slug']);

    if(languageToFetch.length < 1){
        return languageCodeMap;
    }
    let responseAndBody = yield request.get('/problems/'+question.stat['question__title_slug']+'/submissions/'+page+'/').catch(err=>{
        throw err;
    });
    if(responseAndBody[0].statusCode != 200){
        throw new Error('网络错误');
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
            acSolutionPromise.push(co(fetchSolutionsOfUrl,codeUrl).then(codeObj => {
                languageCodeMap[language] = codeObj.code;
            }).catch(err => {
                throw err;
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
let fetchSolutionsOfUrl = function* (url){
    let responseAndBody = yield request.get(url);
    if(responseAndBody[0].statusCode != 200){
        debug(responseAndBody[0]);
        throw new Error('网络错误');
    }
    let body = responseAndBody[1];
    let matchResult = body.match(/submissionCode\: \'([\s\S]*)\'\,\s*editCodeUrl/);
    if(matchResult === null){
        console.log(responseAndBody[1]);
        throw new Error('网页解析错误');
    }
    let codeInUnicode = matchResult[1];
    let code = eval("`" + codeInUnicode + "`");
    //debug('code:');
    //debug(code);
    return {code};
}
