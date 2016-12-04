"use strict";
let requestLib = require('request');
let jar = requestLib.jar();
let config;
const debug = require('debug')('lc-spider');
const baseUrl = 'https://leetcode.com/';
let request = requestLib
    .defaults({
        jar: jar,
        baseUrl:baseUrl
    });
let thenifyAll = require('thenify-all');
request = thenifyAll(request,{},['get','post']);
let co = require('co');


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
        let responseAndBody = yield request.get('/api/problems/algorithms/');
        let body;
        try{
            body = JSON.parse(responseAndBody[1]);
        }catch(e){
            debug(responseAndBody[1]);
            throw(e);
        }
        let acLists = body['stat_status_pairs'].filter(element => {
            return element.status === 'ac';
        })
        debug('列表如下:');
        debug(acLists);
        return acLists.reverse();
    })
}
exports.fetchACSolutions = acLists =>{
    return co(function*(){
        debug("爬取具体的题目");
        if(acLists && acLists.length > 0){
            acLists.map(element => {
                let languageClone = [];
                config.language.forEach(element=>{
                    languageClone.push(element);
                })
                return co.wrap(fetchACSolutionOfQuestion.bind(null,element,languageClone,1));
            })
        }
    })
}
let fetchACSolutionOfQuestion = function* (question,languageToFetch,page){
    let responseAndBody = yield request.get('/problems/'+question.stat['question__article__slug']+'/submissions/');
}
