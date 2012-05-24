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
symbolTable.addInfix('MUL', 15);
symbolTable.addInfix('DIV', 15);
symbolTable.addInfix('DIV_INT', 15);
symbolTable.addInfix('EXP', 15);
symbolTable.addInfix('MOD', 15);

symbolTable.addInfix('PLUS', 14);
symbolTable.addInfix('MINUS', 14);

symbolTable.addInfix('RSHIFT', 13);
symbolTable.addInfix('LSHIFT', 13);
symbolTable.addInfix('URSHIFT', 13);

symbolTable.addInfix('LT', 12);
symbolTable.addInfix('LTE', 12);
symbolTable.addInfix('GT', 12);
symbolTable.addInfix('GTE', 12);
symbolTable.addInfix('IN', 12);
symbolTable.addInfix('HAS', 12);
symbolTable.addInfix('ELLIPSIS', 12);
symbolTable.addInfix('IS', 11); // validate expressions in compiler

symbolTable.addInfix('EQ', 11);
symbolTable.addInfix('NE', 11);

symbolTable.addInfix('BIT_AND', 10);
symbolTable.addInfix('BIT_XOR', 9);
symbolTable.addInfix('BIT_OR', 8);

// Shortcircuit Operators -----------------------------------------------------
symbolTable.addInfixRight('AND', 7);
symbolTable.addInfixRight('OR', 7);

//symbolTable.addInfix('COMMA', 1);


// Ternary Operator -----------------------------------------------------------
symbolTable.addInfix('HOOK', 5, function(parser, left) {

    this.left = left;
    this.right = parser.getExpression(2);
    this.id = 'TERNARY';
    parser.advance('COLON');

    this.third = parser.getExpression(2);
    this.arity = 'ternary';
    return this;

});


// Dot operator ---------------------------------------------------------------
symbolTable.addInfix('DOT', 20, function(parser, left) {

    this.left = left;
    if (parser.get().arity !== 'name') {
        parser.error(parser.get(), 'Expected a property name.');
    }

    parser.get().arity = 'property';
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
symbolTable.addPrefix('ELLIPSIS');
symbolTable.addPrefix('NOT');
symbolTable.addPrefix('CAST');
symbolTable.addPrefix('BIT_NOT');
symbolTable.addPrefix('MEMBER');
symbolTable.addPrefix('NEW');
symbolTable.addPrefix('DELETE');


// Literals -------------------------------------------------------------------
symbolTable.addLiteral('INTEGER');
symbolTable.addLiteral('FLOAT');
symbolTable.addLiteral('STRING');
symbolTable.addLiteral('BOOLEAN');
symbolTable.addLiteral('NULL');

symbolTable.addSymbol('IDENTIFIER').nud = function() {
    this.id = 'NAME';
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

