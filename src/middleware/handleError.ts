import { Context, Next } from 'hono'
import { AppError } from '../errors'

export const handleError = (err: Error, ctx: Context) => {
  if (err instanceof AppError) {
    // Revert to using the init object (Overload 2) as it's more standard for ResponseInit
    // Cast statusCode to 'any' to bypass the specific ContentfulStatusCode type requirement
    return ctx.json({ error: err.message }, { status: err.statusCode as any })
  }
  console.error('Unhandled error:', err)
  // Apply the same pattern for consistency
  return ctx.json({ error: 'Internal server error' }, { status: 500 })
}
