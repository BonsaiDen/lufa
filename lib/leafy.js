/*
Leafy - Powerful yet small templating.

Copyright (c) 2011 Ivo Wetzel.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

function lf(string) {

    function wrap(group, multi) {

        return function(value) {

            key = group.length;
            if (multi) {

                for(i = 0, l = value.length,
                    key = l < key ? l : key; i < key;) {

                    at(group[i], value[i++]);
                }

            } else {

                for(i = 0; i < key;) {
                    at(group[i++], value);
                }

            }

            return tpl;

        };

    }

    // Here be dragons... tiny little ones ^.^"
    for(

    // helper variables, they are re-used all over the place,
    // but one has to watch out that they are used side effect free
    var i, l, gl, e, key,

        // our actual data arrays / object
        words = [],
        indexes = [],
        indexLength = 0,
        groups = {},

        // our crazy match expression
        matchExp = /([^\\]|^)(\{([^\{\}]+[^\\\}]|[^\{\\\}]|)\})/g,

        // undef is a short reference to undefined
        // it is only used during initial parsing
        undef,

        // replace a given index, having it as a variable reduces the size
        // of a of the tpl.at calls
        at = function(o, value) {

            // uses: e, gl, undef

            // use gl here because l and others are
            // used for looping and stuff
            o = indexes[o < 0 ? indexLength + o : o];
            if ((gl = o[2])) {

                for(e = 0; undef = gl[e++];) {
                    value = value[undef];
                }

            }

            words[o[0]] = value;

            return tpl;

        },

        tpl = {

            at: at,

            // Object mapping
            map: function(obj) {

                // uses: l, i

                l = obj.length;
                if (+l === l) {
                    for(i = 0; i < l;) {
                        at(i, obj[i++]);
                    }

                } else {

                    for(i in obj) {
                        if (tpl[i]) {
                            tpl[i](obj[i]);
                        }
                    }

                }

                return tpl;

            },

            // For each
            each: function(callback) {

                // uses: i, gl

                for(i = 0; i < indexLength;) {
                    gl = indexes[i++];
                    words[gl[0]] = callback(i, gl[1], gl[2]);
                }

                return tpl;

            },

            // Conversion
            toString: function() {
                return words.join('');
            }

        }

    // if condition of the for loop
    ;
        // Add words and placeholders to the list
        words.push(

            // add the word
            string.substring(matchExp.lastIndex,

                // Figure out the end of the word
                (key = matchExp.exec(string)) ? (key.index + !!key[1])

                // make sure that we replace escape {}
                // also get rid of the template string on the last iteration
                // we actually care about memory leaks in this world of closures...
                : (string = undef)).replace(/\\(\{|\})/g, '$1'),

                    // the placeholder
                    key && key[2]), key // if !key exit

    ;) {

        // uses: i, e, key, gl, l, undef

        // Match accesors
        if (/\.|\[/.test((e = key = key[3]))) {

            // re-define the regex (reset the lastIndex this way) and
            // also match the first element as the key
            for(

                key = (l = /\.?([^\.\[]+)|\[(\d+|('|")(|.*?[^\\])\3)\]/g).exec(e)[1],
                i = [];

                // extract [0] .foo ['test'] etc.
                gl = l.exec(e);
                i.push(gl[4] != undef ? gl[4]
                        : (gl[2] != undef ? +gl[2] : gl[1]))

            );

        }

        // create a new group and add the functions
        if (!tpl[key]) {

            tpl[key] = wrap(gl = groups[key] = []);
            tpl[key + 's'] = wrap(gl, 1);

        }

        // Push indexes and stuff into the indexes thing
        indexes.push([indexLength * 2 + 1, key, i]);
        groups[key].push(indexLength++);

    }

    return tpl;

}

module.exports = lf;

