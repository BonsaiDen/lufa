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

var builtinTypes = require('./builtinTypes');

var constEx = /const~/g;

// Lists need to validate all sub types
// maps needs to validate all sub types
// hashes need to validate all keys to be compatible?
var binaryOperatorTable = {

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
    ]

};

// The first entry is the left side, the second one the resultant type of the expression
var unaryOperatorTable = {

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

// a to b
var implicitCastTable = [
    'int:float',
    'float:int'
];

function resolveImplicitCast(a, b) {
    a = a.replace(constEx, '');
    b = b.replace(constEx, '');
    return implicitCastTable.indexOf(a + ':' + b) !== -1;
}

// a to b
var explicitCastTable = [
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
];


function resolveCast(a, b) {
    a = a.replace(constEx, '');
    b = b.replace(constEx, '');
    return explicitCastTable.indexOf(a + ':' + b) !== -1;
}


function resolveBinary(op, a, b) {

    var types = binaryOperatorTable[op];

    // Ignore constants
    a = a.replace(constEx, '');
    b = b.replace(constEx, '');

    for(var i = 0, l = types.length; i < l; i++) {
        if (types[i][0] === a && types[i][1] === b) {
            return builtinTypes.resolveFromId(types[i][2]);
        }
    }

    // TODO throw here
    return null;

}

function resolveUnary(op, a) {

    var types = unaryOperatorTable[op];

    // Ignore constants
    a = a.replace(constEx, '');

    for(var i = 0, l = types.length; i < l; i++) {
        if (types[i][0] === a) {
            return builtinTypes.resolveFromId(types[i][1]);
        }
    }

    // TODO throw here
    return null;

}

module.exports = {
    resolveCast: resolveCast,
    resolveImplicitCast: resolveImplicitCast,
    resolveBinary: resolveBinary,
    resolveUnary: resolveUnary
};

