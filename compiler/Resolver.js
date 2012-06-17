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

        var right = this.resolveExpression(node),
            bool = TypeCache.getIdentifierFromArgs('bool');

        // In case of an invalid expression break out
        if (!right) {
            return;
        }

        right = right.type;

        if (!TypeCache.compare(right, bool)) {

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

                indexA = this.scope.resolveTypeFromName(indexes[0]);
                if (!TypeCache.compare(right.sub[0], indexA)) {
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
                indexA = this.scope.resolveTypeFromName(indexes[0]);
                indexB = this.scope.resolveTypeFromName(indexes[1]);

                if (!TypeCache.compare(right.sub[0], indexA)) {
                    this.error(indexes[0], 'Incompatible type for iteration key on map "{lid}" != "{rid}"', {
                        rid: right.sub[0].id,
                        lid: indexA.id
                    });
                }

                if (!TypeCache.compare(right.sub[1], indexB)) {
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
                type = this.resolveAssignment({
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

    resolveIndexExpression: function(left, inner, msg) {

        var type = this.resolveExpressionType(inner),
            i = TypeCache.getIdentifierFromArgs('int');

        if (!TypeCache.compare(type, i)) {
            this.error(inner, msg || 'Invalid list index, expected "{lid}" but got "{rid}"', {
                lid: i.id,
                rid: type.id
            });
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
                value = this.resolveListType(node);
                break;

            case 'HASH':
            case 'MAP':
                value = this.resolveMapType(node);
                break;

            case 'INDEX':

                left = this.resolveExpressionType(node.left);

                // Inner must be an integer in case of a list
                if (left.isList) {
                    this.resolveIndexExpression(left, node.inner);
                    value = left.sub[0];

                // Map, inner must be key type of map
                } else if (left.isMap) {

                    right = this.resolveExpressionType(node.inner);

                    i = left.sub[0];
                    if (!TypeCache.compare(right, i)) {
                        this.error(node.inner, 'Invalid map index, expected "{lid}" but got "{rid}"', {
                            lid: i.id,
                            rid: right.id
                        });
                    }

                    value = left.sub[1];

                // Invalid left side operand
                } else {
                    this.error(node.left, 'Invalid left-hand operand for indexing', {});
                }

                break;

            // Ranges on lists, and reverse indexing on maps
            // [1, 2, 3, 4][0:2:-1] # from, to, step
            // { 1: 'foo', 2: 'bla}[:'bla'] # reverse
            case 'RANGE':

                left = this.resolveExpressionType(node.left);

                // Inner must be an integer in case of a list
                if (left.isList) {

                    // TODO Do more validation?
                    if (node.inner[0] !== null) {
                        this.resolveIndexExpression(left, node.inner[0], 'Invalid range start, expected "{lid}" but got "{rid}"');
                    }

                    if (node.inner[1] !== null) {
                        this.resolveIndexExpression(left, node.inner[1], 'Invalid range end, expected "{lid}" but got "{rid}"');
                    }

                    if (node.inner[2] !== null) {
                        this.resolveIndexExpression(left, node.inner[2], 'Invalid range step, expected "{lid}" but got "{rid}"');
                    }

                    value = left;

                // Map, inner must be key type of map
                } else if (left.isMap) {

                    // Make sure only the second inner is set
                    if (!!node.inner[0] || !node.inner[1] || !!node.inner[2]) {
                        this.error(node.left, 'Invalid reverse map index', {});
                    }

                    right = this.resolveExpressionType(node.inner[1]);

                    i = left.sub[1];
                    if (!TypeCache.compare(right, i)) {
                        this.error(node.inner, 'Invalid reverser map index, expected "{lid}" but got "{rid}"', {
                            lid: i.id,
                            rid: right.id
                        });
                    }

                    value = left.sub[0];

                // Invalid left side operand
                } else {
                    this.error(node.left, 'Invalid left-hand operand for range', {});
                }

                // Left must be a list
                // returns sub type of left
                break;

            case 'NAME':
                this.expressionHasSideEffect = true;
                value = this.scope.resolveTypeFromName(node);
                break;

            // Is this ever the case? :O
            case 'IDENTIFIER':
                break;

            // Boolean IN operator
            case 'IN':

                left = this.resolveExpressionType(node.left);
                right = this.resolveExpressionType(node.right);

                // Check item type
                if (right.isList) {

                    if (!TypeCache.compare(left, right.sub[0])) {
                        this.error(node.left, 'Invalid left-hand operand for IN operator, "{lid}" != "{rid}"', {
                            lid: left.id,
                            rid: right.sub[0].id
                        });
                    }

                // Check key type
                } else if (right.isMap) {
                    if (!TypeCache.compare(left, right.sub[0])) {
                        this.error(node.left, 'Invalid left-hand operand for IN operator, "{lid}" != "{rid}"', {
                            lid: left.id,
                            rid: right.sub[0].id
                        });
                    }

                // TODO Hashes?
                } else {
                    this.error(node.right, 'Invalid right-hand operand for IN operator', {});
                }

                value = TypeCache.getIdentifierFromArgs('bool');
                break;

            // Boolean HAS operator, reverse of IN
            case 'HAS':
                break;

            // List and Map Comprehensions
            case 'COMPREHENSION':
                value = this.resolveComprehensionType(node);
                break;

            // Make sure the right side of the ret statement matches
            // the function type
            case 'RETURN':

                base = this.scope.returnScope.baseNode;
                left = TypeCache.getIdentifier(base.type, base).returnType;

                // TODO resolveFromId does not return a fully compatible object yet
                // add baseClass to all types and unify data structure
                if (!node.right) {
                    right = TypeCache.getIdentifierFromArgs('void');

                } else {
                    right = this.resolveExpressionType(node.right);
                }

                if (TypeCache.compare(left, right)) {
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
                value = this.scope.resolveTypeFromName(node);
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
                left = TypeCache.resolveMember(base, node.right.value);

                if (!left) {
                    this.error(node, 'Type "{rid}" has no member "{property}"', {
                        rid: base.id,
                        property: node.right.value
                    });

                } else {
                    value = left;
                }

                break;

            // Make sure the cast is allowed and not useless (e.g. (int)4)
            case 'CAST':

                if (node.type.isBuiltin) {

                    right = this.resolveExpressionType(node.right);
                    value = TypeCache.getIdentifier(node.type);

                    if (TypeCache.compare(right, value)) {
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
                value = this.resolveFunctionCall(node);
                break;

            // Easy stuff :)
            case 'ASSIGN':
                value = this.resolveAssignment(node);
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
                    value = TypeCache.getIdentifierFromArgs(node.id.toLowerCase());

                } else {
                    throw new Error('Unhandled expression type: ' + node.id + ':' + node.arity);
                }

                break;

        }

        return value;

    },

    resolveAssignment: function(node) {

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
            } else if (TypeCache.compare(left, right)) {
                value = left;

            // Special case for empty lists
            } else if (left.isList && right.id === 'list') {
                value = left;

            // Special case for empty maps
            } else if (left.isMap && right.id === 'map') {
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

    resolveFunctionCall: function(node) {

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

        if (!TypeCache.compare(arg, param)) {
            this.error(call.args[i], 'Argument type mismatch "{arg}" != "{param}"', {
                index: i + 1,
                name: node.name,
                param: param.id,
                arg: arg.id

            }, true);
        }

    },

    resolveListType: function(node) {

        // The list type is determined by the first item in the list
        // subsequent lists must be the same type or will raise errors
        // if a list is mixed, it will match all assignments
        var value = null;
        for(var i = 0, l = node.items.length; i < l; i++) {

            var item = node.items[i];
            if (value === null) {
                value = this.resolveExpressionType(item);

            } else {
                if (!TypeCache.compare(value, this.resolveExpressionType(item))) {
                    this.error(item, 'Item at index {index} in list does not have the expected type of "{type}"', {
                        index: i,
                        type: value.id

                    }, true);
                }
            }

        }

        return TypeCache.getListIdentifier(value);

    },

    resolveMapType: function(node) {

        var key, value = null;

        // Empty map
        if (!node.keys) {
            return TypeCache.getMapIdentifier();
        }

        for(var i = 0, l = node.keys.length; i < l; i++) {

            var item = node.keys[i];
            if (value === null) {
                key = this.resolveExpressionType(item);
                value = this.resolveExpressionType(item.keyValue);

            } else {

                if (!TypeCache.compare(key, this.resolveExpressionType(item))) {
                    this.error(item, 'Key at index {index} in map does not have the expected type of "{type}"', {
                        index: i,
                        type: key.id

                    }, true);
                }

                if (!TypeCache.compare(value, this.resolveExpressionType(item.keyValue))) {
                    this.error(item.keyValue, 'Value at index {index} in map does not have the expected type of "{type}"', {
                        index: i,
                        type: value.id

                    }, true);
                }

            }

        }

        return TypeCache.getMapIdentifier(key, value);

    },

    resolveComprehensionType: function(node) {

        // Create a sub scope of the parent on the fly
        var scope = this.scope.addComprehensionScope(node);
        scope.compile();
        scope.validate();

        // Index numbers are not balanced
        if (node.elseIndexes.length !== 0 && node.returnIndexes.length !== node.elseIndexes.length) {
            this.error(node, 'Unbalanced number of return indexes in comprehension ', {});
        }

        function resolveListIndex(index) {

            var v = scope.resolver.resolveExpression(index);
            if (v) {
                return TypeCache.getListIdentifier(v.type);

            } else {
                this.error(index, 'Invalid return for list comprehension', {});
            }

        }

        function resolveMapIndex(indexA, indexB) {

            var k = scope.resolver.resolveExpression(indexA),
                v = scope.resolver.resolveExpression(indexB);

            if (k && v) {
                return TypeCache.getMapIdentifier(k.type, v.type);

            } else {
                this.error(indexA, 'Invalid return for list comprehension', {});
            }

        }

        // Type
        var left, right, value = null;
        if (node.returnIndexes.length === 1) {

            left = resolveListIndex.call(this, node.returnIndexes[0]);

            // Validate condition if present
            if (node.ifCondition) {
                scope.resolver.validateSingleCondition(node.ifCondition);
                right = resolveListIndex.call(this, node.elseIndexes[0]);
            }

            // Make sure
            if (left && right && !TypeCache.compare(left, right)) {
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
            if (left && right && !TypeCache.compare(left, right)) {
                this.error(node, 'Return indexes are not of the same type "{lid[0].id},{lid[1].id}" != "{rid[0].id},{rid[1].id}"', {
                    rid: right.sub,
                    lid: left.sub
                });
            }

            value = left;

        } else {
            this.error(node, 'Invalid number of return indexes for list comprehension', {});
        }

        return value;

    },

    // Resolving of operators and casts ---------------------------------------
    resolveUnary: function(op, right, node) {

        var value = null;
        if (right) {

            var types = Resolver.$unaryOperatorTable[op],
                id = TypeCache.cleanId(right.id);

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

                    value = TypeCache.getIdentifierFromArgs(def[1]);
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
            lid = TypeCache.cleanId(left.id),
            rid = TypeCache.cleanId(right.id);

        for(var i = 0, l = types.length; i < l; i++) {

            var type = types[i];
            if (type[0] === lid && type[1] === rid) {

                // TODO move to TypeCache and abstract in a better way
                if (typeof type[2] === 'string') {
                    return TypeCache.getIdentifierFromArgs(type[2]);

                } else {
                    return type[2];
                }

            }
        }

        // TODO throw here
        return null;

    },

    resolveCast: function(right, left) {

        var table = Resolver.$explicitCastTable,
            rid = TypeCache.cleanId(right.id),
            lid = TypeCache.cleanId(left.id);

        for(var i = 0, l = table.length; i < l; i++) {

            var type = table[i][0],
                targets = table[i][1];

            // TODO for higher level casts make sure to change
            // this for support of real types in the cast table
            if (type === rid) {

                // Go through targets
                for(var e = 0, el = targets.length; e < el; e++) {
                    if (targets[e] === lid) {
                        return true;
                    }
                }

                return false;

            }

        }

        return false;

    },

    resolveImplicitCast: function(right, left) {

        var table = Resolver.$implicitCastTable,
            rid = TypeCache.cleanId(right.id),
            lid = TypeCache.cleanId(left.id);

        for(var i = 0, l = table.length; i < l; i++) {

            var type = table[i][0],
                targets = table[i][1];

            // TODO for higher level casts make sure to change
            // this for support of real types in the cast table
            if (type === rid) {

                // Go through targets
                for(var e = 0, el = targets.length; e < el; e++) {
                    if (targets[e] === lid) {
                        return true;
                    }
                }

                return false;

            }

        }

        return false;

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
            ['int', 'int', TypeCache.getListIdentifier('int')]
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
        ]

    },

    // a to b
    $implicitCastTable: [
        ['int', ['float', 'bool']],
        ['float', ['int', 'bool']],
        ['string', ['bool']]
    ],

    // a to b
    $explicitCastTable: [

        ['bool', ['int', 'string']],
        ['int', ['bool', 'float', 'string']],
        ['float', ['int', 'string']],
        ['string', ['int', 'float', 'bool']]
    ]

});


module.exports = Resolver;

