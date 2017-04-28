"use strict";
let fs = require('fs');
let path = require('path');
let co = require('co');
let thenifyAll = require('thenify-all');
let thenFs = thenifyAll(fs,{},['stat','unlink','writeFile']);

let result;

/**
 * Load the last spider result from result.json.
 * If result.json doesn't exits that means never fetched solutions before.
 *
 * @return {Promise}
 *      @return {Object} last spider result
 * @api public
 */
exports.getResult = co.wrap(function*(){
    try{
        let stats = yield thenFs.stat(path.resolve(process.cwd(),'result.json'));
        if(stats.isFile()){
            result = require(path.resolve(process.cwd(),'result.json'));
            return result;
        }else{
            throw(new Error('result.json not exist'));
        }
    }catch(e){
        result = {};
        return result;
    }
})


/**
 * Write the spider result to result.json.
 *
 * @param {Object} languageCodeMap
 * @param {Object} leetcodeNumObj
 * @return {Promise}
 *      @return {Object} result
 * @api public
 */
exports.writeResult = co.wrap(function*(languageCodeMapArr, leetcodeNumObj){
    languageCodeMapArr.forEach(element => {
        let ele = {};
        result[element['_id']] = ele;
        ele.id = element['_id'];
        ele.level = element['_level'];
        ele.title = element['_title'];
        ele.language = element['_solveLang'];
    })
    yield thenFs.unlink(path.resolve(process.cwd(),'result.json')).catch(function(){});
    result.lastUpdatedTime = getTimeStr("yyyy-MM-dd");
    Object.assign(result,leetcodeNumObj);
    yield thenFs.writeFile(path.resolve(process.cwd(),'result.json'), JSON.stringify(result));
    return result;
})

/**
 * Get the time string with the specified format
 *
 * @param {String} fmt
 * @return {String}
 * @api public
 */
function getTimeStr(fmt){
    let time = new Date();
    let o = {
        "M+": time.getMonth() + 1, //月份
        "d+": time.getDate(), //日
        "h+": time.getHours(), //小时
        "m+": time.getMinutes(), //分
        "s+": time.getSeconds(), //秒
        "q+": Math.floor((time.getMonth() + 3) / 3), //季度
        "S": time.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (time.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (let k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}