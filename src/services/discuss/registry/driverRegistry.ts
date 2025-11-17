/**
 * Driver Registry
 * Implements registry pattern to avoid hardcoded type switches
 */

import type { Participant, ParticipantConfig } from "@/domain/discuss/types.js";
import type { ModelRouter } from "@/services/prompt/router.js";
import type { ParticipantDriver } from "@/domain/discuss/types.js";

export interface DriverConstructor {
  new(participant: Participant, deps: { router: ModelRouter }): ParticipantDriver;
}

export class DriverRegistry {
  private static drivers = new Map<string, DriverConstructor>();

  /**
   * Register a new driver type
   */
  static register(type: string, constructor: DriverConstructor): void {
    this.drivers.set(type, constructor);
  }

  /**
   * Create a driver instance for a participant
   */
  static create(participant: Participant, router: ModelRouter): ParticipantDriver {
    const Constructor = this.drivers.get(participant.type);

    if (!Constructor) {
      const availableTypes = Array.from(this.drivers.keys()).join(', ');
      throw new Error(
        `Unknown participant type: ${participant.type}. Available types: ${availableTypes}`
      );
    }

    return new Constructor(participant, { router });
  }

  /**
   * Get list of registered driver types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(this.drivers.keys());
  }

  /**
   * Check if a driver type is registered
   */
  static isRegistered(type: string): boolean {
    return this.drivers.has(type);
  }
}
