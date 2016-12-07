"use strict";
let fs = require('fs');
let path = require('path');
let co = require('co');
let thenifyAll = require('thenify-all');
let language = require('./language');
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
 * @return {Promise}
 *      @return {Object} result
 * @api public
 */
exports.writeResult = co.wrap(function*(languageCodeMapArr){
    languageCodeMapArr.forEach(element => {
        let ele = {};
        result[element['_id']] = ele;
        ele.id = element['_id'];
        ele.level = element['_level'];
        ele.title = element['_title'];
        ele.language = element['_solveLang'];
    })
    yield thenFs.unlink(path.resolve(process.cwd(),'result.json')).catch(function(){});
    yield thenFs.writeFile(path.resolve(process.cwd(),'result.json'),JSON.stringify(result));
    return result;
})