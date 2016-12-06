"use strict";
const debug = require('debug')('lc-spider');
let chalk = require('chalk');
let thenify = require('thenify');
let path = require('path');
let argv = require('yargs')
    .option('c', {
        alias : 'config',
        demand: true,
        describe: 'Use your config file to download your leetcode accepted solutions',
        type: 'string'
    })
    .usage('Usage: $0 [options]')
    .example('$0 -c config.json', `Use the config file 'config.json' to run lc-spider.
    You need to write a json file beforehand like this :
     ` + chalk.blue(`{
        "username" : "hello@gmail.com",
        "password" : "xxxxxxxxx",
        "languages": ["java","c++","c"],
        "git_repo":"https://github.com/hello/leetcode"
     }\n`) +
     `The fields ${chalk.red("username" )} and ${chalk.red("password" )}  are your leetcode account, both necessary.
     The field ${chalk.red("languages" )} is necessary.Only the accepted solutions wrote in those languages will be downloaded.
     The field ${chalk.red("git_repo" )} is not necessary.When we are finishing downloading, it will be used to form a markdown file.
    `)
    .help('h')
    .alias('h', 'help')
    .argv;


let fs = require('fs');
let co = require('co');
let stat = thenify(fs.stat);
let spider = require('./spider.js');



co(function *(){
    let stats = yield stat(path.resolve(process.cwd(),argv.c)).catch(err=>{
        throw new Error("config file "+argv.c +" not exist!");
    });
    if(!stats.isFile()){
        throw new Error("config file "+argv.c +" not exist!");
    }
    let config = require(path.resolve(process.cwd(),argv.c));
    if(!configCheck(config)){
        throw new Error('config file error');
    }
    debug('begin');
    return config;
})  .then(spider.login)
    .then(spider.fetchACLists)
    .then(spider.fetchACSolutions)
    .catch(err => {
        console.log(err);
        console.error(err.stack);
        process.exit();
    });




function configCheck(config){
    if(undefined == config.username || undefined == config.password){
        console.warn(chalk.red("username or password not found in config file"));
        return false;
    }
    const languageExtMap = require('./language');
    if(config.language){
        if(config.length < 1){
            return console.warn(chalk.red("at least one language needed"));
        }
        let languageCheck = config.language.every(element => {
            if(languageExtMap[element] == undefined){
                console.error(element +'is not supported');
                return false;
            }
            return true;
        })
        if(!languageCheck){
            return false;
        }
    }
    return true;
}
process.on('uncaughtException', function (err) {
    console.log('uncaughtException:')
    console.log(err);
})
