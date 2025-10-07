import { SetMetadata } from '@nestjs/common';
export const API_KEY_PROTECTED = 'api_key_protected';
export const ApiKeyProtected = () => SetMetadata(API_KEY_PROTECTED, true);
