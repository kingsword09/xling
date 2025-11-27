/**
 * Load balancer implementation for proxy service
 */

import type {
  LoadBalanceStrategy,
  ProviderConfig,
} from "@/domain/xling/config.ts";

// Provider with apiKeys array (normalized)
interface NormalizedProvider extends ProviderConfig {
  apiKeys: string[];
}
import type {
  KeyState,
  LoadBalancer,
  ProviderState,
  ProxyError,
} from "./types.ts";

const DEFAULT_COOLDOWN_MS = 60000; // 1 minute cooldown for failed keys

export class ProxyLoadBalancer implements LoadBalancer {
  readonly strategy: LoadBalanceStrategy;
  #providerStates: Map<string, ProviderState> = new Map();
  #keyStates: Map<string, KeyState[]> = new Map();
  #roundRobinIndex = 0;
  #cooldownMs: number;

  constructor(
    strategy: LoadBalanceStrategy = "failover",
    cooldownMs: number = DEFAULT_COOLDOWN_MS,
  ) {
    this.strategy = strategy;
    this.#cooldownMs = cooldownMs;
  }

  /**
   * Initialize provider state
   */
  #initProviderState(provider: NormalizedProvider): ProviderState {
    const existing = this.#providerStates.get(provider.name);
    if (existing) return existing;

    const state: ProviderState = {
      name: provider.name,
      healthy: true,
      currentKeyIndex: 0,
      failedKeys: new Set(),
      requestCount: 0,
      errorCount: 0,
    };
    this.#providerStates.set(provider.name, state);

    // Initialize key states
    const keyStates: KeyState[] = provider.apiKeys.map((_, index) => ({
      index,
      healthy: true,
    }));
    this.#keyStates.set(provider.name, keyStates);

    return state;
  }

  /**
   * Select a provider based on the load balancing strategy
   */
  selectProvider(providers: NormalizedProvider[]): NormalizedProvider | null {
    if (providers.length === 0) return null;

    // Initialize states for all providers
    providers.forEach((p) => this.#initProviderState(p));

    // Filter healthy providers with available keys
    const healthyProviders = providers.filter((p) => {
      const state = this.#providerStates.get(p.name);
      if (!state?.healthy) return false;
      // Check if at least one key is available
      return this.#hasAvailableKey(p);
    });

    if (healthyProviders.length === 0) {
      // All providers unhealthy, try to recover the least recently failed one
      return this.#recoverProvider(providers);
    }

    switch (this.strategy) {
      case "round-robin":
        return this.#selectRoundRobin(healthyProviders);
      case "random":
        return this.#selectRandom(healthyProviders);
      case "weighted":
        return this.#selectWeighted(healthyProviders);
      case "failover":
      default:
        return this.#selectFailover(healthyProviders);
    }
  }

  /**
   * Select an API key for the given provider
   */
  selectKey(provider: NormalizedProvider, state: ProviderState): string | null {
    const keyStates = this.#keyStates.get(provider.name);
    if (!keyStates) return provider.apiKeys[0] ?? null;

    const now = Date.now();

    // Find an available key (healthy or cooldown expired)
    for (let i = 0; i < provider.apiKeys.length; i++) {
      const keyIndex = (state.currentKeyIndex + i) % provider.apiKeys.length;
      const keyState = keyStates[keyIndex];

      if (!keyState) continue;

      // Check if key is healthy or cooldown has expired
      if (keyState.healthy) {
        return provider.apiKeys[keyIndex] ?? null;
      }

      if (keyState.cooldownUntil && now >= keyState.cooldownUntil) {
        // Cooldown expired, reset key state
        keyState.healthy = true;
        keyState.cooldownUntil = undefined;
        state.failedKeys.delete(keyIndex);
        return provider.apiKeys[keyIndex] ?? null;
      }
    }

    return null;
  }

  /**
   * Report successful request
   */
  reportSuccess(providerName: string, keyIndex: number): void {
    const state = this.#providerStates.get(providerName);
    if (state) {
      state.requestCount++;
      state.healthy = true;
    }

    const keyStates = this.#keyStates.get(providerName);
    if (keyStates?.[keyIndex]) {
      keyStates[keyIndex].healthy = true;
      keyStates[keyIndex].lastUsed = Date.now();
    }
  }

  /**
   * Report error and potentially rotate key
   */
  reportError(providerName: string, keyIndex: number, error: ProxyError): void {
    const state = this.#providerStates.get(providerName);
    if (state) {
      state.errorCount++;
      state.lastError = error.message;
      state.lastErrorTime = Date.now();

      if (error.shouldRotateKey) {
        state.failedKeys.add(keyIndex);
        state.currentKeyIndex =
          (keyIndex + 1) % (this.#keyStates.get(providerName)?.length ?? 1);
      }

      // Mark provider unhealthy if all keys failed
      const keyStates = this.#keyStates.get(providerName);
      if (keyStates && state.failedKeys.size >= keyStates.length) {
        state.healthy = false;
      }
    }

    const keyStates = this.#keyStates.get(providerName);
    if (keyStates?.[keyIndex] && error.shouldRotateKey) {
      keyStates[keyIndex].healthy = false;
      keyStates[keyIndex].lastError = error.message;
      keyStates[keyIndex].lastErrorTime = Date.now();
      keyStates[keyIndex].cooldownUntil = Date.now() + this.#cooldownMs;
    }
  }

  /**
   * Get provider state
   */
  getProviderState(providerName: string): ProviderState | undefined {
    return this.#providerStates.get(providerName);
  }

  /**
   * Check if provider has at least one available key
   */
  #hasAvailableKey(provider: NormalizedProvider): boolean {
    const keyStates = this.#keyStates.get(provider.name);
    if (!keyStates) return true;

    const now = Date.now();
    return keyStates.some(
      (ks) => ks.healthy || (ks.cooldownUntil && now >= ks.cooldownUntil),
    );
  }

  /**
   * Try to recover a provider when all are unhealthy
   */
  #recoverProvider(providers: NormalizedProvider[]): NormalizedProvider | null {
    // Sort by priority, then by last error time (oldest first)
    const sorted = [...providers].sort((a, b) => {
      const stateA = this.#providerStates.get(a.name);
      const stateB = this.#providerStates.get(b.name);

      // Priority first
      const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (priorityA !== priorityB) return priorityA - priorityB;

      // Then by last error time
      const timeA = stateA?.lastErrorTime ?? 0;
      const timeB = stateB?.lastErrorTime ?? 0;
      return timeA - timeB;
    });

    // Reset the first provider's state and try again
    const provider = sorted[0];
    if (provider) {
      const state = this.#providerStates.get(provider.name);
      if (state) {
        state.healthy = true;
        state.failedKeys.clear();
        state.currentKeyIndex = 0;
      }

      const keyStates = this.#keyStates.get(provider.name);
      if (keyStates) {
        keyStates.forEach((ks) => {
          ks.healthy = true;
          ks.cooldownUntil = undefined;
        });
      }
    }

    return provider ?? null;
  }

  /**
   * Round-robin selection
   */
  #selectRoundRobin(providers: NormalizedProvider[]): NormalizedProvider {
    const provider = providers[this.#roundRobinIndex % providers.length];
    this.#roundRobinIndex++;
    return provider!;
  }

  /**
   * Random selection
   */
  #selectRandom(providers: NormalizedProvider[]): NormalizedProvider {
    const index = Math.floor(Math.random() * providers.length);
    return providers[index]!;
  }

  /**
   * Weighted selection based on provider weights
   */
  #selectWeighted(providers: NormalizedProvider[]): NormalizedProvider {
    const totalWeight = providers.reduce((sum, p) => sum + (p.weight ?? 1), 0);
    let random = Math.random() * totalWeight;

    for (const provider of providers) {
      random -= provider.weight ?? 1;
      if (random <= 0) return provider;
    }

    return providers[0]!;
  }

  /**
   * Failover selection (priority-based)
   */
  #selectFailover(providers: NormalizedProvider[]): NormalizedProvider {
    // Sort by priority (lower = higher priority)
    const sorted = [...providers].sort((a, b) => {
      const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
      return priorityA - priorityB;
    });

    return sorted[0]!;
  }

  /**
   * Reset all provider states
   */
  reset(): void {
    this.#providerStates.clear();
    this.#keyStates.clear();
    this.#roundRobinIndex = 0;
  }

  /**
   * Get statistics for all providers
   */
  getStats(): Record<
    string,
    { requests: number; errors: number; healthy: boolean }
  > {
    const stats: Record<
      string,
      { requests: number; errors: number; healthy: boolean }
    > = {};
    for (const [name, state] of this.#providerStates) {
      stats[name] = {
        requests: state.requestCount,
        errors: state.errorCount,
        healthy: state.healthy,
      };
    }
    return stats;
  }
}
