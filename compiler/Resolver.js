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
    builtinTypes = require('./builtinTypes');



var Resolver = Class(function(scope) {
    this.scope = scope;
    this.types = {};

}, {

    $ExpressionError: function() {

    },

    $NameError: function() {

    },

    validateDefaults: function() {

        var scope = this.scope;
        for(var i = 0, l = scope.defaults.length; i < l; i++) {

            var def = scope.defaults[i];
            if (def.right) {
                this.resolveExpression(def);
            }

        }

    },

    validateExpressions: function() {

        var scope = this.scope;
        for(var i = 0, l = scope.expressions.length; i < l; i++) {
            var exp = scope.expressions[i],
                rType = this.resolveExpression(exp);

            //console.log('expression======', exp, rType);

        }

    },

    validateReturns: function() {

        var scope = this.scope;
        for(var i = 0, l = scope.returns.length; i < l; i++) {

            console.log('return');

            var exp = scope.returns[i];
            if (exp.right) {
                var rType = this.resolveExpression(exp.right);

            // TODO add default returns at a later point?
            } else {
                rType = 'void'; // TODO get void type from builtins
            }

            // TODO validate against function type

        }

    },

    // Right must be a object returned by the expression resolver
    // Left must be a type object from a token
    compareTypes: function(left, right) {

        if (!right) {
            return false;
        }

        if (left.isFunction || right.isFunction) {
            return left.id === right.id;

        } else {
            var constEx = /const~/g;
            return left.id.replace(constEx, '') === right.id.replace(constEx, '');
        }

    },

    resolveExpression: function(node) {

        try {

            // Declarations are handled like assignments
            var type = null;
            if (node.arity === 'declaration') {
                type = this.validateAssignment({
                    left: node,
                    right: node.right
                });

            } else {
                type = this.resolveExpressionType(node);
            }

            return {
                type: type
            };

        } catch(err) {

            if (!(err instanceof Resolver.$ExpressionError) && !(err instanceof Resolver.$NameError)) {
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
                            this.scope.error(node, null, 'Item #' + (i + 1) + ' in list does not have the expected type of "' + value.id + '".');
                        }
                    }

                }

                break;

            case 'NAME':
                value = this.scope.resolveName(node);
                break;

            case 'IDENTIFIER':
                break;

            case 'VARIABLE':
            case 'PARAMETER':
                value = this.typeFromNode(node);
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

                if (node.type.isBuiltin) {

                    right = this.resolveExpressionType(node.right);
                    value = this.getTypeDescription(node.type);

                    console.log(node);
                    if (this.compareTypes(right, value)) {
                        this.scope.warning(node, null, 'Usesless cast from "' + right.id + '" to "' + value.id + '" at {first.pos}.');

                    } else if (!operators.resolveCast(right.id, value.id)) {
                        this.scope.error(node, null, 'Cannot cast from "' + right.id + '" to "' + value.id + '" at {first.pos}.');
                        throw new Resolver.$ExpressionError();
                    }

                } else {
                    throw new Error('Cast to non builtin types is not supported at the moment');
                }
                break;

            case 'CALL':

                left = this.resolveExpressionType(node.left);
                if (left) {

                    if (!left.isFunction) {
                        this.scope.error(node, null, 'Cannot call non-function type "' + left.id + '" at {first.pos}.');
                        throw new Resolver.$ExpressionError();

                    // Validate arguments
                    } else {

                        // Required
                        var i, arg, param;
                        for(i = 0; i < Math.min(left.requiredParams, node.args.length); i++) {
                            this.validateParameter(node.left, i, left.params[i], node.args[i]);
                        }

                        if (left.requiredParams > node.args.length) {
                            this.scope.error(node.left, null, 'Parameter count mismatch, call to function "{first.name}" ({first.pos}) requires ' + left.requiredParams + ' arguments, but only ' + node.args.length + ' were supplied.');
                        }

                        // Optional
                        for(i = left.requiredParams; i < Math.min(left.params.length, node.args.length); i++) {
                            this.validateParameter(node.left, i, left.params[i], node.args[i]);
                        }

                        if (node.args.length > left.params.length) {
                            this.scope.error(node.left, null, 'Parameter count mismatch, call to function "{first.name}" ({first.pos}) takes at maximum ' + left.params.length + ' arguments, but ' + node.args.length + ' were supplied.');
                        }

                        return left.type;
                    }

                }

                if (value === null) {
                    this.scope.error(node.left, null, 'Cannot call non-function type at {first.pos}.');
                    throw new Resolver.$ExpressionError();
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
                        this.scope.error(node, null, 'Incompatible types for {first.id} operator at {first.pos}, result for operands "' + left.id + ':' + right.id + '" is undefined.');
                        throw new Resolver.$ExpressionError();
                    }

                } else if (node.arity === 'unary') {

                    right = this.resolveExpressionType(node.right);
                    if (right) {
                        value = operators.resolveUnary(node.id, right.id);
                    }

                    if (value === null) {
                        this.scope.error(node, null, 'Incompatible types for unary {first.id} operator at {first.pos}, result for operand "' + right.id + '" is undefined.');
                        throw new Resolver.$ExpressionError();
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
                    this.scope.error(node, null, 'Invalid types for {first.value} assignment at {first.pos}, result for operands "' + left.id + ':' + right.id + '" is undefined.');
                    throw new Resolver.$ExpressionError();
                }

            } else if (this.compareTypes(left, right)) {
                value = left;
            }

            if (left.isConst && node.left.id !== 'PARAMETER') {
                this.scope.error(node.left, null, 'Cannot assign to constant "{first.name}" at {first.pos}.');
            }

            // Allow implicit conversion, but raise a warning
            if (operators.resolveImplicitCast(right.id, left.id)) {
                this.scope.error(node.left, null, 'Implicit cast of "' + right.id + '" to "' + left.id + '" at {first.pos}.');
                value = left;
            }

        }

        if (value === null) {
            this.scope.error(node.left, null, 'Invalid assignment at {first.pos}, types do not match: ' + right.id + ' != ' + left.id + '.');
            throw new Resolver.$ExpressionError();
        }

        return value;

    },

    validateParameter: function(node, i, param, arg) {

        param = builtinTypes.resolveFromType(param.type);
        arg = this.resolveExpressionType(arg);

        if (!this.compareTypes(arg, param)) {
            this.scope.error(node, null, 'Argument #' + (i + 1) + ' for call of function "{first.name}" has invalid type. "' + param.id + '" is required, but "' + arg.id + '" was supplied.');
        }

    },

    typeFromNode: function(node) {

        if (this.types.hasOwnProperty(node.name)) {
            return this.types[node.name];
        }

        this.types[node.name] = this.getTypeDescription(node.type, node);
        //console.log(node.name, '=',this.types[node.name].id);
        return this.types[node.name];

    },

    getTypeDescription: function(type, node, parent, getReturn) {

        // Parses parameters for functions
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

        // Parses sub type for lists, hashes and maps
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

        var value = null;

        // Function definitions
        if (node && node.id === 'FUNCTION') {

            var ret = this.getTypeDescription(type);
            value = {
                id: ret.id, // this is a plain id for comparison
                returnType: ret,
                isFunction: true,
                isConst: type.isConst || false,
                isList: false
            };

            value.id += '<function';
            getParams.call(this, node.params, value);

        // Builtin types
        } else if (type.isBuiltin && !type.hasOwnProperty('returns')) {

            var plain = builtinTypes.resolveFromType(type);

            value = {
                id: plain.id,
                isFunction: type.isFunction || false,
                isConst: type.isConst || false,
                isList: plain.id === 'list'
            };

            // TODO for param validation, ignore the const part when comparing
            // against the arguments
            value.id = (type.isConst ? 'const~' : '') + value.id;
            getSub.call(this, type, value);

            // Handles the final return type of a simple function
            if (type.isFunction && !getReturn) {
                value.returnType = this.getTypeDescription(type, null, null, true);
                getParams.call(this, type.params, value);
            }

        // Function return types
        } else if (type.isFunction && type.returns != null) {

            value = {
                id: 'function', // this is a plain id for comparison
                returnType: null,
                isFunction: true,
                isConst: type.isConst || false,
                isList: false
            };

            value.returnType = this.getTypeDescription(type.returns, null, value);
            getParams.call(this, type.params, value);

        } else {
            console.log('UNKNOWN', type);
            this.scope.error(node, null, 'Unkown type "' + type.value + '".');
            throw new Resolver.$TypeError();
        }

        if (parent) {
            parent.id = value.id + '<' + parent.id;
        }

        return value;

    },

    resolveMember: function(struct, property) {

        console.log(struct, property.value);
        // checks stuff!

    }

});

module.exports = Resolver;

