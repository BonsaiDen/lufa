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

var FunctionScope = Class(function(module, baseScope, parentScope, baseNode) {

    Scope(this, module, baseScope, parentScope, baseNode);

    this.defines.parameters = {};

    this.body = this.baseNode.body;
    this.parameters = this.baseNode.params;
    this.type = 'function';

    this.returns = [];

}, Scope, {

    compile: function() {

        // Define all parameter names and save the expressions for later validation
        // TODO have a better error message for distinguishing paramters later
        // TODO put out a warning in case one of these shadows a name from a top level scope
        for(var i = 0, l = this.parameters.length; i < l; i++) {

            var param = this.parameters[i];
            this.defineParameter(param);
            if (param.right) {
                this.defaults.push(param);
            }

            //var topName;
            //if ((topName = this.parent.resolveName(param))) {
                //this.warning(param, topName, 'Parameter "%name" at %pos shadows definition in outer scope at %opos');
            //}

        }

        return Scope.compile(this);
    },

    defineParameter: function(node) {
        if (!this.isDefined(node)) {
            this.defines['parameters'][node.name] = node;
        }
    },

    validate: function() {
        this.validateDefaults();
        this.validateExpressions();
        this.validateReturns();
    },

    validateReturns: function() {

        for(var i = 0, l = this.returns.length; i < l; i++) {

            var exp = this.returns[i];
            if (exp.right) {
                rType = this.resolveExpression(exp.right);

            // TODO add default returns at a later point?
            } else {
                rType = 'void'; // TODO get void type from builtins
            }

            // TODO validate against function type

        }

    }

});

module.exports = FunctionScope;

