// Lists need to validate all sub types
// maps needs to validate all sub types
// hashes need to validate all keys to be compatible?

var operatorTable = {

    'MUL': {
        'int': 'int',
        'int': 'float',
        'float': 'int'
        'float': 'float',
        'list': 'int';
        'string': 'int'
    },

    'PLUS': {
        'int': 'int',
        'int': 'float',
        'float': 'int'
        'float': 'float',
        'list': 'list';
        'string': 'string',
        'map': 'map'
    },

    'MINUS': {
        'int': 'int',
        'int': 'float',
        'float': 'int'
        'float': 'float',
        'list': 'list';
        'string': 'string',
        'map': 'map'
    },

    'DIV': {
        'int': 'int',
        'int': 'float',
        'float': 'int'
        'float': 'float'
    },

    'POW': {
        'int': 'int',
        'int': 'float',
        'float': 'int'
        'float': 'float'
    },

    'DIV_INT': {
        'int': 'int',
        'int': 'float',
        'float': 'int'
        'float': 'float'
    },

    'DECREMENT': ['int', 'float'],

    'MOD': {
        'int': 'int'
    },

    'LT': {
        'int': 'int',
        'int': 'float',
        'float': 'int',
        'float': 'float',
        'list': 'list' // TODO checks length?
    },

    // TODO more complicated due to maps and hashes
    'IN': {
        '<type>': 'list', // depends on list type
        'string': 'hash' // checks for key in hash
    }

};


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
