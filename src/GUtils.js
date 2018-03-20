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


export const toGraph = function (graph, root) {
    const set = new Set()
    const ret = convertToGraph(graph, root, set)
    const branch = {
        type: 'branch',
        root: ret,
        nodes: set,
        listeners: [],
        nodeChanged: function (n) {
            this.listeners.forEach(l => l(n))
        },
        onChange: function (l) {
            this.listeners.push(l)
        }
    }
    function chg(n) {
        branch.nodeChanged(n)
    }
    graph.onChange(chg)
    return branch
}


function convertToGraph(graph, ast, set) {
    // console.log('adding the ast',ast,'to the graph',graph)
    if(ast.type === 'block') {
        const rets = ast.statements.map((a)=>convertToGraph(graph,a,set))
        return rets[rets.length-1]
    }
    if(ast.type === 'statement') {
        const rets = ast.parts.map((a)=>convertToGraph(graph,a,set))
        console.log("need to bind the statement",rets.length)
        if(rets.length >= 2) {
            for(let i=0; i<rets.length-1; i++) {
                const A = rets[i]
                const B = rets[i+1]
                console.log(`adding connection for ${A} => ${B} `)
                if(B.type === 'identifier' || B.type === 'symbolref') {
                    graph.SYMBOLS[B.value] = A
                    console.log(`setting the symbol ${B.value} to ${A}`)
                }
            }
        }
        return rets[rets.length-1]
    }
    if(ast.type === 'literal') {
        const ret = graph.makeLiteral(ast.value+"",ast.value)
        set.add(ret)
        return ret
    }
    if(ast.type === 'parameter') {
        return convertToGraph(graph,ast.value,set)
    }
    if(ast.type === 'identifier') {
        const ret = graph.makeSymbolReference(ast.value)
        set.add(ret)
        return ret
    }

    if(ast.type === 'funcall') {
        const ret = graph.makeExpression(ast.id.value)
        set.add(ret)
        ast.params.forEach((arg)=>{
            const ret2 = convertToGraph(graph,arg,set)
            graph.add(ret2,ret,arg.name)
        })
        return ret
    }
    throw new Error(`unknown AST node type: ${ast.type} `)
}

