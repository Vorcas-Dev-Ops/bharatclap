import { Model, FilterQuery } from 'mongoose';
import { OffsetOptions, StandardResponse } from './paginationTypes';
export declare function paginateOffset<T>(model: Model<T>, filter?: FilterQuery<T>, options?: OffsetOptions): Promise<StandardResponse<T>>;
