import React from "react";

export type TabItem = string | { value: string; label: React.ReactNode };
export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}
export function Tabs(props: TabsProps): JSX.Element;
