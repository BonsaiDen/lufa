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
var symbolTable = {};
var baseSymbol = {

    nud: function (parser) {
        parser.error(this, 'Invalid expression: ');
    },

    led: function (parser, left) {
        parser.error(this, 'Missing operator');
    },

    is: function() {

        for(var i = 0, l = arguments.length; i < l; i++) {
            if (this.id === arguments[i]) {
                return true;
            }
        }

        return false;

    },

    not: function() {
        return !this.is.apply(this, arguments);
    }

};

function addSymbol(id, bp) {

    var s = symbolTable[id];
    bp = bp || 0;
    if (s) {
        if (bp >= s.lbp) {
            s.lbp = bp;
        }

    } else {
        s = Object.create(baseSymbol);
        s.id = s.value = id;
        s.lbp = bp;
        symbolTable[id] = s;
    }

    return s;

}

function addInfix(id, bp, led) {

    var s = addSymbol(id, bp);
    s.led = led || function(parser, left) {
        this.left = left;
        this.right = parser.getExpression(bp);
        this.arity = 'binary';
        delete this.value;
        return this;
    };

    return s;

}

function addInfixRight(id, bp, led) {

    var s = addSymbol(id, bp);
    s.led = led || function(parser, left) {
        this.left = left;
        this.right = parser.getExpression(bp - 1);
        this.arity = 'binary';
        return this;
    };

    return s;

}

function addPrefix(id, nud) {

    var s = addSymbol(id);
    s.nud = nud || function(parser) {
        //scope.reserve(this); # TODO re-enable
        this.left = parser.getExpression(70);
        this.arity = 'unary';
        return this;
    };

    return s;

}

function addAssignment(id) {

    return addInfixRight(id, 10, function(parser, left) {

        if (left.id !== 'DOT' && left.id !== 'LEFT_BRACKET' && left.arity !== 'name') {
            left.error('Bad lvalue.');
        }

        this.left = left;
        this.right = parser.getExpression(9);
        this.isAssignment = true;
        this.arity = 'binary';

        return this;

    });

}

function addStatement(s, f) {
    var x = addSymbol(s);
    x.std = f;
    return x;
}

module.exports = {
    symbols: symbolTable,
    addSymbol: addSymbol,
    addInfix: addInfix,
    addInfixRight: addInfixRight,
    addPrefix: addPrefix,
    addAssignment: addAssignment,
    addStatement: addStatement
};

