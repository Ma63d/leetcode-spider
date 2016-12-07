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


/**
 * Write the solutions and question into file.
 *
 * @param {Object} languageCodeMap, an map object to store different language's solutions
 * @return {Promise}
 * @api public
 */
exports.writeToFile = co.wrap(function*(languageCodeMap){
    yield dirExistsOrCreate(path.resolve(process.cwd(),formatId(languageCodeMap._id)+'.'+languageCodeMap._title));
    try{
        let promises = Object.keys(languageCodeMap).filter((prop)=>{
            return (prop in language);
        }).map(lang => {
            console.log('write to file: '+formatId(languageCodeMap._id) +'.'+ languageCodeMap._title +' '+lang);
            return write(path.resolve(process.cwd(),formatId(languageCodeMap._id)+'.'+languageCodeMap._title,languageCodeMap._title+'.'+language[lang]),languageCodeMap[lang]);
        })
        promises.push(write(path.resolve(process.cwd(),formatId(languageCodeMap._id)+'.'+languageCodeMap._title,languageCodeMap._title+'.question.md'),languageCodeMap['_question']))
        yield promises;
    }catch(err){
        debug('file write err',languageCodeMap._id);
        throw(err);
    }
})

/**
 * Check if the dir exists.
 * If not, create it.
 *
 * @param {Object} languageCodeMap, an map object to store different language's solutions
 * @return {Promise}
 * @api public
 */
let dirExistsOrCreate = co.wrap(function*(path){
    try{
        let stats = yield thenFs.stat(path);
        if(!stats.isDirectory()){
            throw new Error('not directory');
        }
    }catch(e){
        yield thenFs.mkdir(path);
    }
})

/**
 * Write it into file.
 *
 * @param {String} pathToWrite
 * @param {String} content
 * @return {Promise}
 * @api public
 */
let write = co.wrap(function*(pathToWrite,content){
    yield thenFs.writeFile(pathToWrite,content).catch(err => {
        throw err;
    })
})

/**
 * Format id to 3-bit.
 *
 * @param {Number} id
 * @return {String}
 * @api public
 */
let formatId = function(id){
    if(id< 10){
        return '00'+id;
    }else if(id < 100){
        return '0'+id;
    }else{
        return ''+id;
    }
}