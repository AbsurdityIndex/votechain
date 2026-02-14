/**
 * Central source of truth for Playwright selectors targeting the POC harness routes.
 *
 * Each VoteChain harness nav pill MUST expose both of the following stable hooks:
 *   1. `data-testid="nav-pill-{route}"` — canonical test id consumed by getRoutePillTestId.
 *   2. `data-client-nav="{route}"` — semantic attribute used by the modal launcher grid.
 * Buttons still shipping `data-client-key` are treated as legacy fallbacks and should be
 * upgraded. Tests reference the selectors below directly so any divergence causes a hard
 * failure instead of silently matching the wrong element.
 *
 * Likewise, every primary content region needs a `data-route-sentinel="{route}"` attribute
 * on the main landmark so the e2e flow can assert the correct page rendered after nav
 * changes. Role- and heading-based selectors are documented as an escape hatch for triage,
 * but callers are expected to prefer the sentinel hook to fail closed whenever it disappears.
 *
 * The `validateRouteSpecs` helper enforces these invariants (matching route-aligned attribute
 * values and canonical selectors) at module evaluation time so spec authors receive a hard
 * throw whenever a required data hook goes missing or drifts away from the documented contract.
 * Fallback selectors are also captured here so accessibility-first queries can pair landmarks
 * and headings when sentinels are temporarily unavailable. Nav labels/index metadata is exported
 * so specs can reference the same canonical ordering when generating harness artifacts.
 */

export type HarnessRoute = 'verify' | 'lookup' | 'dashboard' | 'monitor' | 'trust';

type NonEmptyArray<TValue extends string> = readonly [TValue, ...TValue[]];

interface PillLocatorSpec {
  /**
   * CSS selectors ordered by preference. The first entry is the required `data-testid`
   * hook, followed by semantic attributes and final legacy fallbacks.
   */
  readonly selectors: NonEmptyArray<string>;
  /** Canonical `data-testid` value (nav-pill-{route}). */
  readonly testId: string;
  /** Required semantic data attribute applied to pill buttons. */
  readonly dataAttr: {
    readonly name: 'data-client-nav';
    readonly value: string;
  };
}

interface SentinelLocatorSpec {
  /** Fully qualified CSS selector for the sentinel attribute. */
  readonly selector: string;
  readonly dataAttr: {
    readonly name: 'data-route-sentinel';
    readonly value: string;
  };
}

interface HeadingFallback {
  readonly id: string;
  readonly text: string;
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  /** CSS selector shortcut for heading queries. */
  readonly selector: string;
}

export interface RouteSpec {
  readonly route: HarnessRoute;
  readonly label: string;
  /**
   * Zero-based index for the pill, matching the order in PocHarnessShell.clients.
   * Use `navOrder` when reporting to humans (1-indexed).
   */
  readonly navIndex: number;
  readonly navOrder: number;
  readonly pill: PillLocatorSpec;
  readonly sentinel: SentinelLocatorSpec;
  readonly fallback: {
    /** Landmark role exposed by the route container (currently `main`). */
    readonly regionRole: 'main' | 'region';
    /** Selector that can be paired with the role for emergency queries. */
    readonly regionSelector: string;
    readonly heading: HeadingFallback;
  };
}

function formatAttrSelector(attrName: string, attrValue: string): string {
  return `[${attrName}="${attrValue}"]`;
}

function assertRouteSpec(condition: boolean, spec: RouteSpec, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[harness-selectors:${spec.route}] ${message}`);
  }
}

function validateRouteSpecs<TSpecs extends readonly RouteSpec[]>(specs: TSpecs): TSpecs {
  specs.forEach((spec) => {
    const expectedTestId = `nav-pill-${spec.route}`;
    assertRouteSpec(
      spec.pill.testId === expectedTestId,
      spec,
      `Nav pill test id must equal "${expectedTestId}", received "${spec.pill.testId}".`,
    );

    const canonicalTestIdSelector = formatAttrSelector('data-testid', expectedTestId);
    assertRouteSpec(
      spec.pill.selectors[0] === canonicalTestIdSelector,
      spec,
      `First pill selector must be ${canonicalTestIdSelector} so failures are immediate.`,
    );

    assertRouteSpec(
      spec.pill.dataAttr.name === 'data-client-nav',
      spec,
      'Nav pills must expose the data-client-nav attribute for semantic routing.',
    );
    assertRouteSpec(
      spec.pill.dataAttr.value === spec.route,
      spec,
      `data-client-nav must equal route "${spec.route}", got "${spec.pill.dataAttr.value}".`,
    );

    const requiredSemanticSelector = formatAttrSelector(
      spec.pill.dataAttr.name,
      spec.pill.dataAttr.value,
    );
    assertRouteSpec(
      spec.pill.selectors.length >= 2,
      spec,
      'Pill selectors must include both the canonical test id and semantic data-client-nav hooks.',
    );
    assertRouteSpec(
      spec.pill.selectors.includes(requiredSemanticSelector),
      spec,
      `Pill selectors must include ${requiredSemanticSelector} so tests fail when it disappears.`,
    );

    assertRouteSpec(
      spec.sentinel.dataAttr.name === 'data-route-sentinel',
      spec,
      'Primary content regions must expose data-route-sentinel attributes.',
    );
    assertRouteSpec(
      spec.sentinel.dataAttr.value === spec.route,
      spec,
      `data-route-sentinel must equal route "${spec.route}", got "${spec.sentinel.dataAttr.value}".`,
    );

    const canonicalSentinelSelector = formatAttrSelector(
      spec.sentinel.dataAttr.name,
      spec.sentinel.dataAttr.value,
    );
    assertRouteSpec(
      spec.sentinel.selector === canonicalSentinelSelector,
      spec,
      `Sentinel selector must be ${canonicalSentinelSelector} to fail closed when removed.`,
    );

    assertRouteSpec(
      Number.isInteger(spec.navIndex) && spec.navIndex >= 0,
      spec,
      'Nav index must be a non-negative integer.',
    );
    assertRouteSpec(
      spec.navOrder === spec.navIndex + 1,
      spec,
      'Nav order must be the 1-indexed version of navIndex.',
    );
    assertRouteSpec(
      spec.label.trim().length > 0,
      spec,
      'Nav labels are required for artifact exports.',
    );

    assertRouteSpec(
      spec.fallback.regionSelector.trim().length > 0,
      spec,
      'Fallback region selectors must be provided for accessibility triage.',
    );
    assertRouteSpec(
      spec.fallback.heading.id.trim().length > 0,
      spec,
      'Fallback headings require ids to anchor aria queries.',
    );
    assertRouteSpec(
      spec.fallback.heading.selector.trim().length > 0,
      spec,
      'Fallback headings must expose a stable CSS selector.',
    );
    assertRouteSpec(
      spec.fallback.heading.text.trim().length > 0,
      spec,
      'Fallback headings must include the rendered text for sanity checks.',
    );
    assertRouteSpec(
      spec.fallback.heading.level >= 1 && spec.fallback.heading.level <= 6,
      spec,
      'Fallback heading level must be between 1 and 6.',
    );
  });

  return specs;
}

const hasOwn = Object.prototype.hasOwnProperty;

const ROUTE_SPECS = validateRouteSpecs([
  {
    route: 'verify',
    label: 'Receipt Verification',
    navIndex: 4,
    navOrder: 5,
    pill: {
      testId: 'nav-pill-verify',
      dataAttr: {
        name: 'data-client-nav',
        value: 'verify',
      },
      selectors: [
        '[data-testid="nav-pill-verify"]',
        '[data-client-nav="verify"]',
        '[data-client-key="verify"]',
      ] as const,
    },
    sentinel: {
      selector: '[data-route-sentinel="verify"]',
      dataAttr: {
        name: 'data-route-sentinel',
        value: 'verify',
      },
    },
    fallback: {
      regionRole: 'main',
      regionSelector: '#poc-verify-main',
      heading: {
        id: 'poc-verify-title',
        selector: '#poc-verify-title',
        text: 'Verify your cast receipt end-to-end',
        level: 1,
      },
    },
  },
  {
    route: 'lookup',
    label: 'Board Audit',
    navIndex: 3,
    navOrder: 4,
    pill: {
      testId: 'nav-pill-lookup',
      dataAttr: {
        name: 'data-client-nav',
        value: 'lookup',
      },
      selectors: [
        '[data-testid="nav-pill-lookup"]',
        '[data-client-nav="lookup"]',
        '[data-client-key="lookup"]',
      ] as const,
    },
    sentinel: {
      selector: '[data-route-sentinel="lookup"]',
      dataAttr: {
        name: 'data-route-sentinel',
        value: 'lookup',
      },
    },
    fallback: {
      regionRole: 'main',
      regionSelector: '#poc-lookup-main',
      heading: {
        id: 'poc-lookup-title',
        selector: '#poc-lookup-title',
        text: 'Audit the bulletin board and anchors by ballot hash',
        level: 1,
      },
    },
  },
  {
    route: 'dashboard',
    label: 'Reveal & Tally',
    navIndex: 6,
    navOrder: 7,
    pill: {
      testId: 'nav-pill-dashboard',
      dataAttr: {
        name: 'data-client-nav',
        value: 'dashboard',
      },
      selectors: [
        '[data-testid="nav-pill-dashboard"]',
        '[data-client-nav="dashboard"]',
        '[data-client-key="dashboard"]',
      ] as const,
    },
    sentinel: {
      selector: '[data-route-sentinel="dashboard"]',
      dataAttr: {
        name: 'data-route-sentinel',
        value: 'dashboard',
      },
    },
    fallback: {
      regionRole: 'main',
      regionSelector: '#poc-dashboard-main',
      heading: {
        id: 'poc-dashboard-title',
        selector: '#poc-dashboard-title',
        text: 'Publish the tally and oversee every election control',
        level: 1,
      },
    },
  },
  {
    route: 'monitor',
    label: 'Operations Monitor',
    navIndex: 5,
    navOrder: 6,
    pill: {
      testId: 'nav-pill-monitor',
      dataAttr: {
        name: 'data-client-nav',
        value: 'monitor',
      },
      selectors: [
        '[data-testid="nav-pill-monitor"]',
        '[data-client-nav="monitor"]',
        '[data-client-key="monitor"]',
      ] as const,
    },
    sentinel: {
      selector: '[data-route-sentinel="monitor"]',
      dataAttr: {
        name: 'data-route-sentinel',
        value: 'monitor',
      },
    },
    fallback: {
      regionRole: 'main',
      regionSelector: '#poc-monitor-main',
      heading: {
        id: 'poc-monitor-title',
        selector: '#poc-monitor-title',
        text: 'Monitor node health, drift alerts, and fraud flags',
        level: 1,
      },
    },
  },
  {
    route: 'trust',
    label: 'Trust Portal',
    navIndex: 7,
    navOrder: 8,
    pill: {
      testId: 'nav-pill-trust',
      dataAttr: {
        name: 'data-client-nav',
        value: 'trust',
      },
      selectors: [
        '[data-testid="nav-pill-trust"]',
        '[data-client-nav="trust"]',
        '[data-client-key="trust"]',
      ] as const,
    },
    sentinel: {
      selector: '[data-route-sentinel="trust"]',
      dataAttr: {
        name: 'data-route-sentinel',
        value: 'trust',
      },
    },
    fallback: {
      regionRole: 'main',
      regionSelector: '#poc-trust-main',
      heading: {
        id: 'poc-trust-title',
        selector: '#poc-trust-title',
        text: 'Verify manifests, STHs, and ledger proofs independently',
        level: 1,
      },
    },
  },
] as const satisfies readonly RouteSpec[]);

const ROUTE_SPEC_LOOKUP: Record<HarnessRoute, RouteSpec> = ROUTE_SPECS.reduce(
  (acc, spec) => {
    acc[spec.route] = spec;
    return acc;
  },
  {} as Record<HarnessRoute, RouteSpec>,
);

export const HARNESS_ROUTES = ROUTE_SPECS.map(
  (spec) => spec.route,
) as readonly HarnessRoute[];

export type HarnessRouteMetadata = Pick<RouteSpec, 'route' | 'label' | 'navIndex' | 'navOrder'>;

/**
 * Canonical label/index metadata derived from the RouteSpec table.
 * Use this when generating reports to ensure nav ordering stays in sync with the UI.
 */
export const HARNESS_ROUTE_METADATA: readonly HarnessRouteMetadata[] = ROUTE_SPECS.map(
  ({ route, label, navIndex, navOrder }) => ({
    route,
    label,
    navIndex,
    navOrder,
  }),
);

function toRoute(route: HarnessRoute | string): HarnessRoute {
  if (hasOwn.call(ROUTE_SPEC_LOOKUP, route)) {
    return route as HarnessRoute;
  }
  const known = HARNESS_ROUTES.join(', ');
  throw new Error(
    `Unknown harness route "${route}". Expected one of: ${known}. Update tests/playwright/selectors.ts if a new route is introduced.`,
  );
}

export function getRouteSpec(route: HarnessRoute | string): RouteSpec {
  const normalized = toRoute(route);
  return ROUTE_SPEC_LOOKUP[normalized];
}

/** Canonical `data-testid` hook that all pills are required to expose. */
export function getRoutePillTestId(route: HarnessRoute | string): string {
  return getRouteSpec(route).pill.testId;
}

/** Required semantic data attribute for nav pills. */
export function getRoutePillDataAttribute(
  route: HarnessRoute | string,
): PillLocatorSpec['dataAttr'] {
  return getRouteSpec(route).pill.dataAttr;
}

/**
 * Selector for the nav pill using the canonical test id.
 * Consumers should expect this to break loudly when teams forget the data hook.
 */
export function getPrimaryPillSelector(route: HarnessRoute | string): string {
  const spec = getRouteSpec(route);
  return spec.pill.selectors[0];
}

/** Ordered selector list for the nav pill, including semantic and legacy hooks. */
export function getPillSelectors(route: HarnessRoute | string): NonEmptyArray<string> {
  return getRouteSpec(route).pill.selectors;
}

/** Selector for the sentinel attribute that guards the rendered route. */
export function getRouteSentinelSelector(route: HarnessRoute | string): string {
  return getRouteSpec(route).sentinel.selector;
}

/** Required sentinel attribute enforced on each route's primary region. */
export function getRouteSentinelDataAttribute(
  route: HarnessRoute | string,
): SentinelLocatorSpec['dataAttr'] {
  return getRouteSpec(route).sentinel.dataAttr;
}

/**
 * Symbolic metadata for nav order validation or reporting (1-indexed display order).
 */
export function getRouteNavOrder(route: HarnessRoute | string): number {
  return getRouteSpec(route).navOrder;
}

/** Zero-based index so specs can assert pills render in the expected position. */
export function getRouteNavIndex(route: HarnessRoute | string): number {
  return getRouteSpec(route).navIndex;
}

export function getRouteLabel(route: HarnessRoute | string): string {
  return getRouteSpec(route).label;
}

/** Structured label/index metadata for reporting flows. */
export function getRouteMetadata(route: HarnessRoute | string): HarnessRouteMetadata {
  const spec = getRouteSpec(route);
  return {
    route: spec.route,
    label: spec.label,
    navIndex: spec.navIndex,
    navOrder: spec.navOrder,
  };
}

/**
 * Fallback selectors anchored on accessible roles and headings.
 * Tests should log when resorting to these to highlight missing sentinels.
 */
export function getRouteFallbacks(route: HarnessRoute | string): RouteSpec['fallback'] {
  return getRouteSpec(route).fallback;
}
