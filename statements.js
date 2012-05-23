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
symbolTable.addStatement('IDENTIFIER', function(parser) {
    return parser.getDeclaration(this, true);

}, function(parser) {
    // only run IDENTIFIERs as statements if the next token is also an IDENTIFIER
    // this ensure that we parse User types but still correctly handle normal names
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

            // Changes in order to make name resolving easier
            name.isImport = true;
            name.name = name.value;

        } else {
            module.isImport = true;
            module.name = module.value;
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
    if (parser.get().not('EOL')) {
        this.left = parser.getExpression(2);
    }

    parser.advance('EOL');
    return this;

});


// While Loops ----------------------------------------------------------------
// ----------------------------------------------------------------------------
symbolTable.addStatement('WHILE', function(parser) {

    this.arity = 'loop';

    this.condition = parser.getExpression(2);
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
    this.iterator = parser.getExpression(2);

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
    this.condition = parser.getExpression(2);
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
        elif.condition = parser.getExpression(2);
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
symbolTable.addStatement('MODIFIER', function(parser) {

    // This handles const modifiers in front of declarations
    if (this.value !== 'const') {
        parser.error('Unexpected MODIFIER ' + this.value);
    }

    var dec = parser.getStatement();
    if (dec.arity !== 'declaration') {
        parser.error('Expected declaration after const modifier');
    }

    dec.isConst = true;
    return dec;

});

symbolTable.addSymbol('EXTENDS');
symbolTable.addStatement('CLASS', function(parser) {

    // class (IDENTIFIER) [extends (IDENTIFIER)]:
    this.arity = 'declaration';
    this.name = parser.get().value;
    parser.advance('IDENTIFIER');

    this.base = parser.advanceIf('EXTENDS') ? parser.get() : null;
    if (this.base) {
        parser.advance('IDENTIFIER');
    }

    parser.advance('COLON');

    this.members = {};
    this.methods = {};
    this.constructor = null;
    this.destructor = null;

    if (!parser.advanceIf('BLOCK_START')) {
        parser.advance('EOL');
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

        var hasAnyModifiers = false;

        while(true) {

            if (!parser.get().is('MODIFIER')) {
                break;
            }

            modifiers[parser.get().value]++;
            hasAnyModifiers = true;
            parser.advance('MODIFIER');

        }

        // Grab actual start of member
        var token = parser.get();

        // Error out on obvious syntax errors
        if (token.is('IDENTIFIER') && !parser.peek().is('IDENTIFIER')) {
            parser.error(token, 'Ambigious syntax in CLASS, missing either new or del to identify con-/destructor');

        // Constructors
        } else if (token.is('NEW')) {

            token = parser.advance('NEW');

            if (hasAnyModifiers) {
                parser.error(token, 'Constructor cannot have modifiers');
            }

            parser.getDeclaration(token, true, false);
            token.id = 'CONSTRUCTOR';

            if (token.type.value !== this.name) {
                parser.error(token, 'Constructor function must match name of class,');
            }

            if (this.constructor) {
                parser.error('Class already has a constructor but defined another one');
            }

            this.constructor = token;

        // Destructors
        } else if (token.is('DELETE')) {

            token = parser.advance('DELETE');

            if (hasAnyModifiers) {
                parser.error(token, 'Destructor cannot have modifiers');
            }

            parser.getDeclaration(token, true, modifiers['abstract'] > 0);
            token.id = 'DESTRUCTOR';

            if (token.type.value !== this.name) {
                parser.error(token, 'Destructor function must match name of class,');
            }

            if (this.destructor) {
                parser.error('Class already has a destructor but defined another one');
            }

            this.destructor = token;

        } else {

            // We expect a type
            if (!parser.advanceIf('TYPE') && !parser.advanceIf('IDENTIFIER')) {
                parser.error('Expected either a built-in or user type');
            }

            parser.getDeclaration(token, true, modifiers['abstract'] > 0);

            // TODO Variables, abstracts may NOT define a value
            if (token.is('VARIABLE')) {

                token.id = 'MEMBER';
                if (this.members.hasOwnProperty(token.name)) {
                    parser.error('Duplicated member name "' + token.name + '" in class declaration');

                } else {
                    this.members[token.name] = token;
                }

            // TODO Methods, abstract ones may NOT end with a COLON
            } else {

                token.id = 'METHOD';
                if (this.methods.hasOwnProperty(token.name)) {
                    parser.error('Duplicated method name "' + token.name + '" in class declaration');

                } else {
                    this.methods[token.name] = token;
                }

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

