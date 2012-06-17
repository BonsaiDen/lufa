- post increment and decrement operators
- list / map sub type count validation
- unify parameter / argument naming
- '4 in 1...10'
    - support BOOLEAN in operator
- resolve user types and hashes as well as maps...
- ADD BASE CLASS TO result of typeFromNode()

    so {
        id: 'boolean',
        clas: {
            members: {
                ...
            },

            ...
        }
    }

- TODO howto casts lists?
    - support casts on sub types(requires parser additions)
    - casts on lists should change the inner type

- add mixed type? 
- Handle null
- resolve index and ranges and their returns

    - if their op is const also validate the range
    - since const map / lists CANNOT be changed

- fix list comprehensions errors about references being used before they're defined
- make @ have a higher binding power than other stuff or so...
- support overloading on builtin types and operators
- binary operators need to know stuff like this and need to have custom actions happening?
- add support for inline comments # ... #

- plain out computation of constants and statics (and expressions that are plain)
- dead code detection (uncalled functions, methods, classes etc.)
- classes
- interfaces
- resolve private / protected access

- iterator comprehensions...

