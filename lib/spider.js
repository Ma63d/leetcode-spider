"use strict";
let requestLib = require('request');
let jar = requestLib.jar();
const baseUrl = 'https://leetcode.com/';
let request = requestLib
    .defaults({
        jar: jar,
        baseUrl:baseUrl
    });
let thenifyAll = require('thenify-all');
request = thenifyAll(request,{},['get','post']);
let co = require('co');

exports.login = config => {
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
                    'login': config['username'],
                    'password': config['password']
                }})
        cookie = jar.getCookies('https://leetcode.com/');
        if(cookie.find(element => element.key == 'PHPSESSID') == undefined){
            return Promise.reject("登录失败");
        }
    })
}
exports.fetchACLists = config => {
    return co(function*(){
        let [response,body] = yield request.get('/api/problems/algorithms/');
        body = JSON.parse(body);
        let acLists = Object.values(body['stat_status_pairs']).filter(element => {
            return element.status === 'ac';
        })
        return acLists.reverse();
    })
}
exports.fetchACSolutions = acLists =>{
    console.log(acLists);
}
let fetchACSolutionByLanguage = (question,language) =>{

}