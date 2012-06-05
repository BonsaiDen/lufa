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
    operators = require('./operators'),
    builtinTypes = require('./builtinTypes'),
    FunctionScope, ClassScope, ForScope;

function ExpressionError() {}
function NameError() {}

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
        this.validateDefaults();
        this.validateExpressions();
    },

    validateDefaults: function() {

        for(var i = 0, l = this.defaults.length; i < l; i++) {

            var def = this.defaults[i];

            this.typeFromNode(def);

            var rType = this.resolveExpression(def.right);

            //console.log('defaults======', def, rType);

            // TODO better error handling
            if (!this.compareTypes(def.type, rType)) {
                //this.error(def, def.right, 'Invalid type assignment');
            }

        }

    },

    // Right must be a object returned by the expression resolver
    // Left must be a type object from a token
    compareTypes: function(left, right) {
        //console.log(left, right);
    },

    validateExpressions: function() {

        for(var i = 0, l = this.expressions.length; i < l; i++) {
            var exp = this.expressions[i],
                rType = this.resolveExpression(exp);

            //console.log('expression======', exp, rType);

        }

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

    },

    resolveExpression: function(node) {

        try {
            var type = this.resolveExpressionType(node);
            return {
                type: type
            };

        } catch(err) {

            if (!(err instanceof ExpressionError) && !(err instanceof NameError)) {
                throw err;

            } else {
                return null;
            }

        }

    },

    // TODO check wether expressions are "Plain" meaning that they only use constatns or literals but do no member / name lookup or any calls
    resolveExpressionType: function(node, parent) {

        // How to handle user types?
        var value = null,
            base = null,
            left = null,
            right = null;

        switch(node.id) {

            case 'LIST':

                // The list type is determined by the first item in the list
                // subsequent lists must be the same type or will raise errors
                // if a list is mixed, it will match all assignments
                for(var i = 0, l = node.items.length; i < l; i++) {
                    var item = node.items[i];
                    if (value === null) {
                        value = this.resolveExpressionType(item);

                    } else {
                        if (!this.compareTypes(value, this.resolveExpressionType(item))) {
                            this.error(node, null, 'Item #' + (i + 1) + ' in list does not have the expected type of "' + value.id + '".');
                        }
                    }

                }

                break;

            case 'NAME':
                value = this.resolveTypeFromName(node);
                break;

            case 'IDENTIFIER':
                break;

            case 'MEMBER':
                // resolve from this.base
                // check if this.base is class, otherwise error out due to @ outside of class
                break;

            case 'DOT':
                base = this.resolveExpressionType(node.left);
                value = this.resolveMember(base, node.right);
                break;

            case 'CAST':
                if (node.type.builtin) {
                    value = builtinTypes.resolveFromType(node.type);

                } else {
                    throw new Error('Cast to non builtin types is not supported at the moment');
                }
                break;

            case 'CALL':

                left = this.resolveExpressionType(node.left);
                if (left) {

                    if (!left.isFunction) {
                        this.error(node, null, 'Cannot call non-function type "' + left.id + '" at {first.pos}.');
                        throw new ExpressionError();

                    // Validate arguments
                    } else {

                        // Required
                        var i, arg, param;
                        for(i = 0; i < Math.min(left.requiredParams, node.args.length); i++) {
                            this.validateParameter(node.left, i, left.params[i], node.args[i]);
                        }

                        if (left.requiredParams > node.args.length) {
                            this.error(node.left, null, 'Parameter count mismatch, call to function "{first.name}" ({first.pos}) requires ' + left.requiredParams + ' arguments, but only ' + node.args.length + ' were supplied.');
                        }

                        // Optional
                        for(i = left.requiredParams; i < Math.min(left.params.length, node.args.length); i++) {
                            this.validateParameter(node.left, i, left.params[i], node.args[i]);
                        }

                        if (node.args.length > left.params.length) {
                            this.error(node.left, null, 'Parameter count mismatch, call to function "{first.name}" ({first.pos}) takes at maximum ' + left.params.length + ' arguments, but ' + node.args.length + ' were supplied.');
                        }

                        return left.type;
                    }

                }

                if (value === null) {
                    this.error(node.left, null, 'Cannot call non-function type at {first.pos}.');
                    throw new ExpressionError();
                }

                break;

            case 'ASSIGN':
                value = this.validateAssignment(node);
                break;

            // Binary and unary expressions
            default:

                // TODO for tenary, we return two possible values...
                // so the upper thing must check here for both types being able
                // to fit the expression
                if (node.arity === 'binary') {

                    left = this.resolveExpressionType(node.left);
                    right = this.resolveExpressionType(node.right);

                    if (left && right) {
                        value = operators.resolveBinary(node.id, left.id, right.id);
                    }

                    if (value === null) {
                        this.error(node, null, 'Incompatible types for {first.id} operator at {first.pos}, result for operands "' + left.id + ':' + right.id + '" is undefined.');
                        throw new ExpressionError();
                    }

                } else if (node.arity === 'unary') {

                    right = this.resolveExpressionType(node.right);
                    if (right) {
                        value = operators.resolveUnary(node.id, right.id);
                    }

                    if (value === null) {
                        this.error(node, null, 'Incompatible types for unary {first.id} operator at {first.pos}, result for operand "' + right.id + '" is undefined.');
                        throw new ExpressionError();
                    }

                    break;

                } else if (node.arity === 'literal') {
                    value = builtinTypes.resolveFromNode(node);

                } else {
                    throw new Error('Unhandled expression type: ' + node.id + ':' + node.arity);
                }

                break;

        }

        return value;

    },

    validateAssignment: function(node) {

        var value = null,
            left = this.resolveExpressionType(node.left),
            right = this.resolveExpressionType(node.right);

        // Check assignment operator
        if (left && right) {

            if (node.value) {
                value = operators.resolveBinary(node.value, left.id, right.id);
                if (value === null) {
                    this.error(node, null, 'Incompatible types for {first.value} assignment operator at {first.pos}, result for operands "' + left.id + ':' + right.id + '" is undefined.');
                    throw new ExpressionError();
                }

            } else if (left.id === right.id) {
                value = left;
            }

            if (left.isConst) {
                this.error(node, null, 'Cannot assign to constant at {first.pos}.');
            }

        }

        if (value === null) {
            this.error(node, null, 'Incompatible types for {first.id} assignment at {first.pos}, result for operands "' + left.id + ' = ' + right.id + '" is undefined.');
            throw new ExpressionError();
        }

        return value;

    },

    validateParameter: function(node, i, param, arg) {

        param = builtinTypes.resolveFromType(param.type);
        arg = this.resolveExpressionType(arg);

        if (!this.compareTypes(arg, param)) {
            this.error(node, null, 'Argument #' + (i + 1) + ' for call of function "{first.name}" has invalid type. "' + param.id + '" is required, but "' + arg.id + '" was supplied.');
        }

    },

    resolveTypeFromName: function(node) {

        for(var d in this.defines) {
            if (this.defines.hasOwnProperty(d)) {

                var defs = this.defines[d];
                if (defs.hasOwnProperty(node.value)) {

                    var name = defs[node.value];
                    this.typeFromNode(name);

                    // TODO return object and add things like isConst and others
                    if (name.type.builtin) {

                        var plain = builtinTypes.resolveFromType(name.type);
                        return {
                            id: plain.id,
                            isList: name.id === 'LIST',
                            isFunction: name.id === 'FUNCTION',
                            isConst: name.isConst || false,
                            type: plain,
                            params: name.params || null,
                            requiredParams: name.requiredParams || 0,
                            name: node.value
                        };

                    } else {
                        console.log('found used defined', name.name || name.value);
                        // user defined type
                    }

                }

            }
        }

        // TODO: Error due to missing name!
        if (this.parentScope) {
            return this.parentScope.resolveTypeFromName(node);

        } else {
            this.error(node, null, 'Reference to undefined name "{first.name}" at {first.pos}.');
            throw new NameError();
        }

    },

    typeFromNode: function(node) {

        if (this.types.hasOwnProperty(node.name)) {
            return this.types[node.name];
        }

        this.types[node.name] = this.getTypeDescription(node.type, node);
        console.log(node.name, '=',this.types[node.name]);
        return this.types[node.name];

        // TODO recursively assemble sub type construct like the one returned by resolveTypeFromName
        // this should handle builtins and functions for now

    },

    getTypeDescription: function(type, node, getReturn) {

        function getParams(params, value) {

            var paramList = [],
                paramIds = [];

            for(var i = 0, l = params.length; i < l; i++) {
                var param = this.getTypeDescription(params[i].type);
                paramList.push(param);
                paramIds.push(param.id);
            }

            value.id += '(' + paramIds.join(',') + ')';
            value.params = paramList;

        }

        function getSub(type, value) {

            if (type.sub) {

                var subTypes = [],
                    subTypeIds = [];

                for(var i = 0, l = type.sub.length; i < l; i++) {
                    var subType = this.getTypeDescription(type.sub[i]);
                    subTypes.push(subType);
                    subTypeIds.push(subType.id);
                }

                value.id += '[' + subTypeIds.join(',') + ']';
                value.sub = subTypes;

            } else {
                value.sub = null;
            }

        }

        // Function definitions
        if (node && node.id === 'FUNCTION') {

            var ret = this.getTypeDescription(type),
                value = {
                    id: ret.id, // this is a plain id for comparison
                    returnType: ret,
                    isFunction: true,
                    isConst: type.isConst || false,
                    isList: false
                };

            getParams.call(this, node.params, value);
            return value;

        }

        // Builtin types
        if (type.builtin) {

            var plain = builtinTypes.resolveFromType(type),
                value = {
                    id: plain.id,
                    isFunction: type.isFunction || false,
                    isConst: type.isConst || false,
                    isList: plain.id === 'list'
                };

            // TODO for param validation, ignore the const part when comparing
            // against the arguments
            value.id = (type.isConst ? 'const:' : '') + value.id;
            getSub.call(this, type, value);

            // Function types, this handles things like: list[int](string) e
            if (type.isFunction && !getReturn) {
                value.returnType = this.getTypeDescription(type, null, true);
                getParams.call(this, type.params, value);
            }

            return value;

        } else {
            console.log(type);
        }

    },

    resolveMember: function(struct, property) {

        console.log(struct, property.value);
        // checks stuff!

    }

});

module.exports = Scope;

// Imports these afterwards
FunctionScope = require('./FunctionScope');
ClassScope = require('./ClassScope');
ForScope = require('./ForScope');

