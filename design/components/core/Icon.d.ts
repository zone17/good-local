import React from "react";

export type IconName =
  | "arrow-left" | "arrow-right" | "chevron-right" | "chevron-down" | "x" | "menu"
  | "check" | "plus" | "minus" | "info" | "alert"
  | "qr" | "wallet" | "map-pin" | "compass" | "calendar" | "clock"
  | "star" | "heart" | "coffee" | "store" | "leaf"
  | "user" | "users" | "bell" | "settings" | "trending-up" | "search"
  | "edit" | "trash" | "share" | "stamp";

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon(props: IconProps): JSX.Element;
