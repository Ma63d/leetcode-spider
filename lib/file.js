"use strict";
/**
 * Created by chuck7 on 16/12/5.
 */
let co = require('co');
let fs = require('fs');
let thenifyAll = require('thenify-all');
let path = require('path');
let language = require('./language');
let thenFs = thenifyAll(fs,{},['stat','mkdir','writeFile']);
const debug = require('debug')('lc-spider');
exports.writeToFile = function*(languageCodeMap){
    yield fileExistsOrCreate(path.resolve(process.cwd(),formatId(languageCodeMap._id)+'.'+languageCodeMap._title));
    try{
        let promises = Object.keys(languageCodeMap).filter((prop)=>{
            return (prop in language);
        }).map(lang => {
            return write(path.resolve(process.cwd(),formatId(languageCodeMap._id)+'.'+languageCodeMap._title,languageCodeMap._title+'.'+language[lang]),languageCodeMap[lang]);
        })
        promises.push(write(path.resolve(process.cwd(),formatId(languageCodeMap._id)+'.'+languageCodeMap._title,languageCodeMap._title+'.title.md'),languageCodeMap['_problem']))
        yield promises;
    }catch(err){
        debug('file write err',languageCodeMap._id);
        throw(err);
    }
}
let fileExistsOrCreate = function(path){
    return co(function*(){
        try{
            let stats = yield thenFs.stat(path);
            if(!stats.isDirectory()){
                throw new Error('not directory');
            }
        }catch(e){
            yield thenFs.mkdir(path);
        }
    })
}
let write = function(path,content){
    return co(function*(){
        yield thenFs.writeFile(path,content).catch(err => {
            throw err;
        })
    })
}
let formatId = function(id){
    if(id< 10){
        return '00'+id;
    }else if(id < 100){
        return '0'+id;
    }else{
        return ''+id;
    }
}