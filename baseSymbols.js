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

// Statements -----------------------------------------------------------------
symbolTable.addStatement('BLOCK_START', function(parser) {
    //new_scope();
    var a = parser.getStatementList();
    parser.advance('BLOCK_END');
    //scope.pop();
    return a;
});

symbolTable.addStatement('SCOPE', function(parser) {

    parser.advance('COLON');

    this.body = null;
    if (!parser.advanceIf('EOL')) {
        this.body = parser.getBlock();
    }

    return this;

});


// Infix Operators ------------------------------------------------------------
symbolTable.addInfix('EXP', 60);
symbolTable.addInfix('MUL', 60);
symbolTable.addInfix('DIV', 60);
symbolTable.addInfix('DIV_INT', 60);
symbolTable.addInfix('MOD', 60);

symbolTable.addInfix('PLUS', 50);
symbolTable.addInfix('MINUS', 50);

symbolTable.addInfix('RSHIFT', 46);
symbolTable.addInfix('LSHIFT', 46);
symbolTable.addInfix('URSHIFT', 46);

symbolTable.addInfix('LT', 43);
symbolTable.addInfix('LTE', 43);
symbolTable.addInfix('GT', 43);
symbolTable.addInfix('GTE', 43);

symbolTable.addInfix('EQ', 40);
symbolTable.addInfix('NE', 40);

symbolTable.addInfix('BIT_AND', 36);
symbolTable.addInfix('BIT_XOR', 34);
symbolTable.addInfix('BIT_OR', 32);

symbolTable.addInfix('BIT_AND', 30);
symbolTable.addInfix('NE', 30);

// Shortcircuit Operators -----------------------------------------------------
symbolTable.addInfixRight('AND', 30);
symbolTable.addInfixRight('OR', 30);


// Ternary Operator -----------------------------------------------------------
symbolTable.addInfix('HOOK', 20, function(parser, left) {

    this.left = left;
    this.right = parser.getExpression(0);
    this.id = 'TERNARY';
    parser.advance('COLON');

    this.third = parser.getExpression(0);
    this.arity = 'ternary';
    return this;

});


// Dot operator ---------------------------------------------------------------
symbolTable.addInfix('DOT', 80, function(parser, left) {

    this.left = left;
    if (parser.get().arity !== 'name') {
        parser.error(parser.get(), 'Expected a property name.');
    }

    parser.get().arity = 'literal';
    this.right = parser.get();
    this.arity = 'binary';
    parser.advance();

    return this;

});


// Separators / Stops ---------------------------------------------------------
symbolTable.addSymbol('COLON');
symbolTable.addSymbol('EOL');
symbolTable.addSymbol('END');
symbolTable.addSymbol('COMMA');
symbolTable.addSymbol('BLOCK_END');
symbolTable.addSymbol('RIGHT_PAREN');
symbolTable.addSymbol('RIGHT_BRACKET');
symbolTable.addSymbol('RIGHT_CURLY');


// Prefix Operators -----------------------------------------------------------
symbolTable.addPrefix('INCREMENT');
symbolTable.addPrefix('DECREMENT');
symbolTable.addPrefix('MINUS');
symbolTable.addPrefix('PLUS');
symbolTable.addPrefix('NOT');
symbolTable.addPrefix('BIT_NOT');
symbolTable.addPrefix('AT');
symbolTable.addPrefix('NEW');
symbolTable.addPrefix('DELETE');


// Literals -------------------------------------------------------------------
var itself = function () {
    return this;
};

symbolTable.addSymbol('INTEGER').nud = itself;
symbolTable.addSymbol('FLOAT').nud = itself;
symbolTable.addSymbol('STRING').nud = itself;
symbolTable.addSymbol('BOOLEAN').nud = itself;
symbolTable.addSymbol('NULL').nud = itself;
symbolTable.addSymbol('IDENTIFIER').nud = function() {
    this.id = 'VARIABLE';
    this.arity = 'name';
    return this;
};


// Assignments ----------------------------------------------------------------
symbolTable.addAssignment('ASSIGN_URSH');
symbolTable.addAssignment('ASSIGN_RSH');
symbolTable.addAssignment('ASSIGN_LSH');
symbolTable.addAssignment('ASSIGN_BITWISE_OR');
symbolTable.addAssignment('ASSIGN_BITWISE_XOR');
symbolTable.addAssignment('ASSIGN_BITWISE_AND');
symbolTable.addAssignment('ASSIGN_PLUS');
symbolTable.addAssignment('ASSIGN_MINUS');
symbolTable.addAssignment('ASSIGN_EXP');
symbolTable.addAssignment('ASSIGN_MUL');
symbolTable.addAssignment('ASSIGN_DIV_INT');
symbolTable.addAssignment('ASSIGN_DIV');
symbolTable.addAssignment('ASSIGN_MOD');
symbolTable.addAssignment('ASSIGN');

