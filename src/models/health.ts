export type Health = {
  status: string
  version: string
  details: {
    [k: string]: {
      status: string
      detail: Record<string, unknown> | null
    }
  }
}
