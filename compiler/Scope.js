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
    TypeCache = require('./TypeCache'),
    FunctionScope, ClassScope, ForScope, ComprehensionScope;


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
    this.cachedTypes = {};

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

    warning: function(node, msg, data) {
        this.module.addWarning(node, msg, data);
    },

    error: function(node, msg, data) {
        this.module.addError(node, msg, data);
    },

    compile: function() {

        var returned = false,
            node = null;

        var body = this.body;
        for(var i = 0, l = body.length; i < l; i++) {

            if (returned) {
                this.error(node, 'Dead code after return statement, {next} is never reached.', {
                    next: body[i]
                });
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

    isDefined: function(node) {

        for(var i in this.defines) {
            if (this.defines.hasOwnProperty(i)) {

                if (this.defines[i].hasOwnProperty(node.name)) {

                    var original = this.defines[i][node.name];
                    this.error(node, 'Re-definition of "{name}", originally {mode} at {line}, col {col} as type of {type}', {
                        name: original.name,
                        mode: (original.isImport ? 'imported' : 'defined'),
                        line: original.line,
                        col: original.col,
                        type: original.type // TODO !?!?!
                    });

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
        this.resolver.validateConditions();
    },

    resolveTypeFromName: function(node) {

        var name = node.name || node.value;
        for(var d in this.defines) {
            if (this.defines.hasOwnProperty(d)) {

                var defs = this.defines[d];
                if (defs.hasOwnProperty(name)) {

                    var original = defs[name];
                    this.checkReferencePosition(node, original);

                    if (this.cachedTypes.hasOwnProperty(name)) {
                        return this.cachedTypes[name];
                    }

                    if (node.type.isBuiltin) {
                        this.cachedTypes[name] = TypeCache.getIdentifier(node.type, node);
                        this.cachedTypes[name].isName = true;

                    } else {

                        if (this.cachedTypes.hasOwnProperty(name)) {
                            return this.cachedTypes[name];
                        }

                        // Find the original user type description
                        var scope = this;
                        while(scope) {

                            var types = scope.defines.types;
                            if (types.hasOwnProperty(node.type.value)) {
                                //console.log('found user type', );
                                node = types[node.type.value];
                                this.cachedTypes[name] = TypeCache.getIdentifier(node.type, node, null, null, this);
                                break;
                            }

                            scope = scope.parentScope;

                        }

                    }

                    return this.cachedTypes[name];

                }

            }
        }

        if (this.parentScope) {
            return this.parentScope.resolveTypeFromName(node);

        } else {
            this.error(node, 'Reference to undefined name "{name}"', {
                name: name
            });

            throw new Resolver.$NameError();

        }

    },

    // TODO remove
    resolveName: function(node) {

        for(var d in this.defines) {
            if (this.defines.hasOwnProperty(d)) {

                var defs = this.defines[d];
                if (defs.hasOwnProperty(node.name || node.value)) {

                    var original = defs[node.name || node.value];
                    this.checkReferencePosition(node, original);
                    return original;

                }

            }
        }

        if (this.parentScope) {
            return this.parentScope.resolveName(node);

        } else {
            this.error(node, 'Reference to undefined name "{name}"', {
                name: node.name || node.value
            });

            throw new Resolver.$NameError();

        }

    },

    checkReferencePosition: function(node, original) {

        if (node.line < original.line || node.line === original.line && node.col < original.col) {
            this.error(node, 'Reference to name "{name}" before definition at line {line}, col {col}', {
                name: node.name,
                line: original.line,
                col: original.col
            });
        }

    },

    addComprehensionScope: function(comp) {
        return this.addScope(new ComprehensionScope(this.module, this, comp));
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
                this.error(ret, 'Return statement outside of function.');
            }

            return true;

        },

        IMPORT: function(imp) {

            for(var i = 0, l = imp.names.length; i < l; i++) {
                this.defineImport(imp.names[i]);
            }

        },

        VARIABLE: function(v) {

            // TODO rewrtie to actually work and create a user type // class
            if (v.type.value === 'hash') {
                this.defineHashType(v);

            // Otherwise deal with normal declaration
            } else {

                this.defineName(v);
                if (v.right) {
                    this.defaults.push(v);
                }

            }

        }

    },

    defineHashType: function(node) {

        if (!this.isDefined(node)) {

            // TODO support sub types correctly
            var foo = this.defines.types[node.name] = {

                type: {
                    isBuiltin: false,
                    value: node.name,
                    type: 'hash',
                    sub: node.type.sub
                },

                fields: node.right.fields || {}

            };

            //console.log(foo);

        }

        //this.types[node.name] = ;

        //console.log(this.types);
        //console.log(node);

                //this.defineType(v);

                //for(var i in v.right.fields) {
                    //if (v.right.fields.hasOwnProperty(i)) {
                        //if (v.right.fields[i].right) {
                            //this.defaults.push(v.right.fields[i]);
                        //}
                    //}
                //}

    }

});

module.exports = Scope;

// Imports these afterwards
FunctionScope = require('./FunctionScope');
ClassScope = require('./ClassScope');
ForScope = require('./ForScope');
ComprehensionScope = require('./ComprehensionScope');

