export default class Graph {
    constructor() {
        this.objs = {}
        this.SYMBOLS = {}
        this.count = 0
    }
    makeInteractive(name,value) { return this.makeLiteral(name,value)  }
    genID(prefix) { return prefix + Math.floor(Math.random() * 10000) }

    makeObj(obj) {
        obj.id = this.genID(obj.type)
        obj.inputs = {}
        obj.graph = this
        this.objs[obj.id] = obj
        this.count++
        return obj
    }
    makeLiteral(name,value) {   return this.makeObj({ name:name, type:'literal',   value:value, }) }
    makeSymbolReference(name) { return this.makeObj({ name:name, type:'symbolref', value:name   }) }
    makeExpression(name) {      return this.makeObj({ name:name, type:'expression'              }) }
    makeAssignment(name) {      return this.makeObj({ name:name, type:'assignment'              }) }

    add(src,dst,name) { dst.inputs[name] = src  }
    setFunction(obj,fun) {  obj.fun = fun }
    setValue(obj,value) { obj.value = value  }
    findByName(name) {  return Object.values(this.objs).find((obj)=>obj.name === name)  }

    dump() {
        console.log("=== object graph dump ===")
        Object.keys(this.objs).forEach((id)=>{
            const obj = this.objs[id]
            if(obj.type === 'literal')
                return console.log(`Literal:: ${obj.name} is ${obj.value}`)
            if(obj.type === 'symbolref') {
                return console.log(`Symbol ref::${obj.name}`)
            }
            const outp = Object.keys(obj.inputs).map((key)=>{
                const val = obj.inputs[key]
                let str = val.toString()
                if(val.type === 'literal') str = val.value
                if(val.type === 'symbolref') str = '@' + val.name
                if(val.type === 'expression') str = '$' + val.name
                return key + " : " + str
            })
            console.log(`Object:: ${obj.name} (${outp.join(", ")})`)
        })
        console.log("=== ===")
    }


    getObjectCount() {
        return this.count
    }
}
