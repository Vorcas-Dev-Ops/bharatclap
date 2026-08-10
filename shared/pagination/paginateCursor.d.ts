import { Model, FilterQuery } from 'mongoose';
import { CursorOptions, StandardResponse } from './paginationTypes';
export declare function paginateCursor<T>(model: Model<T>, filter?: FilterQuery<T>, options?: CursorOptions): Promise<StandardResponse<T>>;
