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

var Scope = Class(function(module, parentScope, baseNode) {

    this.type = 'block';

    this.module = module; // the module this scope belongs to eventually
    this.parentScope = parentScope; // the direct parent of this scope
    this.baseNode = baseNode; // the base node (the token defining the scope header)
    this.body = baseNode; // the body, this might be different for loops and functions

    this.returnScope = null;
    this.breakScope = null;
    this.memberScope = null;

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

    addScope: function(scope) {

        this.scopes.push(scope);

        // Find return / break / member scopes
        var parent = this;
        while(parent) {

            if (scope.returnScope === null && parent.type === 'function' && this.type !== 'function') {
                scope.returnScope = parent;
            }

            if (scope.breakScope  === null && parent.type === 'loop' && this.type !== 'loop') {
                scope.breakScope  = parent;
            }

            if (scope.memberScope === null && parent.type === 'class' && this.type !== 'class') {
                scope.memberScope = parent;
            }

            parent = parent.parentScope;

        }

        return scope;

    },

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

    resolveName: function(node) {

        for(var d in this.defines) {
            if (this.defines.hasOwnProperty(d)) {

                var defs = this.defines[d];
                if (defs.hasOwnProperty(node.value)) {
                    return defs[node.value];
                    //return this.resolver.typeFromNode(name);
                }

            }
        }

        if (this.parentScope) {
            return this.parentScope.resolveName(node);

        } else {
            this.error(node, null, 'Reference to undefined name "{first.name}" at {first.pos}.');
            throw new Resolver.$NameError();
        }

    },

    nodes: {

        FUNCTION: function(func) {
            this.defineFunction(func);
            this.addScope(new FunctionScope(this.module, this, func));
        },

        IF: function(iff) {

            this.conditions.push(iff.condition);
            this.addScope(new Scope(this.module, this, iff.body));

            for(var i = 0, l = iff.branches.length; i < l; i++) {

                if (iff.condition) {
                    this.conditions.push(iff.condition);
                }

                this.addScope(new Scope(this.module, this, iff.branches[i].body));

            }

        },

        SCOPE: function(scope) {
            this.addScope(new Scope(this.module, this, scope.body));
        },

        // TODO Loops
        FOR: function(loop) {
            this.addScope(new ForScope(this.module, this, loop));

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

