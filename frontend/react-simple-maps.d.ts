declare module "react-simple-maps" {
  import type { ReactNode } from "react";

  export interface GeographyStyle {
    default?: React.CSSProperties;
    hover?: React.CSSProperties;
    pressed?: React.CSSProperties;
  }

  export interface GeographyProps {
    geography: { rsmKey: string; properties: Record<string, unknown> };
    style?: GeographyStyle;
    onClick?: () => void;
    tabIndex?: number;
    "aria-label"?: string;
  }

  export const Geography: (props: GeographyProps) => ReactNode;

  export interface GeographiesRenderArgs {
    geographies: Array<{ rsmKey: string; properties: Record<string, unknown> }>;
  }

  export const Geographies: (props: {
    geography: string | object;
    children: (arg: GeographiesRenderArgs) => ReactNode;
  }) => ReactNode;

  export const ZoomableGroup: (props: { children?: ReactNode }) => ReactNode;

  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    children?: ReactNode;
  }

  export const ComposableMap: (props: ComposableMapProps) => ReactNode;
}
