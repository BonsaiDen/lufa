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
var Class = require('../lib/Class').Class,
    leafy = require('../lib/leafy'),
    Scope = require('./Scope'),
    util = require('util');


var Module = Class(function(name, fileData) {

    this.name = name;

    this.source = fileData.source;
    this.filename = fileData.filename;
    this.ast = fileData.ast;

    //console.log(util.inspect(this.ast, false, 8, true));

    this.imports = {};
    this.exports = {};

    this.warnings = [];
    this.errors = [];

    this.topScope = null;

    this.scopes = {};

    this.parseScopes();

}, {

    parseScopes: function() {

        this.topScope = new Scope(this, null, this.ast);

        this.scopes[0] = [this.topScope];

        var scopes = [this.topScope],
            level = 1;

        while(scopes.length) {

            var levelScopes = scopes;
            scopes = [];

            this.scopes[level] = [];
            for(var i = 0, l = levelScopes.length; i < l; i++) {
                var addScopes = levelScopes[i].compile();
                this.scopes[level].push.apply(this.scopes[level], addScopes);
                scopes.push.apply(scopes, addScopes);
            }

            level++;

        }

    },

    addWarning: function(node, msg, data) {
        this.warnings.push([node, leafy(msg).map(data).toString()]);
    },

    addError: function(node, msg, data) {
        this.errors.push([node, leafy(msg).map(data).toString()]);
    },

    compile: function(compiler) {

        this.resolveImports(compiler);
        this.validate();

        // Error reporting
        function sort(a, b) {
            if (a[0].line < b[0].line) {
                return -1;

            } else if (a[0].line > b[0].line) {
                return 1;

            } else {
                return a[0].col - b[0].col;
            }
        }

        this.warnings.sort(sort);
        this.errors.sort(sort);

        var i, l;
        for(i = 0, l = this.warnings.length; i < l; i++) {
            console.log(leafy('Warn {line}:{col}: {msg}').map({
                line: this.warnings[i][0].line,
                col: this.warnings[i][0].col,
                msg: this.warnings[i][1]

            }).toString());
        }

        for(i = 0, l = this.errors.length; i < l; i++) {
            console.log(leafy('Err {line}:{col}: {msg}').map({
                line: this.errors[i][0].line,
                col: this.errors[i][0].col,
                msg: this.errors[i][1]

            }).toString());
        }

    },

    validate: function() {

        for(var level in this.scopes) {
            if (this.scopes.hasOwnProperty(level)) {

                var scopes = this.scopes[level];
                for(var i = 0, l = scopes.length; i < l; i++) {
                    scopes[i].validate();
                }

            }
        }

    },

    resolveImports: function(compiler) {

        function moduleName(token) {

            var name = token.value;
            while((token = token.left)) {
                name += '.' + token.value;
            }

            return name;

        }

        for(var i in this.imports) {
            if (this.imports.hasOwnProperty(i)) {

                var im = this.imports[i].node;

                // As imports
                if (im.original) {

                    // As from base
                    if (im.base) {
                        //console.log('from', moduleName(im.base), 'import', im.original.value, 'as', im.name);
                        im.module = compiler.getModule(moduleName(im.base));
                        im.target = im.original;

                    // Plain as
                    } else {
                        //console.log('import', moduleName(im.original), 'as', im.name);
                        im.module = compiler.getModule(moduleName(im.original));
                    }

                // From imports
                } else if (im.base) {
                    //console.log('from', moduleName(im.base), 'import', im.name);
                    im.module = compiler.getModule(moduleName(im.base));
                    im.target = im.name;

                } else {
                    //console.log('import', im.name);
                    im.module = compiler.getModule(moduleName(im));
                }

            }
        }

    }

});

module.exports = Module;

