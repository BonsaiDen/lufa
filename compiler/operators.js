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
    ],

    'OR': [
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

function resolveBinary(op, a, b) {

    var types = binaryOperatorTable[op];
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
    for(var i = 0, l = types.length; i < l; i++) {
        if (types[i][0] === a) {
            return builtinTypes.resolveFromId(types[i][1]);
        }
    }

    // TODO throw here
    return null;

}

module.exports = {
    resolveBinary: resolveBinary,
    resolveUnary: resolveUnary
};

