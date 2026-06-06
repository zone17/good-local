import React from "react";

export interface ProgressMeterProps {
  count: number;
  total?: number;
  label?: React.ReactNode;
  /** Override "{n} to go" copy. */
  remainingLabel?: React.ReactNode;
  tone?: "pine" | "stamp" | "ochre" | "river";
  size?: "sm" | "md" | "lg";
  className?: string;
}
export function ProgressMeter(props: ProgressMeterProps): JSX.Element;
