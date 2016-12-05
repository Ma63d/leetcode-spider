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
exports.writeToFile = function(languageCodeMapArr){
    return co(function*(){
        let promises = languageCodeMapArr.map((e) =>{
            return co(function*(){
                yield fileExistsOrCreate(path.resolve(process.cwd(),formatId(e._id)+'.'+e._title));
                try{
                    yield Object.keys(e).filter((prop)=>{
                        return (prop in language);
                    }).map(lang => {
                        return write(path.resolve(process.cwd(),formatId(e._id)+'.'+e._title,e._title+'.'+language[lang]),e[lang]);
                    })
                }catch(e){
                    throw(e);
                }
            })
        })
        try{
            yield promises;
        }catch(e){
            throw(e);
        }
    })
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