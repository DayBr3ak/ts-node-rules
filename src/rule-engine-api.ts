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

  constructor(private context: ApiContext<T>, private x: number) {}

  public restart(): Promise<T> {
    return Api.FnRuleLoop(0, this.context)
  }

  public stop(): Promise<T> {
    this.context.complete = true
    return Api.FnRuleLoop(0, this.context)
  }

  /**
   * Use when as a return value
   *
   * ### Example
   * ```js
   * return R.when(someCondition === true);
   * ```
   * @param outcome the condition for the rule to be ran
   * @returns       a Promise used internally by the engine
   */
  private async next(nextState: T = this.context.session): Promise<T> {
    this.context.session = nextState
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
      return res
    } else {
      await nextTick()
      return this.next()
    }
  }
}
