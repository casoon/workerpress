/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

import type { AuthUser } from '@workerpress/core';

declare global {
  namespace App {
    interface Locals {
      cfContext: ExecutionContext;
      user?: AuthUser;
    }
  }
}
