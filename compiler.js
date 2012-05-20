
function Scope(parent, body, base) {
    this.__base = base || null;
    this.__parent = parent || null;

    // This includes class members and methods
    this.__members = {};

    // All other functions and variables
    // these are the result of declarations and paramters
    this.__names = {};

    this.parse(body);

}

// TODO validate use of possible uniniliazed values
// TODO check for assignments on const vars
Scope.prototype = {

    parse: function(body) {

        for(var i = 0, l = body.length; i < l; i++) {

            var exp = body[i];
            if (exp.arity === 'declaration') {

                if (exp.id === 'FUNCTION') {
                    // create sub scope for this function

                } else if (exp.id === 'CLASS') {
                    // create sub scope for this class
                    new Scope(this, exp); // TODO ???

                // Just define a name
                } else {

                }

            }

        }

    },


};


// TODO
//
// TODO
// There are two ways to parse this:
//
//  top down first, so for each scope go in each sub scope and resolve the things in there
//
//  or level first, so for each scope figure out all new scopes and parse them after all scopes on the current level have been finished
//
// TODO also try to build the data in here in a way that the code-gen can use without doing another run over it
function FunctionScope(exp) {

    // Go through all params and define them as names
    // TODO disallow non primitives in expressions here? So only literals are valid and names are not?

    // Go through body and parse statements


}

function ClassScope(exp) {

    // Go through all members and define them as members


    // Go through all methods and define them as members


}

ClassScope.prototype = {

    defineMember: function(member) {

        if (this.__members.hasOwnProperty(member.value)) {
            this.error(this.__members[member.value], 'Member with name "' + member.value + '" already defined in current class.');

        } else {
            this.__members[name.value] = name;
        }

    },

    resolveMember: function(member) {

        // Go up until we find a parent scope that defines a base
        if (!this.__base) {

            if (this.__parent) {
                return this.__parent.resolveMember(member);

            } else {
                this.error(member, 'Access of member "%t" in non-class construct.');
            }

        // If we end up here, we should have a base and members
        } if (this.__members.hasOwnProperty(member.value)) {
            return this.members[member.value];

        // TODO go up through parent classes later in a later compile step
        } else {
            this.error(member, 'Member "%t" not found in class "' + this.__base.name + '".');
        }

    }

};

function BaseScope(base, statements) {
    // The base this scope belongs too, either the top level scope of a module or the class scope inside a class
    // TODO this is used to resolve stuff???
    this.__base = base;
}

BaseScope.prototype = {

    parseStatements: function(statements) {

        for(var i = 0, l = body.length; i < l; i++) {

            var exp = body[i];
            if (exp.arity === 'declaration') {

                if (exp.id === 'FUNCTION') {
                    // create sub scope for this function

                } else if (exp.id === 'CLASS') {
                    // create sub scope for this class
                    new Scope(this, exp); // TODO ???

                // Just define a name
                } else {

                }

            }

        }

    },

    handle_ASSIGN: function(exp) {

    },

    handle_FUNCTION: function(exp) {
        // define the .name in this scope
        // create a new FunctionScope
    },

    handle_CLASS: function(exp) {

    },

    defineName: function(name) {

        if (this.__names.hasOwnProperty(name.value)) {
            // TODO show both locations? Or just previous defintion?
            this.error(name, 'Variable with name "' + name.value + '" already defined in current scope.');

        } else {
            this.__names[name.value] = name;
        }

    },

    resolveName: function(name) {

        if (this.__names.hasOwnProperty(name.value)) {
            return this.__names[name.value];

        } else if (this.__parent) {
            return this.__parent.resolveName(name);

        } else {
            this.error(name, 'Access of undefined variable "%t".');
        }

    },

    error: function(token, msg) {

        if (typeof token === 'string') {
            msg = token;
            token = this.__currentToken;
        }

        msg = msg || 'Undefined %t';
        msg = 'CompileError: ' + msg + ' at line ' +  token.line + ', col ' + token.col;

        throw new Error(msg.replace('%t', token.value));

    }

};



// Compiler thing -------------------------------------------------------------
// ----------------------------------------------------------------------------
function Compiler(ast) {
    this.__ast = ast;
    this.__scope = new Scope(null);
}

Compiler.prototype = {


};






// Lists need to validate all sub types
// maps needs to validate all sub types
// hashes need to validate all keys to be compatible?
var binaryOperatorTable = {

    'EQ': [
        ['int', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'NE': [
        ['int', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'LTE': [
        ['int', 'int', 'boolean'],
        ['int', 'float', 'boolean'],
        ['float', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'LT': [
        ['int', 'int', 'boolean'],
        ['int', 'float', 'boolean'],
        ['float', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'GTE': [
        ['int', 'int', 'boolean'],
        ['int', 'float', 'boolean'],
        ['float', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'GT': [
        ['int', 'int', 'boolean'],
        ['int', 'float', 'boolean'],
        ['float', 'int', 'boolean'],
        ['float', 'float', 'boolean'],
        ['string', 'string', 'boolean']
    ],

    'PLUS': [
        ['int', 'int', 'int'],
        ['int', 'float', 'float'],
        ['float', 'int', 'float'],
        ['float', 'float', 'float'],
        ['string', 'string', 'string']
    ],

    'MINUS': [
        ['int', 'int', 'int'],
        ['int', 'float', 'float'],
        ['float', 'int', 'float'],
        ['float', 'float', 'float']
    ],

    'EXP': [
        ['int', 'int', 'int'],
        ['int', 'float', 'float'],
        ['float', 'int', 'float'],
        ['float', 'float', 'float']
    ],

    'MUL': [
        ['int', 'int', 'int'],
        ['int', 'float', 'float'],
        ['float', 'int', 'float'],
        ['float', 'float', 'float'],
        ['string', 'int', 'string']
    ],

    'DIV_INT': [
        ['int', 'int', 'int'],
        ['int', 'float', 'int'],
        ['float', 'int', 'int'],
        ['float', 'float', 'int']
    ],

    'DIV': [
        ['int', 'int', 'int'],
        ['int', 'float', 'float'],
        ['float', 'int', 'float'],
        ['float', 'float', 'float']
    ],

    'MOD': [
        ['int', 'int', 'int']
    ],

    'BIT_AND': [
        ['int', 'int', 'int']
    ],

    'BIT_OR': [
        ['int', 'int', 'int']
    ],

    'BIT_XOR': [
        ['int', 'int', 'int']
    ],

    'AND': [
        ['boolean', 'boolean', 'boolean']
    ]

};

// The first entry is the left side, the second one the resultant type of the expression
var unaryOperatorTable = {

    'BIT_NOT': [
        ['int', 'int']
    ],

    'NOT': [
        ['boolean', 'boolean']
    ],

    'PLUS': [
        ['int', 'int'],
        ['float', 'float']
    ],

    'MINUS': [
        ['int', 'int'],
        ['float', 'float']
    ],

    'DECREMENT': [
        ['int', 'int'],
        ['float', 'float']
    ],

    'INCREMENT': [
        ['int', 'int'],
        ['float', 'float']
    ],

    // Left is the expression to be cast, right the cast (type)
    'CAST': [
        ['int', 'string'],
        ['int', 'float'],
        ['float', 'string'],
        ['float', 'int'],
        ['string', 'int'],
        ['string', 'float']
    ]

};


// Type class, needed, otherwise this will become a giant mess.
function Type() {


}

// This compares types
function compareType(a, b) {

    // Simple case
    if (typeof a === 'string' && typeof b === 'string') {

    // Function types and sub types
    } else if (typeof a === 'object' && typeof b === 'object') {

    } else {
        return 'Error: Incompatible types';
    }

}

function resolveBinary(op, a, b) {

    var types = binaryOperatorTable[op];
    for(var i = 0, l = types.length; i < l; i++) {
        if (types[0] === a && types[1] === b) {
            return types[2];
        }
    }

    // throw here
    return null;

}

function resolveUnary(op, a) {

    var types = unaryOperatorTable[op];
    for(var i = 0, l = types.length; i < l; i++) {
        if (types[0] === a) {
            return types[1];
        }
    }

    // throw here
    return null;


}

// TODO really complicated stuff will be the resolving of class methods
function resolveType(exp) {

    // TODO the compiler will also need to support branching prediction to a certain level...
    // but most of these issues should be resolved by the hard scoping and typing
    var leftType, rightType, result, indexType, startType, endType, stepType;

    // Plain literals
    if (exp.arity === 'literal') {

        // In case of plain stuff return the id
        if (exp.id !== 'IDENTIFIER') {
            return exp.id.toLowerCase();

        // In case of DOT accessors we need to do some more magic
        } else {

        }

    // Names
    } else if (exp.arity === 'name') {

        // this might return an object, since function types are more complex...
        return scope.resolveName(exp.value).type;

    // Operators
    } else if (exp.arity === 'binary') {

        leftType = resolveType(exp.left);
        rightType = resolveType(exp.right);

        var op = exp.id;
        if (exp.id === 'ASSIGN') {
            op = exp.value;
        }

        // Ok, time to figure out the sub type of left
        if (exp.id === 'INDEX') {

            // then we see whether the expression of inner, can be used to index LEFT
            // in case of a string this is easy (integers)
            // for maps we check the type
            // for lists this is also relatively easy (guess what: integers again)
            indexType = resolveType(exp.inner);

        // TODO all of these need to be integers
        } else if (exp.id === 'RANGE') {

            // TODO check for sliceability of left


            // TODO also NOTE: inner may have up to 3 entries
            // so in case of map reverse lookups we want to check against those

            // Check first inner, the start of a range OR the index
            // also, che
            if (exp.inner[0]) {
                startType = resolveType(exp.inner[0]);
            }

            if (exp.inner[1]) {
                stepType = resolveType(exp.inner[1]);
            }

            // The third inner is the step, this also needs support
            if (exp.inner[2]) {
                endType = resolveType(exp.inner[2]);
            }

        } else if (exp.id === 'DOT') {

            if (!leftType.contains(rightType)) {
                // TODO throw error about right being not a member of left
            }

            return; // TODO return the new subtype of the DOT expression so b in case of a.b

            // TODO check if right is contained in left

            // TODO grab the left side and resolve the VARIABLE name and type
            // then grab the right and figure out if it exists in left

        // Normal operations
        } else {
            // Look up table to figure out if this will work
            result = resolveBinary(op, leftType, rightType);
        }

        return result;

    // Unaries
    } else if (exp.arity === 'unary') {

        if (exp.id === 'MEMBER') {

            scope.resolveMember(exp.left); // TODO figure out how to make it work...

            // TODO resolve left side first then return that type

            // TODO we also need to look up against the currents class members
            // instead of looking for the normal variable

        } else {

            leftType = resolveType(exp.left);
            result = resolveBinary(exp.id, leftType);
            return result;

        }

    }

}




/*
build scopes
    build names
    build hashes and classes

    verify assignments
        verify expressions
            verify ops
                verify types / names / returns

    verify variables

    verfiy expressions

    verify calls
        verify functions / overload / modifiers / params (defaults)


check expression

    each token:

        if inner:
            recurse check each inner expression

        if operator:
            check types

        if expression:
            resolve type

            check expression

        else:
            check token inner

    check operator


        check token
            resolve type
            custom check


1 + 2

plus:
    left type = int
    right type = int
*/
