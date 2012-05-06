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
        parser.error(this, 'Invalid expression, most likely a statement token:');
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

function addPrefix(id, nud, precedence) {

    var s = addSymbol(id);
    s.nud = nud || function(parser) {
        //scope.reserve(this); # TODO re-enable
        this.left = parser.getExpression(18);
        this.arity = 'unary';
        return this;
    };

    return s;

}

function addAssignment(id) {

    return addInfixRight(id, 2, function(parser, left) {

        if (left.not('DOT', 'INDEX', 'RANGE', 'MEMBER') && left.arity !== 'name') {
            parser.error(left, 'Bad left hand value for assignment,');
        }

        this.left = left;
        this.right = parser.getExpression(1);
        this.isAssignment = true;
        this.arity = 'binary';

        return this;

    });

}

function addStatement(s, f, c) {
    var x = addSymbol(s);
    x.std = f;
    x.check = c;
    return x;
}

function addLiteral(s) {

    var x = addSymbol(s);
    x.arity = 'literal';
    x.nud = function() {
        return this;
    };

    return x;

}

module.exports = {
    symbols: symbolTable,
    addSymbol: addSymbol,
    addLiteral: addLiteral,
    addInfix: addInfix,
    addInfixRight: addInfixRight,
    addPrefix: addPrefix,
    addAssignment: addAssignment,
    addStatement: addStatement
};

