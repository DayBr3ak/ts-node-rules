import clonedeep from 'lodash.clonedeep'
import { ApiContext, Api } from './rule-engine-api'

export type RuleEngineCallback<T, R> = (
  R: Api<T>,
  fact: T,
  deps: Deps
) => Promise<R> | R

export interface RuleEngineRule<T> {
  priority?: number
  on?: boolean
  id?: string
  consequence: RuleEngineCallback<T, any>
  condition: RuleEngineCallback<T, boolean>
}

export interface Deps {
  [key: string]: (...args: any[]) => any | Promise<any>
}

export interface RuleEngineOptions {
  readonly deps: Deps
}

const defaults: RuleEngineOptions = {
  deps: {}
}

const RULE_DEFAULTS = {
  priority: 1,
  on: true
}

export class RuleEngine<T> {
  private activeRules: Array<RuleEngineRule<T>> = []
  private options: RuleEngineOptions

  constructor(
    private rules: Array<RuleEngineRule<T>> = [],
    options?: RuleEngineOptions
  ) {
    this.options = { ...defaults, ...options }
    if (rules.length) {
      this.register(rules)
    }
  }

  public register(rules: Array<RuleEngineRule<T>>): RuleEngine<T> {
    const r: Array<RuleEngineRule<T>> = rules.map(x => ({
      ...RULE_DEFAULTS,
      ...x
    }))
    this.rules.push(...r)
    this.sync()
    return this
  }

  public sync(): RuleEngine<T> {
    const prioritySorter = (a: RuleEngineRule<T>, b: RuleEngineRule<T>) =>
      b.priority! - a.priority!
    const ruleFilter = (a: RuleEngineRule<T>) => a.on
    this.activeRules = this.rules.filter(ruleFilter)
    this.activeRules.sort(prioritySorter)
    return this
  }

  public async execute(fact: T): Promise<{ result: T; matchPath: string[] }> {
    const context: ApiContext<T> = {
      matchPath: [],
      deps: this.options.deps || {},
      complete: false,
      session: clonedeep(fact),
      rules: this.activeRules
    }

    const result = await Api.FnRuleLoop(0, context)
    return { result, matchPath: context.matchPath }
  }

  public addDeps(moduleName: string, module: any): RuleEngine<T> {
    this.options.deps[moduleName] = module
    return this
  }
}

// function RuleEngine(rules, options) {
//   Object.assign(this, clonedeep(defaults), options)

//   this.init()
//   if (typeof rules != 'undefined') {
//     this.register(rules)
//   }
//   return this
// }

// RuleEngine.prototype.init = function(rules) {
//   this.rules = []
//   this.activeRules = []
//   return this
// }

// const RULE_DEFAULTS = {
//   priority: 1
// }

// RuleEngine.prototype.register = function(rules) {
//   let rulz = []
//   if (Array.isArray(rules)) {
//     rulz = rules
//   } else if (rules !== null && typeof rules == 'object') {
//     rulz = [rules]
//   }

//   rulz = rulz.map(x => Object.assign({}, RULE_DEFAULTS, x))
//   this.rules.push(...rulz)
//   this.sync()
//   return this
// }

// const prioritySorter = (a, b) => b.priority - a.priority
// const ruleFilter = a => {
//   if (typeof a.on === 'undefined') {
//     a.on = true
//   }
//   if (a.on === true) {
//     return a
//   }
// }

// RuleEngine.prototype.sync = function() {
//   this.activeRules = this.rules.filter(ruleFilter)
//   this.activeRules.sort(prioritySorter)
//   return this
// }

// // const nextTick = () => new Promise(r => process.nextTick(r))
// const nextTick = () => new Promise(r => setImmediate(r))

// RuleEngine.prototype.execute = async function(fact) {
//   const matchPath = []
//   const deps = this.deps

//   let complete = false
//   let session = clonedeep(fact)
//   let _rules = this.activeRules

//   class Api {
//     constructor(x) {
//       this.x = x
//       this.transitionCalled = false
//     }

//     rule() {
//       return _rules[this.x]
//     }

//     async when(outcome) {
//       const x = this.x
//       if (outcome) {
//         const _consequence = _rules[x].consequence
//         _consequence.ruleRef = _rules[x].id || _rules[x].name || 'index_' + x
//         await nextTick()
//         matchPath.push(_consequence.ruleRef)
//         this.transitionCalled = false
//         const res = await _consequence.call(null, this, session, deps)
//         if (this.transitionCalled) {
//           return res
//         }
//         console.log(
//           `rules:: Warning, R.next or R.stop was not called in rule ${
//             _consequence.ruleRef
//           }, default to R.next`
//         )
//         return await this.next()
//       } else {
//         await nextTick()
//         return await this.next()
//       }
//     }

//     restart(nextState = session) {
//       session = nextState
//       this.transitionCalled = true
//       return FnRuleLoop(0)
//     }

//     stop(nextState = session) {
//       session = nextState
//       this.transitionCalled = true
//       complete = true
//       return FnRuleLoop(0)
//     }

//     async next(nextState = session) {
//       session = nextState
//       this.transitionCalled = true
//       await nextTick()
//       return await FnRuleLoop(this.x + 1)
//     }
//   }

//   const FnRuleLoop = async x => {
//     if (x < _rules.length && complete === false) {
//       const API = new Api(x)
//       return await _rules[x].condition.call(null, API, session, deps)
//     } else {
//       await nextTick()
//       session.matchPath = matchPath
//       return session
//     }
//   }

//   return await FnRuleLoop(0)
// }

// RuleEngine.prototype.findRules = function(filter) {
//   if (typeof filter === 'undefined') {
//     return this.rules
//   } else {
//     const find = matches(filter)
//     return filterd(this.rules, find)
//   }
// }

// RuleEngine.prototype.turn = function(state, filter) {
//   state = state === 'on' || state === 'ON' ? true : false
//   const rules = this.findRules(filter)
//   for (let i = 0, j = rules.length; i < j; i++) {
//     rules[i].on = state
//   }
//   this.sync()
//   return this
// }

// RuleEngine.prototype.prioritize = function(priority, filter) {
//   priority = parseInt(priority, 10)
//   var rules = this.findRules(filter)
//   for (var i = 0, j = rules.length; i < j; i++) {
//     rules[i].priority = priority
//   }
//   this.sync()
//   return this
// }

// RuleEngine.prototype.toJSON = function() {
//   var rules = this.rules
//   if (rules instanceof Array) {
//     rules = rules.map(function(rule) {
//       rule.condition = rule.condition.toString()
//       rule.consequence = rule.consequence.toString()
//       return rule
//     })
//   } else if (typeof rules != 'undefined') {
//     rules.condition = rules.condition.toString()
//     rules.consequence = rules.consequence.toString()
//   }
//   return rules
// }

// function makeRules(rules) {
//   const require = undefined
//   const process = undefined
//   return rules.map(rule => {
//     rule.condition = eval('(' + rule.condition + ')')
//     rule.consequence = eval('(' + rule.consequence + ')')
//     return rule
//   })
// }

// RuleEngine.prototype.fromJSON = function(rules) {
//   this.init()
//   if (typeof rules == 'string') {
//     rules = JSON.parse(rules)
//   }
//   if (rules !== null && typeof rules == 'object') {
//     rules = [rules]
//   }
//   if (!rules instanceof Array) {
//     throw new Error('rules must be either an object or an array of objects')
//   }
//   this.register(makeRules(rules))
//   return this
// }

// RuleEngine.prototype.addDeps = function(moduleName, module) {
//   this.deps[moduleName] = module
//   return this
// }

// export default RuleEngine
