/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

import type { AuthUser } from '@workerpress/core';

declare global {
  namespace App {
    interface Locals {
      runtime: { env: Env; ctx: ExecutionContext };
      user?: AuthUser;
    }
  }
}

export {};
