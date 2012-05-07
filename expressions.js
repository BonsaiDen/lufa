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

    this.arity = 'unary';
    this.id = 'LIST';

    var elements = [];
    if (parser.tokenNot('RIGHT_BRACKET')) {

        while (true) {

            elements.push(parser.getExpression(0));

            if (parser.tokenNot('COMMA')) {

                // Check for list comprehension
                if (parser.tokenIs('FOR')) {

                    parser.advance('FOR');
                    symbolTable.symbols['FOR'].std.call(this, parser, true);
                    this.id = 'LIST_COMPREHENSION';

                }

                break;

            }

            parser.advance('COMMA');

        }

    }

    if (this.id === 'LIST') {
        this.inner = elements;

    } else {
        this.body = elements[0];
    }

    parser.advance('RIGHT_BRACKET');

    return this;

});


// Access and slicing ---------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addInfix('LEFT_BRACKET', 20, function(parser, left) {

    this.left = left;

    if (parser.tokenIs('RIGHT_BRACKET')) {
        parser.error('Expected index or range expression but got empty brackets');
    }

    this.inner = [];

    while(true) {

        var next = parser.get();
        if (next.is('RIGHT_BRACKET', 'COLON')) {
            this.inner.push(null);

        } else {
            this.inner.push(parser.getExpression(0));
        }

        if (parser.tokenNot('COLON')) {
            break;
        }

        parser.advance('COLON');

    }

    parser.advance('RIGHT_BRACKET');

    this.id = this.inner.length > 1 ? 'RANGE' : 'INDEX';
    this.arity = 'binary';

    return this;

});


// Hashes / Structures --------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addPrefix('LEFT_CURLY', function(parser) {

    this.id = 'HASH';

    this.inner = [];
    if (parser.tokenNot('RIGHT_CURLY')) {

        // Determine the type
        var next = parser.peek();

        // Hash literal
        if (next.is('COLON')) {

            var token = parser.get();

            // A hash value { name: x, foo: y }
            if (token.is('IDENTIFIER')) {

                this.id = 'HASHVALUE';

                while(true) {

                    token = parser.get();

                    parser.advance('IDENTIFIER');
                    parser.advance('COLON');
                    token.left = parser.getExpression(0);

                    this.inner.push(token);

                    if (parser.get().not('COMMA')) {
                        break;
                    }

                    parser.advance('COMMA');

                }

            // Parses a map hash construct
            } else {

                this.id = 'HASHMAP';

                while(true) {

                    token = parser.getExpression(0);
                    parser.advance('COLON');
                    token.left = parser.getExpression(0);

                    this.inner.push(token);

                    if (parser.get().not('COMMA')) {
                        break;
                    }

                    parser.advance('COMMA');

                }

                console.log(token);

            }

        // Hash type description {
        //    string name = '',
        //    int num
        // }
        } else {

            this.id = 'HASHDESC';

            while(true) {

                parser.advance();
                this.inner.push(parser.getDeclaration(parser.get(), true, false, true));

                if (parser.get().not('COMMA')) {
                    break;
                }

                parser.advance('COMMA');

            }

        }

    }

    parser.advance('RIGHT_CURLY', 'Missing COMMA in HASH literal');

    console.log(parser.get());
    this.arity = 'unary';
    return this;

});


// Wrappers & Casts -----------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addPrefix('LEFT_PAREN', function(parser) {

    var type = parser.get();

    // Type casts
    if (parser.advanceIf('TYPE')) {

        // Convert into a CAST token
        this.id = 'CAST';
        var cast = parser.tokenFromSymbol(this);

        cast.type = parser.getType(type);
        parser.advance('RIGHT_PAREN', 'Missing closing parenthesis around CAST');

        cast.nud(parser);

        return cast;

    } else {

        // Simple wrapping around expressions
        var e;
        if (parser.tokenNot('RIGHT_PAREN')) {
            e = parser.getExpression(0);

        } else {
            parser.error('Expected expression but got');
        }

        parser.advance('RIGHT_PAREN');
        return e;

    }

});


// Calls ----------------------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addInfix('LEFT_PAREN', 19, function(parser, left) {

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
    // TODO might be broken in certain cases
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

