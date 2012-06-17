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

            elements.push(parser.getExpression(2));

            if (parser.tokenNot('COMMA')) {

                // Check for list comprehension
                if (parser.tokenIs('FOR')) {

                    this.ifCondition = null;
                    this.returnIndexes = elements;
                    this.elseIndexes = [];

                    parser.advance('FOR');
                    symbolTable.symbols['FOR'].std.call(this, parser, true);
                    this.id = 'COMPREHENSION';

                    if (parser.advanceIf('IF')) {

                        this.ifCondition = parser.getExpression(2);

                        if (parser.advanceIf('ELSE')) {

                            // Grab indexes for else condition
                            while (true) {

                                this.elseIndexes.push(parser.getExpression(2));
                                if (parser.tokenNot('COMMA')) {
                                    break;
                                }

                                parser.advance('COMMA');

                            }

                        }

                    }

                }

                break;

            }

            parser.advance('COMMA');

        }

    }

    if (this.id === 'LIST') {
        this.items = elements;

    } else {
        this.body = [];
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
            this.inner.push(parser.getExpression(2));
        }

        if (parser.tokenNot('COLON')) {
            break;
        }

        parser.advance('COLON');

    }

    parser.advance('RIGHT_BRACKET');

    this.id = this.inner.length > 1 ? 'RANGE' : 'INDEX';
    if (this.id === 'INDEX') {
        this.inner = this.inner[0];
    }

    this.arity = 'binary';

    return this;

});


// Hashes / Structures --------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addPrefix('LEFT_CURLY', function(parser) {

    this.id = 'HASH';

    if (parser.tokenNot('RIGHT_CURLY')) {

        // Determine the type
        var next = parser.peek(),
            token = parser.get();

        // Hash Value
        if (token.is('COLON')) {

            this.id = 'HASH_VAL';
            this.fields = {};

            while(true) {

                parser.advance('COLON');

                token = parser.get();
                parser.advance('IDENTIFIER');
                parser.advance('ASSIGN');
                token.left = parser.getExpression(2);

                if (this.fields.hasOwnProperty(token.value)) {
                    parser.error('Duplicated field "' + token.value + '" in hash value');

                } else {
                    this.fields[token.value] = token;
                }

                if (parser.get().not('COMMA')) {
                    break;
                }

                parser.advance('COMMA');

            }

        // Hash Declaration
        } else if (token.is('IDENTIFIER') && next.is('IDENTIFIER') || token.is('TYPE')) {

            this.id = 'HASH_DEC';
            this.fields = {};

            while(true) {

                var mod = parser.get(),
                    isConstant = false;

                if (parser.tokenIs('MODIFIER')) {

                    parser.advance('MODIFIER');

                    if (mod.value !== 'const') {
                        parser.error('Unexpected MODIFIER ' + mod.value);
                    }

                    isConstant = true;

                }

                if (!(parser.advanceIf('TYPE') || parser.advanceIf('IDENTIFIER'))) {
                    parser.error('Expected TYPE or IDENTIFIER, but got %t');
                }

                // Parse type declaration
                var dec = parser.getDeclaration(parser.get(), true, false, true);
                dec.isConst = isConstant;

                if (this.fields.hasOwnProperty(dec.name)) {
                    parser.error('Duplicated field "' + dec.name + '" in hash declaration');

                } else {
                    this.fields[dec.name] = dec;
                }

                if (parser.get().not('COMMA')) {
                    break;
                }

                parser.advance('COMMA');

            }

        // Maps
        } else {

            this.id = 'MAP';
            this.keys = [];

            while(true) {

                token = parser.getExpression(2);
                parser.advance('COLON');

                // Do not use right here, it might already be used by the expression on the left
                token.keyValue = parser.getExpression(2);

                this.keys.push(token);

                if (parser.get().not('COMMA')) {
                    break;
                }

                parser.advance('COMMA');

            }

        }

    }

    parser.advance('RIGHT_CURLY', 'Missing COMMA in HASH literal / declaration');

    this.arity = 'unary';
    return this;

});


// Wrappers & Casts -----------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addPrefix('LEFT_PAREN', function(parser) {

    var type = parser.get(),
        next = parser.peek();

    // Type casts
    if (parser.advanceIf('TYPE') || (parser.advanceIf('IDENTIFIER') && next.id === 'RIGHT_PAREN')) {

        // Convert into a CAST token
        this.id = 'CAST';
        var cast = parser.tokenFromSymbol(this);

        cast.type = parser.getType(type).type;
        parser.advance('RIGHT_PAREN', 'Missing closing parenthesis around CAST');

        cast.nud(parser);

        return cast;

    } else {

        // Simple wrapping around expressions
        var e;
        if (parser.tokenNot('RIGHT_PAREN')) {
            e = parser.getExpression(2);

        } else {
            parser.error('Expected expression but got');
        }

        parser.advance('RIGHT_PAREN');
        return e;

    }

});


// Inline types for IS operator -----------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addSymbol('TYPE').nud = function(parser) {
    this.arity = 'type';
    return this;
};

// Make sure the only allowe expression is "(expression) is (type)"
symbolTable.addSymbol('TYPE').checkRight = function(parser, right) {

    if (right.not('IS')) {
        parser.error(this, 'TYPE cannot be used in expression expect with the IS operator');
    }

};

symbolTable.addSymbol('TYPE').checkLeft = function(parser, left) {
    parser.error(this, 'TYPE cannot be used in expression expect with the IS operator');
};


// Calls ----------------------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addInfix('LEFT_PAREN', 19, function(parser, left) {

    var args = [];

    // Call on access / list
    if (left.is('DOT', 'INDEX')) {
        this.arity = 'ternary';
        this.left = left;
        this.args = args;
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
        this.args = args;
        this.id = 'CALL';

        if (left.arity !== 'unary' && left.arity !== 'name'
            && left.not('LEFT_PAREN', 'AND', 'OR', 'HOOK')) {

            // TODO result of expression XYZ is not callable
            parser.error(left, 'Expected a NAME or CAST for CALL expression but got');
        }

    }

    if (parser.tokenNot('RIGHT_PAREN')) {
        while (true) {

            args.push(parser.getExpression(2));

            if (parser.tokenNot('COMMA')) {
                break;
            }

            parser.advance('COMMA');

        }
    }

    parser.advance('RIGHT_PAREN');
    return this;

});

