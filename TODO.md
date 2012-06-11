- post increment and decrement operators
- list / map sub type count validation
- unify parameter / argument naming
- '4 in 1...10'
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


- add mixed type
- resolve index and ranges and their returns

    - if their op is const also validate the range
    - since const map / lists CANNOT be changed

- list comprehensions need their own scope
- Parse for loop headers extra, these should all return a isList type
- validate all conditions to be interpretable as bool results, this should do implicit casts of integers and other things? and warn about those
- make @ have a higher binding power than other stuff or so...
