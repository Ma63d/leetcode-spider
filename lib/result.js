"use strict";
let fs = require('fs');
let path = require('path');
let co = require('co');
let thenifyAll = require('thenify-all');
let language = require('./language');
let thenFs = thenifyAll(fs,{},['stat','unlink','writeFile']);


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
            return require(path.resolve(process.cwd(),'result.json'));
        }else{
            throw(new Error('result.json not exist'));
        }
    }catch(e){
        return {};
    }
})


/**
 * Write the spider result to result.json.
 *
 * @param {Object} languageCodeMap
 * @return {Promise}
 * @api public
 */
exports.writeResult = co.wrap(function*(languageCodeMapArr){
    let result = {};
    languageCodeMapArr.forEach(element => {
        let ele = {};
        result[element['_id']] = ele;
        ele.id = element['_id'];
        ele.level = element['_level'];
        ele.title = element['_title'];
    })
    yield thenFs.unlink(path.resolve(process.cwd(),'result.json')).catch(function(){});
    yield thenFs.writeFile(path.resolve(process.cwd(),'result.json'),JSON.stringify(result));
})