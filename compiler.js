// Lists need to validate all sub types
// maps needs to validate all sub types
// hashes need to validate all keys to be compatible?
var binaryOperatorTable = {

    'EQ': [
        ['int', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'NE': [
        ['int', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'LTE': [
        ['int', 'int', 'boolean'],
        ['int', 'float', 'boolean'],
        ['float', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'LT': [
        ['int', 'int', 'boolean'],
        ['int', 'float', 'boolean'],
        ['float', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'GTE': [
        ['int', 'int', 'boolean'],
        ['int', 'float', 'boolean'],
        ['float', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'GT': [
        ['int', 'int', 'boolean'],
        ['int', 'float', 'boolean'],
        ['float', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
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
        ['boolean', 'boolean', 'boolean']
    ]

};

// The first entry is the left side, the second one the resultant type of the expression
var unaryOperatorTable = {

    'BIT_NOT': [
        ['int', 'int']
    ],

    'NOT': [
        ['boolean', 'boolean']
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
        ['int', 'int'],
        ['float', 'float']
    ],

    'INCREMENT': [
        ['int', 'int'],
        ['float', 'float']
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

};

function Scope(parent) {
    this.parent = parent;
    this.members = {};
}

Scope.prototype = {

    resolveName: function(name) {
        if (this.members.hasOwnProperty(name)) {
            return this.members[name];
        }
    },

    body: function() {
        // go through all statements
        // and expressions
        // check assignments and calls
    }

};

// Type class, needed, otherwise this will become a giant mess.
function Type() {


}

// This compares types
function compareType(a, b) {

    // Simple case
    if (typeof a === 'string' && typeof b === 'string') {

    // Function types and sub types
    } else if (typeof a === 'object' && typeof b === 'object') {

    } else {
        return 'Error: Incompatible types';
    }

}

function resolveBinary(op, a, b) {

    var types = binaryOperatorTable[op];
    for(var i = 0, l = types.length; i < l; i++) {
        if (types[0] === a && types[1] === b) {
            return types[2];
        }
    }

    // throw here
    return null;

}

function resolveUnary(op, a) {

    var types = unaryOperatorTable[op];
    for(var i = 0, l = types.length; i < l; i++) {
        if (types[0] === a) {
            return types[1];
        }
    }

    // throw here
    return null;


}

function resolveType(exp) {

    var leftType, rightType, result, indexType, startType, endType, stepType;

    // Plain literals
    if (exp.arity === 'literal') {
        return exp.id;

    // Names
    } else if (exp.arity === 'name') {

        // this might return an object, since function types are more complex...
        return scope.resolveName(exp.value).type;

    // Operators
    } else if (exp.arity === 'binary') {

        leftType = resolveType(exp.left);
        rightType = resolveType(exp.right);

        var op = exp.id;
        if (exp.id === 'ASSIGN') {
            op = exp.value;
        }

        // Ok, time to figure out the sub type of left
        if (exp.id === 'INDEX') {

            // then we see whether the expression of inner, can be used to index LEFT
            // in case of a string this is easy (integers)
            // for maps we check the type
            // for lists this is also relatively easy (guess what: integers again)
            indexType = resolveType(exp.inner);

        // TODO all of these need to be integers
        } else if (exp.id === 'RANGE') {

            // TODO check for sliceability of left


            // TODO also NOTE: inner may have up to 3 entries
            // so in case of map reverse lookups we want to check against those

            // Check first inner, the start of a range OR the index
            // also, che
            if (exp.inner[0]) {
                startType = resolveType(exp.inner[0]);
            }

            if (exp.inner[1]) {
                stepType = resolveType(exp.inner[1]);
            }

            // The third inner is the step, this also needs support
            if (exp.inner[2]) {
                endType = resolveType(exp.inner[2]);
            }

        }

        // Look up table to figure out if this will work
        result = resolveBinary(op, leftType, rightType);

        return result;

    // Unaries
    } else if (exp.arity === 'unary') {
        leftType = resolveType(exp.left);

        result = resolveBinary(exp.id, leftType);

        return result;
    }

}




/*
build scopes
    build names
    build hashes and classes

    verify assignments
        verify expressions
            verify ops
                verify types / names / returns

    verify variables

    verfiy expressions

    verify calls
        verify functions / overload / modifiers / params (defaults)


check expression

    each token:

        if inner:
            recurse check each inner expression

        if operator:
            check types

        if expression:
            resolve type

            check expression

        else:
            check token inner

    check operator


        check token
            resolve type
            custom check


1 + 2

plus:
    left type = int
    right type = int
*/
