import React from "react";

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Plain delta string — e.g. "+6 pts this week" */
  delta?: React.ReactNode;
  deltaDirection?: "up" | "down";
  /** Small suffix beside the value — "%", "/mo", "regulars" */
  suffix?: React.ReactNode;
  className?: string;
}
export function Stat(props: StatProps): JSX.Element;
