"use strict";
let fs = require('fs');
let path = require('path');
let co = require('co');
let thenifyAll = require('thenify-all');
let language = require('./language');
let thenFs = thenifyAll(fs,{},['stat','unlink','writeFile']);

exports.getResult =() => {
    return co(function*(){
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
}
exports.writeResult = (languageCodeMapArr) => {
    return co(function*(){
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
}