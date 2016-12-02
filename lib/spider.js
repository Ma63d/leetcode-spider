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
    co(function*(){
        yield request.get('/accounts/login/');
        let cookie = jar.getCookies('https://leetcode.com/');
        let cookieOfToken = cookie.find(element => element.key == 'csrftoken');
        if(cookieOfToken == undefined){
            throw new Error("获取csrftoken失败");
        }
        let token = cookieOfToken.value;
        console.log(token);
        let response = yield request({method: 'POST', url :'/accounts/login/',headers:{'Referer': baseUrl+'/accounts/login/'},form: {
                    'csrfmiddlewaretoken': token,
                    'login': config['username'],
                    'password': config['password']
                }})
        console.log(response);
        cookie = jar.getCookies('https://leetcode.com/');
        console.log(cookie);
    }).catch(err => console.error(err));
}