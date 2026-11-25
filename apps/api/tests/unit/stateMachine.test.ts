// describe groups tests, it defines one test, expect checks a result
import { describe, expect, it } from "vitest";
// The state machine map we want to protect
import { ALLOWED_TRANSITIONS } from "../../src/modules/tickets/ticket.service.js";

// The four statuses, written out so the tests fail if someone adds a status and forgets the rules
const ALL_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

// Group: rules of the ticket state machine
describe("ticket state machine", () => {
  // Every status must have an entry, even if its list is empty
  it("defines rules for every status", () => {
    // The map's keys must be exactly our statuses
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...ALL_STATUSES].sort());
  });

  // CLOSED is final: nothing may leave it
  it("treats CLOSED as final", () => {
    // No allowed moves from CLOSED
    expect(ALLOWED_TRANSITIONS.CLOSED).toEqual([]);
  });

  // A status moving to itself would be a pointless "change"
  it("never allows a status to move to itself", () => {
    // Check each status
    for (const status of ALL_STATUSES) {
      // Its own name must not be in its list
      expect(ALLOWED_TRANSITIONS[status]).not.toContain(status);
    }
  });

  // A typo like "RESOLVD" would silently create a dead rule
  it("only points to statuses that exist", () => {
    // Check every target of every status
    for (const status of ALL_STATUSES) {
      for (const target of ALLOWED_TRANSITIONS[status]) {
        // The target must be a real status
        expect(ALL_STATUSES).toContain(target);
      }
    }
  });

  // Every status must be reachable, otherwise it is dead code
  it("lets every status be reached starting from OPEN", () => {
    // Start with OPEN and keep following allowed moves
    const reached = new Set<string>(["OPEN"]);
    // The statuses still to explore
    const queue: string[] = ["OPEN"];
    // Breadth-first walk through the graph
    while (queue.length > 0) {
      // Take the next status
      const current = queue.shift() as (typeof ALL_STATUSES)[number];
      // Visit each status it can move to
      for (const next of ALLOWED_TRANSITIONS[current]) {
        // Only handle new ones
        if (!reached.has(next)) {
          // Remember it
          reached.add(next);
          // Explore from it later
          queue.push(next);
        }
      }
    }
    // Everything must have been reached
    expect([...reached].sort()).toEqual([...ALL_STATUSES].sort());
  });

  // The business rule: a resolved ticket may be reopened, a closed one may not
  it("allows reopening from RESOLVED but not from CLOSED", () => {
    // RESOLVED can go back to OPEN
    expect(ALLOWED_TRANSITIONS.RESOLVED).toContain("OPEN");
    // CLOSED cannot go anywhere
    expect(ALLOWED_TRANSITIONS.CLOSED).not.toContain("OPEN");
  });
});
