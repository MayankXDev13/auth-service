/**
 * @deprecated — shallow util, use `import { asyncHandler } from 'lib/http'`.
 * Previously 15 LoC indirection, imported in 6 controllers. Now re-export from src/lib/http.
 */
export { asyncHandler } from '../lib/http';