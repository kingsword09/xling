#!/usr/bin/env node

/**
 * xling CLI 入口点
 */

import { execute } from '@oclif/core';

await execute({ development: false, dir: import.meta.url });
