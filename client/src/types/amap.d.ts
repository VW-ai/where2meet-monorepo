/**
 * AMap (Gaode) JS API 2.0 types for the China meeting map.
 * The package covers the core API; the controls below are plugins it leaves out.
 */

/// <reference types="@amap/amap-jsapi-types" />

declare namespace AMap {
  /** Scale bar control (plugin "AMap.Scale") */
  class Scale extends Control {
    constructor(opts?: Partial<ControlConfig>);
  }

  /** Zoom buttons control (plugin "AMap.ToolBar") */
  class ToolBar extends Control {
    constructor(opts?: Partial<ControlConfig>);
  }
}

interface Window {
  /** Read by the AMap loader; see src/shared/lib/amap/loader.ts */
  _AMapSecurityConfig?: { serviceHost?: string; securityJsCode?: string };
}
