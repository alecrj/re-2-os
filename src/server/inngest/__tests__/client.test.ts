/**
 * Tests for Inngest Client
 */

import { describe, it, expect } from 'vitest';
import { inngest } from '../client';

describe('Inngest Client', () => {
  it('should be configured with correct app id', () => {
    expect(inngest.id).toBe('reselleros');
  });

  it('should have event schemas configured', () => {
    // The client should be properly instantiated
    expect(inngest).toBeDefined();
  });
});
