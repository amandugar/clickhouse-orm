export type BaseColumn<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  name: Extract<keyof T, string>
  /**
   * Optional expression makes it a materialized column when present
   */
  expression?: string
}
