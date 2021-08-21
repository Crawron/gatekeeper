export type MaybePromise<T> = Promise<T> | T

export type MaybeArray<T> = T | T[]

export type NonEmptyArray<T> = [T, ...T[]]

export type ValueOf<T> = T extends readonly unknown[] ? T[number] : T

export type Falsy = false | 0 | "" | null | undefined

export type OptionalKeys<
  Target extends Record<string, unknown>,
  Keys extends keyof Target,
> = Omit<Target, Keys> & Partial<Pick<Target, Keys>>

export type Primitive = string | number | boolean | undefined | null

export type UnknownRecord = Record<string, unknown>