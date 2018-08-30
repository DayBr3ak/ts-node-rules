import { RuleEngineRule, Deps } from './rule-engine'

export interface ApiContext<T> {
  rules: Array<RuleEngineRule<T>>
  matchPath: string[]
  session: T
  deps: Deps
  complete: boolean
}

const nextTick = () => new Promise(r => setImmediate(r))

export class Api<T> {
  public static async FnRuleLoop<T>(
    x: number,
    context: ApiContext<T>
  ): Promise<T> {
    if (x < context.rules.length && context.complete === false) {
      const API = new Api<T>(context, x)
      const outcome = await context.rules[x].condition(
        API,
        context.session,
        context.deps
      )
      return API.when(outcome)
    } else {
      await nextTick()
      return context.session
    }
  }

  public readonly NEXT = '@next'
  public readonly STOP = '@next'
  public readonly RESTART = '@next'

  constructor(private context: ApiContext<T>, private x: number) {}

  private restart(): Promise<T> {
    return Api.FnRuleLoop(0, this.context)
  }

  private stop(): Promise<T> {
    this.context.complete = true
    return Api.FnRuleLoop(0, this.context)
  }

  private async next(): Promise<T> {
    await nextTick()
    return Api.FnRuleLoop(this.x + 1, this.context)
  }

  private rule(x?: number): RuleEngineRule<T> {
    return this.context.rules[typeof x === 'undefined' ? this.x : x]
  }

  private async when(outcome: boolean): Promise<T> {
    const x = this.x
    if (outcome) {
      const rule = this.rule(x)
      const consequence = rule.consequence
      const ruleRef = rule.id || 'index_' + x
      await nextTick()
      this.context.matchPath.push(ruleRef)
      const res = await consequence(
        this,
        this.context.session,
        this.context.deps
      )
      switch (res) {
        case this.STOP:
          return this.stop()
        case this.RESTART:
          return this.restart()
        default:
          return this.next()
      }
    } else {
      await nextTick()
      return this.next()
    }
  }
}
