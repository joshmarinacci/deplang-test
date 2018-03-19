import ohm  from 'ohm-js'

export const toAST = function (src) {

    const grammar = ohm.grammar(`
        BasicSyntax {
            Block = Statement+
            Statement = Expr ("=>" Expr)*
            Expr = FunCall | String | Number | identifier
            Parameter = identifier ":" Expr
            identifier = letter (letter|digit)*
            String = "'" (~"'" any)* "'"
            Number = digit+
            FunCall = identifier "(" Arguments ")"
            Arguments = ListOf<Parameter, ",">
        }
    `)

    console.log('converting',src)
    const match = grammar.match(src)
    console.log('match is',match.succeeded())
    const sem = grammar.createSemantics().addOperation('toAST', {
        Number: (a) => { return { type:'literal', value:parseInt(a.sourceString,10) } },
        String: (_q1,str,_q2)  => { return { type:'literal', value:str.sourceString} },
        identifier: function(str, rest) { return { type:'identifier', value: this.sourceString }},
        Arguments: (a) => a.asIteration().toAST(),
        Statement: function(first, _, rest) {
            const chs = [first.toAST()].concat(rest.toAST())
            return {
                type:'statement',
                parts:chs,
            }
        },
        Parameter: (id, _, expr) => ({ type:'parameter', name:id.sourceString, value:expr.toAST() }),
        FunCall: function(id, op, params, cp) {
            return {
                type:'funcall',
                id:id.toAST(),
                params:params.toAST()
            }
        },
        Block: function(statements) {
            return {
                type:'block',
                statements: statements.toAST()
            }
        }
    })
    const ret = sem(match).toAST()
    return ret
}

