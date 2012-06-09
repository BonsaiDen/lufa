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
    TypeCache = require('./TypeCache');


// Static analyzer for lufa code ----------------------------------------------
// ----------------------------------------------------------------------------
var Resolver = Class(function(scope) {
    this.scope = scope;
    this.typeCache = new TypeCache();

}, {

    $ExpressionError: function() {

    },

    $NameError: function() {

    },

    warning: function(node, msg, data) {
        this.scope.warning(node, msg, data);
    },

    error: function(node, msg, data, silent) {

        this.scope.error(node, msg, data);
        if (!silent) {
            throw new Resolver.$ExpressionError();
        }

    },


    // Basic validation -------------------------------------------------------
    // ------------------------------------------------------------------------
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
            this.resolveExpression(scope.expressions[i]);
        }

    },

    validateReturns: function() {

        var scope = this.scope;
        for(var i = 0, l = scope.returns.length; i < l; i++) {
            this.resolveExpression(scope.returns[i]);
        }

    },

    resolveExpression: function(node) {

        try {

            var type = null;

            // Declarations are handled like assignments
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
            right = null,
            i, l;

        switch(node.id) {

            case 'LIST':

                // The list type is determined by the first item in the list
                // subsequent lists must be the same type or will raise errors
                // if a list is mixed, it will match all assignments
                for(i = 0, l = node.items.length; i < l; i++) {
                    var item = node.items[i];
                    if (value === null) {
                        value = this.resolveExpressionType(item);

                    } else {
                        if (!this.typeCache.compare(value, this.resolveExpressionType(item))) {
                            this.error(node, 'Item at index {index} in list does not have the expected type of "{type}"', {
                                index: i,
                                type: value.id

                            }, true);
                        }
                    }

                }

                break;

            // Left needs to be a list and index an integer
            // in case the list is constant
            // try to figure out the value from the declaration
            // and do a bounds check! :)
            //
            // List can also be a map, type of inner needs to match the first subtype
            // of the map. If the map is const, we do a field lookup for the name.
            case 'INDEX':
                break;

            // TODO move this and above into external functions
            // to reduce code bloat
            // Same as above, just more fancy
            case 'RANGE':
                break;

            case 'NAME':
                value = this.typeCache.getFromToken(this.scope.resolveName(node));
                break;

            // Is this ever the case? :O
            case 'IDENTIFIER':
                break;

            // Make sure the right side of the ret statement matches
            // the function type
            case 'RETURN':

                base = this.scope.returnScope.baseNode;
                left = this.typeCache.getIdentifier(base.type, base).returnType;

                // TODO resolveFromId does not return a fully compatible object yet
                // add baseClass to all types and unify data structure
                if (!node.right) {
                    right = this.typeCache.getIdentifierFromArgs('void');

                } else {
                    right = this.resolveExpressionType(node.right);
                }

                if (this.typeCache.compare(left, right)) {
                    value = left;
                }

                if (value === null) {
                    this.error(node, 'Invalid return of type "{rid}". Type does not match parent function type "{lid}"', {
                        rid: right.id,
                        lid: left.id
                    });
                }

                break;

            case 'VARIABLE':
            case 'PARAMETER':
                value = this.typeCache.getFromToken(node);
                break;

            // use the member base to get the baseClass of the current class body
            // then resolve the member on that baseClass
            case 'MEMBER':
                // resolve from this.base
                // check if this.base is class, otherwise error out due to @ outside of class
                break;

            // TODO base needs to have a baseClass and node.right needs to be
            // a name / identifier. Then we can resolve the member from the base.type.memberTable
            case 'DOT':
                base = this.resolveExpressionType(node.left);

                value = this.resolveMember(base, node.right);
                break;

            // Make sure the cast is allowed and not useless (e.g. (int)4)
            case 'CAST':

                if (node.type.isBuiltin) {

                    right = this.resolveExpressionType(node.right);
                    value = this.typeCache.getIdentifier(node.type);

                    if (this.typeCache.compare(right, value)) {
                        this.warning(node, 'Cast from "{rid}" to "{lid}" has no effect', {
                            rid: right.id,
                            lid: left.id
                        });

                    } else if (!this.resolveCast(right, value)) {
                        this.error(node, 'Cannot cast from "{rid}" to "{lid}"', {
                            rid: right.id,
                            lid: left.id
                        });
                    }

                } else {
                    throw new Error('Cast to non builtin types is not supported at the moment');
                }
                break;

            // Make sure the object is callable and give the returnType as
            // the result
            case 'CALL':

                left = this.resolveExpressionType(node.left);

                if (!left.isFunction) {
                    this.error(node, 'Cannot call non-function type "{lid}"', {
                        lid: left.id
                    });

                // Validate arguments
                } else {

                    // TODO overhaul this based on the changes to the type descriptors
                    // shouldn't be that hard!
                    var arg, param;
                    for(i = 0; i < Math.min(left.requiredParams, node.args.length); i++) {
                        this.validateParameter(node.left, i, left.params[i], node.args[i]);
                    }

                    if (left.requiredParams > node.args.length) {
                        this.error(node.left, 'Parameter count mismatch, call to function "{name}" requires at least {required} arguments, but only {given} are given', {
                            name: node.left.name,
                            required: left.requiredParams,
                            given: node.args.length

                        }, true);
                    }

                    // Optional
                    for(i = left.requiredParams; i < Math.min(left.params.length, node.args.length); i++) {
                        this.validateParameter(node.left, i, left.params[i], node.args[i]);
                    }

                    if (node.args.length > left.params.length) {
                        this.error(node.left, 'Parameter count mismatch, call to function "{name}" takes at maximum {max} arguments, but a total of {given} are given', {
                            name: node.left.name,
                            required: left.params.length,
                            given: node.args.length

                        }, true);
                    }

                }

                value = left.returnType;
                break;

            // Easy stuff :)
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
                        value = this.resolveBinary(node.id, left, right);
                    }

                    if (value === null) {
                        this.error(node, 'Incompatible types for {op} operator, result for operands "{lid}" = "{rid}" is undefined',{
                            op: node.id,
                            lid: left.id,
                            rid: right.id
                        });
                    }

                } else if (node.arity === 'unary') {

                    right = this.resolveExpressionType(node.right);
                    value = this.resolveUnary(node.id, right, node);
                    break;

                } else if (node.arity === 'literal') {
                    value = this.typeCache.getIdentifierFromArgs(node.id.toLowerCase());

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
                value = this.resolveBinary(node.value, left, right);
                if (value === null) {
                    this.error(node, 'Invalid types for {op} assignment, result for operands "{lid}" = "{rid}" is undefined', {
                        op: node.value,
                        lid: left.id,
                        rid: right.id

                    });
                }

            } else if (this.typeCache.compare(left, right)) {
                value = left;
            }

            if (left.isConst && node.left.id !== 'PARAMETER') {
                this.error(node.left, 'Cannot assign to constant "{name}"', {
                    name: node.left.name || node.left.value

                }, true);
            }

            // Allow implicit conversion, but raise a warning
            if (this.resolveImplicitCast(right, left)) {
                this.error(node.left, 'Implicit cast from "{rid}" to "{lid}"', {
                    lid: left.id,
                    rid: right.id

                }, true);
                value = left;
            }

        }

        if (value === null) {
            this.error(node.left, 'Invalid assignment, incompatible types "{lid}" = "{rid}"', {
                lid: left.id,
                rid: right.id
            });
        }

        return value;

    },

    validateParameter: function(node, i, param, arg) {

        //param = builtinTypes.resolveFromType(param.type);
        arg = this.resolveExpressionType(arg);

        if (!this.typeCache.compare(arg, param)) {
            this.error(node, 'Argument #{index} for call of function "name" has invalid type. "{param}" is required, but "{arg}" was supplied', {
                index: i + 1,
                name: node.name,
                param: param.id,
                arg: arg.id

            }, true);
        }

    },


    // Resolving of operators and casts ---------------------------------------
    resolveUnary: function(op, right, node) {

        var value = null;
        if (right) {

            var types = Resolver.$unaryOperatorTable[op],
                id = TypeCache.$cleanId(right.id);

            for(var i = 0, l = types.length; i < l; i++) {
                if (types[i][0] === id) {

                    // Found a compatible type, now see whether we're trying to modify a const
                    var def = types[i];
                    if (right.isConst && def[2] === true) {
                        this.error(node, 'Invalid unary {op} operator, operand "{rid}" is constant', {
                            op: node.id,
                            rid: right.id

                        }, true);
                    }

                    value = this.typeCache.getIdentifierFromArgs(def[1]);
                    break;

                }
            }

        }

        if (value === null) {
            this.error(node, 'Incompatible types for unary {op} operator at {first.pos}, result for operand "{right}" is undefined', {
                op: node.id,
                rid: right.id
            });
        }

        return value;

    },

    resolveBinary: function(op, left, right) {

        var types = Resolver.$binaryOperatorTable[op],
            lid = TypeCache.$cleanId(left.id),
            rid = TypeCache.$cleanId(right.id);

        for(var i = 0, l = types.length; i < l; i++) {
            if (types[i][0] === lid && types[i][1] === rid) {
                return this.typeCache.getIdentifierFromArgs(types[i][2]);
            }
        }

        // TODO throw here
        return null;

    },

    resolveCast: function(right, left) {
        return Resolver.$explicitCastTable.indexOf(TypeCache.$cleanId(right.id) + ':' + TypeCache.$cleanId(left.id)) !== -1;
    },

    resolveImplicitCast: function(right, left) {
        return Resolver.$implicitCastTable.indexOf(TypeCache.$cleanId(right.id) + ':' + TypeCache.$cleanId(left.id)) !== -1;
    },


    // Operator compatibility tables ------------------------------------------
    // ------------------------------------------------------------------------
    $binaryOperatorTable: {

        'EQ': [
            ['int', 'int', 'bool'],
            ['float', 'float', 'bool'],
            ['string', 'string', 'bool']
        ],

        'NE': [
            ['int', 'int', 'bool'],
            ['float', 'float', 'bool'],
            ['string', 'string', 'bool']
        ],

        'LTE': [
            ['int', 'int', 'bool'],
            ['int', 'float', 'bool'],
            ['float', 'int', 'bool'],
            ['float', 'float', 'bool'],
            ['string', 'string', 'bool']
        ],

        'LT': [
            ['int', 'int', 'bool'],
            ['int', 'float', 'bool'],
            ['float', 'int', 'bool'],
            ['float', 'float', 'bool'],
            ['string', 'string', 'bool']
        ],

        'GTE': [
            ['int', 'int', 'bool'],
            ['int', 'float', 'bool'],
            ['float', 'int', 'bool'],
            ['float', 'float', 'bool'],
            ['string', 'string', 'bool']
        ],

        'GT': [
            ['int', 'int', 'bool'],
            ['int', 'float', 'bool'],
            ['float', 'int', 'bool'],
            ['float', 'float', 'bool'],
            ['string', 'string', 'bool']
        ],

        'PLUS': [
            ['int', 'int', 'int'],
            ['int', 'float', 'float'],
            ['float', 'int', 'float'],
            ['float', 'float', 'float'],
            ['string', 'string', 'string']
        ],

        'MINUS': [
            ['int', 'int', 'int'],
            ['int', 'float', 'float'],
            ['float', 'int', 'float'],
            ['float', 'float', 'float']
        ],

        'EXP': [
            ['int', 'int', 'int'],
            ['int', 'float', 'float'],
            ['float', 'int', 'float'],
            ['float', 'float', 'float']
        ],

        'MUL': [
            ['int', 'int', 'int'],
            ['int', 'float', 'float'],
            ['float', 'int', 'float'],
            ['float', 'float', 'float'],
            ['string', 'int', 'string']
        ],

        'DIV_INT': [
            ['int', 'int', 'int'],
            ['int', 'float', 'int'],
            ['float', 'int', 'int'],
            ['float', 'float', 'int']
        ],

        'DIV': [
            ['int', 'int', 'int'],
            ['int', 'float', 'float'],
            ['float', 'int', 'float'],
            ['float', 'float', 'float']
        ],

        'MOD': [
            ['int', 'int', 'int']
        ],

        'BIT_AND': [
            ['int', 'int', 'int']
        ],

        'BIT_OR': [
            ['int', 'int', 'int']
        ],

        'BIT_XOR': [
            ['int', 'int', 'int']
        ],

        'AND': [
            ['bool', 'bool', 'bool']
        ],

        'OR': [
            ['bool', 'bool', 'bool']
        ],

        'ELLIPSIS': [
            ['int', 'int']
        ]

    },

    // The first entry is the left side, the second one the resultant type of the expression
    $unaryOperatorTable: {

        'BIT_NOT': [
            ['int', 'int']
        ],

        'NOT': [
            ['bool', 'bool']
        ],

        'PLUS': [
            ['int', 'int'],
            ['float', 'float']
        ],

        'MINUS': [
            ['int', 'int'],
            ['float', 'float']
        ],

        'DECREMENT': [
            ['int', 'int', true],
            ['float', 'float', true]
        ],

        'INCREMENT': [
            ['int', 'int', true],
            ['float', 'float', true]
        ],

        // Left is the expression to be cast, right the cast (type)
        'CAST': [
            ['int', 'string'],
            ['int', 'float'],
            ['float', 'string'],
            ['float', 'int'],
            ['string', 'int'],
            ['string', 'float']
        ]

    },

    // a to b
    $implicitCastTable: [
        'int:float',
        'float:int'
    ],

    // a to b
    $explicitCastTable: [
        'bool:int',
        'bool:string',
        'int:bool',
        'int:float',
        'int:string',
        'float:int',
        'float:string',
        'string:int',
        'string:float',
        'string:bool'
    ]

});


module.exports = Resolver;

