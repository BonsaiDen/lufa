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

require('./baseSymbols');
require('./expressions');
require('./statements');


// Parser thing ---------------------------------------------------------------
// ----------------------------------------------------------------------------
function Parser() {
    this.__tokens = null;
    this.__currentToken = null;
    this.__currentIndex = 0;
    // this.__currentScope = scope; ???
}

Parser.prototype = {

    error: function(token, msg) {

        if (typeof token === 'string') {
            msg = token;
            token = this.__currentToken;
        }

        msg = msg || 'Unexpected token';
        throw new Error('SyntaxError: ' + msg + ' ' + token.id
                        + ' at line ' +  token.line + ', col ' + token.col);

    },

    parse: function(tokens) {

        this.__tokens = tokens;
        this.__currentIndex = 0;
        this.advance();

        var s = this.getStatementList();
        this.advance('END');
        //scope.pop();

        return s;

    },

    tokenIs: function(id) {
        return this.__currentToken.id === id;
    },

    tokenNot: function(id) {
        return this.__currentToken.id !== id;
    },

    get: function() {
        return this.__currentToken;
    },

    peek: function() {
        return this.tokenFromSymbol(this.__tokens[this.__currentIndex]);
    },

    advanceIf: function(id) {

        if (this.__currentToken.id === id) {
            return this.advance(id);

        } else {
            return false;
        }

    },

    back: function() {
        this.__currentIndex -= 2;
        this.__currentToken = this.tokenFromSymbol(this.__tokens[this.__currentIndex]);
        return this.__currentToken;
    },

    advance: function(id) {

        var token, value;
        if (id && this.__currentToken.not(id)) {
            this.error(this.__currentToken, 'Expected "' + id + '" but got');
        }

        if (this.__currentIndex >= this.__tokens.length) {
            this.__currentToken = symbolTable.symbols['END'];
            return;
        }

        this.__currentToken = this.tokenFromSymbol(this.__tokens[this.__currentIndex++]);
        return this.__currentToken;

    },

    tokenFromSymbol: function(token) {

        // Grab the token spec from the symbolTables list
        var obj = symbolTable.symbols[token.id];
        if (!obj) {
            this.error(token, 'Unkown token');
        }

        // Create new token object
        var t = Object.create(obj);
        t.id = token.id;
        t.arity = null;
        t.line = token.line;
        t.col = token.col;
        t.value = token.value;

        // Pre parse some values
        if (token.id === 'TYPE') {
            t.type = token.value;

        } else if (token.id === 'STRING' || token.id === 'BOOLEAN' || token.id === 'INTEGER' || token.id === 'FLOAT') {
            t.arity = 'literal';

        } else if (token.id === 'IDENTIFIER') {
            t.arity = 'name';
        }

        return t;

    },

    getExpression: function(rbp) {

        var left,
            token = this.__currentToken;

        this.advance();

        left = token.nud(this);

        while(rbp < this.__currentToken.lbp) {
            token = this.__currentToken;
            this.advance();
            left = token.led(this, left);
        }

        return left;

    },

    getStatement: function() {

        var next = this.__currentToken;
        if (next.std) {

            if (!next.check || next.check(this)) {

                //scope.reserve(next); # TODO scope stuff
                this.advance();
                return next.std(this);

            }

        }

        // Make sure this is a valid expression for a statement
        var exp = this.getExpression(0);

        // Determine side effects
        var hasSideEffect = false,
            e = exp;

        while(e) {

            if (e.isAssignment || e.id === 'CALL'
                || e.id === 'DECREMENT' || e.id === 'INCREMENT'
                || e.id === 'NEW' || e.id === 'DELETE') {

                hasSideEffect = true;
                break;

            }

            // TODO Tenary / bitwise support?
            if (e.is('AND', 'OR')) {
                e = e.right;

            } else {
                break;
            }

        }

        if (!hasSideEffect) {
            this.error(e, 'Bad expression statement, expected expression with side effect (like assignment or decrement), instead saw');
        }

        this.advance('EOL');
        return exp;

    },

    getStatementList: function() {

        var a = [], s;
        while (true) {

            if (this.__currentToken.is('BLOCK_END', 'END')) {
                break;
            }

            s = this.getStatement();
            if (s) {
                a.push(s);
            }

        }

        return a.length === 0 ? null : a.length === 1 ? a[0] : a;

    },

    getBlock: function() {

        var token = this.__currentToken;
        if (this.advanceIf('BLOCK_START')) {
            return token.std(this);

        } else {
            return null;
        }

    },

    getBody: function() {
        return !this.advanceIf('EOL') ? this.getBlock() : null;
    },


    // Special methods for parsing certain sub constructs ---------------------
    // ------------------------------------------------------------------------
    getDeclaration: function(dec, getValue, isAbstract) {

        this.getType(dec);
        this.advance('IDENTIFIER');

        dec.id = 'VARIABLE';
        dec.arity = 'declaration';
        dec.right = null;

        if (getValue) {

            // Variable with assignment
            if (this.advanceIf('ASSIGN')) {

                if (isAbstract) {
                    this.error(dec, 'Declared as abstract but has a value,');

                } else {
                    dec.right = this.getExpression(0);
                }

            // Function
            } else if (this.advanceIf('LEFT_PAREN')) {

                dec.id = 'FUNCTION';
                this.getFunctionParams(dec);

                if (!isAbstract) {
                    this.advance('COLON');
                    dec.body = this.getBlock();

                } else if (this.advanceIf('COLON')) {
                    this.error(dec, 'Declared as abstract but has a body,');
                }

            }

            // There's no EOL after a block end
            if (!dec.body) {
                this.advance('EOL');
            }

        }

        return dec;

    },

    getType: function(type) {

        var parentType = type.value;
        type.type = {
            value: type.value,
            isFunction: false,
            params: null,
            builtin: true
        };

        // small cleanup
        delete type.value;

        // User defined type
        if (type.is('IDENTIFIER')) {
            type.type.builtin = false;
            return type;
        }

        // Grab sub types
        if (type.is('TYPE') && this.advanceIf('LEFT_BRACKET')) {

            type.inner = [];

            while((this.get().not('RIGHT_BRACKET'))) {

                var sub = this.get();
                sub.arity = 'type';

                if (this.advanceIf('IDENTIFIER')) {

                    if (parentType !== 'hash' && parentType !== 'list' && parentType !== 'map') {
                        this.error(type, 'Cannot have sub type IDENTIFIER for non LIST/HASH/MAP types');
                    }

                    type.inner.push(sub);

                } else if (this.advanceIf('TYPE')) {

                    if (parentType !== 'list' && parentType !== 'map') {
                        this.error(type, 'Cannot have sub type TYPE for non LIST/MAP types');
                    }

                    type.inner.push(sub);
                    this.getType(sub);

                }

                if (this.get().not('COMMA')) {
                    break;
                }

                if (parentType !== 'map' || type.inner.length > 1) {
                    this.error(type, 'Cannot have multiple or more than 2 sub types for non MAP types');
                }

                this.advance('COMMA');

            }

            this.advance('RIGHT_BRACKET');

        }

        // Function type, we don't need param names here!
        if (this.advanceIf('LEFT_PAREN')) {
            this.getFunctionParams(type.type, true);
            type.type.isFunction = true;
        }

        return type;

    },

    /**
      * Function parses a function
      */
    getFunctionParams: function(dec, typeOnly) {

        var params = [];
        if (this.get().not('RIGHT_PAREN')) {

            while(true) {

                // For signature definitions
                var param;
                if (typeOnly) {

                    param = this.get();
                    this.advance('TYPE');
                    this.getType(param);

                    params.push(param);

                } else {
                    param = this.getParamPair(this.get());
                    params.push(param);
                }

                // Var args like (int b...) method will then receive a list
                if (this.advanceIf('ELLIPSIS')) {
                    param.vararg = true;
                }

                if (this.get().not('COMMA')) {
                    break;
                }

                this.advance('COMMA');

            }

        }

        dec.params = params;
        this.advance('RIGHT_PAREN');

    },

    /**
      * Grabs a pair of params in function stuff...
      */
    getParamPair: function(param) {

        this.advance('TYPE');
        this.getType(param);

        param.arity = 'parameter';
        param.name = this.get().value;

        this.advance('IDENTIFIER');

        if (this.advanceIf('ASSIGN')) {
            param.right = this.getExpression(0);

        } else {
            param.right = null;
        }

        return param;

    }

};

exports.Parser = Parser;
