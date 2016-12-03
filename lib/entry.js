"use strict";
let chalk = require('chalk');
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
if(!fs.existsSync(path.resolve(process.cwd(),argv.c))){
    return console.warn(chalk.red("config file not exist!"));
}
let config = require(path.resolve(process.cwd(),argv.c));
if(undefined == config.username || undefined == config.password){
    return console.warn(chalk.red("username or password not found in config file"));
}
let spider = require('./spider.js');
spider.login(config).then(spider.fetchACLists(config)).then(spider.fetchACSolutions).catch(err => console.error(err));;