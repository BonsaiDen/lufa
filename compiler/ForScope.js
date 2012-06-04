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
    Scope = require('./Scope');

var ForScope = Class(function(module, baseScope, parentScope, baseNode) {

    Scope(this, module, baseScope, parentScope, baseNode);

    this.body = this.baseNode.body;
    this.indexes = this.baseNode.indexes;
    this.type = 'forloop';

    this.returns = [];

    // The iterator exists in the parent scope
    this.parentScope.expressions.push(this.baseNode.iterator);

}, Scope, {

    compile: function() {

        // Define indexes inside the loops body scope
        for(var i = 0, l = this.indexes.length; i < l; i++) {
            var index = this.indexes[i];
            this.defineName(index);
        }

        return Scope.compile(this);

    }

});

module.exports = ForScope;


