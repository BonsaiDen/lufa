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

// Variable Declarations ------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addStatement('TYPE', function(parser) {
    return parser.getDeclaration(this, true);
});


// For In Loops ---------------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addSymbol('IN');
symbolTable.addStatement('FOR', function(parser, isComprehension) {

    // The index variables for iteration
    this.indexes = [];


    // Parse the indecies
    while(parser.tokenNot('IN')) {

        var next = parser.peek(),
            token = parser.get();

        // for (IDENTIFIER) in (expression)
        if (next.is('COMMA', 'IN')) {

            // Indexes cannot come from an outer scope in the case of comprehensions
            if (isComprehension) {
                parser.error('Index in list comprehensions must have a TYPE');
            }

            parser.advance('IDENTIFIER', 'Expected IDENTIFIER as forin loop index');
            this.indexes.push(token);

        // for (TYPE) (IDENTIFIER) in (expression)
        } else {

            if (parser.advanceIf('TYPE') || parser.advanceIf('IDENTIFIER')) {
                this.indexes.push(parser.getDeclaration(token, false));

            } else {
                parser.error(token, 'Expected TYPE or IDENTIFIER as forin loop index');
            }

        }

        if (parser.tokenNot('COMMA')) {
            break;
        }

        parser.advance('COMMA', 'Expected COMMA to separate forin loop indexes');

    }

    parser.advance('IN', 'Expected IN of forin loop to separate indexes and iterator');

    // The expression which serves as the iterator
    this.iterator = parser.getExpression(0);

    // List comprehensions do not have a COLON or a body
    if (!isComprehension) {
        parser.advance('COLON', 'Expected COLON after forin loop header');

        // Grab body, if it exists
        this.body = parser.getBody();

    }

    return this;

});


// If / elif / else conditions ------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addStatement('IF', function(parser) {

    // Grab the initial expression and setup memebers
    this.condition = parser.getExpression(0);
    parser.advance('COLON', 'Expected COLON after if condition');

    this.branches = [];

    // Grab the block, if it exists
    this.body = parser.getBody();

    // Grab all ELIF branches on the same indentation level
    while(true) {

        // Grab token and assert it's an ELIF
        var elif = parser.get();
        if (!parser.advanceIf('ELIF')) {
            break;
        }

        // ELIF condition
        elif.condition = parser.getExpression(0);
        parser.advance('COLON', 'Expected COLON after elif condition');

        // Grab the block, if it exists
        elif.body = parser.getBody();

        // Add to the branches
        this.branches.push(elif);

    }

    // Grab token and see whether it's an ELIF
    var els = parser.get();
    if (parser.advanceIf('ELSE')) {
        parser.advance('COLON', 'Expected COLON after else statement');

        // Grab the block, if it exists
        els.body = parser.getBody();

        // Add to the branches, ELSE will always be the last branch of a IF statement
        this.branches.push(els);

    }

    return this;

});

// Error for headless elif statements
symbolTable.addStatement('ELIF', function(parser) {
    parser.error(this, 'Not if statement found for');
});

// Error for headless else statements
symbolTable.addStatement('ELSE', function(parser) {
    parser.error(this, 'Not if statement found for');
});


