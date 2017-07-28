/**
 * @file
 * @author liucan10(chuck7liu@gmail.com)
 */

const fs = require('fs')
const path = require('path')
/**
 * Check if the dir and its ancestor dir exists.
 * If not, create it recursively.
 *
 * @api public
 */
function ensureDirectoryExists (dirname) {
    if (fs.existsSync(dirname)) {
        return true
    }
    ensureDirectoryExists(path.dirname(dirname))
    fs.mkdirSync(dirname)
}
exports.ensureDirectoryExists = ensureDirectoryExists
