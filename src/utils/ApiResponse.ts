
/**
 * @deprecated — shallow util, use `import { ApiResponse, successResponse } from 'lib/http'`.
 * Previously 18 LoC standalone, imported in 6 controllers. Now re-export from src/lib/http.
 */
export { ApiResponse, successResponse, createdResponse, noContentResponse } from '../lib/http';
