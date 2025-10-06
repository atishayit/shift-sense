import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private reflector: Reflector = new Reflector()) {}

  private isMutation(method: string) {
    return ['POST','PUT','PATCH','DELETE'].includes(method.toUpperCase());
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (!this.isMutation(req.method)) return true; // read routes are open

    const key = req.headers['x-api-key'] as string | undefined;
    const expected = process.env.API_KEY;
    return !!expected && key === expected;
  }
}
