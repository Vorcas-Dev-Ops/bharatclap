export interface DecodedCursor {
    v: any;
    id: string;
}
export declare function encodeCursor(value: any, id: string): string;
export declare function decodeAndValidateCursor(cursorToken: string): DecodedCursor;
export declare function validateOffset(page: number, limit: number): void;
