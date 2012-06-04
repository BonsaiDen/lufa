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
    Scope = require('./Scope'),
    FunctionScope = require('./Scope');


var ClassScope = Class(function(module, baseScope, parentScope, baseNode) {

    Scope(this, module, baseScope, parentScope, baseNode);

    this.members = {};

    this.type = 'class';
    this.members = {};

}, Scope, {

    compile: function() {

        // Constructor
        var node = this.baseNode;
        if (node.constructor) {
            this.scopes.push(new FunctionScope(this.module, this, this, node.constructor));
        }

        // Destructor
        if (node.destructor) {
            this.scopes.push(new FunctionScope(this.module, this, this, node.destructor));
        }

        // Define members
        var members = node.members,
            methods = node.methods,
            i;

        for(i in members) {

            if (members.hasOwnProperty(i)) {
                var member = members[i];
                this.defineMember(member);
                this.defaults.push(member);
            }

        }

        // Define methods
        for(i in methods) {

            var method = methods[i];
            this.defineMember(method);

            this.scopes.push(new FunctionScope(this.module, this, this, method));

        }

        return this.scopes;

    },

    defineMember: function(node) {

        if (this.members.hasOwnProperty(node.name)) {
            var original = this.members[node.name];

        } else {
            this.members[node.name] = node;
        }

    }

});

module.exports = ClassScope;

