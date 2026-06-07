import React from "react";

export interface SealMarkProps {
  size?: number;
  /** Custom top arc text. */
  topLine?: string;
  /** Custom bottom arc text. */
  bottomLine?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function SealMark(props: SealMarkProps): JSX.Element;
