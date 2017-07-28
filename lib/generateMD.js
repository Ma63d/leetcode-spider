'use strict'
const fs = require('fs')
const thenifyAll = require('thenify-all')
const thenFs = thenifyAll(fs, {}, ['stat', 'readFile', 'writeFile'])
const path = require('path')
const co = require('co')
const debug = require('debug')('lc-spider')
const Mustache = require('mustache')

let language = require('./language')

const readAndCopyTpl = co.wrap(function * (libTplPath, localTplPath) {
    let tpl
    try {
        yield thenFs.stat(localTplPath)
        tpl = yield thenFs.readFile(localTplPath, 'utf-8')
    } catch (e) {
        tpl = yield thenFs.readFile(libTplPath, 'utf-8')
        yield thenFs.writeFile(localTplPath, tpl)
    }

    return tpl
})

exports.generateMarkdown = co.wrap(function * (resultObj, leetcodeNumObj, outputDir, templatePath) {
    const localTplPath = path.resolve(process.cwd(), templatePath)
    const libTplPath = path.resolve(__dirname, './README.tpl')
    let tpl = yield readAndCopyTpl(libTplPath, localTplPath)

    let reg = /^\.?\/?/
    outputDir = outputDir.replace(reg, '')

    let hardNum = 0
    let easyNum = 0
    let mediumNum = 0

    let problemNumbers = Object.keys(resultObj).map(key => +key).filter(key => {
        return !isNaN(key)
    }).sort()
    let solutions = []
    problemNumbers.forEach(id => {
        let idStr = formatId(id)
        let solutionLinks = ``
        resultObj[id].language.forEach(lang => {
            solutionLinks += ` [${lang}](./${outputDir}/${idStr}.${resultObj[id].title}/${resultObj[id].title}.${language.nameMap[lang]})`
        })
        let difficulty = leveToStr(resultObj[id].level)
        switch (difficulty) {
        case 'Easy':
            easyNum++
            break
        case 'Medium':
            mediumNum++
            break
        case 'Hard':
            hardNum++
            break
        }

        solutions.push({
            id: idStr,
            title: resultObj[id].title,
            solutionLinks,
            difficulty,
            paidOnly: resultObj[id].paidOnly ? ':heavy_check_mark:' : '',
            acceptance: resultObj[id].acceptance
        })
    })
    solutions.sort((a, b) => {
        return parseInt(a.id, 10) - parseInt(b.id, 10)
    })
    const viewData = {
        language: leetcodeNumObj.language.join(' '),
        total: leetcodeNumObj.total,
        solved: leetcodeNumObj.solved,
        locked: leetcodeNumObj.locked,
        hard: hardNum,
        medium: mediumNum,
        easy: easyNum,
        time: getTimeStr('yyyy-MM-dd'),
        solutions: solutions
    }
    debug(viewData)
    let readmeContent = Mustache.render(tpl, viewData)

    yield thenFs.writeFile(path.resolve(process.cwd(), 'README.md'), readmeContent)
})

function getTimeStr (fmt) {
    let time = new Date()
    let o = {
        'M+': time.getMonth() + 1, // 月份
        'd+': time.getDate(), // 日
        'h+': time.getHours(), // 小时
        'm+': time.getMinutes(), // 分
        's+': time.getSeconds(), // 秒
        'q+': Math.floor((time.getMonth() + 3) / 3), // 季度
        'S': time.getMilliseconds() // 毫秒
    }
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (time.getFullYear() + '').substr(4 - RegExp.$1.length))
    for (let k in o) { if (new RegExp('(' + k + ')').test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length))) }
    return fmt
}

function formatId (id) {
    if (id < 10) {
        return '00' + id
    } else if (id < 100) {
        return '0' + id
    } else {
        return '' + id
    }
}
function leveToStr (level) {
    switch (level) {
    case 1: return 'Easy'
    case 2: return 'Medium'
    case 3: return 'Hard'
    }
}
