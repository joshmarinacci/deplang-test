export default class Observable {
    constructor(name, value) {
        this.name = name
        this.value = value
        this.listeners = []
        this.dependencies = []
        this.dirty = true
        this.invalid = false
    }
    dependsOn() {
        const args = Array.prototype.slice.apply(arguments)
        args.forEach((arg)=>{
            arg.listeners.push(this)
            this.dependencies.push(arg)
        })
    }

    clearDeps() {
        this.dependencies.forEach((arg)=>{
            arg.listeners = arg.listeners.filter(n => n !== this)
        })
        this.dependencies = []
    }

    isDirty() {
        return this.dirty
    }
    isInvalid() {
        return this.invalid
    }
    evaluate() {
        // if(this.invalid) {
        //     console.log("WARNING. Invalid!",this)
        // }
        if(typeof this.value === 'function') {
            const params = this.dependencies.map((o)=>o.evaluate())
            if(params.find(p=>p instanceof Error)) {
                console.log("a dep is an error")
                this.invalid = true
                return new Error("invalid")
            }
            const val = this.value.apply(null,params)
            this.dirty = false
            this.invalid = false
            return val
        }

        const params = this.dependencies.map((o)=>o.evaluate())
        if(params.find(p=>p instanceof Error)) {
            console.log("a dep is an error")
            this.invalid = true
            return new Error("invalid")
        }
        this.dirty = false
        this.invalid = false
        return this.value
    }
    update(value) {
        this.value = value
        this.markDirty()
    }
    markDirty() {
        this.dirty = true
        this.listeners.forEach(l=>l.markDirty())
    }
    dumpChain(prefix) {
        if(!prefix) prefix = ''
        console.log(prefix + this.name,'=',this.value)
        this.dependencies.forEach((d)=>d.dumpChain(prefix+'  '))
    }

    markInvalid() {
        this.invalid = true
        this.listeners.forEach(l=>l.markInvalid())
    }
}
