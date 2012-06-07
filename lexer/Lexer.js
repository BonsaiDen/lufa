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

/*jshint evil: true, regexdash: false, regexp: false */
var KEYWORDS = {

    'class': 'CLASS',
    'extends': 'EXTENDS',
    'package': 'PACKAGE',
    'extern': 'EXTERN',

    'if': 'IF',
    'elif': 'ELIF',
    'else': 'ELSE',
    'try': 'TRY',
    'catch': 'CATCH',
    'finally': 'FINALLY',
    'raise': 'RAISE',
    'for': 'FOR',
    'while': 'WHILE',
    'scope': 'SCOPE',
    'ret': 'RETURN',

    'true': 'BOOL',
    'false': 'BOOL',
    'null': 'NULL',

    'from': 'FROM',
    'import': 'IMPORT',
    'as': 'AS',
    'export': 'EXPORT',

    'outer': 'OUTER' // modifier or not?

};

var TYPES = 'void bool int float string list map hash'.split(' ');
var MODIFIERS = 'const static abstract public protected private'.split(' ');

var OPERATORS = {
    '>>>=': 'ASSIGN_URSH',
    '>>=':  'ASSIGN_RSH',
    '<<=':  'ASSIGN_LSH',
    '|=':   'ASSIGN_BITWISE_OR',
    '^=':   'ASSIGN_BITWISE_XOR',
    '&=':   'ASSIGN_BITWISE_AND',
    '+=':   'ASSIGN_PLUS',
    '-=':   'ASSIGN_MINUS',
    '**=':  'ASSIGN_EXP',
    '*=':   'ASSIGN_MUL',
    '//=':  'ASSIGN_DIV_INT',
    '/=':   'ASSIGN_DIV',
    '%=':   'ASSIGN_MOD',

    '==':   'EQ',
    '!=':   'NE',
    '=':    'ASSIGN',

    ',':    'COMMA',
    '?':    'HOOK',
    ':':    'COLON',

    '||':   'OR',
    '&&':   'AND',

    '|':    'BIT_OR',
    '&':    'BIT_AND',
    '^':    'BIT_XOR',
    '~':    'BIT_NOT',

    '<<':   'LSHIFT',
    '>>>':  'URSHIFT',
    '>>':   'RSHIFT',

    '...':  'ELLIPSIS',

    '<=':   'LTE',
    '<':    'LT',
    '>=':   'GTE',
    '>':    'GT',

    '++':   'INCREMENT',
    '--':   'DECREMENT',
    '+':    'PLUS',
    '-':    'MINUS',

    '**':   'EXP',
    '*':    'MUL',

    '//':   'DIV_INT',
    '/':    'DIV',

    '%':    'MOD',
    '!':    'NOT',

    '.':    'DOT',
    '@':    'MEMBER',

    '[':    'LEFT_BRACKET',
    ']':    'RIGHT_BRACKET',
    '{':    'LEFT_CURLY',
    '}':    'RIGHT_CURLY',
    '(':    'LEFT_PAREN',
    ')':    'RIGHT_PAREN'
};

var ASCII_OPERATORS = {
    'has': 'HAS',
    'in': 'IN',
    'is':   'IS',
    'new':  'NEW',
    'del':  'DELETE'
};

// These will prevent a block from being openend
var NO_BLOCK = ['COMMA', 'CONTINUE_LINE', 'LEFT_PAREN', 'LEFT_CURLY', 'LEFT_BRACKET'];

// We're skipping the insertion of EOL tokens right before these tokens
var SKIP_EOL = ['RIGHT_PAREN', 'RIGHT_CURLY', 'RIGHT_BRACKET'];


// Regular Expressions --------------------------------------------------------
// ----------------------------------------------------------------------------

// Combines the operators into one single regexp
var opMatch = '^';
for (var i in OPERATORS) {

    if (opMatch !== '^') {
        opMatch += '|^';
    }

    opMatch += i.replace(/[?|^&(){}\[\]+\-*\/\.]/g, '\\$&');

}

var opRegExp = new RegExp(opMatch),

    // We don't match negative numbers
    // these need to be figured out during AST building

    // This does not align with JS
    // It only allows floats which have have a number infront AND after
    // the decimal point, everything else makes ellipsis and stuff just way
    // harder to detect
    fpRegExp = /^\d+\.\d+(?:[eE][-+]?\d+)?|^\d+(?:\.\d*)?[eE][-+]?\d+/,

    // no octals
    intRegExp = /^0[xX][\da-fA-F]+|^\d+/,

    reRegExp = /^\/((?:\\.|\[(?:\\.|[^\]])*\]|[^\/])+)\/([gimy]*)/,
    multiCommentRegExp = /^\#\#\#(.|[\r\n])*?\#\#\#/m,
    commentRegExp = /^\#.*$/,

    // No $ in identifiers for now
    identRegExp = /^[_\w]+/,
    wsRegExp = /^[\ \t]+/,
    strRegExp = /^'([^'\\]|\\.)*'|^"([^"\\]|\\.)*"/;

/**
  * A token represents the smallest entry the stream.
  */
function Token() {

    // Place and whitespace information
    this.line = 1;
    this.col = 1;
    this.nol = 0; // token # on line
    this.ws = {
        indent: 0, // number of spaces used for indentation
        before: 0, // whitespace between this token and the one before it
        after: 0, // whitespace after this token and the next one
        trailing: 0 // trailing whitespace on the line after this token (only on newline/EOL tokens)
    };

    // The token id e.g. "KEYWORD" (we do not use type because it is confusing for the type system )
    this.id = null;

    // The value of the token e.g. "class"
    this.value = null;

    // The plain source version e.g. "'Hello \'World\'!'"
    this.plain = null;

    this.level = 0;

}

Token.prototype = {

    toString: function() {

        var indent = this.level,
            pre = new Array(indent + 1).join('    ');

        return pre + '[' + (this.id + '          ').substr(0, 13) + ' '
                + '' + this.ws.indent + ':' + this.ws.before + ' | B#'
                + ' T#' + this.nol + ' ' + this.line
                + ':' + this.col + ' | ' + this.ws.after + ':' + this.ws.trailing
                + '' + ': ' + this.value + ']';
    }

};


/**
  * A block encapsulates a indented region of code.
  */
function Block(parent) {

    // The parent block
    this.parent = parent || null;

    // The child blocks
    this.childs = [];

    // The "deepness" level of the block
    this.level = this.parent ? this.parent.level + 1 : 1;

    // The tokens inside the block
    // this.tokens = [];
    this.id = Block.id++;

}

Block.id = 0;

Block.prototype = {

    toString: function() {
        return '[Block #' + this.id + ']';
    },

    toJSON: function() {
        return {
            id: this.id,
            parent: this.parent ? this.parent.id : null,
            level: this.level
        };
    }

};


/**
  * Parse Error
  */
function ParseError(msg, line, col) {
    this.name = 'ParseError';
    this.message = msg + ' on line ' + line + ' at column ' + col;
}

ParseError.prototype = Error.prototype;


// Main lexing function -------------------------------------------------------
// ----------------------------------------------------------------------------
function parse(input, tabWidth, stripComments) {

    input += '\n';

    // cursor position in the input string
    var cursor = 0,

        // whitespace for current token
        line = 1,
        col = 1,
        spaceBefore = 0,

        // indentation information during parsing
        indentation = 0,
        indentStack = [],

        // how many spaces will expand a tab
        tabExpand = new Array((tabWidth || 4)).join(' '),

        // initial token
        token = new Token(),

        // the last non-whitespace token
        lastToken = null,
        lastIndentToken = null,

        // current token number on line
        numberOnLine = 0,

        // token list
        list = [],

        // initial / current block
        block = new Block();

    // Helpers for inserting block tokens into the stream
    // TODO clean up
    function insertBlockStart(block, subBlock, token) {

        var t = new Token();
        t.id = 'BLOCK_START';
        t.value = subBlock;
        t.nol = token.nol;
        t.line = token.line;
        t.col = token.col;
        t.ws = token.ws;
        t.level = block.level;

        list.splice(list.length - 1, 0, t);

    }

    // TODO clean up
    function insertBlockEnd(block, last) {

        var prev = list[list.length - (last ? 1 : 2)];
        var t = new Token();
        t.id = 'BLOCK_END';
        t.line = prev.line;
        t.col = prev.col;
        t.value = block;
        t.ws = block.token.ws;
        t.level = block.level;

        var eol = new Token();
        eol.line = prev.line;
        eol.col = prev.col;
        eol.id = 'EOL';
        eol.value = 'EOL';
        eol.ws = block.token.ws;
        eol.level = block.level;

        if (last === true) {
            list.push(t);

        } else {
            list.splice(list.length - 1, 0, t);
        }

    }

    block.token = token;
    insertBlockStart({ level: 0 }, block, token);

    // Grab the inputs
    while (cursor < input.length) {

        // Save the last non-whitespace token
        if (token.id !== 'WHITESPACE') {
            lastToken = token;

            // Save the last non-newline one for block detection
            if (token.id !== 'NEWLINE' && token.nol === 0) {

                // Detect line wrappings via COMMA or CONTINUE_LINE
                var prevWrap = list[list.length - 2];
                if (!(prevWrap && (NO_BLOCK.indexOf(prevWrap.id) !== -1))) {

                    if (token.id !== 'COMMENT' || !stripComments) {
                        lastIndentToken = token;
                    }

                }

            }

        }

        // Get the rest
        // We also grab the rest of the line here for regexps
        var sub = input.substring(cursor),
            subline = sub.substring(0, sub.indexOf('\n')),
            m = null;

        // Create next token
        token = new Token();
        token.line = line;
        token.col = col;
        token.ws.indent = indentation;
        token.ws.before = lastToken.id === 'NEWLINE' ? 0 : spaceBefore;

        // Reset whitespace
        spaceBefore = 0;

        // Newlines
        if (sub[0] === '\n') {

            lastToken.ws.trailing = token.ws.before;
            token.ws.before = 0;
            token.id = 'NEWLINE';
            token.value = '\\n';
            token.plain = sub[0];
            indentation = 0;
            col = 0; // gets increased below, thus setting it to 0 here is correct
            line++;

        // Multi line comments
        // don't ask me how this regexp works... just pray that it will never fail
        } else if ((m = sub.match(multiCommentRegExp)) && m.index === 0) {

            token.id = 'COMMENT';
            token.plain = m[0];
            token.value = m[0].slice(3, -3); // strip of ### ... ###

            // Count the lines inside the comment and adjust the line counter
            var lines = token.plain.split('\n');
            line += lines.length - 1;

            // Make sure to adjust the column position too
            col = lines[lines.length - 1].length - m[0].length + 1;

        // Comment
        } else if ((m = subline.match(commentRegExp))) {

            // Detect unclosed multiline comments
            if (m[0].substr(0, 3) === '###') {
                throw new ParseError('Unclosed multiline comment', line, col);
            }

            token.id = 'COMMENT';
            token.plain = m[0];
            token.value = m[0].substr(1); // strip starting '#'

        // Float
        } else if ((m = sub.match(fpRegExp))) {
            token.id = 'FLOAT';
            token.plain = m[0];
            token.value = parseFloat(m[0]);

        // Integer
        } else if ((m = sub.match(intRegExp))) {
            token.id = 'INTEGER';
            token.plain = m[0];
            token.value = parseInt(m[0]);

        // String
        } else if ((m = sub.match(strRegExp))) {
            token.id = 'STRING';
            token.plain = m[0];

            // simplest way to get the actual js string value.
            // Don't beat me, taken straight from narcissus :O
            token.value = eval(m[0]);

        // Identifier
        } else if ((m = sub.match(identRegExp))) {
            token.value = m[0];

            if (KEYWORDS.hasOwnProperty(token.value)) {
                token.id = KEYWORDS[token.value];

            } else if (TYPES.indexOf(token.value) !== -1) {
                token.id = 'TYPE';
                token.type = token.value; // reduces code in the parser

            } else if (MODIFIERS.indexOf(token.value) !== -1) {
                token.id = 'MODIFIER';

            } else if (ASCII_OPERATORS.hasOwnProperty(token.value)) {
                token.id = ASCII_OPERATORS[token.value];

            } else {
                token.id = 'IDENTIFIER';
            }

        // Regexp, matches just on the same line and only if we didn't encounter a identifier right before it
        } else if (lastToken.id !== 'IDENTIFIER' && (m = subline.match(reRegExp))) {
            token.id = 'REGEXP';
            token.plain = m[0];
            token.value = m[1];
            token.flags = m[2];

        // Operator
        } else if ((m = sub.match(opRegExp))) {

            // Split of data for ASSIGN operators
            var op = OPERATORS[m[0]];
            if (op.substring(0, 6) === 'ASSIGN') {

                token.id = 'ASSIGN';
                if (op === 'ASSIGN') {
                    token.value = null;

                } else {
                    token.value = op.substring(7);
                }

            } else {
                token.id = op;
            }

        // Whitespace handling
        } else if ((m = sub.match(wsRegExp))) {

            token.id = 'WHITESPACE';

            // Provide meta information about whitespace
            spaceBefore = m[0].replace(/\t/g, '    ').length;
            if (col === 1) {
                indentation = spaceBefore;

            } else {
                lastToken.ws.after = spaceBefore;
            }

        // Line continutation, these get stripped out before we return at the end
        } else if (sub[0] === '\\') {
            token.id = 'CONTINUE_LINE';

        // Throw up on unknown tokens!
        } else {
            throw new ParseError('Unexpected ' + sub[0], line, col);
        }

        // Add non-whitespace tokens to stream
        if (token.id !== 'WHITESPACE' && (token.id !== 'COMMENT' || !stripComments)) {

            // Assign the nol
            token.nol = numberOnLine;

            // Handle newline stuff
            if (token.id === 'NEWLINE') {

                // Ignore newlines which are the only token on the line
                if (numberOnLine !== 0) {
                    list.push(token);
                }

                // REMOVE EOL infront of other stuff
                numberOnLine = 0;

            // Other tokens, and block detection
            } else {

                list.push(token);

                numberOnLine++;

                // Let's see whether this token would start or end a block
                var indentBy = token.ws.indent - lastIndentToken.ws.indent;

                // We started a new block
                // this is a bit complicated
                // we need to filter out cases where commas wrap argument lists
                // and line contiutation is in place
                //
                // Also, indentend comments will not open a block
                if (indentBy > 0 && token.nol === 0 && token.id !== 'COMMENT') {

                    // Drop previous newline token
                    // it will be 2 tokens behind us
                    if (lastToken.id === 'NEWLINE') {
                        list.splice(list.length - 2, 1);
                    }

                    // Allow for line wrapping with commas and other things
                    var prev = list[list.length - 2];
                    if (NO_BLOCK.indexOf(prev.id) === -1) {

                        indentStack.push(indentBy);

                        // Insert new block
                        var subBlock = new Block(block);
                        subBlock.token = token;

                        insertBlockStart(block, subBlock, token);

                        block.childs.push(subBlock);
                        block = subBlock;

                    }

                // End of an existing one
                } else if (indentBy < 0 && token.nol === 0) {

                    var outdent = Math.abs(indentBy),
                        lastIndent = indentStack[indentStack.length - 1];

                    // Detect unaligned outdents
                    if (outdent % lastIndent) {
                        throw new ParseError('Unaligned indentation of ' + outdent, line, col);
                    }

                    // Remove indentation levels from stack
                    while(outdent > 0) {

                        lastIndent = indentStack.pop();

                        if (lastIndent === undefined) {
                            throw new ParseError('Unaligned indentation of ' + outdent, line, col);
                        }

                        outdent -= lastIndent;

                        // go up to parent block
                        insertBlockEnd(block);
                        block = block.parent;

                    }

                }

            }

            token.level = block.level;

        }

        // Advance cursor by the length of the matched token
        var len = 1;
        if (m) {
            len = m[0].length;
        }

        cursor += len;
        col += len;

    }

    // Close any blocks which are not closed yet
    do {
        insertBlockEnd(block, true);

    } while((block = block.parent));

    // Convert newlines to EOL and filter the ones which do not end a statement
    for(var i = 0, l = list.length; i < l; i++) {

        var tok = list[i],
            next = list[i + 1];

        // DROP stuff infront of ] } )
        if (tok.id === 'CONTINUE_LINE') {
            list.splice(i, 1);
            l--;
            i--;

        } else if (tok.id === 'NEWLINE') {

            // Check if we should skip this for easier AST building
            if (next && SKIP_EOL.indexOf(next.id) !== -1) {
                list.splice(i, 1);
                l--;
                i--;

            } else {
                tok.id = 'EOL';
                tok.value = '<EOL>';
            }

        }

        // Move comment tokens to start of line
        // so parsing is easier later on
        // TODO clean up
        tok = list[i];
        if (tok.id === 'COMMENT') {

            if (tok.nol !== 0) {

                var e = i - 1;
                while(list[e].nol !== 0) {
                    list[e].nol += 1;
                    e--;
                }

                list[e].nol += 1;

                tok.nol = 0;

                list.splice(i, 1);
                list.splice(e, 0, tok);

            }

        }

    }

    return list;

}

exports.parse = parse;

