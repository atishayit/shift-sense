import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { API_KEY_PROTECTED } from './api-key.decorator';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(ctx: ExecutionContext): boolean {
        // Only enforce when the handler/class is marked
        const required = this.reflector.getAllAndOverride<boolean>(API_KEY_PROTECTED, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (!required) return true;

        const req = ctx.switchToHttp().getRequest();
        const header = (req.headers['x-api-key'] ?? req.headers['X-API-Key']) as string | undefined;
        const ok = header && process.env.API_KEY && header === process.env.API_KEY;
        if (!ok) throw new UnauthorizedException('Invalid or missing x-api-key');
        return true;
    }
}
