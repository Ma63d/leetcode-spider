"use strict";
/**
 * Created by chuck7 on 16/12/5.
 */
let co = require('co');
let fs = require('fs');
let thenifyAll = require('thenify-all');
let path = require('path');
let langExtMap = require('./language').extMap;
let thenFs = thenifyAll(fs,{},['stat','mkdir','writeFile']);
const debug = require('debug')('lc-spider');
const logger = require('log4js').getLogger('layout-pattern');

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
 * Write the solutions and question into file.
 *
 * @param {Object} languageCodeMap, an map object to store different language's solutions
 * @return {Promise}
 * @api public
 */
exports.writeToFile = co.wrap(function*(languageCodeMap){
    yield dirExistsOrCreate(path.resolve(process.cwd(),formatId(languageCodeMap._id)+'.'+languageCodeMap._title));
    try{
        let solveLang = [];
        let promises = Object.keys(languageCodeMap).filter((prop)=>{
            return (prop in langExtMap);
        }).map(lang => {
            logger.info('write to file: '+formatId(languageCodeMap._id) +'.'+ languageCodeMap._title +' '+lang);
            solveLang.push(lang);
            return write(path.resolve(process.cwd(),formatId(languageCodeMap._id)+'.'+languageCodeMap._title,languageCodeMap._title+'.'+langExtMap[lang]),languageCodeMap[lang]);
        })
        languageCodeMap._solveLang = solveLang;
        promises.push(write(path.resolve(process.cwd(),formatId(languageCodeMap._id)+'.'+languageCodeMap._title,'question.md'),languageCodeMap['_question']))
        yield promises;
    }catch(err){
        debug('file write err',languageCodeMap._id);
        throw(err);
    }
})



/**
 * Format id to 3-bit.
 *
 * @param {Number} id
 * @return {String}
 * @api public
 */
function formatId(id){
    if(id< 10){
        return '00'+id;
    }else if(id < 100){
        return '0'+id;
    }else{
        return ''+id;
    }
}