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
    Resolver = require('./Resolver'),
    FunctionScope, ClassScope, ForScope;

var Scope = Class(function(module, baseScope, parentScope, baseNode) {

    this.type = 'block';

    this.module = module;
    this.baseScope = baseScope;
    this.parentScope = parentScope;
    this.baseNode = baseNode;
    this.body = baseNode;

    this.level = parentScope ? parentScope.level + 1 : 0;

    this.defines = {
        functions: {},
        imports: {},
        names: {},
        types: {}
    };

    this.types = {};
    this.defaults = [];
    this.conditions = [];
    this.expressions = [];

    this.scopes = [];
    this.resolver = new Resolver(this);

}, {

    warning: function(first, second, msg) {
        this.module.addWarning(first, second, msg);
    },

    error: function(first, second, msg) {
        this.module.addError(first, second, msg);
    },

    compile: function() {

        var returned = false,
            node = null;

        var body = this.body;
        for(var i = 0, l = body.length; i < l; i++) {

            if (returned) {
                this.error(node, body[i], 'Dead code after return statement at {node.pos}, {original.info} at {original.pos} is never reached.');
                break;
            }

            node = body[i];
            if (this.nodes.hasOwnProperty(node.id)) {
                returned |= this.nodes[node.id].call(this, node);

            } else {
                this.expressions.push(node);
            }

        }

        return this.scopes;

    },

    log: function() {

        console.log('');
        console.log('scope level', this.level);

        for(var d in this.defines) {
            if (this.defines.hasOwnProperty(d)) {
                console.log(d + ':', Object.keys(this.defines[d]));
            }
        }

        console.log('defaults', this.defaults);
        console.log('conditions', this.conditions);
        console.log('expressions', this.expressions);
        console.log('returns', this.returns);

    },

    isDefined: function(node) {

        for(var i in this.defines) {
            if (this.defines.hasOwnProperty(i)) {

                if (this.defines[i].hasOwnProperty(node.name)) {

                    var original = this.defines[i][node.name];
                    this.error(node, original, '"{first.name}" was already '
                                            + (original.isImport ? 'imported into the' : 'defined in the')
                                            + ' current scope at {second.pos} as type of {second.type}, but {first.pos} tries to '
                                            + (original.isImport ? 're-import' : 're-defined')
                                            + ' it as type of {first.type}.');

                    return i;
                }

            }
        }

        return false;

    },

    defineName: function(node) {
        if (!this.isDefined(node)) {
            this.defines.names[node.name] = node;
        }
    },

    defineFunction: function(node) {
        if (!this.isDefined(node)) {
            this.defines.functions[node.name] = node;
        }
    },

    defineType: function(node) {
        if (!this.isDefined(node)) {
            this.defines.types[node.name] = node;
        }
    },

    defineImport: function(node) {

        if (!this.isDefined(node)) {

            this.defines.imports[node.name] = node;
            this.module.imports[node.name] = {
                node: node,
                name: node.name,
                target: null,
                module: null
            };

        }

    },

    validate: function() {
        this.resolver.validateDefaults();
        this.resolver.validateExpressions();
    },

    nodes: {

        FUNCTION: function(func) {
            this.defineFunction(func);
            this.scopes.push(new FunctionScope(this.module, this.baseScope, this, func));
        },

        IF: function(iff) {

            this.conditions.push(iff.condition);
            this.scopes.push(new Scope(this.module, this.baseScope, this, iff.body));

            for(var i = 0, l = iff.branches.length; i < l; i++) {

                if (iff.condition) {
                    this.conditions.push(iff.condition);
                }

                this.scopes.push(new Scope(this.module, this.baseScope, this, iff.branches[i].body));

            }

        },

        SCOPE: function(scope) {
            this.scopes.push(new Scope(this.module, this.baseScope, this, scope.body));
        },

        // TODO Loops
        FOR: function(loop) {
            this.scopes.push(new ForScope(this.module, this.baseScope, this, loop));

        },

        CLASS: function() {

        },

        RETURN: function(ret) {

            var functionScope = this;
            while(functionScope) {

                if (functionScope.type === 'function') {
                    functionScope.returns.push(ret);
                    break;
                }

                functionScope = functionScope.parentScope;

            }

            if (functionScope === null) {
                this.error(ret, null, 'Return statement outside of function at %pos.');
            }

            return true;

        },

        IMPORT: function(imp) {

            for(var i = 0, l = imp.names.length; i < l; i++) {
                var name = imp.names[i];
                this.defineImport(name);
            }

        },

        VARIABLE: function(v) {

            // Detect hash declaration and create user types
            if (v.type.value === 'hash' && v.right && v.right.id === 'HASHDEC') {

                this.defineType(v);

                for(var i in v.right.fields) {
                    if (v.right.fields.hasOwnProperty(i)) {
                        if (v.right.fields[i].right) {
                            this.defaults.push(v.right.fields[i]);
                        }
                    }
                }

            // Otherwise deal with normal declaration
            } else {

                this.defineName(v, 'name');
                if (v.right) {
                    this.defaults.push(v);
                }

            }

        }

    }

});

module.exports = Scope;

// Imports these afterwards
FunctionScope = require('./FunctionScope');
ClassScope = require('./ClassScope');
ForScope = require('./ForScope');

