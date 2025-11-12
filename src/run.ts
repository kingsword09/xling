#!/usr/bin/env node

/**
 * xling CLI entry point
 */

import { execute } from "@oclif/core";

await execute({ development: false, dir: import.meta.url });
