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
    ForScope = require('./ForScope');

var ComprehensionScope = Class(function(module, baseScope, parentScope, baseNode) {

    ForScope(this, module, baseScope, parentScope, baseNode);
    this.type = 'comprehension';

}, ForScope, {

    /**
      * This does not give the desired results in comprehensions
      * since the syntax itself will result in the indexes being declared after the
      * first usage in the source; thus, we're leaving this blank
      */
    checkReferencePosition: function(node, original) {
    }

});

module.exports = ComprehensionScope;

