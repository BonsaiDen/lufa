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
    this.expressionHasSideEffect = false;

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

    validateConditions: function() {

        var scope = this.scope;
        for(var i = 0, l = scope.conditions.length; i < l; i++) {
            this.validateSingleCondition(scope.conditions[i]);
        }

    },

    validateSingleCondition: function(node) {

        var right = this.resolveExpression(node).type,
            bool = this.typeCache.getIdentifierFromArgs('bool');

        if (!this.typeCache.compare(right, bool)) {

            if (this.resolveImplicitCast(right, bool)) {
                this.warning(node, 'Implicit cast from "{rid}" to "{lid}" in condition', {
                    lid: bool.id,
                    rid: right.id

                });

            } else {
                this.error(node, 'Invalid condition, result of expression is "{rid}" and not "bool"', {
                    rid: right.id

                }, true);
            }

        }

    },

    validateForLoop: function(loop) {

        try {
            this.validateIterator(loop.indexes, loop.iterator);

        } catch(e) {
            if (e instanceof Resolver.$NameError) {
                console.log('name error');
            }
        }

    },

    validateIterator: function(indexes, iter) {

        var indexA, indexB, right;

        // Check the iterator
        try {
            right = this.resolveExpression(iter).type;

        } catch(e) {
            this.error(iter, 'Invalid iterator', {});
        }

        // Lists
        if (indexes.length === 1) {

            if (!right.isList) {
                this.error(iter, 'Invalid type for list iteration: "{type}"', {
                    type: right.id
                });

            } else {

                indexA = this.typeCache.getFromToken(this.scope.resolveName(indexes[0]));
                if (!this.typeCache.compare(right.sub[0], indexA)) {
                    this.error(indexes[0], 'Incompatible type for iteration index on list "{lid}" != "{rid}"', {
                        rid: right.sub[0].id,
                        lid: indexA.id
                    });
                }

            }

        // Maps
        } else if (indexes.length === 2) {

            if (!right.isMap) {
                this.error(iter, 'Invalid type for map iteration: "{type}"', {
                    type: right.id
                });

            } else {
                indexA = this.typeCache.getFromToken(this.scope.resolveName(indexes[0]));
                indexB = this.typeCache.getFromToken(this.scope.resolveName(indexes[1]));

                if (!this.typeCache.compare(right.sub[0], indexA)) {
                    this.error(indexes[0], 'Incompatible type for iteration key on map "{lid}" != "{rid}"', {
                        rid: right.sub[0].id,
                        lid: indexA.id
                    });
                }

                if (!this.typeCache.compare(right.sub[1], indexB)) {
                    this.error(indexes[1], 'Incompatible type for iteration value on map "{lid}" != "{rid}"', {
                        rid: right.sub[1].id,
                        lid: indexB.id
                    });
                }

            }

        // More than 3 indexes
        } else {
            this.error(iter, 'Too many indexes for iteration on "{type}"', {
                type: right.id
            });
        }

    },


    // Type resolving ---------------------------------------------------------
    // ------------------------------------------------------------------------
    resolveExpression: function(node) {

        this.expressionHasSideEffect = false;

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
                type: type,
                hasSideEffect: this.expressionHasSideEffect
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
            i, l,
            scope = null;

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
                            this.error(item, 'Item at index {index} in list does not have the expected type of "{type}"', {
                                index: i,
                                type: value.id

                            }, true);
                        }
                    }

                }

                // TODO what to do with empty lists?!
                value = this.typeCache.getListIdentifier(value);
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
                this.expressionHasSideEffect = true;
                value = this.typeCache.getFromToken(this.scope.resolveName(node));
                break;

            // Is this ever the case? :O
            case 'IDENTIFIER':
                break;

            case 'COMPREHENSION':

                // Create a sub scope of the parent on the fly
                scope = this.scope.addComprehensionScope(node);
                scope.compile();
                scope.validate();

                // Index numbers are not balanced
                if (node.elseIndexes.length !== 0 && node.returnIndexes.length !== node.elseIndexes.length) {
                    this.error(node, 'Unbalanced number of return indexes in comprehension ', {});
                }

                function resolveListIndex(index) {

                    var v = scope.resolver.resolveExpression(index);
                    if (v) {
                        return this.typeCache.getListIdentifier(v.type);

                    } else {
                        this.error(index, 'Invalid return for list comprehension', {});
                    }

                }

                function resolveMapIndex(indexA, indexB) {

                    var k = scope.resolver.resolveExpression(indexA),
                        v = scope.resolver.resolveExpression(indexB);

                    if (k && v) {
                        return this.typeCache.getMapIdentifier(k.type, v.type);

                    } else {
                        this.error(indexA, 'Invalid return for list comprehension', {});
                    }

                }

                // Type
                if (node.returnIndexes.length === 1) {

                    left = resolveListIndex.call(this, node.returnIndexes[0]);

                    // Validate condition if present
                    if (node.ifCondition) {
                        scope.resolver.validateSingleCondition(node.ifCondition);
                        right = resolveListIndex.call(this, node.elseIndexes[0]);
                    }

                    // Make sure
                    if (left && right && !this.typeCache.compare(left, right)) {
                        this.error(node, 'Return indexes are not of the same type "{lid}" != "{rid}"', {
                            rid: right.sub[0].id,
                            lid: left.sub[0].id
                        });
                    }

                    value = left;

                // Map
                } else if (node.returnIndexes.length === 2) {

                    left = resolveMapIndex.call(this, node.returnIndexes[0], node.returnIndexes[1]);

                    // Validate condition if present
                    if (node.ifCondition) {
                        scope.resolver.validateSingleCondition(node.ifCondition);
                        right = resolveMapIndex.call(this, node.elseIndexes[0], node.returnIndexes[1]);
                    }

                    // Make sure
                    if (left && right && !this.typeCache.compare(left, right)) {
                        this.error(node, 'Return indexes are not of the same type "{lid[0].id},{lid[1].id}" != "{rid[0].id},{rid[1].id}"', {
                            rid: right.sub,
                            lid: left.sub
                        });
                    }

                    value = left;

                } else {
                    this.error(node, 'Invalid number of return indexes for list comprehension', {});
                }
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
                // left should be class instance(plain types = classes too) or hash
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
                        this.error(node, 'Invalid cast from "{rid}" to "{lid}"', {
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
                value = this.validateFunctionCall(node);
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

        this.expressionHasSideEffect = true;

        var value = null,
            left = this.resolveExpressionType(node.left),
            right = this.resolveExpressionType(node.right);

        // Check assignment operator
        if (left && right) {

            // Assignment to self
            if (node.left.name === node.right.name) {
                this.warning(node.left, 'Self-assignment without effect', {
                });
            }

            if (node.value) {

                value = this.resolveBinary(node.value, left, right);
                if (value === null) {
                    this.error(node, 'Invalid types for {op} assignment, result for operands "{lid}" = "{rid}" is undefined', {
                        op: node.value,
                        lid: left.id,
                        rid: right.id
                    });
                }

            // Plain assignments
            } else if (this.typeCache.compare(left, right)) {
                value = left;

            // Special case for empty lists
            } else if (left.isList && right.id === 'list') {
                value = left;
            }

            if (left.isConst && node.left.id !== 'PARAMETER') {
                this.error(node.left, 'Assignment to constant "{name}"', {
                    name: node.left.name || node.left.value

                }, true);
            }

            // Allow implicit conversion, but raise a warning
            if (this.resolveImplicitCast(right, left)) {
                this.warning(node.left, 'Implicit cast from "{rid}" to "{lid}" in assignment', {
                    lid: left.id,
                    rid: right.id
                });
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

    validateFunctionCall: function(node) {

        this.expressionHasSideEffect = true;

        var left = this.resolveExpressionType(node.left);
        if (!left.isFunction) {
            this.error(node, 'Cannot call non-function type "{lid}"', {
                lid: left.id
            });

        } else {

            var arg, param,
                args = node.args,
                count = args.length,
                name = node.left.name || node.left.value;

            if (left.requiredParams > count) {
                this.error(node, 'Parameter count mismatch. Call to function "{name}" with {given} arguments, but requires at least {required}', {
                    name: name,
                    required: left.requiredParams,
                    given: count

                }, true);
            }

            if (count > left.params.length) {
                this.error(node.args[left.params.length], 'Parameter count mismatch. Call of function "{name}" with {given} arguments, but takes {max} at maximum', {
                    name: name,
                    max: left.params.length,
                    given: count

                }, true);
            }

            // TODO remove const stuff in error messages?
            for(var i = 0; i < Math.min(Math.max(left.requiredParams, count), left.params.length); i++) {
                this.validateParameter(node, node.left, i, left.params[i], args[i]);
            }

        }

        return left.returnType;

    },

    validateParameter: function(call, node, i, param, arg) {

        arg = this.resolveExpressionType(arg);

        if (!this.typeCache.compare(arg, param)) {
            this.error(call.args[i], 'Argument type mismatch "{arg}" != "{param}"', {
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

                    // Unary has side effect
                    if (def[2] === true) {

                        this.expressionHasSideEffect = true;

                        if (right.isConst) {
                            this.error(node, 'Modification of constant "{rid}" by unary {op} operator', {
                                op: node.id,
                                rid: right.id

                            }, true);
                        }

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

            var type = types[i];
            if (type[0] === lid && type[1] === rid) {

                // TODO move to TypeCache and abstract in a better way
                if (typeof type[2] === 'string') {
                    return this.typeCache.getIdentifierFromArgs(type[2]);

                } else {
                    return this.typeCache.getIdentifier(type[2]);
                }

            }
        }

        // TODO throw here
        return null;

    },

    resolveCast: function(right, left) {
        return Resolver.$explicitCastTable.indexOf(TypeCache.$cleanId(right.id) + ':' + TypeCache.$cleanId(left.id)) !== -1;
    },

    resolveImplicitCast: function(right, left) {
        var cast = TypeCache.$cleanId(right.id) + ':' + TypeCache.$cleanId(left.id);
        return Resolver.$implicitCastTable.indexOf(cast) !== -1;
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
            ['int', 'int', {
                value: 'list',
                isBuiltin: true,
                sub: [{
                    isBuiltin: true,
                    value: 'int'
                }]
            }]
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
        'int:bool',
        'float:int',
        'float:bool',
        'string:bool'
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

