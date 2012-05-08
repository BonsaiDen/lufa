/**
  * Copyright (c) 2012 Ivo Wetzel.
  *
  * Permission is hereby granted, free of charge, to any person obtaining a copy
  * of this software and associated documentation files (the "Software"), to deal
  * in the Software without restriction, including without limitation the rights
  * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  * copies of the Software, and to permit persons to whom the Software is
  * furnished to do so, subject to the following conditions:
  *
  * The above copyright notice and this permission notice shall be included in
  * all copies or substantial portions of the Software.
  *
  * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  * THE SOFTWARE.
  */
var lexer = require('./lexer'),
    Parser = require('./Parser').Parser,
    fs = require('fs'),
    util = require('util');

function compile(source) {

    var tokens = lexer.parse(source, 4, true),
        p = new Parser();

    return p.parse(tokens);

}

function compileFile(file, debug) {

    console.log('Parsing', file);

    var source = fs.readFileSync(file).toString(),
        tokens = lexer.parse(source, 4, true),
        p = new Parser();

    if (debug) {
        for(var i = 0, l = tokens.length; i < l; i++) {
            console.log(tokens[i].toString());
        }
    }

    var tree = p.parse(tokens);

    if (debug) {
        console.log(util.inspect(tree, false, 10));
    }

    //var compress = require('compress-buffer').compress;
    fs.writeFileSync(file + 'a', util.inspect(tree, false, 10));//'Lufa' + compress(new Buffer(JSON.stringify(tree))));

}

exports.compile = compile;
exports.compileFile = compileFile;

