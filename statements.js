/**  * Copyright (c) 2012 Ivo Wetzel.
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
symbolTable.addStatement('IDENTIFIER', function(parser) {
    return parser.getDeclaration(this, true);

}, function(parser) {
    // only run IDENTIFIERs as statements if the next token is also an IDENTIFIER
    return parser.peek().is('IDENTIFIER');
});

symbolTable.addStatement('TYPE', function(parser) {
    return parser.getDeclaration(this, true);
});


// Import / Export ------------------------------------------------------------
// ----------------------------------------------------------------------------
function parseImportExport(parser) {

    this.arity = 'module';
    this.names = [];
    this.base = null;

    delete this.value;

    while(true) {

        var module = parser.getModuleName();

        // Name mapping
        if (parser.advanceIf('AS')) {
            var name = parser.get();
            parser.advance('IDENTIFIER');
            module.as = name;
        }

        this.names.push(module);

        if (parser.get().not('COMMA')) {
            break;
        }

        parser.advance('COMMA');

    }

    parser.advance('EOL');

    return this;

}

symbolTable.addSymbol('AS');
symbolTable.addStatement('IMPORT', function(parser) {
    return parseImportExport.call(this, parser);
});

symbolTable.addStatement('EXPORT', function(parser) {
    return parseImportExport.call(this, parser);
});

symbolTable.addStatement('FROM', function(parser) {

    this.id = 'IMPORT';
    this.arity = 'module';

    var base = parser.getModuleName(parser);

    parser.advance('IMPORT');
    parseImportExport.call(this, parser);

    this.base = base;

    return this;

});


// Returns --------------------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addStatement('RETURN', function(parser) {

    this.arity = 'return';
    this.left = parser.getExpression(0)

    parser.advance('EOL');
    return this;

});


// While Loops ----------------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addStatement('WHILE', function(parser) {

    this.arity = 'loop';

    this.condition = parser.getExpression(0);
    parser.advance('COLON', 'Expected COLON after while loop header');

    this.body = parser.getBody();

    return this;

});


// For In Loops ---------------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addSymbol('IN');
symbolTable.addStatement('FOR', function(parser, isComprehension) {

    this.arity = 'loop';

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



// Classes --------------------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addSymbol('MODIFIER');
symbolTable.addSymbol('EXTENDS');
symbolTable.addStatement('CLASS', function(parser) {

    // class (IDENTIFIER) [extends (IDENTIFIER)]:
    this.arity = 'declaration';
    this.name = parser.get();
    parser.advance('IDENTIFIER');

    this.base = parser.advanceIf('EXTENDS') ? parser.get() : null;
    parser.advance('IDENTIFIER');
    parser.advance('COLON');

    this.members = [];
    this.methods = [];
    this.constructors = [];

    if (!parser.advanceIf('BLOCK_START')) {
        return this;
    }

    // Grab constructors and methods
    while(true) {

        // Collect modifiers
        var modifiers = {
            'static': 0,
            'const': 0,
            'public': 0,
            'protected': 0,
            'private': 0,
            'abstract': 0
        };
        while(true) {

            if (!parser.get().is('MODIFIER')) {
                break;
            }

            modifiers[parser.get().value]++;
            parser.advance('MODIFIER');

        }

        // Grab actual start of member
        var token = parser.get();

        // Constructors, must have the same IDENTIFIER value as the class name
        // abstract ones
        if (token.is('IDENTIFIER')) {
            parser.getDeclaration(token, true, modifiers['abstract'] > 0);
            token.id = 'CONSTRUCTOR';
            this.constructors.push(token);

        } else {

            parser.advance('TYPE');
            parser.getDeclaration(token, true, modifiers['abstract'] > 0);

            // TODO Variables, abstracts may NOT define a value
            if (token.is('VARIABLE')) {
                token.id = 'MEMBER';
                this.members.push(token);

            // TODO Methods, abstract ones may NOT end with a COLON
            } else {
                token.id = 'METHOD';
                this.methods.push(token);
            }

        }

        // Validate modifiers
        // we do this after parsing so that we can have some meaningful error
        // messages (line numbers and such)
        for(var i in modifiers) {
            if (modifiers[i] > 1) {
                parser.error(token, 'Multiple ' + i + ' modifiers for');
            }
        }

        if (modifiers['private'] + modifiers['protected'] + modifiers['public'] > 1) {
            parser.error(token, 'Multiple visibility modifiers for');
        }

        // Assign modifiers
        token.isConst = modifiers['const'] === 1;
        token.isStatic = modifiers['static'] === 1;
        token.isAbstract = modifiers['abstract'] === 1;

        if (modifiers['private'] === 1) {
            token.visbility = 'private';

        } else if (modifiers['protected'] === 1) {
            token.visbility = 'protected';

        } else {
            token.visbility = 'public';
        }

        if (parser.get().is('BLOCK_END')) {
            break;
        }

    }

    parser.advance('BLOCK_END');

    return this;

});












