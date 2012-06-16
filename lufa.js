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
var Class = require('./lib/Class.js').Class,
    path = require('path'),
    fs = require('fs'),
    Lexer = require('./lexer/Lexer.js'),
    Parser = require('./parser/Parser.js'),
    Module = require('./compiler/Module.js');


function CompilerError(msg) {
    this.name = 'CompilerError';
    this.message = msg;
}

CompilerError.prototype = Error.prototype;


/**
  * The lufa compiler.
  */
var Compiler = Class(function(libPath) {

    this.libPath = libPath || '.';

    // Modules used during compilation
    this.modules = {};
    this.moduleList = [];

}, {

    getModule: function(moduleName) {

        if (this.modules.hasOwnProperty(moduleName)) {
            return this.modules[moduleName];
        }

        var filename = this.resolveModuleName(moduleName);
        if (!filename) {
            throw new CompilerError('Module "' + moduleName + '" not found.');

        } else {

            var file = this.parseFile(filename);
            this.modules[moduleName] = new Module(moduleName, file);
            this.moduleList.push(this.modules[moduleName]);
            return this.modules[moduleName];

        }

    },

    /**
      * Resolves the module name and returns the path of the file which matches its name
      */
    resolveModuleName: function(name) {

        function getStat(p) {

            var abs = path.join.apply(null, p);
            if (fs.existsSync(abs)) {
                return fs.statSync(abs);

            } else {
                return null;
            }

        }

        // foo.name
        var parts = name.split('.');
        for(var i = 0, l = parts.length; i < l; i++) {

            var p = parts.slice(0, i + 1),
                stat;

            // Check for directoy
            if (i < l - 1) {

                stat = getStat(p);
                if (!(stat && stat.isDirectory())) {
                    return null;
                }

            } else {

                // Check for script file
                p[i] = parts[i] + '.lf';
                stat = getStat(p);
                if (stat && stat.isFile()) {
                    return path.join.apply(null, p);

                // Check for package index
                } else {

                    p[i] = parts[i];
                    p.push('index.lf');

                    stat = getStat(p);
                    if (stat && stat.isFile()) {
                        return path.join.apply(null, p);

                    } else {
                        return null;
                    }

                }

            }

        }

    },

    /**
      * Parses the given file and create an AST and meta information for it
      */
    parseFile: function(filename) {

        var source = fs.readFileSync(filename).toString(),
            tokens = Lexer.parse(source, 4, true);

        return {
            source: source,
            ast: Parser.ast(tokens),
            filename: filename
        };

    },

    /**
      * Performs AST analysis on scopes, names, classes and members
      *
      * Also defines imports and exports for the module.
      */
    compile: function(moduleName) {

        this.getModule(moduleName);

        var module = null;
        while((module = this.moduleList.shift())) {
            module.compile(this);
        }

    },

    /**
      * Does type and expression analysis and ensures the code works
      */
    validateModule: function(module) {

    },

    /**
      * Generates low level code for execution
      */
    generateModule: function(module) {

    }

});


var c = new Compiler();
c.compile('test');

