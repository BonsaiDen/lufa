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
var symbolTable = require('./symbolTable');

// Lists and list comprehensions ----------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addPrefix('LEFT_BRACKET', function(parser) {

    var elements = [];
    if (parser.tokenNot('RIGHT_BRACKET')) {

        while (true) {

            elements.push(parser.getExpression(0));
            if (parser.tokenNot('COMMA')) {
                break;
            }

            parser.advance('COMMA');

        }

    }

    parser.advance('RIGHT_BRACKET');

    this.inner = elements;
    this.arity = 'unary';
    this.id = 'LIST';

    return this;

});


// Access and slicing ---------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addInfix('LEFT_BRACKET', 80, function(parser, left) {

    this.left = left;

    if (parser.tokenIs('RIGHT_BRACKET')) {
        parser.error('Expected index or range expression but got');
    }

    this.inner = parser.getExpression(0);
    this.arity = 'binary';
    this.id = 'INDEX';

    parser.advance('RIGHT_BRACKET');

    return this;

});


// Hashes / Structures --------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addPrefix('LEFT_CURLY', function(parser) {

    var elements = [];
    //if (parser.tokenNot('RIGHT_CURLY')) {

        //// TODO make this different
        //while (true) {

            //var n = parser.get();
            //if (n.arity !== 'name' && n.arity !== 'literal') {
                //parser.get().error('Bad key.');
            //}

            //parser.advance();
            //parser.advance('COLON');

            //var v = parser.getExpression(0);
            //v.key = n.value;
            //elements.push(v);
            //if (get().id !== 'COMMA') {
                //break;
            //}

            //advance('COMMA');

        //}
    //}

    parser.advance('RIGHT_CURLY');

    this.inner = elements;
    this.arity = 'unary';
    this.id = 'HASH';
    return this;

});


// Wrappers & Casts -----------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addPrefix('LEFT_PAREN', function(parser) {

    var e;
    if (parser.tokenNot('RIGHT_PAREN')) {
        e = parser.getExpression(0);

    } else {
        parser.error('Expected expression but got');
    }

    parser.advance('RIGHT_PAREN');
    return e;

});


// Calls ----------------------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addInfix('LEFT_PAREN', 80, function(parser, left) {

    var params = [];

    // Call on access / list
    if (left.is('DOT', 'INDEX')) {
        this.arity = 'ternary';
        this.left = left;
        this.inner = params;
        this.id = 'CALL';

        if (left.is('LIST')) {
            parser.error(left, 'List object is not callable');
        }

    // Call on () getExpression
    } else {
        this.arity = 'binary';
        this.left = left;
        this.right = left.right;
        this.inner = params;
        this.id = 'CALL';

        if (left.arity !== 'unary' && left.arity !== 'name'
            && left.not('LEFT_PAREN', 'AND', 'OR', 'HOOK')) {

            // TODO result of expression XYZ is not callable
            parser.error(left, 'Expected a NAME or CAST for CALL expression but got');
        }

    }

    if (parser.tokenNot('RIGHT_PAREN')) {
        while (true) {

            params.push(parser.getExpression(0));

            if (parser.tokenNot('COMMA')) {
                break;
            }

            parser.advance('COMMA');

        }
    }

    parser.advance('RIGHT_PAREN');
    return this;

});

