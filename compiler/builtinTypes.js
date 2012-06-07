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
var types = {

    'STRING': {

        id: 'string',
        methods: {
            'upper': {
                'params': []
            }
        },

        members: {
            'length': 'int'
        }

    },

    'BOOL': {

        id: 'bool',
        methods: {

        },

        members: {

        }

    },

    'INTEGER': {

        id: 'int',
        methods: {

        },

        members: {

        }

    },

    'FLOAT': {

        id: 'float',
        methods: {

        },

        members: {

        }

    },

    'LIST': {

        id: 'list',
        methods: {

        },

        members: {

        }

    },

    'MAP': {

        id: 'map',
        methods: {

        },

        members: {

        }

    },

    'HASH': {

        id: 'hash',
        methods: {

        },

        members: {

        }

    },

    'VOID': {
        id: 'void'
    }

};

exports.resolveFromNode = function(node) {

    if (types.hasOwnProperty(node.id)) {
        return types[node.id];

    } else {
        throw new Error('Cannot map node id to builtin type: ' + node.id);
    }

};

var builtinMap = {
    'int': 'INTEGER',
    'float': 'FLOAT',
    'string': 'STRING',
    'list': 'LIST',
    'hash': 'HASH',
    'map': 'MAP',
    'bool': 'BOOL',
    'void': 'VOID'
};

exports.resolveFromType = function(type) {
    return exports.resolveFromId(type.value);
};

exports.resolveFromId = function(id) {

    if (builtinMap.hasOwnProperty(id)) {
        if (types.hasOwnProperty(builtinMap[id])) {
            return types[builtinMap[id]];
        }
    }

    throw new Error('Cannot map type id to builtin type: ' + id);

};

